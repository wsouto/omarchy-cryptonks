# Contributing to Crypto Stonks

A crypto futures watchlist for the Omarchy shell bar. It is QML and plain
JavaScript, with no build step: shell plugins must be QML, and the shell
already ships the UI kit, theme tokens, and popup machinery.

This page is adapted from the CONTRIBUTING.md of Stonks by Gaurav Chande
(MIT, https://github.com/gmchande/omarchy-stonks, v1.0.2), whose way of
working this project keeps. What was removed is what belongs to Stonks alone:
its Yahoo and Robinhood data, its test harnesses, its release steps.

Every file opens with a comment saying what it owns and why. Read that before
changing it. This page holds only what the code can't tell you.

## Simplicity

- Simple means untangled, not short: each piece does one job and can change on its own. Refuse state braided with time, one component knowing two concerns, a flag that couples two paths, a result that depends on hidden order.
- Leave the code simpler than you found it.
- No handling for cases this data and its users can't produce.
- Delete what nothing uses.
- Confirm a limit you blame on the shell in its code
  (`/usr/share/omarchy/shell/`) before designing around it.
- No build step. Source files are the files that run.

## Run it

Follow [docs/HOWTO.md](docs/HOWTO.md) to install, update and remove the
plugin. In short:

- After a change, run `omarchy restart shell`. A hot reload isn't enough: the
  service stays loaded and can keep answering with the old code.
- QML errors go to the shell's log: `journalctl --user -t omarchy-shell -f`.

## Verify it

- `bash test/check.sh` is the check to run before every commit: the manifest
  follows the shell's schema, every QML file lints, and `bun test` passes.
  Its last line must be `ALL PASS`.
- Tests check what the plugin does: what it fetches, saves and says. They
  never check a picture, a position, or a timing.
- Before adding a test, name what a user would see break. A bug fix's test
  fails on the code before the fix.
- Wait on events or counts, never on fixed sleeps.
- Parsers are tested on saved exchange answers, so a test passes without a
  network.

## Layout

- `manifest.json`: the plugin's id, kinds, and the pill's settings.
- `BarWidget.qml`: the pill in the bar.
- `PriceFeed.qml`: fetches the pill's symbol once a minute and holds its
  quote. `Refresh.js` is its rules: what each refresh asks for, and what the
  answers mean.
- `adapters/<exchange>.js`: the only files that name an exchange's endpoints
  or fields. Each returns the quote record in
  [docs/QUOTE-RECORD.md](docs/QUOTE-RECORD.md). See
  [docs/ADAPTERS.md](docs/ADAPTERS.md).
- The rule files (`*.js`) are pure functions, one concern each, with no
  drawing and no clock.
- Only the feeds fetch. Today that is `PriceFeed.qml`, which keeps its own
  pause; from roadmap step 6 each feed fetches through a `Gate.qml`.

## Product rules

- **Only what's true.** Show what the exchange sent, never an adjustment,
  precision, or coverage it didn't. Leave out a figure that isn't known; never
  guess it. A field an adapter can't supply is `null`. Only a failed or
  overdue refresh shows a "!".
- **Money.** No currency conversion: each symbol in its own quote currency.
- **Time.** The day starts at 00:00 UTC, and the screen says so ("since
  00:00 UTC"), so it is never mistaken for an exchange's rolling 24-hour
  figure.
- **Colour.** Up is the theme's green and down its red (the shell's urgent),
  everywhere; never the accent, which in Omarchy means selected. Never adjust
  a theme's colours.
- **Fetching.** Fetch each symbol only as often as it is needed, fetch
  nothing while every screen is off, and leave a site that refuses us alone
  for a while. Bybit bans an IP for at least 10 minutes after too many
  requests, so a refusal pauses us that long. (Not yet kept: the pill still
  fetches while the screens are off. The shared service of roadmap step 6
  adds it.)
- **Mouse and keys.** Every flow works by mouse alone and by keys alone, and
  anything that looks clickable acts when clicked. A button says only what it
  does.
- **Text.** Every character drawn is one JetBrainsMono Nerd Font has.

## Words

The README, the manifest, and every word on screen are written for one reader
who has never seen the plugin and has thirty seconds to give it.

- Open with what the plugin does for the reader, in a sentence with a verb.
  The second sentence says something the first didn't.
- Change the words with the code, and promise nothing it doesn't do.
- Use the reader's words, not the code's.
- One name for each thing, the same on screen and in the docs.
- Present tense and active verbs: "the plugin keeps the lists it has", not
  "the lists are kept".
- Specific over general: a number, a time, the words the reader will see.
- Say it once. Cut "very", "just", "simply", "quite", and any sentence that
  repeats the one before.
- Trouble starts from the words on screen, then says why, then what to do.

## Style

- QML: value-in components, `readonly property` for derived state, a
  `Process` for every side effect, animations at the shell's 160 ms
  OutCubic.
- Secondary text is the foreground mixed toward its ground (`Tones.dim`),
  never `Qt.darker`, which gets louder on a light theme.
- Read Omarchy's colours as `Commons.Color`, after
  `import qs.Commons as Commons`. A plain `Color` names Qt 6.12's own
  `Color` type, not Omarchy's.
- Rule files: `.pragma library` first, so QML loads each once rather than
  once per row; top-level functions only, read through `.import`, imports
  one way with no cycles.
- Comment the reason, not the line: say why a rule exists.
- A copied file keeps its original header and gains a line saying where it
  came from and what changed.

## Agents

An agent can write your change, but you're its author: read the diff and be
able to explain every line.

`AGENTS.md`, `CLAUDE.md`, and other agent files stay out of the repository:
an installed copy would hand them to the user's own coding agents, and the
Omarchy plugin marketplace's review refuses them. Keep your own local copy
and have it point here.
