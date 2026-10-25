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

## Exchanges (step 15)

- **A second exchange, Binance** (`adapters/binance.js`), picked by the
  `exchange` key of the data file (`"Bybit"` or `"Binance"`, Bybit when
  missing or unknown); the whole plugin reads one exchange at a time. A
  symbol the other exchange doesn't list shows its problem line until you
  switch back (hiding it comes with the exchange pill, step 15c). `crypto`
- **Binance has no coin names**: a row's name is the base coin ("BTC"), not
  "Bitcoin". `crypto`
- **Binance's funding comes in a request of its own** (`premiumIndex`), asked
  with the price, so a symbol costs two requests there against one on Bybit;
  a funding that fails leaves the price and shows no funding. It has no
  funding interval, so that field is `null`. `crypto`
- **Binance's instrument can't be asked for alone**: each new symbol downloads
  the whole list (52 KB compressed) once per start, and the run's size cap is
  raised for it (`runCap`). `crypto`
- **Each exchange has a symbol list of its own** (`instruments-<exchange>.json`
  in the cache), and a switch empties the quotes kept, so one exchange's
  price is never shown as the other's. `crypto`
- **Rate limits**: Bybit 600 requests per 5 s, Binance 2400 weight per
  minute, both per IP and free; see [ADAPTERS.md](ADAPTERS.md). `crypto`

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
  next range loads: the chart is empty and the header says "Loading BTCUSDT
  1W", then it draws in. A range that failed says "1W unavailable" with
  RETRY, which asks again as `r` does. `left out`
- **The info block has no market cap or P/E**: VOL stands in their place, on
  the 52-week line under OPEN, where the original has MKT CAP and P/E. Funding
  rate or open interest could take the other slot later. `crypto`
- **VOL is the base coin's volume since 00:00 UTC** (BTC for BTCUSDT), under
  1,000 to four digits, and its worth in the quote coin: "51K BTC ($4.2B)".
  The coin is the symbol without its quote currency. The labels of a column
  pad to the widest on show (`InfoTable`), so VOL's value starts under
  OPEN's. `crypto`

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
- **A window out of sight (another workspace, a screen off) is treated as
  open**: the feed keeps every row fresh. `left out`
- **The launcher icon is the pixel bull in Bitcoin orange**, so the two
  launcher entries differ. `crypto`

## Statuses (step 11)

- **No "UPDATE OVERDUE".** Every request ends within curl's 10 seconds, so a
  run that does not answer has failed, and says "Refresh failed". An old quote
  that nothing failed on (a feed that has not asked) says "As of", plainly,
  after two minutes. The original's 90 seconds of owed time has no case here.
  `crypto`
- **The freshness words have no trading phase**: the market never closes, so
  there is no "live" tied to it. LIVE goes out when the quote is over two
  minutes old, saved, or failed. A quote from another UTC day names its day
  ("As of 14 Nov 22:13 UTC"); times are UTC. `crypto`
- **The header keeps Bybit's own reason** ("! No network") beside the words on
  the hero's line and the rows' name lines. `crypto`
- **The data-file notice is shorter** ("Can't read the data file · fix or
  remove it to save"), since the file's name is longer here than in the
  popup's width. The footer has no hint and no update notices. `crypto`
- **The hero's listing line has FUNDING at its right end** (the original has
  none): the perpetual's estimated funding rate for the next settlement,
  signed (`+0.0100%`, `▲` in retro; positive, longs pay shorts), toned up or
  down by its sign, and the time left to settlement (`3h12m`). The name gives
  way to it before the symbol, exchange or currency do. It comes from the
  tickers call that already gives the price. `crypto`
