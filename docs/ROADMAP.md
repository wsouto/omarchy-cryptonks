# Roadmap

Small steps, each leaving a plugin that loads. Tick a box when it is done and
commit. Each step says what you will see. Run `bash test/check.sh` and
`omarchy restart shell` after every step. If the step makes anything differ
from the original, add it to [DIFFERENCES.md](DIFFERENCES.md) in the same commit.

- [x] **0. Scaffold.** Repo, licence with credit, manifest, a placeholder pill.
      You see: "CRYPTO" in the bar after following [HOWTO.md](HOWTO.md).
- [x] **1. Define the quote record.** [QUOTE-RECORD.md](QUOTE-RECORD.md) is
      complete after reading Bybit's instruments-info page. You see: a
      contract, no code. Review it and change anything you disagree with.
- [x] **2. Copy the files that need no changes.** `Format.js`, `Tones.js`
      and `Cells.js` from the original, each with its header comment and a
      line saying where it came from. You see: the same pill, with the files
      in place and the checks passing. `Settings.js` is not a plain copy: it
      calls the original's `Quote.regularClose` and `History.historyRanges`,
      so it waits for step 7, where rows and ranking are built.
      Later trimmed to what the pill uses: `Cells.js` and the rest of
      `Format.js` and `Tones.js` come back with the screens that need them.
- [x] **3. Write `adapters/bybit.js` and `Fetch.js`.** Parse a saved Bybit
      answer in a test. You see: a test that passes without a network.
- [x] **4. A pill with a real price.** One symbol, the price and the change
      since 00:00 UTC, refreshed once a minute. You see: BTCUSDT in the bar.
The steps from 5 on follow the original's layers, as drawn in
[FEATURE-MAP.md](FEATURE-MAP.md), which says what each feature becomes here.

- [x] **5. The pill's forms.** The day's 5-minute candles (`candlesUrl`;
      checked: Bybit's kline accepts a `start` at 00:00 UTC), the
      sparkline, arrow and icon forms, middle-click to cycle. You see: the
      pill in its default sparkline form.
- [x] **6. The popup.** Hero, day chart, scrub, the retro and smooth looks.
      You see: click the pill and scrub BTCUSDT's day. Done in two parts:
  - [x] **6a. Smooth.** Left click opens the popup: the animal and LIVE,
        the hero (`BITCOIN · Bybit · USDT`, the price, the change since
        00:00 UTC; `c` or a click switches percent and amount), the day
        chart with its dashed open, the scrub (pointer, `h`/`l`, Escape),
        and the replay (`p`, or click the animal). The row name is now
        `fullName`.
  - [x] **6b. Retro.** The pixel chart, the block digits, the look icon
        and `s`; the pill's pixel line and ▲▼ signs. The look rode the
        pill's bar entry (`style`) until step 7a.
- [x] **7. Rows.** The shared service, `Gate.qml`, the saved quotes,
      `Settings.js`, rows. You see: a list of rows. Done in two parts:
  - [x] **7a. The service.** `Plugin.qml` and `Service.qml`, shared by the
        pill and the popup; `Settings.js` and the data file (the starter
        symbols, the featured one, the change mode, the look); the saved
        quotes; nothing fetched while every screen is off. You see: the
        same pill and popup, but the look and the change mode survive a
        restart, and a restart shows the last price at once.
  - [x] **7b. Rows.** The rows of All in the popup: the cursor (pointer,
        `j`/`k`), Enter, Space or a click to show a row's symbol, `1` to
        `9`, and the rows following a scrub. One feed for every symbol, each
        asking for its own price every minute (under 1 KB, where Bybit's
        all-tickers answer is 680 KB), a row's candles every 5 minutes and
        the featured symbol's every minute; the rows only while the popup is
        open. `Gate.qml` was left out: with one feed and one run a minute,
        the feed's own pause on a refusal does its work. You see: a list of
        rows.
- [x] **8. Lists and search.** Lists, search, order, undo, the key sheet.
      You see: add a symbol by typing `eth`. The key sheet came early, after
      step 7: the header's `?` (or the `?` key) shows the keys that work so
      far, and each step adds its own keys to `KeySheet.js`. In three parts:
  - [x] **8a. Search, remove, undo.** `a`, `+` or the footer's "+ Add a
        symbol" opens search over Bybit's list of contracts, fetched as
        search opens when the saved one is missing or a day old (850 KB, 98
        KB compressed), so nothing goes out while you type; "The symbol list
        didn't load" with RETRY. The hero previews the choice, Enter or a
        click adds and features it, or shows a row already in All. `x`,
        Delete, the row's × or a right-click removes; `u` or a click on the
        footer's note undoes. Rows now ask for 2 daily candles, and only the
        featured symbol for a year, the one that `high52w` and `low52w`
        need. You see: add LINKUSDT by typing `link`.
  - [x] **8b. Order.** The line over the rows: ALL and the order control,
        whose word steps (`o`) through manual, symbol, name and % change
        since 00:00 UTC, and whose arrow reverses a sort (`O`). In manual
        order a row moves by drag, Shift+J/K or Ctrl+J/K and Ctrl+↑/↓; in a
        sorted one the footer says to switch. A sort never rewrites the
        order arranged by hand. You see: sort the rows by % change.
  - [x] **8c. Lists.** Named lists, each with its own order: the list
        menu (`w` or the list's name), `,` and `.` to step, Manage lists
        (`W` or the menu) to rename, move and delete, a symbol's lists (`m`
        or Ctrl-click), and the breadth rule beside the list's name. The
        original's `ListMenu`, `ManageLists`, `SymbolLists`, `BreadthRule`,
        `RowPointer` and `KeyText` are copied unchanged. A new list's name
        is not kept through a close. You see: make a list and fill it.
- [x] **9. Ranges.** You see: 1W to All. The range row under the chart
      (1D to All; `[` and `]`, the wheel or a click) is the original's
      `RangeSelector`. A range's candles ride the price feed's run, for the
      hero's symbol only while the popup is open, and are asked again after
      15 minutes (1W, 1M) or an hour. The hero's change is the percentage
      from the range's first open; the rows and their rule keep the day and
      say "TODAY". The range is saved in the data file. The info block's
      range line (low, high, since) is not built.
- [ ] **10. The window.** The window, IPC, the launcher. You see:
      right-click opens the window.
- [ ] **11. Statuses.** Errors, retry, the look at every state. You see:
      unplug the network and read it.
- [ ] **12. Polish and release.** The boundary check that only `adapters/`
      names an exchange, flow tests, README, publishing. You see: a release.

Not planned yet: portfolio, API keys, a second exchange, WebSocket, funding
rate. They are in the design notes and can come after step 12.

## Rules for the code

- Every file opens with a comment saying what it owns and why.
- Comment the reason, not the line: say why a rule exists.
- Copied files keep the original header and gain a line saying what changed.
- One job per file. If a file does two things, split it.
