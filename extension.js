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

const MULTIPLE_SERVERS_TEXT = "(Multiple servers)";
const DEFAULT_ENDPOINT_URL = "https://master1.ddnet.tw/ddnet/15/servers.json";
const INFO_ENDPOINT_URL = "https://info2.ddnet.tw/info";

const RELOAD_ICON_TEXT = "⟳";
const DDNET_EXECUTABLE = "DDNet";
const TEEWORLDS_DIRECTORY = GLib.get_home_dir() + "/.teeworlds"; // ~/.teeworlds
const UPDATE_INTERVAL_SECONDS = 60;
const INITIAL_RETRY_INTERVAL_SECONDS = 2;

// const SHOW_BROWSER_PAGE_COMMAND = DDNET_EXECUTABLE + " \"cl_skip_start_menu 1\""; // this is saved to settings file so disabling it
const SHOW_BROWSER_PAGE_COMMAND = DDNET_EXECUTABLE;

var officialServersList = [];
let friendsMenu;

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

      const playButton = new PopupMenu.PopupMenuItem("Play");
      playButton.connect('activate', () => {
        GLib.spawn_command_line_async(DDNET_EXECUTABLE);
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
      const file = Gio.file_new_for_path(TEEWORLDS_DIRECTORY + "/settings_ddnet.cfg");
      let endpointURL = null;
      try {
        var [ok, contents, _] = file.load_contents(null);
        if (ok) {
          const lines = ByteArray.toString(contents).split("\n");
          for (var i = 0; i < lines.length; i++) {
            if (lines[i].search("add_friend") !== -1) {
              const match = lines[i].match(/(?<=add_friend "(.*)" \".*\")/);
              if (match.length > 1)
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
    startUpdateTimeout() {
      this.clearTimeouts();
      this.timeout = Mainloop.timeout_add_seconds(UPDATE_INTERVAL_SECONDS, () => { this.updateList(); });
    }
    clearTimeouts() {
      if (this.timeout) Mainloop.source_remove(this.timeout);
      if (this.initialRetryTimeout) Mainloop.source_remove(this.initialRetryTimeout);
    }
    tryStoreOfficialServersListThenUpdate(timeoutSeconds = 0){
      this.clearTimeouts();
      this.initialRetryTimeout = Mainloop.timeout_add_seconds(timeoutSeconds, ()=> { this.storeOfficialServersListThenUpdate(); });
    }
    storeOfficialServersListThenUpdate() {
      const serverTypes = ["servers", "servers-kog"];
      load_json_async(this._httpSession, INFO_ENDPOINT_URL, (data) => {
        try {
          for (var serverTypeIndex = 0; serverTypeIndex < serverTypes.length; serverTypeIndex++) {
            const serverType = serverTypes[serverTypeIndex];
            for (var i = 0; i < data[serverType].length; i++) {
              for (var group in data[serverType][i].servers) {
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
      return SHOW_BROWSER_PAGE_COMMAND;
  }
}

class DDNetServer {
  constructor(data) {
    this.data = data;
  }
  getMapName() {
    return this.data.info.map.name + " (" + this.data.info.clients.length + "/" + this.data.info.max_players + ")";
  }
  getCleanServerText(){
    return this.data.info.name.replace(/\[.*?\]/g, "").replace(/\s+/g, " ").trim();
  }
  getServerText() {
    return this.isVerified() ? this.getCleanServerText()  : this.data.info.name;
  }
  getJoinURL() {
    return this.data.addresses[this.data.addresses.length - 1].split("//")[1];
  }
  getJoinCommand() {
    return DDNET_EXECUTABLE + " 'connect " + this.getJoinURL() + "'";
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

function load_json_async(httpSession, url, fun) {
  let message = Soup.Message.new('GET', url);
  httpSession.queue_message(message, function (session, message) {
    let data = JSON.parse(message.response_body.data);
    fun(data);
  });
}

function init() { }

function enable() {
  friendsMenu = new DDNetFriendsMenu();
  Main.panel.addToStatusArea('DDNetFriendsPanel', friendsMenu, 1);
}

function disable() {
  friendsMenu.clearTimeouts();
  friendsMenu.destroy();
  friendsMenu = null;
}
