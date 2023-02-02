<img align="middle" src="https://github.com/hus3h/gnome-shell-extension-ddnet-friends-panel/raw/main/ddnet-icon.png" width="100"> 

# DDNet friends panel for GNOME Shell

Automatically check for online DDNet friends and join them from your top bar.

This extension will check for online DDNet friends every 1 minute and show their count in your top bar. You can click the indicator to expand the panel and see more details like what map each friend is playing, you can click on a friend list item to launch the game and connect to the server they are in.

![screenshot][screenshot]

[screenshot]: https://github.com/hus3h/gnome-shell-extension-ddnet-friends-panel/raw/main/extension-screenshot.png

___

# Install

### GNOME Shell Extensions

[<img src="https://raw.githubusercontent.com/andyholmes/gnome-shell-extensions-badge/master/get-it-on-ego.svg?sanitize=true" alt="Get it on GNOME Extensions" height="100" align="middle">][extension-link]

[extension-link]: https://extensions.gnome.org/extension/4965/ddnet-friends-panel/

### Manual

```
git clone "https://github.com/hus3h/gnome-shell-extension-ddnet-friends-panel" ~/.local/share/gnome-shell/extensions/ddnet-friends-panel@hus3h
```

___

# Notes

 - The extension uses the configuration file `~/.teeworlds/settings_ddnet.cfg` to get the friends list, make sure the file exists and your user has access to read it
 - Newly added friends will appear in the panel after you close the game (the game client saves configuration on exit)
 - Options like the DDNet executable location and refresh interval are not currently customizable but can be easily edited in `extension.js` at the beginning of the file if needed
 - If you are facing a problem or have an idea for a feature, feel free to open an issue

___

# Thanks to
 - [TwitchLive Panel by maweki](https://github.com/maweki/twitchlive-extension)
 - [Command Menu by arunk140](https://github.com/arunk140/gnome-command-menu)

The base of the extension was mostly copied from these extensions.
