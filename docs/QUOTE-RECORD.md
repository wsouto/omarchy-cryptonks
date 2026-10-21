# The quote record (draft v0)

The one shape every adapter returns and every screen reads. It is adapted from
the record Stonks' `Quote.parseChart` returns, with the stock-market session
fields removed because a perpetual never closes. A field an exchange cannot
supply is `null`, never a guess.

| Field | Meaning | Source on Bybit |
| --- | --- | --- |
| `symbol` | the exchange's own symbol, such as `BTCUSDT` | ticker `symbol` |
| `name` | display name | base coin, such as `BTC` |
| `exchange` | which adapter produced it, such as `Bybit` | the adapter |
| `instrumentType` | `PERPETUAL` for now | the adapter |
| `currency` | the quote currency, such as `USDT`; never converted | instrument info |
| `priceDigits` | decimals every price of this symbol shows | tick size |
| `price` | latest traded price | ticker `lastPrice` |
| `marketTime` | when `price` was read, in seconds | response `time` |
| `dayOpen` | open of today's UTC daily candle; the change baseline | kline `D`, newest candle |
| `dayHigh`, `dayLow` | high and low of today's UTC day | same candle |
| `volume` | base-coin volume since 00:00 UTC | same candle |
| `turnover` | quote-currency volume since 00:00 UTC | same candle |
| `high52w`, `low52w` | high and low of the last 365 daily candles | kline `D` |
| `firstTradeDate` | first candle's time, so a young symbol's ranges are honest | kline |
| `points` | the chart: a list of `{ t, p }`, seconds and price | kline |

**Change since 00:00 UTC** = `price - dayOpen`, and as a percent of `dayOpen`.
The screen says "since 00:00 UTC" so it is never mistaken for Bybit's own
rolling 24-hour figure.

**Removed from the Stonks record:** `session`, `current`, `clocks`, `gmtoffset`,
`timezoneName`, `zoneName`, `prevClose` (replaced by `dayOpen`), `crypto`.
