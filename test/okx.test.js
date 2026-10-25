// The OKX adapter, tested on answers OKX really sent (recorded on
// 2026-10-25 into test/fixtures/okx-*), so they pass without a network. The
// fixtures keep OKX's own envelope and records; only the number of records is
// cut:
//
//   okx-instruments.json   BTC-USDT-SWAP, ETH-USDT-SWAP (in scope),
//                          BTC-USD-SWAP (inverse) and AAPL-USDT-SWAP (a stock)
//   okx-ticker-btc.json    the ticker of BTC-USDT-SWAP
//   okx-tickers.json       the tickers of BTC-USDT-SWAP, ETH-USDT-SWAP and
//                          BTC-USD-SWAP
//   okx-funding-btc.json   the funding rate of BTC-USDT-SWAP
//   okx-funding-any.json   BTC-USDT-SWAP and ETH-USDT-SWAP, as "ANY" lists
//   okx-candles-btc-d.json three daily candles of BTC-USDT-SWAP, newest first
//   okx-candles-btc-5.json the 5-minute candles of 2026-10-25 UTC up to the
//                          ticker's time, newest first
//   okx-error.json         the answer to an instrument that doesn't exist
import { test, expect } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { load } from "./load.js"

const O = load("adapters/okx.js")
const F = load("Fetch.js")

const fixture = name => JSON.parse(readFileSync(join(import.meta.dir, "fixtures", name), "utf8"))
const clone = value => JSON.parse(JSON.stringify(value))
const symbolsOf = parsed => parsed.instruments.map(i => i.symbol).sort()
const DAY = 86400

// ---- Symbols ----

test("a symbol is the base coin and USDT, and OKX's id has -USDT-SWAP", () => {
  expect(O.instId("BTCUSDT")).toBe("BTC-USDT-SWAP")
  expect(O.instId("1000PEPEUSDT")).toBe("1000PEPE-USDT-SWAP")
  expect(O.instId("BTCUSD")).toBe("BTCUSD")
  expect(O.symbolOf("BTC-USDT-SWAP")).toBe("BTCUSDT")
  expect(O.symbolOf("BTC-USD-SWAP")).toBeNull()
  expect(O.symbolOf("BTC-USDT-260327")).toBeNull()
})

// ---- The symbols you can add ----

test("only crypto linear USDT swaps that trade are in scope", () => {
  const parsed = O.parseInstruments(fixture("okx-instruments.json"))
  expect(symbolsOf(parsed)).toEqual(["BTCUSDT", "ETHUSDT"])
  expect(parsed.truncated).toBe(false)
  expect(parsed.cursor).toBe("")
})

test("an inverse swap and a stock swap are left out", () => {
  const symbols = symbolsOf(O.parseInstruments(fixture("okx-instruments.json")))
  expect(symbols).not.toContain("AAPLUSDT")
  expect(symbols.length).toBe(2)
})

test("a swap that is not live is left out", () => {
  const json = clone(fixture("okx-instruments.json"))
  json.data.find(x => x.instId === "ETH-USDT-SWAP").state = "suspend"
  expect(symbolsOf(O.parseInstruments(json))).toEqual(["BTCUSDT"])
})

test("an instrument carries what search and the record need; the name is the base coin", () => {
  const found = O.parseInstruments(fixture("okx-instruments.json")).instruments.find(i => i.symbol === "BTCUSDT")
  expect(found).toEqual({
    symbol: "BTCUSDT",
    name: "BTC",
    currency: "USDT",
    priceDigits: 1,
    firstTradeDate: 1573557408,
    fundingInterval: null
  })
})

test("a tick size gives the digits a price shows", () => {
  expect(O.digitsOf("0.001")).toBe(3)
  expect(O.digitsOf("1")).toBe(0)
  expect(O.digitsOf("")).toBeNull()
})

test("an answer OKX refused, or no answer, is null and not an empty list", () => {
  expect(O.parseInstruments(fixture("okx-error.json"))).toBeNull()
  expect(O.parseInstruments(null)).toBeNull()
  expect(O.parseInstruments({ code: "0", data: "x" })).toBeNull()
})

test("one instrument is asked for by its id, the list with none", () => {
  expect(O.instrumentUrl("BTCUSDT")).toBe("https://www.okx.com/api/v5/public/instruments?instType=SWAP&instId=BTC-USDT-SWAP")
  expect(O.instrumentsUrl("ignored")).toBe("https://www.okx.com/api/v5/public/instruments?instType=SWAP")
})

// ---- The latest price and funding ----

test("one request asks for the one ticker wanted, or every swap's", () => {
  expect(O.quotesUrl(["BTCUSDT"])).toBe("https://www.okx.com/api/v5/market/ticker?instId=BTC-USDT-SWAP")
  expect(O.quotesUrl([])).toBe("https://www.okx.com/api/v5/market/tickers?instType=SWAP")
  expect(O.quotesUrl(["BTCUSDT", "ETHUSDT"])).toContain("instType=SWAP")
  expect(O.fundingUrl("BTCUSDT")).toBe("https://www.okx.com/api/v5/public/funding-rate?instId=BTC-USDT-SWAP")
})

