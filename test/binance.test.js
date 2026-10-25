// The Binance adapter, tested on answers Binance really sent (recorded on
// 2026-10-24 into test/fixtures/binance-*), so they pass without a network.
// The fixtures keep Binance's own records; only the number of records is cut:
//
//   binance-exchangeinfo.json   BTCUSDT, ETHUSDT (in scope), BTCDOMUSDT (an
//                               index), BTCUSDC (USDC), BTCUSDT_261225 (a
//                               dated future), OMGUSDT (settling)
//   binance-ticker-24hr.json    ticker/24hr of BTCUSDT and ETHUSDT
//   binance-premium.json        premiumIndex of the same two
//   binance-kline-btcusdt-d.json   three daily candles, oldest first
//   binance-kline-btcusdt-5.json   the 5-minute candles of 2026-10-24 (UTC)
//   binance-error.json          the 400 answer to an invalid symbol
import { test, expect } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { load } from "./load.js"

const N = load("adapters/binance.js")
const F = load("Fetch.js")

const fixture = name => JSON.parse(readFileSync(join(import.meta.dir, "fixtures", name), "utf8"))
const clone = value => JSON.parse(JSON.stringify(value))
const symbolsOf = parsed => parsed.instruments.map(i => i.symbol).sort()

// ---- The symbols you can add ----

test("only crypto USDT perpetuals that trade are in scope", () => {
  const parsed = N.parseInstruments(fixture("binance-exchangeinfo.json"))
  expect(symbolsOf(parsed)).toEqual(["BTCUSDT", "ETHUSDT"])
  expect(parsed.truncated).toBe(false)
  expect(parsed.cursor).toBe("")
})

test("an index, a dated future, a USDC contract and a settling one are left out", () => {
  const symbols = symbolsOf(N.parseInstruments(fixture("binance-exchangeinfo.json")))
  for (const s of ["BTCDOMUSDT", "BTCUSDT_261225", "BTCUSDC", "OMGUSDT"]) expect(symbols).not.toContain(s)
})

test("an instrument carries what search and the record need; the name is the base coin", () => {
  const found = N.parseInstruments(fixture("binance-exchangeinfo.json")).instruments.find(i => i.symbol === "BTCUSDT")
  expect(found).toEqual({
    symbol: "BTCUSDT",
    name: "BTC",
    currency: "USDT",
    priceDigits: 2,
    firstTradeDate: 1567965300,
    fundingInterval: null
  })
})

test("an answer Binance refused, or no answer, is null and not an empty list", () => {
  expect(N.parseInstruments(fixture("binance-error.json"))).toBeNull()
  expect(N.parseInstruments(null)).toBeNull()
  expect(N.parseInstruments({ symbols: "x" })).toBeNull()
})

test("an instrument is asked for with the whole list, which Binance cannot narrow", () => {
  expect(N.instrumentUrl("BTCUSDT")).toBe("https://fapi.binance.com/fapi/v1/exchangeInfo")
  expect(N.instrumentsUrl("ignored")).toBe("https://fapi.binance.com/fapi/v1/exchangeInfo")
})

// ---- The latest price and funding ----

test("one request asks for every price, or for the one symbol wanted", () => {
  expect(N.quotesUrl([])).toBe("https://fapi.binance.com/fapi/v1/ticker/24hr")
  expect(N.quotesUrl(["BTCUSDT", "ETHUSDT"])).not.toContain("symbol=")
  expect(N.quotesUrl(["BTCUSDT"])).toContain("?symbol=BTCUSDT")
  expect(N.fundingUrl("BTCUSDT")).toBe("https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT")
})

test("the last price by symbol, and when Binance answered in seconds", () => {
  const quotes = N.parseQuotes(fixture("binance-ticker-24hr.json"))
  expect(quotes.time).toBe(1792902573)
  expect(quotes.prices).toEqual({ BTCUSDT: 80844.2, ETHUSDT: 2364.48 })
  expect(quotes.funding).toEqual({})
})

