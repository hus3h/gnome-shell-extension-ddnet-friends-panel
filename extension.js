const Main = imports.ui.main;
const { St, GLib } = imports.gi;
const GObject = imports.gi.GObject;
const Gio = imports.gi.Gio;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const Clutter = imports.gi.Clutter;
const Soup = imports.gi.Soup;
const Gtk = imports.gi.Gtk;
const Mainloop = imports.mainloop;
const ByteArray = imports.byteArray;
const ExtensionUtils = imports.misc.extensionUtils;
const Extension = ExtensionUtils.getCurrentExtension();
const ExtensionSettings = Extension.imports.settings;
const Util = imports.misc.util;

const MULTIPLE_SERVERS_TEXT = "(Multiple servers)";
const DEFAULT_ENDPOINT_URL = "https://master1.ddnet.tw/ddnet/15/servers.json";
const INFO_ENDPOINT_URL = "https://info2.ddnet.tw/info";

const RELOAD_ICON_TEXT = "⟳";
const INITIAL_RETRY_INTERVAL_SECONDS = 2;

var officialServersList = [];
let friendsMenu;

let prefs;

const DDNetFriendsMenu = GObject.registerClass(
    class DDNetFriendsMenu extends PanelMenu.Button {
        _init() {
            super._init(0);
            this._httpSession = Soup.Session.new();
            let indicatorBox = new St.BoxLayout();
            let icon = new St.Icon({
                gicon: Gio.icon_new_for_string(Me.dir.get_path() + '/DDNet.png'),
                style_class: 'system-status-icon',
            });
            this.friendsList = [];
            this.onlineFriendsCountText = new St.Label({ text: RELOAD_ICON_TEXT, y_align: Clutter.ActorAlign.CENTER })
            indicatorBox.add_child(icon);
            indicatorBox.add_child(this.onlineFriendsCountText);
            this.add_child(indicatorBox);

            this.playersListView = new PopupMenu.PopupMenuSection();
            this.playersListContainer = new PopupMenu.PopupMenuSection();
            let scrollView = new St.ScrollView({ overlay_scrollbars: true, hscrollbar_policy: Gtk.PolicyType.NEVER });
            scrollView.add_actor(this.playersListView.actor);
            this.playersListContainer.actor.add_actor(scrollView);
            this.menu.addMenuItem(this.playersListContainer);

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            this.extraButtonsView = new PopupMenu.PopupMenuSection();
            this.extraButtonsView.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            this.updateButton = new PopupMenu.PopupMenuItem("Update");
            const updateButtonContainer = new PopupMenu.PopupMenuSection();
            updateButtonContainer.actor.add_actor(this.updateButton.actor);
            this.extraButtonsView.addMenuItem(updateButtonContainer);
            this.updateButton.connect('activate', () => { this.updateList(); });
            this.updateButton.actor.reactive = false;


            const settingsButton = new PopupMenu.PopupMenuItem("Settings");
            settingsButton.connect('activate', () => {
                ExtensionUtils.openPrefs()
            });
            this.extraButtonsView.addMenuItem(settingsButton);

            const playButton = new PopupMenu.PopupMenuItem("Play");
            playButton.connect('activate', () => {
                GLib.spawn_command_line_async(getSettingsJoinCommand());
            });
            this.extraButtonsView.addMenuItem(playButton);
            this.menu.addMenuItem(this.extraButtonsView);

            this.menu.connect('open-state-changed', this.onMenuOpened.bind(this));

            this.tryStoreOfficialServersListThenUpdate();
            // this.updateList();
        }
        updateList() {
            if (!this.canUpdate) return;
            this.canUpdate = false;
            // const oldText = this.updateButton.label.text;
            const oldText = "Update";
            this.updateButton.label.set_text("Updating...");
            this.updateButton.actor.reactive = false;
            this.update(() => {
                this.updateButton.actor.reactive = true;
                this.updateButton.label.set_text(oldText);
                this.canUpdate = true;
            });
            return true;
        }
        addMenuError(text) {
            this.playersListView.removeAll();
            this.playersListView.addMenuItem(new PopupMenu.PopupMenuItem(text, { "reactive": false, "can_focus": false }));
            this.onlineFriendsCountText.set_text(RELOAD_ICON_TEXT);
        }
        update(callback) {
            this.clearTimeouts();
            this.friendsList = [];
            const file = getConfigFile();
            let endpointURL = null;
            if (file) {
                try {
                    var [ok, contents, _] = file.load_contents(null);
                    if (ok) {
                        const lines = ByteArray.toString(contents).split("\n");
                        for (var i = 0; i < lines.length; i++) {
                            if (lines[i].search("add_friend") !== -1) {
                                const match = lines[i].match(/(?<=add_friend "(.*)" \".*\")/);
                                if (match && match.length > 1)
                                    this.friendsList.push(new DDNetPlayer(match[1]));
                            }
                            else if (lines[i].search("br_cached_best_serverinfo_url") !== -1) {
                                const match = lines[i].match(/\"(.*)\"/);
                                if (match.length > 1)
                                    endpointURL = match[1];
                            }
                        }
                    }
                } catch (e) {
                    this.addMenuError("Error reading settings_ddnet.cfg file");
                    logError(e);
                    if (callback) callback();
                    return;
                }
            } else {
                this.addMenuError("Cannot find settings_ddnet.cnf, please select the location manually in the extension settings");
                if (callback) callback();
                return;
            }
            if (this.friendsList.length > 0) {
                if (endpointURL === null)
                    endpointURL = DEFAULT_ENDPOINT_URL;
                load_json_async(this._httpSession, endpointURL, (data) => {
                    try {
                        this.playersListView.removeAll();
                        for (var i = 0; i < data.servers.length; i++) {
                            if (!data.servers[i].info.clients)
                                continue;
                            for (var j = 0; j < data.servers[i].info.clients.length; j++) {
                                for (var k = 0; k < this.friendsList.length; k++) {
                                    if (this.friendsList[k].name === data.servers[i].info.clients[j].name.toString()) {
                                        this.friendsList[k].addActiveServer(new DDNetServer(data.servers[i]));
                                    }
                                }
                            }
                        }
                        let onlineFriendsCount = 0;
                        for (var i = 0; i < this.friendsList.length; i++) {
                            if (this.friendsList[i].isActive()) {
                                if (onlineFriendsCount === 0) {
                                    this.playersListView.addMenuItem(new PlayersListHead());
                                    this.playersListView.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
                                }
                                onlineFriendsCount++;
                                this.playersListView.addMenuItem(new PlayerMenuItem(this.friendsList[i]));
                            }
                        }
                        if (onlineFriendsCount === 0)
                            this.addMenuError("No friends online");
                        this.onlineFriendsCountText.set_text(onlineFriendsCount.toString());
                    } catch (e) {
                        this.addMenuError("Error loading or parsing servers list");
                    }
                    if (callback) callback();
                    this.startUpdateTimeout();
                }, (e) => {
                    this.addMenuError("An error occured when making the HTTP request");
                    if (callback) callback();
                    this.startUpdateTimeout(INITIAL_RETRY_INTERVAL_SECONDS);
                });
            }
            else {
                this.addMenuError("You did not add any friends");
                if (callback) callback();
                this.startUpdateTimeout();
            }
        }
        onMenuOpened() {
            if (this.menu.isOpen)
                this.updateList();
        }
        startUpdateTimeout(seconds = null) {
            this.clearTimeouts();
            this.timeout = Mainloop.timeout_add_seconds(seconds === null ? prefs.refreshInterval.get() : seconds, () => {
                this.updateList();
            });
        }
        clearTimeouts() {
            if (this.timeout) Mainloop.source_remove(this.timeout);
            if (this.initialRetryTimeout) Mainloop.source_remove(this.initialRetryTimeout);
        }
        tryStoreOfficialServersListThenUpdate(timeoutSeconds = 0) {
            this.clearTimeouts();
            this.initialRetryTimeout = Mainloop.timeout_add_seconds(timeoutSeconds, () => { this.storeOfficialServersListThenUpdate(); });
        }
        storeOfficialServersListThenUpdate() {
            const serverTypes = ["servers", "servers-kog"];
            load_json_async(this._httpSession, INFO_ENDPOINT_URL, (data) => {
                try {
                    for (var serverTypeIndex = 0; serverTypeIndex < serverTypes.length; serverTypeIndex++) {
                        const serverType = serverTypes[serverTypeIndex];
                        for (var i = 0; i < data[serverType].length; i++) {
                            for (var group in data[serverType][i].servers) {
                                if (data[serverType][i].servers[group] === null) continue;
                                for (var j = 0; j < data[serverType][i].servers[group].length; j++) {
                                    officialServersList.push(data[serverType][i].servers[group][j].split(":")[0]);
                                }
                            }
                        }
                    }
                    officialServersList = [...new Set(officialServersList)]; // array unique
                    this.canUpdate = true;
                    this.updateList();
                } catch (e) {
                    this.addMenuError("Failed to parse servers info, retrying...");
                    this.tryStoreOfficialServersListThenUpdate(INITIAL_RETRY_INTERVAL_SECONDS);
                }
            }, (e) => {
                this.addMenuError("Failed to parse servers info, retrying...");
                this.tryStoreOfficialServersListThenUpdate(INITIAL_RETRY_INTERVAL_SECONDS);
            });
        }
    }
);

class DDNetPlayer {
    constructor(name) {
        this.name = name;
        this.activeServers = [];
    }
    addActiveServer(server) {
        this.activeServers.push(server);
    }
    isActive() {
        return this.activeServers.length > 0;
    }
    getJoinCommand() {
        if (this.activeServers.length === 1)
            return this.activeServers[0].getJoinCommand();
        else
            return getSettingsJoinCommand();
    }
}

class DDNetServer {
    constructor(data) {
        this.data = data;
    }
    getMapName() {
        return this.data.info.map.name + " (" + this.data.info.clients.length + "/" + this.data.info.max_players + ")";
    }
    getCleanServerText() {
        return this.data.info.name.replace(/\[.*?\]/g, "").replace(/\s+/g, " ").trim();
    }
    getServerText() {
        return this.isVerified() ? this.getCleanServerText() : this.data.info.name;
    }
    getJoinURL() {
        return this.data.addresses[this.data.addresses.length - 1].split("//")[1];
    }
    getJoinCommand() {
        return getSettingsJoinCommand() + " 'connect " + this.getJoinURL() + "'";
    }
    isVerified() {
        return officialServersList.indexOf(this.getJoinURL().split(":")[0]) !== -1;
    }
}

const PlayerMenuItem = GObject.registerClass(
    class PlayerMenuItem extends PopupMenu.PopupBaseMenuItem {
        _init(player) {
            super._init();
            const layout = new St.BoxLayout();
            const col1 = new St.Label({ style_class: "playerName", text: player.name });
            const col2 = new St.Label({ style_class: "officialServer", text: (player.activeServers.length > 1 ? "" : (player.activeServers[0].isVerified() ? "🗸" : "?")) });
            const col3 = new St.Label({ style_class: "serverName", text: (player.activeServers.length > 1 ? MULTIPLE_SERVERS_TEXT : player.activeServers[0].getServerText()) });
            const col4 = new St.Label({ style_class: "mapName", text: (player.activeServers.length > 1 ? "-" : player.activeServers[0].getMapName()) });
            layout.add(col1);
            layout.add(col2);
            layout.add(col3);
            layout.add(col4);
            this.add_actor(layout);
            this.connect('activate', () => {
                GLib.spawn_command_line_async(player.getJoinCommand());
            });
        }
    }
);

const PlayersListHead = GObject.registerClass(
    class PlayersListHead extends PopupMenu.PopupBaseMenuItem {
        _init(player) {
            super._init({ "reactive": false, "can_focus": false });
            const layout = new St.BoxLayout();
            const col1 = new St.Label({ style_class: "playerName", text: "Player" });
            const col2 = new St.Label({ style_class: "officialServer", text: "" });
            const col3 = new St.Label({ style_class: "serverName", text: "Server" });
            const col4 = new St.Label({ style_class: "mapName", text: "Map" });
            layout.add(col1);
            layout.add(col2);
            layout.add(col3);
            layout.add(col4);
            this.add_actor(layout);
        }
    }
);

function getSettingsJoinCommand() {
    const value = prefs.joinCommand.get().trim().replace("~", GLib.get_home_dir());
    return !value ? "DDNet" : value;
}

function getConfigFile() {
    let file = null;
    let settingsPath = prefs.configPath.get().trim();
    if (!settingsPath) {
        const homeDir = GLib.get_home_dir();
        file = Gio.file_new_for_path(homeDir + "/.teeworlds/settings_ddnet.cfg");
        if (!file.query_exists(null)) {
            file = Gio.file_new_for_path(homeDir + "/.local/share/ddnet/settings_ddnet.cfg");
        }
    } else {
        file = Gio.file_new_for_path(settingsPath);
    }
    if (!file || !file.query_exists(null)) return null;
    return file;
}

function load_json_async(httpSession, url, callback, error_callback = null) {
    let message = Soup.Message.new('GET', url);
    if (httpSession.queue_message) {
        httpSession.queue_message(message, function (session, message) {
            try {
                let data = JSON.parse(message.response_body.data);
                callback(data);
            } catch (e) {
                if (error_callback) error_callback(e);
            }
        });
    } else if (httpSession.send_and_read_async) {
        httpSession.send_and_read_async(
            message,
            GLib.PRIORITY_DEFAULT,
            null,
            function (session, result) {
                try {
                    let bytes = session.send_and_read_finish(result);
                    let decoder = new TextDecoder('utf-8');
                    let response = decoder.decode(bytes.get_data());
                    let data = JSON.parse(response);
                    callback(data);
                } catch (e) {
                    if (error_callback) error_callback(e);
                }
            }
        );
    }
    else {
        friendsMenu.addMenuError("Cannot send HTTP requests");
    }
}

function init() { }

function enable() {
    prefs = new ExtensionSettings.Prefs();
    prefs.refreshInterval.changed(() => {
        friendsMenu.updateList();
    });
    prefs.configPath.changed(() => {
        friendsMenu.updateList();
    });
    friendsMenu = new DDNetFriendsMenu();
    Main.panel.addToStatusArea('DDNetFriendsPanel', friendsMenu, 1);
}

function disable() {
    friendsMenu.clearTimeouts();
    friendsMenu.destroy();
    friendsMenu = null;
    prefs = null;
}
