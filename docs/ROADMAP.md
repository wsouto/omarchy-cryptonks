# Roadmap

Small steps, each leaving a plugin that loads. Tick a box when it is done and
commit. Each step says what you will see. Run `bash test/check.sh` and
`omarchy restart shell` after every step.

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
- [ ] **7. Rows.** The shared service, `Gate.qml`, the saved quotes,
      `Settings.js`, rows. You see: a list of rows. Done in two parts:
  - [x] **7a. The service.** `Plugin.qml` and `Service.qml`, shared by the
        pill and the popup; `Settings.js` and the data file (the starter
        symbols, the featured one, the change mode, the look); the saved
        quotes; nothing fetched while every screen is off. You see: the
        same pill and popup, but the look and the change mode survive a
        restart, and a restart shows the last price at once.
  - [ ] **7b. Rows.** The rows of the five starters in the popup, their
        feed (prices every minute, day lines every 5 minutes) and
        `Gate.qml`. You see: a list of rows.
- [ ] **8. Lists and search.** Lists, search, order, undo, the key sheet.
      You see: add a symbol by typing `eth`.
- [ ] **9. Ranges.** You see: 1W to All.
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
