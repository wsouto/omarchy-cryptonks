// What one refresh's answers mean for the pill: the quote it shows, and the
// words behind its "!". Runs are built from the answers Bybit really sent
// (test/fixtures/), joined as curl joins them, so they pass without a
// network.
import { test, expect } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { load } from "./load.js"

const B = load("adapters/bybit.js")
const F = load("Fetch.js")
const R = load("Refresh.js")

const body = name => readFileSync(join(import.meta.dir, "fixtures", name), "utf8")
const btc = () => B.parseInstruments(JSON.parse(body("instruments.json"))).instruments.find(i => i.symbol === "BTCUSDT")

// One answer of a run, as curl writes it.
const answer = (index, status, text = "{}", exit = 0, retryAfter = "") =>
  `${text}\n${F.ANSWER_MARK} ${index} ${String(status).padStart(3, "0")} ${exit} ${retryAfter}\n`

// The run of a first refresh: tickers, candles and the instrument.
const FIRST = ["quotes", "daily", "instrument"]
const whole = () =>
  answer(0, 200, body("tickers.json")) + answer(1, 200, body("kline-btcusdt-d.json")) + answer(2, 200, body("instruments.json"))

// What the feed kept: an instrument, and no candles yet.
const keep = instrument => instrument ? { symbol: instrument.symbol, instrument, candles: null } : null
const read = (text, asked = FIRST, instrument = null, symbol = "BTCUSDT") =>
  R.read(F.answers(text, B.limits), asked, symbol, keep(instrument), B)

test("a whole run gives the quote and keeps the instrument", () => {
  const got = read(whole())
  expect(got.problem).toBe("")
  expect(got.wait).toBe(0)
  expect(got.kept.instrument).toEqual(btc())
  expect(got.quote.price).toBe(84440.8)
  expect(got.quote.dayOpen).toBe(82991)
})

test("a later run uses the instrument kept from before", () => {
  const text = answer(0, 200, body("tickers.json")) + answer(1, 200, body("kline-btcusdt-d.json"))
  const got = read(text, ["quotes", "daily"], btc())
  expect(got.problem).toBe("")
  expect(got.quote.symbol).toBe("BTCUSDT")
})

test("a refusal pauses for as long as Bybit asks and shows no new quote", () => {
  const got = read(answer(0, 403) + answer(1, 200, body("kline-btcusdt-d.json")), ["quotes", "daily"], btc())
  expect(got.wait).toBe(600)
  expect(got.quote).toBeNull()
  expect(got.problem).toContain("waiting 10 minutes")
  expect(read(answer(0, 429, "{}", 0, "30"), ["quotes"], btc()).problem).toContain("waiting 30 seconds")
})

test("no answer from the network says so", () => {
  const got = read(answer(0, 0, "", 6), ["quotes"], btc())
  expect(got.problem).toBe("No network")
  expect(got.quote).toBeNull()
})

test("a server error names its HTTP status", () => {
  expect(read(answer(0, 500), ["quotes"], btc()).problem).toBe("Bybit sent an error (HTTP 500)")
})

test("an answer that is not JSON says it cannot be read", () => {
  expect(read(answer(0, 200, "<html>"), ["quotes"], btc()).problem).toBe("Bybit sent an answer that cannot be read")
})

test("tickers Bybit turned down give Bybit's own words", () => {
  const text = answer(0, 200, '{"retCode":10001,"retMsg":"params error"}') + answer(1, 200, body("kline-btcusdt-d.json"))
  expect(read(text, ["quotes", "daily"], btc()).problem).toBe("Bybit: params error")
})

test("a symbol Bybit does not list as a USDT perpetual says so", () => {
  const empty = '{"retCode":0,"retMsg":"OK","result":{"list":[]}}'
  const text = answer(0, 200, body("tickers.json")) + answer(1, 200, body("kline-btcusdt-d.json")) + answer(2, 200, empty)
  const got = read(text, FIRST, null, "NOPEUSDT")
  expect(got.problem).toBe("NOPEUSDT is not a USDT perpetual that trades on Bybit")
  expect(got.kept.instrument).toBeNull()
})

test("a half answer never replaces a whole quote", () => {
  const got = read(answer(0, 200, body("tickers.json")), ["quotes", "daily"], btc())
  expect(got.quote).toBeNull()
  expect(got.problem).not.toBe("")
})

// ---- The words for each failure ----

test("candles Bybit turned down give Bybit's own words, not 'no price'", () => {
  const text = answer(0, 200, body("tickers.json")) + answer(1, 200, '{"retCode":10001,"retMsg":"kline refused"}')
  expect(read(text, ["quotes", "daily"], btc()).problem).toBe("Bybit: kline refused")
})

