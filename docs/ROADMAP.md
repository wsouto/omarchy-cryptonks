# Roadmap

Small steps, each leaving a plugin that loads. Tick a box when it is done and
commit. Each step says what you will see. Run `bash test/check.sh` and
`omarchy restart shell` after every step.

- [x] **0. Scaffold.** Repo, licence with credit, manifest, a placeholder pill.
      You see: "CRYPTO" in the bar after following [HOWTO.md](HOWTO.md).
- [ ] **1. Define the quote record.** Finish [QUOTE-RECORD.md](QUOTE-RECORD.md)
      after reading Bybit's instruments-info page. You see: a reviewed contract,
      no code.
- [ ] **2. Copy the files that need no changes.** `Format.js`, `Tones.js`,
      `Cells.js` and `Settings.js` from the original, each with its header
      comment. You see: the same pill, with the files in place and the checks
      passing.
- [ ] **3. Write `adapters/bybit.js` and `Fetch.js`.** Parse a saved Bybit
      answer in a test. You see: a test that passes without a network.
- [ ] **4. A pill with a real price.** One symbol, the price and the change
      since 00:00 UTC, refreshed once a minute. You see: BTCUSDT in the bar.
- [ ] **5. The popup.** The chart for one symbol, scrub with the pointer.
- [ ] **6. The list.** Rows, adding a symbol through search, removing, undo.
- [ ] **7. Named lists, ranges and the retro look.**
- [ ] **8. Polish and tests.** Fixtures recorded from Bybit, the boundary check
      that only `adapters/` names an exchange.

Not planned yet: portfolio, API keys, a second exchange, WebSocket, funding
rate. They are in the design notes and can come after step 8.

## Rules for the code

- Every file opens with a comment saying what it owns and why.
- Comment the reason, not the line: say why a rule exists.
- Copied files keep the original header and gain a line saying what changed.
- One job per file. If a file does two things, split it.