test("the last price by symbol, and when OKX answered in seconds", () => {
  const one = O.parseQuotes(fixture("okx-ticker-btc.json"))
  expect(one.time).toBe(1792887309)
  expect(one.prices).toEqual({ BTCUSDT: 80744.5 })
  expect(one.funding).toEqual({})
  expect(one.stats.BTCUSDT).toMatchObject({ open: 80888.8, high: 81061.4, low: 79168, volume: 59810.7146 })
  const all = O.parseQuotes(fixture("okx-tickers.json"))
  expect(Object.keys(all.prices).sort()).toEqual(["BTCUSDT", "ETHUSDT"])
})

test("funding: the rate and the settlement to come, in seconds", () => {
  const f = O.parseFunding(fixture("okx-funding-btc.json"))
  expect(f.BTCUSDT).toEqual({ rate: 0.0000244791294062, nextTime: 1792915200 })
  expect(Object.keys(O.parseFunding(fixture("okx-funding-any.json"))).sort()).toEqual(["BTCUSDT", "ETHUSDT"])
})

test("a funding rate or time that is missing is null", () => {
  const json = clone(fixture("okx-funding-btc.json"))
  json.data[0].fundingRate = ""; json.data[0].fundingTime = ""
  expect(O.parseFunding(json).BTCUSDT).toEqual({ rate: null, nextTime: null })
})

test("a refused or unreadable price or funding answer is null", () => {
  expect(O.parseQuotes(fixture("okx-error.json"))).toBeNull()
  expect(O.parseFunding(fixture("okx-error.json"))).toBeNull()
  expect(O.parseQuotes(null)).toBeNull()
  const blank = clone(fixture("okx-ticker-btc.json"))
  blank.data[0].last = ""
  expect(O.parseQuotes(blank)).toBeNull()
})

test("what OKX said is its msg", () => {
  expect(O.said(fixture("okx-error.json"))).toContain("doesn't exist")
  expect(O.said({ code: "0", data: [] })).toBe("")
  expect(O.said(null)).toBe("")
})

// ---- Candles ----

test("daily candles are UTC days, 300 to a request at most", () => {
  expect(O.dailyUrl("BTCUSDT", 2)).toBe("https://www.okx.com/api/v5/market/candles?instId=BTC-USDT-SWAP&bar=1Dutc&limit=2")
  expect(O.dailyUrl("BTCUSDT", 365)).toContain("limit=300")
  expect(O.dailyUrl("BTCUSDT", 0)).toContain("limit=1")
})

test("a year of days is two requests: the newest 300 and the older ones, with no gap", () => {
  const now = 1792887309
  const today = Math.floor(now / DAY) * DAY
  expect(O.dailyMore("BTCUSDT", 2, now)).toEqual([])
  expect(O.dailyMore("BTCUSDT", 300, now)).toEqual([])
  const more = O.dailyMore("BTCUSDT", 365, now)
  expect(more.length).toBe(1)
  expect(more[0]).toContain("/market/history-candles?instId=BTC-USDT-SWAP&bar=1Dutc")
  // The page ends at the oldest the first one holds, one candle past it.
  const after = Number(/after=(\d+)/.exec(more[0])[1])
  expect(after).toBe((today - 298 * DAY) * 1000)
  expect(today - 299 * DAY).toBeLessThan(after / 1000)
  // It asks for the rest of the year and one candle over.
  expect(more[0]).toContain("limit=67")
})

test("the pages of a long range together hold the range's candles", () => {
  const now = 1792887309
  expect(O.historyMore("BTCUSDT", "1W", now).length).toBe(2)
  expect(O.historyMore("BTCUSDT", "1M", now).length).toBe(2)
  expect(O.historyMore("BTCUSDT", "3M", now).length).toBe(0)
  expect(O.historyMore("BTCUSDT", "1Y", now).length).toBe(1)
  expect(O.historyMore("BTCUSDT", "2Y", now).length).toBe(2)
  expect(O.historyMore("BTCUSDT", "10Y", now).length).toBe(1)
  expect(O.historyMore("BTCUSDT", "All", now).length).toBe(0)
  expect(O.historyMore("BTCUSDT", "1D", now)).toEqual([])
})

test("the day's candles start at the UTC midnight given, a millisecond early", () => {
  const url = O.candlesUrl("BTCUSDT", 1792886400)
  expect(url).toContain("bar=5m")
  expect(url).toContain("before=1792886399999")
  expect(url).toContain("limit=300")
})

test("candles are read oldest first, in seconds, volume in the base coin", () => {
  const c = O.parseCandles(fixture("okx-candles-btc-d.json"))
  expect(c.length).toBe(3)
  expect(c[0].t).toBe(1792713600)
  expect(c[2]).toEqual({ t: 1792886400, open: 80850.1, high: 80850.1, low: 80739.1, close: 80744.5, volume: 510.661, turnover: 41247640.31198 })
})

test("a candle with a figure missing is left out whole; a refusal is null", () => {
  const json = clone(fixture("okx-candles-btc-d.json"))
  json.data[1][2] = ""
  expect(O.parseCandles(json).length).toBe(2)
  expect(O.parseCandles(fixture("okx-error.json"))).toBeNull()
})