test("a 403 names both of its causes: too many requests, or Bybit blocked here", () => {
  const got = read(answer(0, 403), ["quotes"], btc())
  expect(got.problem).toBe("Bybit refused us (too many requests from this IP, or Bybit is not available where you are): waiting 10 minutes")
  expect(read(answer(0, 429, "{}", 0, "30"), ["quotes"], btc()).problem).toBe("Bybit asked for fewer requests: waiting 30 seconds")
})

test("a run with no answer at all blames curl, not Bybit", () => {
  expect(read("", ["quotes", "daily"], btc()).problem).toBe("curl sent nothing: is it installed?")
})

test("a run that stopped partway says an answer is missing", () => {
  const got = read(answer(0, 200, body("tickers.json")), ["quotes", "daily"], btc())
  expect(got.problem).toBe("The refresh stopped before every answer came")
})

// ---- What a refresh asks for, and what it keeps ----

const DAY = 86400
const NOW = 1792623649
const TODAY = Math.floor(NOW / DAY) * DAY
const candle = (t, high = 10, low = 5) => ({ t, open: 7, high, low, close: 7, volume: 1, turnover: 1 })
const days = (from, count) => Array.from({ length: count }, (_, i) => candle(from + i * DAY))
const roles = plan => plan.asked
const limitOf = plan => Number(plan.urls[plan.asked.indexOf("daily")].match(/limit=(\d+)/)[1])

test("the first refresh asks for the instrument and a year of candles", () => {
  const plan = R.plan(B, "BTCUSDT", null, NOW)
  expect(roles(plan)).toEqual(["quotes", "daily", "instrument"])
  expect(limitOf(plan)).toBe(365)
  expect(plan.urls[2]).toContain("symbol=BTCUSDT")
})

test("once a year is kept, each minute asks for two candles and no instrument", () => {
  const kept = { symbol: "BTCUSDT", instrument: btc(), candles: days(TODAY - 364 * DAY, 365) }
  const plan = R.plan(B, "BTCUSDT", kept, NOW)
  expect(roles(plan)).toEqual(["quotes", "daily"])
  expect(limitOf(plan)).toBe(2)
})

test("after days asleep, a refresh asks for every day missed", () => {
  const kept = { symbol: "BTCUSDT", instrument: btc(), candles: days(TODAY - 367 * DAY, 365) }
  expect(limitOf(R.plan(B, "BTCUSDT", kept, NOW))).toBe(4)
})

test("what was kept for another symbol is asked for again", () => {
  const eth = { symbol: "ETHUSDT", instrument: { ...btc(), symbol: "ETHUSDT", name: "ETH" }, candles: days(TODAY - 364 * DAY, 365) }
  const plan = R.plan(B, "BTCUSDT", eth, NOW)
  expect(roles(plan)).toEqual(["quotes", "daily", "instrument"])
  expect(limitOf(plan)).toBe(365)
})

test("an instrument kept for another symbol never labels this one's price", () => {
  const eth = { symbol: "ETHUSDT", instrument: { ...btc(), symbol: "ETHUSDT", name: "ETH", priceDigits: 2 }, candles: null }
  const text = answer(0, 200, body("tickers.json")) + answer(1, 200, body("kline-btcusdt-d.json"))
  const got = R.read(F.answers(text, B.limits), ["quotes", "daily"], "BTCUSDT", eth, B)
  expect(got.quote).toBeNull()
  expect(got.kept.symbol).toBe("BTCUSDT")
  expect(got.kept.instrument).toBeNull()
})

test("fresh candles replace kept ones of the same day, and a year is kept", () => {
  const kept = days(TODAY - 364 * DAY, 365)
  const merged = R.mergeDaily(kept, [candle(TODAY - DAY, 99, 1), candle(TODAY + DAY)])
  expect(merged.length).toBe(365)
  expect(merged[0].t).toBe(TODAY - 363 * DAY)
  expect(merged.at(-2)).toEqual(candle(TODAY, 10, 5))
  expect(merged.at(-3)).toEqual(candle(TODAY - DAY, 99, 1))
  expect(merged.at(-1).t).toBe(TODAY + DAY)
})

test("the year's range comes from the kept candles, today's from the fresh ones", () => {
  // A year ending today, with its high and low 200 days ago; the fixture's
  // candles are the last three days, so they replace the kept ones.
  const year = days(TODAY - 364 * DAY, 365).map(c => c.t === TODAY - 200 * DAY ? candle(c.t, 99999, 1) : c)
  const kept = { symbol: "BTCUSDT", instrument: btc(), candles: year }
  const text = answer(0, 200, body("tickers.json")) + answer(1, 200, body("kline-btcusdt-d.json"))
  const got = R.read(F.answers(text, B.limits), ["quotes", "daily"], "BTCUSDT", kept, B)
  expect(got.quote.high52w).toBe(99999)
  expect(got.quote.low52w).toBe(1)
  expect(got.quote.dayOpen).toBe(82991)
  expect(got.kept.candles.length).toBe(365)
})
