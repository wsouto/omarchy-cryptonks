// The Bybit adapter and the fetch rules, tested on answers Bybit really sent
// (recorded on 2026-10-21 into test/fixtures/), so they pass without a
// network. The fixtures keep Bybit's own envelope and records; only the
// number of records is cut to a few chosen ones:
//
//   instruments.json   BTCUSDT, ETHUSDT (crypto, USDT), BTCPERP (crypto,
//                      USDC), BTCUSDT-06NOV26 (a dated future) and AAPLUSDT
//                      (a stock-like "TradFi" contract)
//   tickers.json       the same five, and OPENAIUSDT, a ticker with no
//                      instrument entry
//   kline-btcusdt-d.json   three daily candles of BTCUSDT, newest first
//
// Run with `bun test` (test/check.sh does).
import { test, expect } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { load } from "./load.js"

const B = load("adapters/bybit.js")
const F = load("Fetch.js")

const fixture = name => JSON.parse(readFileSync(join(import.meta.dir, "fixtures", name), "utf8"))
const clone = value => JSON.parse(JSON.stringify(value))

// Bybit's own order is kept, so tests ask for a symbol by name.
const symbolsOf = parsed => parsed.instruments.map(i => i.symbol).sort()
const instrument = (parsed, symbol) => parsed.instruments.find(i => i.symbol === symbol)

// ---- The symbols you can add ----

test("the instruments list is one request for every linear contract", () => {
  const url = B.instrumentsUrl()
  expect(url).toContain("/v5/market/instruments-info")
  expect(url).toContain("category=linear")
  expect(url).toContain("limit=1000")
})

test("only crypto perpetuals that trade are in scope", () => {
  const parsed = B.parseInstruments(fixture("instruments.json"))
  expect(symbolsOf(parsed)).toEqual(["BTCPERP", "BTCUSDT", "ETHUSDT"])
  expect(parsed.truncated).toBe(false)
})

test("a stock-like TradFi contract and a dated future are left out", () => {
  const symbols = symbolsOf(B.parseInstruments(fixture("instruments.json")))
  expect(symbols).not.toContain("AAPLUSDT")
  expect(symbols).not.toContain("BTCUSDT-06NOV26")
})

test("a contract not yet open is left out", () => {
  const json = clone(fixture("instruments.json"))
  const eth = json.result.list.find(x => x.symbol === "ETHUSDT")
  eth.status = "PreLaunch"
  const btc = json.result.list.find(x => x.symbol === "BTCUSDT")
  btc.isPreListing = true
  expect(symbolsOf(B.parseInstruments(json))).toEqual(["BTCPERP"])
})

test("an instrument carries what search and the record need", () => {
  const parsed = B.parseInstruments(fixture("instruments.json"))
  expect(instrument(parsed, "BTCUSDT")).toEqual({
    symbol: "BTCUSDT",
    name: "BTC",
    currency: "USDT",
    pair: "BTCUSDT",
    priceDigits: 2,
    firstTradeDate: 1584230400,
    fundingInterval: 480
  })
})

test("a USDC perpetual is found by its pair, though Bybit names it BTCPERP", () => {
  const perp = instrument(B.parseInstruments(fixture("instruments.json")), "BTCPERP")
  expect(perp.pair).toBe("BTCUSDC")
  expect(perp.currency).toBe("USDC")
})

test("a list Bybit says is incomplete is marked truncated", () => {
  const json = clone(fixture("instruments.json"))
  json.result.nextPageCursor = "page2"
  expect(B.parseInstruments(json).truncated).toBe(true)
})

test("an answer Bybit refused, or no answer, is null and not an empty list", () => {
  expect(B.parseInstruments({ retCode: 10006, retMsg: "Too many visits", result: {} })).toBeNull()
  expect(B.parseInstruments(null)).toBeNull()
  expect(B.parseInstruments({ retCode: 0, result: { list: "x" } })).toBeNull()
})

