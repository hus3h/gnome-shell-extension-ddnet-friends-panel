const Gio = imports.gi.Gio;
const ExtensionUtils = imports.misc.extensionUtils;

const SCHEMA_PATH = 'org.gnome.shell.extensions.ddnet-friends-panel';

function Prefs() {
 var settings = this.settings = ExtensionUtils.getSettings(SCHEMA_PATH);
 this.configPath = {
  key: 'config-path',
  get: function () { return settings.get_string(this.key); },
  set: function (v) { settings.set_string(this.key, v); },
  changed: function (cb) { return settings.connect('changed::' + this.key, cb); },
  disconnect: function () { return settings.disconnect.apply(settings, arguments); },
 };
 this.refreshInterval = {
  key: 'refresh-interval',
  get: function () { return settings.get_uint(this.key); },
  set: function (v) { settings.set_uint(this.key, v); },
  changed: function (cb) { return settings.connect('changed::' + this.key, cb); },
  disconnect: function () { return settings.disconnect.apply(settings, arguments); },
 };
 this.joinCommand = {
  key: 'join-command',
  get: function () { return settings.get_string(this.key); },
  set: function (v) { settings.set_string(this.key, v); },
  changed: function (cb) { return settings.connect('changed::' + this.key, cb); },
  disconnect: function () { return settings.disconnect.apply(settings, arguments); },
 };
};