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
| `open24h` | price 24 hours ago; the change baseline | ticker `prevPrice24h` |
| `high24h`, `low24h` | high and low of the last 24 hours | ticker `highPrice24h`, `lowPrice24h` |
| `volume24h` | base-coin volume of the last 24 hours | ticker `volume24h` |
| `turnover24h` | quote-currency volume of the last 24 hours | ticker `turnover24h` |
| `openInterest` | worth of the open contracts, in the quote currency; `null` where the ticker does not send it (Binance, OKX) | ticker `openInterestValue` |
| `high52w`, `low52w` | high and low of the last 365 daily candles | kline `D` |
| `firstTradeDate` | when the symbol launched, so a young symbol's ranges are honest | instruments info `launchTime` (ms; divide by 1000) |
| `fundingInterval` | minutes between funding payments, such as `480` | instruments info `fundingInterval` |
| `fundingRate` | estimated rate for the next settlement, a fraction (`0.0001` = 0.01%); positive: longs pay shorts | ticker `fundingRate` |
| `nextFundingTime` | when that settlement is, in seconds | ticker `nextFundingTime` (ms; divide by 1000) |
| `points` | the 1D line: each 5-minute candle of the last 24 hours as `{ t, p }`, its start in seconds and its close; `[]` with none | kline `5` from 24 hours ago |

**The 24-hour change** = `price - open24h`, and as a percent of `open24h`: the
exchange's own 24-hour change. A figure the ticker doesn't send is `null`.

**Removed from the Stonks record:** `session`, `current`, `clocks`, `gmtoffset`,
`timezoneName`, `zoneName`, `prevClose` (replaced by `open24h`), `crypto`.

**On Binance** (`adapters/binance.js`): `name` is `baseAsset` (`BTC`, Binance
sends no full name), `priceDigits` is `pricePrecision`, `firstTradeDate` is
`onboardDate`, `price` is ticker/24hr `lastPrice`, `marketTime` its
`closeTime`, the 24-hour fields its `openPrice`, `highPrice`, `lowPrice`,
`volume` and `quoteVolume`,
`fundingRate` and `nextFundingTime` are premiumIndex `lastFundingRate` and
`nextFundingTime`, the candles are klines (`1d` opens at 00:00 UTC, as
Bybit's), and `fundingInterval` is `null`: Binance sends it only in a list of
the contracts that differ from 8 hours, which nothing here reads.

**On OKX** (`adapters/okx.js`): `symbol` is the base coin and `USDT` (OKX's
`instId` is `BTC-USDT-SWAP`), `name` the base coin, `priceDigits` the decimals
of `tickSz`, `firstTradeDate` is `listTime`, `price` is ticker `last`,
`marketTime` its `ts`, `fundingRate` and `nextFundingTime` are funding-rate
`fundingRate` and `fundingTime` (the settlement to come; OKX's
`nextFundingTime` is the one after), the candles are `1Dutc` days, the 24-hour
fields are ticker `open24h`, `high24h`, `low24h` and `volCcy24h` (base coin),
`turnover24h` is `volCcy24h × last` because OKX sends no quote-coin volume for
a swap, and `fundingInterval` is `null`.

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
