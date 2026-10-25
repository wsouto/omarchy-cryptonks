# Differences from the original

What this project does differently from omarchy-stonks, and why. Every copied
file also says `Changes:` in its header; this page holds the reasons and the
ideas worth sending back. Add an entry in the commit that makes the difference.

Each entry: **what**, **why**, and a tag.

- `crypto`: the market forces it (24/7, rolling 24 hours, Bybit). Not for the original.
- `left out`: the original has it, we do not yet. Bring back on request.
- `PR?`: could be an improvement for the original too. Check it first.

## Market

- **1D is the last 24 hours, as on the exchanges.** The line runs from 24
  hours before the newest candle to it, so it always fills the chart, and
  the change, high, low and volume are the exchange's own 24-hour figures
  from its ticker, so they match its app. No sessions, extended hours or
  breaks, so `DayChart`, `PixelChart`, `Chart.js` and `Sparkline` lose that
  logic and the pen never lifts. The original's closed market shows the last
  whole session; a market that never closes has no such moment, and a day
  from 00:00 UTC (tried until 2026-10-25) looked empty after midnight.
  `crypto`
- **The animal never sleeps** (`HeaderStatus`, `BarAnimal`): a perpetual market
  is never closed, so the lids are gone. `crypto`
- **"TODAY" label in `ListLine`** is "24H", and the hero's caption says
  "24H" where the original names nothing. `crypto`

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
  switch back. `crypto`
- **Each exchange keeps its own data**: a switch puts the feed's instruments,
  candles, quotes and charts aside for the exchange left, for the session,
  so switching back asks only what is due. The saved quotes file holds each
  exchange's last quotes (version 3, `{ exchange: { symbol: quote } }`;
  older files are not read), so a first switch shows that exchange's last
  prices at once. Candles are not saved. `crypto`
- **Fewer requests per symbol**: the exchange's instrument list, fetched at
  start, on a switch and when search opens (once a day, saved per
  exchange), gives each symbol its instrument, so none is asked for alone.
  A row's 24 hours (open, high, low, volume) come with its price; only the
  featured symbol asks for daily candles, for its 52-week range. `crypto`
- **The exchange pill**: the exchange's name on the hero's listing line is a
  pill; a click, or `e`, steps to the next exchange and wraps to the first.
  The setting is saved in the data file. A symbol the new exchange doesn't
  list is kept in the lists and shows "NO DATA FOR THIS SYMBOL" (the feed's
  own treatment of a symbol that gets no answer); it is not hidden. `crypto`
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
- **OKX** (`adapters/okx.js`): a symbol stays `BTCUSDT`, mapped to OKX's
  `BTC-USDT-SWAP`; the name is the base coin; funding is a request of its own
  and has no interval (`fundingInterval` null); stock, commodity and index
  swaps (`instCategory` other than 1) and the inverse and USDC swaps are left
  out; coins that OKX names without Bybit's `1000` prefix (PEPE, not
  1000PEPE) are different symbols. `crypto`
- **OKX answers 300 candles at most**, so a year of days (the 52W figures and
  the 1Y range), 2Y, 1W on 15-minute candles, 1M on hourly ones, YTD past day
  300 and 10Y are several requests, the older ones from OKX's history
  endpoint (`dailyMore`, `historyMore`, `Refresh.js`). A page that fails
  fails the whole question, so a range is never drawn short. `crypto`
- **OKX's volume is read in the base coin** (`volCcy`, `volCcy24h`), as its
  own `vol` counts contracts of a size that differs by coin. Its ticker
  sends no quote-coin volume for a swap, so the 24 hours' worth in USDT is
  the base volume at the last price: close, not exact. `crypto`
- **Rate limits**: Bybit 600 requests per 5 s, Binance 2400 weight per
  minute, OKX 10 to 40 requests per 2 seconds for each instrument, all per IP and free; see [ADAPTERS.md](ADAPTERS.md). `crypto`

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
  the 52-week line under 24H OPEN, where the original has MKT CAP and P/E. Funding
  rate or open interest could take the other slot later. `crypto`
- **VOL is the base coin's volume over 24 hours** (BTC for BTCUSDT), under
  1,000 to four digits, and its worth in the quote coin: "51K BTC ($4.2B)".
  The coin is the symbol without its quote currency. It is always the 24
  hours', on every range: the original's VOL is the day's, on the day line
  only, but next to 24H OPEN there is no room for it at a coin's prices. `crypto`

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
