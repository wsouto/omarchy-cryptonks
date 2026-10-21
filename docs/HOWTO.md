# How to run, install, change and remove it

Everything here uses the commands that ship with Omarchy 4. Run them in a
terminal. The plugin lives in this folder, `~/Projects/omarchy-crypto-stonks`,
and the shell loads it from `~/.config/omarchy/plugins/wsouto.crypto-stonks`.

## Install for development (a link, not a copy)

```sh
ln -s ~/Projects/omarchy-crypto-stonks ~/.config/omarchy/plugins/wsouto.crypto-stonks
omarchy-shell shell rescanPlugins
omarchy plugin enable wsouto.crypto-stonks center
```

- The first line links the plugin folder into the shell's plugin folder, so
  every edit you make here is the code the shell runs.
- The last line asks where in the bar to put it. `center` is the default.
- If the shell does not list the plugin, it may not follow links. Replace the
  link with a copy: `rm ~/.config/omarchy/plugins/wsouto.crypto-stonks`, then
  `cp -r ~/Projects/omarchy-crypto-stonks ~/.config/omarchy/plugins/wsouto.crypto-stonks`,
  and copy again after each edit. (Not yet tested on this machine.)

## After you change code

```sh
bash test/check.sh          # manifest and QML checks; must end with ALL PASS
omarchy restart shell       # the shell keeps old code loaded until it restarts
```

Errors from QML go to the shell's log. Watch it in a second terminal:

```sh
journalctl --user -t omarchy-shell -f
```

## Remove it

```sh
omarchy plugin disable wsouto.crypto-stonks
rm ~/.config/omarchy/plugins/wsouto.crypto-stonks    # removes the link only
```

Your repo folder stays. Once the plugin saves settings, they will live in a
file in `~/.config/omarchy/` that `omarchy plugin remove` does not delete; the
README will name it.

## See what is installed

```sh
omarchy plugin list
```

## Edit it by hand

Open any `.qml` or `.js` file in your editor. Every file starts with a comment
saying what it owns. Change it, run `bash test/check.sh`, then
`omarchy restart shell`. If the bar breaks, run `git diff` to see what you
changed and `git checkout -- <file>` to undo one file.

## Work with git

```sh
git status                  # what changed
git diff                    # the changes, line by line
git add -A && git commit    # save a step; write what you changed, in a sentence
git log --oneline           # the steps so far
```
