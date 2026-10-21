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

**The contract** (draft; names may change when the first adapter is written)

| Function | Gives |
| --- | --- |
| `quotesUrl(symbols)` and `parseQuotes(json)` | the latest price and day figures for many symbols |
| `candlesUrl(symbol, range)` and `parseCandles(json)` | candles for a chart range |
| `instrumentsUrl()` and `parseInstruments(json)` | the symbols you can add, for search |
| `limits` | request limits and what to do on a refusal |

**First adapter: Bybit** (`adapters/bybit.js`, not written yet), V5 API,
USDT perpetuals (`category=linear`):

| Need | Endpoint |
| --- | --- |
| Prices for every symbol in one request | `GET /v5/market/tickers?category=linear` |
| Chart candles | `GET /v5/market/kline` (up to 1000 per request) |
| Symbol list | instruments info (not read yet) |

Limit: 600 requests per 5 seconds per IP. Past it Bybit answers 403 and bans
the IP for at least 10 minutes.
Source: <https://bybit-exchange.github.io/docs/v5/rate-limit>.
