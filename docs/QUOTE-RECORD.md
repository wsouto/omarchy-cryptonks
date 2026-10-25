# The quote record (draft v0)

The one shape every adapter returns and every screen reads. It is adapted from
the record Stonks' `Quote.parseChart` returns, with the stock-market session
fields removed because a perpetual never closes. A field an exchange cannot
supply is `null`, never a guess.

| Field | Meaning | Source on Bybit |
| --- | --- | --- |
| `symbol` | the exchange's own symbol, such as `BTCUSDT` | instruments info `symbol` |
| `name` | display name | instruments info `fullName`, such as `Bitcoin`, or `baseCoin` (`BTC`) when it is empty |
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
| `fundingRate` | estimated rate for the next settlement, a fraction (`0.0001` = 0.01%); positive: longs pay shorts | ticker `fundingRate` |
| `nextFundingTime` | when that settlement is, in seconds | ticker `nextFundingTime` (ms; divide by 1000) |
| `points` | the day's line: each 5-minute candle of today's UTC day as `{ t, p }`, its start in seconds and its close; `[]` with none | kline `5` from 00:00 UTC |

**Change since 00:00 UTC** = `price - dayOpen`, and as a percent of `dayOpen`.
The screen says "since 00:00 UTC" so it is never mistaken for Bybit's own
rolling 24-hour figure.

**Removed from the Stonks record:** `session`, `current`, `clocks`, `gmtoffset`,
`timezoneName`, `zoneName`, `prevClose` (replaced by `dayOpen`), `crypto`.

**On Binance** (`adapters/binance.js`): `name` is `baseAsset` (`BTC`, Binance
sends no full name), `priceDigits` is `pricePrecision`, `firstTradeDate` is
`onboardDate`, `price` is ticker/price `price`, `marketTime` its `time`,
`fundingRate` and `nextFundingTime` are premiumIndex `lastFundingRate` and
`nextFundingTime`, the candles are klines (`1d` opens at 00:00 UTC, as
Bybit's), and `fundingInterval` is `null`: Binance sends it only in a list of
the contracts that differ from 8 hours, which nothing here reads.

## Which symbols are in scope

Read from Bybit's [instruments-info page](https://bybit-exchange.github.io/docs/v5/market/instrument) on 2026-10-21:

- `category=linear` holds more than 500 symbols and the endpoint returns 500
  by default. Ask for `limit=1000` so one request returns the whole list, and
  do not paginate. If the list ever reaches 1000, the adapter marks it
  `truncated` instead of passing it off as whole.
- **Search with autocomplete:** the adapter fetches the list once, keeps only
  the symbols in scope (below), and caches it. As the user types, such as
  `btc` or `btcusdt`, the screen filters that cached list locally, so
  typing costs no requests. The cache is refreshed rarely, for example once
  a day, because new listings are infrequent.
- Keep only `contractType` = `LinearPerpetual` and `status` = `Trading`. Dated
  futures and pre-launch contracts are out.
- Only contracts quoted in USDT are in, so every symbol is the base coin and
  `USDT`, such as `BTCUSDT`, which is what a person types in search. USDC
  perpetuals are out: Bybit names them `BTCPERP`, `ETHPERP`, `AAVEPERP`, not
  `BTCUSDC`, they are 68 of 907 contracts (checked on 2026-10-21), and they
  would put a second quote currency in the list. `currency` stays on the
  record for other exchanges. To bring USDC back, add a `pair` field
  (`baseCoin` + `quoteCoin`) so that search can match `btcusdc` to `BTCPERP`.
- **TradFi perpetuals** (stock-like contracts) are out entirely: crypto only.
  They appear in the same list with a non-empty `marketRegion` or
  `underlyingTicker`, and the adapter rejects any instrument that has either.
- `fundingInterval` (minutes) is kept on the record; the 1D info line shows
  `fundingRate` and the time left to `nextFundingTime`.
