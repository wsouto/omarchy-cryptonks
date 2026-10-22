# Differences from the original

What this project does differently from omarchy-stonks, and why. Every copied
file also says `Changes:` in its header; this page holds the reasons and the
ideas worth sending back. Add an entry in the commit that makes the difference.

Each entry: **what**, **why**, and a tag.

- `crypto`: the market forces it (24/7, UTC day, Bybit). Not for the original.
- `left out`: the original has it, we do not yet. Bring back on request.
- `PR?`: could be an improvement for the original too. Check it first.

## Market

- **The day is the UTC day, 00:00 to 24:00.** No sessions, extended hours or
  breaks, so `DayChart`, `PixelChart`, `Chart.js` and `Sparkline` lose that
  logic and the pen never lifts. `crypto`
- **The animal never sleeps** (`HeaderStatus`, `BarAnimal`): a perpetual market
  is never closed, so the lids are gone. `crypto`
- **"TODAY" label in `ListLine`** says the UTC day, not a session. `crypto`

## Data

- **One feed for every symbol** (`Service.qml`), with a run of its own for a
  symbol that joins (preview, add, undo, newly featured). `crypto`
- **Search reads Bybit's instrument list**, no lookup is asked of anyone
  (`Search.js`, `SymbolSearch.qml`). `crypto`
- **Rows ask 2 daily candles, only the featured symbol a year.** Keeps the
  per-minute load small. Side effect: a row with no saved quote shows
  "Loading…" about 5 s after a shell restart. `PR?` if the original has the
  same wait.

## Ranges (step 9)

- **A range's candles ride the price feed's run** (`Refresh.js`,
  `PriceFeed.qml`), with no `HistoryFeed`, `Gate` or second curl: one pause
  for a refusal covers both. `crypto`
- **The chart's baseline on a range is the first candle's open**, and its
  caption names the range ("1W"). The scrub strip says "START <moment>".
  `crypto`
- **A range is asked again by age alone**, 15 minutes for 1W and 1M, an hour
  for the rest; the market never closes, so there is no session rule. `crypto`
- **No charts fetched ahead for rows**, and no held chart that dims while the
  next range loads: the chart is empty, then draws in. The loading look comes
  with step 11. `left out`
- **The info block has no market cap or P/E**: VOL stands in their place, on
  the 52-week line under OPEN, where the original has MKT CAP and P/E. Funding
  rate or open interest could take the other slot later. `crypto`
- **VOL is the base coin's volume since 00:00 UTC** (BTC for BTCUSDT), under
  1,000 to four digits, and its worth in the quote coin: "51K BTC ($4.2B)".
  The coin is the symbol without its quote currency. `crypto`

## Lists

- **Deleting a list takes its symbols out of All too**, except those another
  list holds, and never the last symbol of All. The original leaves them in
  All. The question in Manage lists says so (`ManageLists.qml` changed one
  line). Your choice, not the market's. `PR?`
- **Removing a row from a named list does the same**: out of All too unless
  another list holds it, and the footer's undo puts it back. The original
  only leaves the list. The checklist's untick (`m`) still leaves just the
  list. `PR?`

## Left out of step 8c

- **A half-typed list name or rename is lost when the popup closes**
  (original: `draft` / `keepTyped`). `left out`
- **Scroll position is not kept per list** (original: `listKeys`). `left out`
- **Dragging a row does not scroll the list**, so with more than 6 rows a row
  can only drop among the rows in sight. Not in the original; our limit.

## Ideas to send upstream

Nothing confirmed yet. When an entry above is a fix or an improvement that does
not depend on crypto, tag it `PR?`, check it against the original's current
code, and move it here with a one-line pitch.

## The window (step 10)

- **`openWindow` and `toggleWindow` take no payload** (no symbol or range to
  show on open), and there is no `show`/`hide`/`next`/`prev` on the IPC
  target yet. `left out`
- **The rows take the height the window has** (`Body.rowsRoom`), where the
  original's chart gives way first. `PR?`
- **A window out of sight (another workspace, a screen off) is treated as
  open**: the feed keeps every row fresh. `left out`
- **The launcher icon is the pixel bull in Bitcoin orange**, so the two
  launcher entries differ. `crypto`