test("a price scale that is not a number is null, not a guess", () => {
  const json = clone(fixture("instruments.json"))
  json.result.list.find(x => x.symbol === "BTCUSDT").priceScale = ""
  expect(instrument(B.parseInstruments(json), "BTCUSDT").priceDigits).toBeNull()
})

// ---- The latest price ----

test("one request asks for every ticker", () => {
  const url = B.quotesUrl()
  expect(url).toContain("/v5/market/tickers")
  expect(url).toContain("category=linear")
  expect(url).not.toContain("symbol=")
})

test("the last traded price by symbol, and when Bybit answered in seconds", () => {
  const quotes = B.parseQuotes(fixture("tickers.json"))
  expect(quotes.time).toBe(1792623649)
  expect(quotes.prices.BTCUSDT).toBe(84440.8)
  expect(Object.keys(quotes.prices).sort()).toEqual(
    ["AAPLUSDT", "BTCPERP", "BTCUSDT", "BTCUSDT-06NOV26", "ETHUSDT", "OPENAIUSDT"])
})

test("a ticker with no price is left out", () => {
  const json = clone(fixture("tickers.json"))
  json.result.list.find(t => t.symbol === "ETHUSDT").lastPrice = ""
  expect("ETHUSDT" in B.parseQuotes(json).prices).toBe(false)
})

test("tickers Bybit refused are null", () => {
  expect(B.parseQuotes({ retCode: 10016, result: {} })).toBeNull()
})

// ---- Daily candles ----

test("daily candles are asked for by symbol and within Bybit's limits", () => {
  const url = B.dailyUrl("BTCUSDT", 365)
  expect(url).toContain("/v5/market/kline")
  expect(url).toContain("symbol=BTCUSDT")
  expect(url).toContain("interval=D")
  expect(url).toContain("limit=365")
  expect(B.dailyUrl("BTCUSDT", 5000)).toContain("limit=1000")
  expect(B.dailyUrl("BTCUSDT", 0)).toContain("limit=1")
  expect(B.dailyUrl("A B", 1)).toContain("symbol=A%20B")
})

test("candles come oldest first, in seconds, with numbers", () => {
  const candles = B.parseDaily(fixture("kline-btcusdt-d.json"))
  expect(candles.map(c => c.t)).toEqual([1792368000, 1792454400, 1792540800])
  expect(candles[2]).toEqual({
    t: 1792540800, open: 82991, high: 84880, low: 82588, close: 84440.8,
    volume: 63537.726, turnover: 5333887794.4113
  })
})

test("a candle with a figure missing is left out whole", () => {
  const json = clone(fixture("kline-btcusdt-d.json"))
  json.result.list[1][2] = ""
  expect(B.parseDaily(json).map(c => c.t)).toEqual([1792368000, 1792540800])
})

// ---- The quote record ----

const btc = () => instrument(B.parseInstruments(fixture("instruments.json")), "BTCUSDT")
const quotes = () => B.parseQuotes(fixture("tickers.json"))
const candles = () => B.parseDaily(fixture("kline-btcusdt-d.json"))

test("the record is the one QUOTE-RECORD.md describes", () => {
  const q = quotes()
  const record = B.buildQuote(btc(), q.prices.BTCUSDT, q.time, candles())
  expect(record).toEqual({
    symbol: "BTCUSDT",
    name: "BTC",
    exchange: "Bybit",
    instrumentType: "PERPETUAL",
    currency: "USDT",
    priceDigits: 2,
    price: 84440.8,
    marketTime: 1792623649,
    dayOpen: 82991,
    dayHigh: 84880,
    dayLow: 82588,
    volume: 63537.726,
    turnover: 5333887794.4113,
    high52w: 84880,
    low52w: 81150,
    firstTradeDate: 1584230400,
    fundingInterval: 480,
    points: null
  })
})