test("a range asks for its own bar, and days, weeks and months are UTC", () => {
  const now = 1792887309
  expect(O.historyUrl("BTCUSDT", "1W", now)).toContain("bar=15m&limit=300")
  expect(O.historyUrl("BTCUSDT", "1M", now)).toContain("bar=1H")
  expect(O.historyUrl("BTCUSDT", "1Y", now)).toContain("bar=1Dutc")
  expect(O.historyUrl("BTCUSDT", "5Y", now)).toContain("bar=1Wutc")
  expect(O.historyUrl("BTCUSDT", "All", now)).toContain("bar=1Mutc")
  expect(O.historyUrl("BTCUSDT", "1D", now)).toBeNull()
})

test("year to date holds the days since 1 January, one more than they are", () => {
  const now = Date.UTC(2026, 11, 20) / 1000
  expect(O.historyMore("BTCUSDT", "YTD", 1792887309).length).toBe(0)
  const days = Math.floor((now - Date.UTC(2026, 0, 1) / 1000) / DAY)
  expect(days).toBeGreaterThan(299)
  expect(O.historyMore("BTCUSDT", "YTD", now).length).toBe(1)
  expect(O.historyMore("BTCUSDT", "YTD", now)[0]).toContain("limit=" + (days + 1 - 300 + 2))
})

test("a range's line has a bar per candle and the first open as its baseline", () => {
  const candles = O.parseCandles(fixture("okx-candles-btc-d.json"))
  const h = O.buildHistory("BTCUSDT", "3M", candles)
  expect(h.bars.length).toBe(3)
  expect(h.baseline).toBe(81380.9)
  expect(h.step).toBe(86400)
  expect(O.buildHistory("BTCUSDT", "3M", [])).toBeNull()
  expect(O.buildHistory("BTCUSDT", "1D", candles)).toBeNull()
})

// ---- The quote record ----

const record = (lineCandles, marketTime) => {
  const instrument = O.parseInstruments(fixture("okx-instruments.json")).instruments[0]
  const quotes = O.parseQuotes(fixture("okx-ticker-btc.json"))
  const funding = O.parseFunding(fixture("okx-funding-btc.json"))
  const candles = O.parseCandles(fixture("okx-candles-btc-d.json"))
  return O.buildQuote(instrument, quotes.prices.BTCUSDT, marketTime === undefined ? quotes.time : marketTime, candles,
    lineCandles, funding.BTCUSDT, quotes.stats.BTCUSDT)
}

test("the record has OKX's own 24-hour figures, and funding", () => {
  const q = record(O.parseCandles(fixture("okx-candles-btc-5.json")))
  expect(q.exchange).toBe("OKX")
  expect(q.symbol).toBe("BTCUSDT")
  expect(q.price).toBe(80744.5)
  expect(q.open24h).toBe(80888.8)
  expect(q.high24h).toBe(81061.4)
  expect(q.low24h).toBe(79168)
  expect(q.volume24h).toBe(59810.7146)
  // OKX sends no quote-coin volume for a swap: the base volume at the last price.
  expect(q.turnover24h).toBeCloseTo(59810.7146 * 80744.5, 4)
  expect(q.openInterest).toBeNull()
  expect(q.high52w).toBe(82047.6)
  expect(q.low52w).toBe(79168)
  expect(q.fundingRate).toBe(0.0000244791294062)
  expect(q.nextFundingTime).toBe(1792915200)
  expect(q.fundingInterval).toBeNull()
  expect(q.points.length).toBe(4)
  expect(q.points[0]).toEqual({ t: 1792886400, p: 80779.8 })
})

test("the line is the last 24 hours: candles older than that are left out", () => {
  const q = record(O.parseCandles(fixture("okx-candles-btc-5.json")), 1792887309 + DAY)
  expect(q.points).toEqual([])
  expect(q.high52w).toBe(82047.6)
})

test("no 24-hour stats give null figures, not a guess", () => {
  const q = O.buildQuote({ symbol: "X", name: "X" }, 1, 1792887309, [], [], null)
  expect(q.open24h).toBeNull()
  expect(q.turnover24h).toBeNull()
})

test("no price, no time or no instrument gives no record; no funding gives nulls", () => {
  expect(O.buildQuote(null, 1, 1, [], [], null)).toBeNull()
  expect(O.buildQuote({ symbol: "X" }, null, 1, [], [], null)).toBeNull()
  const q = O.buildQuote({ symbol: "X", name: "X" }, 1, 1792887309, [], [], null)
  expect(q.fundingRate).toBeNull()
})

// ---- Refusals ----

test("403 is a refusal, as 429 is, and waits ten minutes", () => {
  expect(F.answerKind(403, 0, O.limits.refusedStatuses)).toBe("refused")
  expect(F.answerKind(429, 0, O.limits.refusedStatuses)).toBe("refused")
  expect(F.answerKind(400, 0, O.limits.refusedStatuses)).toBe("missing")
  expect(O.limits.refusedPauseSeconds).toBe(600)
})
