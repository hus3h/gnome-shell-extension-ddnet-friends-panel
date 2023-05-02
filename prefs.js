const { Gio, Gtk, Adw, GLib } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const settings = ExtensionUtils.getSettings("org.gnome.shell.extensions.ddnet-friends-panel");
const ExtensionSettings = ExtensionUtils.getCurrentExtension().imports.settings;
const prefs = new ExtensionSettings.Prefs();

const Config = imports.misc.config;
const [major] = Config.PACKAGE_VERSION.split('.');
const shellVersion = Number.parseInt(major);

const DEFAULT_FILE_LABEL = "Auto (~/.teeworlds/settings_ddnet.cfg or ~/.local/share/ddnet/settings_ddnet.cfg)";

function getValueOr(text, altText){
    return text ? text : altText;
}

function init() {
}

function addFilePicker({ group, key, }) {
    const row = new Adw.ActionRow({
        activatable: true,
    });
    group.add(row);
    const filenameLabel = new Gtk.Label({
        label: getValueOr(settings.get_string(key), DEFAULT_FILE_LABEL),
        valign: Gtk.Align.CENTER,
    });
    row.add_prefix(filenameLabel);

    let fileChooser = new Gtk.FileChooserNative({
        title: 'Select file',
        modal: true,
    });
    fileChooser.connect('response', (dlg, response) => {
        if (response !== Gtk.ResponseType.ACCEPT) return;
        settings.set_string(fc_key, dlg.get_file().get_path());
        fc_label.label = getValueOr(settings.get_string(fc_key), DEFAULT_FILE_LABEL);
    });
    row.connect('activated', () => {
        fc_key = key;
        fc_label = filenameLabel;
        fileChooser.transient_for = row.get_root();
        fileChooser.show();
    });
    prefs.configPath.changed(()=> {
        filenameLabel.label = getValueOr(settings.get_string(key), DEFAULT_FILE_LABEL);
    });
}

function buildPrefsWidget() {
    let prefsWidget = new Gtk.Grid({
        ...{
            column_spacing: 12,
            row_spacing: 12,
            column_homogeneous: true,
        },
        ...(shellVersion >= 40 ?
            {
                margin_top: 18,
                margin_bottom: 18,
                margin_start: 18,
                margin_end: 18,
            }
            :
            {
                margin: 18,
            }
        ),
    });

    let configPathGroup = new Adw.PreferencesGroup();

    addFilePicker({
        settings: settings,
        group: configPathGroup,
        key: 'config-path',
    });

    let defaultButton = new Gtk.Button({
        label: 'Reset',
    });

    defaultButton.connect('clicked', () => {
        settings.set_string('config-path', '');
    });

    let refreshIntervalBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL});

    refreshIntervalBox.append(
        new Gtk.Label({
            label: 'Seconds between updates',
            halign: Gtk.Align.START,
            valign: Gtk.Align.CENTER,
            hexpand: true
        })
    );

    let refreshSeconds = new Gtk.SpinButton({
        halign: Gtk.Align.END,
        valign: Gtk.Align.CENTER,
        margin_start: 10,
        adjustment: new Gtk.Adjustment({
            lower: 1,
            step_increment: 10,
            upper: 180,
            value: getValueOr(settings.get_uint("refresh-interval"), 60),
        }),
    });

    refreshSeconds.connect("value-changed", () => {
        settings.set_uint("refresh-interval", refreshSeconds.value);
    });

    prefs.refreshInterval.changed(()=> {
        refreshSeconds.set_value(settings.get_uint("refresh-interval"));
    });

    refreshIntervalBox.append(refreshSeconds);

    let joinCommand = new Gtk.Entry({
        text: settings.get_string("join-command"),
        hexpand: true
    });
    joinCommand.connect("changed", () => {
        settings.set_string("join-command", joinCommand.get_text().trim());
    });
    prefs.joinCommand.changed(()=> {
        joinCommand.set_value(settings.get_string("join-command"));
    });
    joinCommand.set_placeholder_text("DDNet");

    let joinCommandBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, hexpand: true});
    joinCommandBox.append(joinCommand);

    prefsWidget.attach(refreshIntervalBox, 0, 0, 1, 1);
    prefsWidget.attach(new Gtk.Label({
        label: 'Location of the settings_ddnet.cfg file',
        halign: Gtk.Align.START,
        margin_top: 20
    }), 0, 1, 1, 1);
    prefsWidget.attach(configPathGroup, 0, 2, 1, 1);
    prefsWidget.attach(defaultButton, 0, 3, 1, 1);
    prefsWidget.attach(new Gtk.Label({
        label: 'Command to run DDNet or path to the executable (default: DDNet)',
        halign: Gtk.Align.START,
        margin_top: 20
    }), 0, 4, 1, 1);
    prefsWidget.attach(joinCommandBox, 0, 5, 1, 1);

    return prefsWidget;
}