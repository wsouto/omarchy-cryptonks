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
| `said(json)` | the words an exchange gave when it turned a question down, "" if none |
| `fundingUrl(symbol)` and `parseFunding(json)` | optional: for an exchange that sends the funding rate apart from the price, `{ symbol: { rate, nextTime } }` |
| `dailyMore(symbol, count, now)` and `historyMore(symbol, range, now)` | optional: for an exchange that answers only a page of candles at a time, the URLs of the older pages, newest first, asked as `year#1`, `daily#1`, `history:<range>#1` and read with the first page; a page that fails fails the whole question |
| `runCap` | optional: the size cap of a run, when an answer it asks for is larger than a year of candles |
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

**Second adapter: Binance** (`adapters/binance.js`), USD-M futures API,
USDT perpetuals (`https://fapi.binance.com`, no key):

| Need | Endpoint | Weight |
| --- | --- | --- |
| Symbol list, tick size, launch time | `GET /fapi/v1/exchangeInfo` (about 930 contracts, 1.1 MB, 52 KB compressed on 2026-10-24; it cannot be narrowed to one symbol, `?symbol=` is ignored) | 1 |
| Last price | `GET /fapi/v1/ticker/price?symbol=` | 1 |
| Funding rate and next settlement | `GET /fapi/v1/premiumIndex?symbol=` | 1 |
| Daily, range and 5-minute candles | `GET /fapi/v1/klines` (up to 1500 per request, oldest first) | 2 for 100 to 499 rows, 5 for 500 to 1000 |

Free and keyless. Limit: **2400 request weight per minute per IP** (the
`rateLimits` of exchangeInfo; the `x-mbx-used-weight-1m` header of an answer
says how much is used). Weights are as measured on 2026-10-24. A minute asks
about 6 weight for the featured symbol (price, funding, a year of daily
candles every minute, the day's 5-minute candles) and about 2 for each row, so
ten symbols are under 100 a minute, 4% of the limit. Past it Binance answers
429 with a `Retry-After`; an IP that goes on gets 418, a ban from 2 minutes
up to 3 days, with `Retry-After` too. 451 means Binance is not available in
your country. The feed leaves Binance alone for as long as it asks, and 10
minutes for a 418 or 451. Compare Bybit's: 600 requests per 5 seconds, then
403 and a ban of 10 minutes or more.
Source: <https://developers.binance.com/docs/derivatives/usds-margined-futures/general-info>.

**Third adapter: OKX** (`adapters/okx.js`), V5 API, USDT perpetual swaps
(`https://www.okx.com`, no key). A symbol is the base coin and USDT, as on the
others; OKX's own id is `BTC-USDT-SWAP`.

| Need | Endpoint | Limit (per IP and instrument ID) |
| --- | --- | --- |
| Symbol list, tick size, listing time | `GET /api/v5/public/instruments?instType=SWAP` (about 520 USDT swaps, 40 KB compressed on 2026-10-24; `&instId=` narrows it to one) | 20 per 2 s |
| Last price | `GET /api/v5/market/ticker?instId=` | 20 per 2 s |
| Funding rate, next settlement | `GET /api/v5/public/funding-rate?instId=` | 10 per 2 s |
| Newest candles, the day's 5-minute ones | `GET /api/v5/market/candles` (**300 at most**, newest first) | 40 per 2 s |
| Older candles | `GET /api/v5/market/history-candles` with `after` (300 at most) | 20 per 2 s |

Free and keyless; the limits are the docs' (checked 2026-10-24), per IP and
per instrument ID, so one symbol's requests don't count against another's. A
minute asks a symbol for one price and one funding (2 requests), and the
featured symbol's day and year candles (2 to 3 more, a 365-day year being two
pages); the first read of a range costs 1 to 3 pages (1W and 1M 3, 2Y 3, 1Y 2,
the rest 1). Even a first load of one symbol is 7 requests in a burst against
limits of 10 to 40 per 2 seconds. Past a limit OKX answers HTTP 429, or HTTP
200 with code `50011` ("Rate limit reached"), which shows as OKX's own words
on that refresh and is asked again the next minute. 403 is what OKX's front
gives an IP it blocks (restricted countries), and pauses the feed for 10
minutes.
Source: <https://www.okx.com/docs-v5/en/#overview-rate-limits>.
