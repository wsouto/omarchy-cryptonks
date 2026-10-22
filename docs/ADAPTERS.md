# Exchange adapters

The project is named for crypto, not for one exchange. Each exchange lives in
one file under `adapters/` and speaks the same small contract. The screens
never mention an exchange.

**Rules**

1. Only `adapters/<exchange>.js` names an endpoint, a field of that exchange's
   JSON, or its symbol style.
2. An adapter is pure: functions in, data out. It draws nothing, runs no
   command and reads no clock. The feeds fetch; the adapter builds URLs and
   reads answers.
3. An adapter returns the records in [QUOTE-RECORD.md](QUOTE-RECORD.md). If an
   exchange lacks a field, the adapter returns `null` for it. It never guesses.

**The contract** (written with the first adapter; a second exchange may still
change it)

| Function | Gives |
| --- | --- |
| `instrumentUrl(symbol)` and `parseInstruments(json)` | one of the symbols you can add, or (from step 6, with `instrumentsUrl()`) all of them for search: `{ instruments, truncated }` |
| `quotesUrl(symbols)` and `parseQuotes(json)` | the latest price of the symbols asked for (every symbol if not one): `{ time, prices }` |
| `dailyUrl(symbol, count)` and `parseCandles(json)` | daily candles, oldest first |
| `candlesUrl(symbol, start)` and `parseCandles(json)` | 5-minute candles from `start` (seconds), the day's line, oldest first |
| `buildQuote(instrument, price, marketTime, candles, dayCandles)` | the record of [QUOTE-RECORD.md](QUOTE-RECORD.md) |
| `limits` | request limits, which statuses mean "refused", for how long, and why in words |

A reader gives `null` for an answer it can't use, so a refused question is
never taken for an empty list.

**First adapter: Bybit** (`adapters/bybit.js`), V5 API,
USDT perpetuals (`category=linear`):

| Need | Endpoint |
| --- | --- |
| Prices for every symbol in one request | `GET /v5/market/tickers?category=linear` |
| Daily candles and chart candles | `GET /v5/market/kline` (up to 1000 per request) |
| Symbol list, tick size, launch time | `GET /v5/market/instruments-info?category=linear&limit=1000` (907 contracts on 2026-10-21; `truncated` is true if `nextPageCursor` is not empty) |

Limit: 600 requests per 5 seconds per IP. Past it Bybit answers 403 and bans
the IP for at least 10 minutes.
Source: <https://bybit-exchange.github.io/docs/v5/rate-limit>.
