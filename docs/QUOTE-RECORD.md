# The quote record (draft v0)

The one shape every adapter returns and every screen reads. It is adapted from
the record Stonks' `Quote.parseChart` returns, with the stock-market session
fields removed because a perpetual never closes. A field an exchange cannot
supply is `null`, never a guess.

| Field | Meaning | Source on Bybit |
| --- | --- | --- |
| `symbol` | the exchange's own symbol, such as `BTCUSDT` | ticker `symbol` |
| `name` | display name | instruments info `baseCoin`, such as `BTC` |
| `exchange` | which adapter produced it, such as `Bybit` | the adapter |
| `instrumentType` | `PERPETUAL` for now | the adapter |
| `currency` | the quote currency, such as `USDT`; never converted | instruments info `quoteCoin` |
| `priceDigits` | decimals every price of this symbol shows | instruments info `priceScale` (a string such as `"2"`) |
| `price` | latest traded price | ticker `lastPrice` |
| `marketTime` | when `price` was read, in seconds | response `time` |
| `dayOpen` | open of today's UTC daily candle; the change baseline | kline `D`, newest candle |
| `dayHigh`, `dayLow` | high and low of today's UTC day | same candle |
| `volume` | base-coin volume since 00:00 UTC | same candle |
| `turnover` | quote-currency volume since 00:00 UTC | same candle |
| `high52w`, `low52w` | high and low of the last 365 daily candles | kline `D` |
| `firstTradeDate` | when the symbol launched, so a young symbol's ranges are honest | instruments info `launchTime` (ms; divide by 1000) |
| `fundingInterval` | minutes between funding payments, such as `480` | instruments info `fundingInterval` |
| `points` | the chart: a list of `{ t, p }`, seconds and price | kline |

**Change since 00:00 UTC** = `price - dayOpen`, and as a percent of `dayOpen`.
The screen says "since 00:00 UTC" so it is never mistaken for Bybit's own
rolling 24-hour figure.

**Removed from the Stonks record:** `session`, `current`, `clocks`, `gmtoffset`,
`timezoneName`, `zoneName`, `prevClose` (replaced by `dayOpen`), `crypto`.

## Which symbols are in scope

Read from Bybit's [instruments-info page](https://bybit-exchange.github.io/docs/v5/market/instrument) on 2026-10-21:

- `category=linear` holds more than 500 symbols and the endpoint returns 500
  by default. Ask for `limit=1000` so one request returns the whole list, and
  do not paginate. (To verify: that the list stays under 1000 symbols. If it
  ever reaches 1000, the adapter must say so instead of silently truncating.)
- **Search with autocomplete:** the adapter fetches the list once, keeps only
  the symbols in scope (below), and caches it. As the user types, such as
  `btcusdt` or `btcusdc`, the screen filters that cached list locally, so
  typing costs no requests. The cache is refreshed rarely, for example once
  a day, because new listings are infrequent.
- Keep only `contractType` = `LinearPerpetual` and `status` = `Trading`. Dated
  futures and pre-launch contracts are out.
- USDT and USDC pairs are both in. Each record carries its own `quoteCoin`,
  so `BTCUSDT` and `BTCUSDC` are different symbols.
- **TradFi perpetuals** (stock-like contracts) are out entirely: crypto only.
  They appear in the same list with a non-empty `marketRegion` or
  `underlyingTicker`, and the adapter rejects any instrument that has either.
- `fundingInterval` (minutes) is kept on the record, for the funding feature
  later.
