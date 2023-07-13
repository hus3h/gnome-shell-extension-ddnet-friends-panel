<img align="middle" src="ddnet-icon.png" width="100"> 

# DDNet Friends Panel for GNOME Shell

Automatically check for online DDNet (DDraceNetwork/Teeworlds) friends and join them from your top bar.

This extension will check for online DDNet friends and show their count in your top bar. You can click the indicator to expand the panel and see more details such as the map each friend is playing, and you can click on a friend list item to launch the game and connect to the server they are in.

![screenshot][screenshot]

[screenshot]: extension-screenshot.png

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

 - The extension runs the command `DDNet` to start the game, you can change the command or specify the path to the executable in the extension settings if needed
 - The extension searches for the configuration file in the default locations, you can choose the file location manually in the extension settings if needed
 - Newly added friends will appear in the panel after you close the game (the game client updates the configuration file on exit)
 - If you are facing a problem or have an idea for a feature, feel free to open an issue

___

# Thanks to
 - [TwitchLive Panel by maweki](https://github.com/maweki/twitchlive-extension)
 - [Command Menu by arunk140](https://github.com/arunk140/gnome-command-menu)

The base of the extension was mostly copied from these extensions.
