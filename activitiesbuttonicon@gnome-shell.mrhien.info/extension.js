//
//  Copyright (c) 2011  Finnbarr P. Murphy.  All rights reserved.
//  Copyright (c) 2012  Phan Quoc Hien.  All rights reserved.
//

const Clutter = imports.gi.Clutter;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const Layout = imports.ui.layout;
const PanelMenu = imports.ui.panelMenu;
const Main = imports.ui.main;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Signals = imports.signals;


// ------------ change to suit -----------
const ACTIVITIES_BUTTON_ICON_SIZE    = 24;
const ACTIVITIES_BUTTON_ICON_NAME    = 'fedora-logo-icon';  


function ActivitiesButtonIcon() {
    this._init.apply(this, arguments);
}

// ----- most of this code came straight from panel.js
ActivitiesButtonIcon.prototype = {
    __proto__: PanelMenu.Button.prototype,

    _init: function() {
        PanelMenu.Button.prototype._init.call(this, 0.0);

        this.actor.name = 'panelActivities';

        let container = new Shell.GenericContainer();
        container.connect('get-preferred-width', Lang.bind(this, this._containerGetPreferredWidth));
        container.connect('get-preferred-height', Lang.bind(this, this._containerGetPreferredHeight));
        container.connect('allocate', Lang.bind(this, this._containerAllocate));
        this.actor.add_actor(container);

        // ---------------- icon code -----------------
        this._iconBox = new St.Bin({ width: ACTIVITIES_BUTTON_ICON_SIZE,
                                     height: ACTIVITIES_BUTTON_ICON_SIZE,
                                     x_fill: true,
                                     y_fill: true });
        this._logo = new St.Icon({ icon_type: St.IconType.FULLCOLOR, 
                                   icon_size: ACTIVITIES_BUTTON_ICON_SIZE, 
                                   icon_name: ACTIVITIES_BUTTON_ICON_NAME });
        this._iconBox.child = this._logo;
        container.add_actor(this._iconBox);
        
        this._hotCorner = new Layout.HotCorner();
        container.add_actor(this._hotCorner.actor);

        // Hack up our menu...
        this.menu.open = Lang.bind(this, this._onMenuOpenRequest);
        this.menu.close = Lang.bind(this, this._onMenuCloseRequest);
        this.menu.toggle = Lang.bind(this, this._onMenuToggleRequest);

        this.actor.connect('captured-event', Lang.bind(this, this._onCapturedEvent));
        this.actor.connect_after('button-release-event', Lang.bind(this, this._onButtonRelease));
        this.actor.connect_after('key-release-event', Lang.bind(this, this._onKeyRelease));

        Main.overview.connect('showing', Lang.bind(this, function() {
        this.actor.add_style_pseudo_class('overview');
        this._escapeMenuGrab();
        this.actor.add_accessible_state (Atk.StateType.CHECKED);
        }));
        Main.overview.connect('hiding', Lang.bind(this, function() {
        this.actor.remove_style_pseudo_class('overview');
        this._escapeMenuGrab();
        this.actor.remove_accessible_state (Atk.StateType.CHECKED);
        }));

        this._xdndTimeOut = 0;
    },

    _containerGetPreferredWidth: function(actor, forHeight, alloc) {
        [alloc.min_size, alloc.natural_size] = this._iconBox.get_preferred_width(forHeight);
    },

    _containerGetPreferredHeight: function(actor, forWidth, alloc) {
        [alloc.min_size, alloc.natural_size] = this._iconBox.get_preferred_height(forWidth);
    },

     _containerAllocate: function(actor, box, flags) {
        this._iconBox.allocate(box, flags);

        // The hot corner needs to be outside any padding/alignment
        // that has been imposed on us
        let primary = Main.layoutManager.primaryMonitor;
        let hotBox = new Clutter.ActorBox();
        let ok, x, y;
        if (actor.get_text_direction() == Clutter.TextDirection.LTR) {
            [ok, x, y] = actor.transform_stage_point(primary.x, primary.y)
        } else {
            [ok, x, y] = actor.transform_stage_point(primary.x + primary.width, primary.y);
            // hotCorner.actor has northeast gravity, so we don't need
            // to adjust x for its width
        }

        hotBox.x1 = Math.round(x);
        hotBox.x2 = hotBox.x1 + this._hotCorner.actor.width;
        hotBox.y1 = Math.round(y);
        hotBox.y2 = hotBox.y1 + this._hotCorner.actor.height;
        this._hotCorner.actor.allocate(hotBox, flags);
    },


    handleDragOver: function(source, actor, x, y, time) {
        if (source != Main.xdndHandler)
            return DND.DragMotionResult.CONTINUE;

        if (this._xdndTimeOut != 0)
            Mainloop.source_remove(this._xdndTimeOut);
        this._xdndTimeOut = Mainloop.timeout_add(BUTTON_DND_ACTIVATION_TIMEOUT,
                                                 Lang.bind(this, this._xdndShowOverview, actor));

        return DND.DragMotionResult.CONTINUE;
    },

    _escapeMenuGrab: function() {
        if (this.menu.isOpen)
            this.menu.close();
    },

    _onCapturedEvent: function(actor, event) {
        if (event.type() == Clutter.EventType.BUTTON_PRESS) {
            if (!this._hotCorner.shouldToggleOverviewOnClick())
                return true;
        }
        return false;
    },

    _onMenuOpenRequest: function() {
        this.menu.isOpen = true;
        this.menu.emit('open-state-changed', true);
    },

    _onMenuCloseRequest: function() {
        this.menu.isOpen = false;
        this.menu.emit('open-state-changed', false);
    },

    _onMenuToggleRequest: function() {
        this.menu.isOpen = !this.menu.isOpen;
        this.menu.emit('open-state-changed', this.menu.isOpen);
    },

    _onButtonRelease: function() {
        if (this.menu.isOpen) {
            this.menu.close();
            Main.overview.toggle();
        }
    },

    _onKeyRelease: function(actor, event) {
        let symbol = event.get_key_symbol();
        if (symbol == Clutter.KEY_Return || symbol == Clutter.KEY_space) {
            if (this.menu.isOpen)
                this.menu.close();
            Main.overview.toggle();
        }
    },

    _xdndShowOverview: function(actor) {
        let [x, y, mask] = global.get_pointer();
        let pickedActor = global.stage.get_actor_at_pos(Clutter.PickMode.REACTIVE, x, y);

        if (pickedActor == this.actor) {
            if (!Main.overview.visible && !Main.overview.animationInProgress) {
                Main.overview.showTemporarily();
                Main.overview.beginItemDrag(actor);
            }
        }

        Mainloop.source_remove(this._xdndTimeOut);
        this._xdndTimeOut = 0;
    }

};


function ChangeActivitiesButton() {
    this._init();
}


ChangeActivitiesButton.prototype = {

    _init: function() {
        this._myActivitiesButton = new ActivitiesButtonIcon();
        this._orgActivitiesButton = Main.panel._activitiesButton;
    },

    enable: function() {
        Main.panel._leftBox.remove_actor(this._orgActivitiesButton.actor);
        Main.panel._leftBox.insert_child_at_index(this._myActivitiesButton.actor, 0);
    },

    disable: function() {
        Main.panel._leftBox.remove_actor(this._myActivitiesButton.actor);
        Main.panel._leftBox.insert_child_at_index(this._orgActivitiesButton.actor, 0);
    }
};


function init(extensionMeta) {
    return new ChangeActivitiesButton();
}