test("the rolling 24 hours by symbol: open, high, low, and volume in both coins", () => {
  const quotes = N.parseQuotes(fixture("binance-ticker-24hr.json"))
  expect(quotes.stats.BTCUSDT).toEqual({ open: 80826.4, high: 80999.9, low: 79178.6, volume: 106084.847, turnover: 8510918698.12 })
  const json = clone(fixture("binance-ticker-24hr.json"))
  json[1].openPrice = ""
  expect(N.parseQuotes(json).stats.ETHUSDT.open).toBeNull()
})

test("one symbol's answer is an object, not a list, and reads the same", () => {
  const one = N.parseQuotes(fixture("binance-ticker-24hr.json")[0])
  expect(one.prices).toEqual({ BTCUSDT: 80844.2 })
})

test("funding by symbol: the next rate and when it settles, in seconds", () => {
  const f = N.parseFunding(fixture("binance-premium.json"))
  expect(f.BTCUSDT).toEqual({ rate: 0.00009435, nextTime: 1792886400 })
  expect(f.ETHUSDT.rate).toBe(0.00003639)
})

test("a funding rate or time that is missing is null", () => {
  const json = clone(fixture("binance-premium.json"))
  json[0].lastFundingRate = ""; json[0].nextFundingTime = 0
  expect(N.parseFunding(json).ETHUSDT).toEqual({ rate: null, nextTime: null })
})

test("a refused or unreadable price or funding answer is null", () => {
  expect(N.parseQuotes(fixture("binance-error.json"))).toBeNull()
  expect(N.parseFunding(fixture("binance-error.json"))).toBeNull()
  expect(N.parseQuotes(null)).toBeNull()
  expect(N.parseQuotes([{ symbol: "BTCUSDT", lastPrice: "", closeTime: 1 }])).toBeNull()
})

test("what Binance said is its msg", () => {
  expect(N.said(fixture("binance-error.json"))).toBe("Invalid symbol.")
  expect(N.said({})).toBe("")
})

// ---- Candles ----

test("daily candles are asked for by count, capped at 1500", () => {
  expect(N.dailyUrl("BTCUSDT", 365)).toContain("interval=1d&limit=365")
  expect(N.dailyUrl("BTCUSDT", 5000)).toContain("limit=1500")
  expect(N.dailyUrl("BTCUSDT", 0)).toContain("limit=1")
})

test("the day's candles start at the UTC midnight given, in milliseconds", () => {
  const url = N.candlesUrl("BTCUSDT", 1792800000)
  expect(url).toContain("interval=5m")
  expect(url).toContain("startTime=1792800000000")
  expect(url).toContain("limit=288")
})

test("candles are read as Binance sends them, oldest first, in seconds", () => {
  const c = N.parseCandles(fixture("binance-kline-btcusdt-d.json"))
  expect(c.length).toBe(3)
  expect(c[0].t).toBe(1792627200)
  expect(c[2]).toEqual({ t: 1792800000, open: 81159.9, high: 81190.7, low: 79178.6, close: 80891.4, volume: 110747.96, turnover: 8888047285.3744 })
})

test("a candle with a figure missing is left out whole; a refusal is null", () => {
  const json = clone(fixture("binance-kline-btcusdt-d.json"))
  json[1][2] = ""
  expect(N.parseCandles(json).length).toBe(2)
  expect(N.parseCandles(fixture("binance-error.json"))).toBeNull()
})

test("a range asks for its own interval, from its own start", () => {
  const now = 1792886132
  expect(N.historyUrl("BTCUSDT", "1W", now)).toContain("interval=15m&startTime=" + (now - 7 * 86400) * 1000)
  expect(N.historyUrl("BTCUSDT", "1M", now)).toContain("interval=1h")
  expect(N.historyUrl("BTCUSDT", "YTD", now)).toContain("startTime=" + Date.UTC(2026, 0, 1))
  expect(N.historyUrl("BTCUSDT", "5Y", now)).toContain("interval=1w")
  const all = N.historyUrl("BTCUSDT", "All", now)
  expect(all).toContain("interval=1M")
  expect(all).not.toContain("startTime")
  expect(N.historyUrl("BTCUSDT", "1D", now)).toBeNull()
})