test("a newest candle from another day gives no day figures, not the wrong day's", () => {
  const q = quotes()
  const record = B.buildQuote(btc(), q.prices.BTCUSDT, q.time + 86400, candles())
  expect(record.dayOpen).toBeNull()
  expect(record.dayHigh).toBeNull()
  expect(record.dayLow).toBeNull()
  expect(record.volume).toBeNull()
  expect(record.turnover).toBeNull()
  expect(record.high52w).toBe(84880)
  expect(record.price).toBe(84440.8)
})

test("with no candles, only what is known is in the record", () => {
  const q = quotes()
  const record = B.buildQuote(btc(), q.prices.BTCUSDT, q.time, [])
  expect(record.price).toBe(84440.8)
  expect(record.dayOpen).toBeNull()
  expect(record.high52w).toBeNull()
  expect(record.low52w).toBeNull()
})

test("there is no record without a price or an instrument", () => {
  const q = quotes()
  expect(B.buildQuote(btc(), null, q.time, candles())).toBeNull()
  expect(B.buildQuote(null, 1, q.time, candles())).toBeNull()
})

test("the year's range is the last 365 candles, so an older high is not in it", () => {
  const made = (t, high, low) => ({ t, open: 1, high, low, close: 1, volume: 1, turnover: 1 })
  const days = []
  for (let i = 0; i < 400; i++) days.push(made(i * 86400, i < 35 ? 1000 : 10, i < 35 ? 1 : 5))
  const record = B.buildQuote(btc(), 7, 399 * 86400 + 60, days)
  expect(record.high52w).toBe(10)
  expect(record.low52w).toBe(5)
})

// ---- The fetch rules ----

const run = (status, exit = 0, retryAfter = "", body = "{}") =>
  `${body}\n${F.ANSWER_MARK} 1 ${String(status).padStart(3, "0")} ${exit} ${retryAfter}\n`

test("curl is asked for compressed, capped, timed-out answers", () => {
  const cmd = F.curlCommand(["https://a", "https://b"], F.TICKERS_CAP)
  expect(cmd[0]).toBe("curl")
  expect(cmd).toContain("--compressed")
  expect(cmd[cmd.indexOf("--max-filesize") + 1]).toBe(String(F.TICKERS_CAP))
  expect(cmd.slice(-2)).toEqual(["https://a", "https://b"])
})

test("the caps are above the answers Bybit sent", () => {
  expect(F.INSTRUMENTS_CAP).toBeGreaterThan(850605)
  expect(F.TICKERS_CAP).toBeGreaterThan(678372)
})

test("a whole 200 answer is ok and its body is the sole body", () => {
  const text = run(200, 0, "", '{"retCode":0}')
  expect(F.answers(text)[0].kind).toBe("ok")
  expect(F.soleBody(text)).toBe('{"retCode":0}')
})

test("no answer at all is none", () => {
  expect(F.answers(run(0, 6))[0].kind).toBe("none")
  expect(F.soleBody(run(0, 6))).toBe("")
})

test("429 and 503 are refusals, with the wait Retry-After names", () => {
  expect(F.answers(run(429, 0, "30"))[0]).toMatchObject({ kind: "refused", retryAfter: 30 })
  expect(F.answers(run(503))[0]).toMatchObject({ kind: "refused", retryAfter: 0 })
})

test("Bybit's 403 is a refusal that waits 10 minutes, once the adapter's limits are given", () => {
  expect(F.answers(run(403), B.limits)[0]).toMatchObject({ kind: "refused", retryAfter: 600 })
  expect(F.answers(run(403, 0, "20"), B.limits)[0]).toMatchObject({ kind: "refused", retryAfter: 20 })
})

test("without limits a 403 is just a wrong question", () => {
  expect(F.answers(run(403))[0].kind).toBe("missing")
})

test("a cut answer or a server error is bad", () => {
  expect(F.answers(run(200, 63))[0].kind).toBe("bad")
  expect(F.answers(run(500))[0].kind).toBe("bad")
})

// ---- The files copied unchanged still load ----

test("the copied rule files load", () => {
  for (const file of ["Format.js", "Tones.js", "Cells.js"]) {
    expect(Object.keys(load(file)).length).toBeGreaterThan(0)
  }
})