test("a range's line has a bar per candle and the first open as its baseline", () => {
  const candles = N.parseCandles(fixture("binance-kline-btcusdt-d.json"))
  const h = N.buildHistory("BTCUSDT", "3M", candles)
  expect(h.bars.length).toBe(3)
  expect(h.baseline).toBe(84049.9)
  expect(h.step).toBe(86400)
  expect(N.buildHistory("BTCUSDT", "3M", [])).toBeNull()
  expect(N.buildHistory("BTCUSDT", "1D", candles)).toBeNull()
})

// ---- The quote record ----

// The 5-minute fixture is the UTC day before 2026-10-25 00:00, so a line read
// at its last candle holds all 288.
const LAST_FIVE = 1792886100
const record = (lineCandles, marketTime) => {
  const instrument = N.parseInstruments(fixture("binance-exchangeinfo.json")).instruments[0]
  const quotes = N.parseQuotes(fixture("binance-ticker-24hr.json"))
  const funding = N.parseFunding(fixture("binance-premium.json"))
  const candles = N.parseCandles(fixture("binance-kline-btcusdt-d.json"))
  return N.buildQuote(instrument, quotes.prices.BTCUSDT, marketTime === undefined ? LAST_FIVE : marketTime, candles,
    lineCandles, funding.BTCUSDT, quotes.stats.BTCUSDT)
}

test("the record has Binance's own 24-hour figures, and funding", () => {
  const q = record(N.parseCandles(fixture("binance-kline-btcusdt-5.json")))
  expect(q.exchange).toBe("Binance")
  expect(q.price).toBe(80844.2)
  expect(q.open24h).toBe(80826.4)
  expect(q.high24h).toBe(80999.9)
  expect(q.low24h).toBe(79178.6)
  expect(q.volume24h).toBe(106084.847)
  expect(q.turnover24h).toBe(8510918698.12)
  expect(q.openInterest).toBeNull()
  expect(q.high52w).toBe(84330)
  expect(q.low52w).toBe(79178.6)
  expect(q.fundingRate).toBe(0.00009435)
  expect(q.nextFundingTime).toBe(1792886400)
  expect(q.fundingInterval).toBeNull()
  expect(q.points.length).toBe(288)
  expect(q.points[0]).toEqual({ t: 1792800000, p: 81127.3 })
})

test("the line is the last 24 hours: a candle older than that is left out", () => {
  const q = record(N.parseCandles(fixture("binance-kline-btcusdt-5.json")), LAST_FIVE + 3600)
  expect(q.points.length).toBe(288 - 12)
  expect(q.points[0].t).toBe(LAST_FIVE + 3600 - 86400 + 300)
})

test("no 24-hour stats give null figures, not a guess", () => {
  const q = N.buildQuote({ symbol: "X", name: "X" }, 1, 1792886132, [], [], null)
  expect(q.open24h).toBeNull()
  expect(q.volume24h).toBeNull()
})

test("no price, no time or no instrument gives no record; no funding gives nulls", () => {
  expect(N.buildQuote(null, 1, 1, [], [], null)).toBeNull()
  expect(N.buildQuote({ symbol: "X" }, null, 1, [], [], null)).toBeNull()
  const q = N.buildQuote({ symbol: "X", name: "X" }, 1, 1792886132, [], [], null)
  expect(q.fundingRate).toBeNull()
  expect(q.nextFundingTime).toBeNull()
})

// ---- Refusals ----

test("418 and 451 are refusals, as 429 is, and wait ten minutes", () => {
  expect(F.answerKind(418, 0, N.limits.refusedStatuses)).toBe("refused")
  expect(F.answerKind(451, 0, N.limits.refusedStatuses)).toBe("refused")
  expect(F.answerKind(429, 0, N.limits.refusedStatuses)).toBe("refused")
  expect(F.answerKind(400, 0, N.limits.refusedStatuses)).toBe("missing")
  expect(N.limits.refusedPauseSeconds).toBe(600)
})
