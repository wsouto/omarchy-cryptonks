// What a refresh's answers mean for the pill and the rows: the quotes they
// show, and the words behind a "!". Runs are built from the answers Bybit really sent
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

// The run of a first refresh: tickers, daily candles, today's 5-minute
// candles and the instrument. The 5-minute fixture is a day later than the
// tickers, so its candles are not the tickers' day: tests of the line move
// the tickers' time to its own.
const FIRST = ["quotes", "daily", "day", "instrument"]
const LATER = ["quotes", "daily", "day"]
const later = () =>
  answer(0, 200, body("tickers.json")) + answer(1, 200, body("kline-btcusdt-d.json")) + answer(2, 200, body("kline-btcusdt-5.json"))
const whole = () => later() + answer(3, 200, body("instruments.json"))

// What the feed kept: an instrument, and no candles yet.
const keep = instrument => instrument ? { symbol: instrument.symbol, instrument, candles: null, day: null, histories: {} } : null
const read = (text, asked = FIRST, instrument = null, symbol = "BTCUSDT") =>
  R.read(F.answers(text, B.limits), asked, symbol, keep(instrument), B)

test("the quote carries the symbol's funding from the tickers", () => {
  const got = read(whole())
  expect(got.quote.fundingRate).toBe(0.00003087)
  expect(got.quote.nextFundingTime).toBeGreaterThan(0)
})

test("a whole run gives the quote and keeps the instrument", () => {
  const got = read(whole())
  expect(got.problem).toBe("")
  expect(got.wait).toBe(0)
  expect(got.kept.instrument).toEqual(btc())
  expect(got.quote.price).toBe(84440.8)
  expect(got.quote.dayOpen).toBe(82991)
})

test("a later run uses the instrument kept from before", () => {
  const got = read(later(), LATER, btc())
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
  const text = later() + answer(3, 200, empty)
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
const limitOf = plan => Number(plan.urls[1].match(/limit=(\d+)/)[1])

test("the featured symbol's first refresh asks for the instrument and a year of candles", () => {
  const plan = R.plan(B, "BTCUSDT", null, NOW, true, true)
  expect(roles(plan)).toEqual(["quotes", "year", "day", "instrument"])
  expect(limitOf(plan)).toBe(365)
  expect(plan.urls[3]).toContain("symbol=BTCUSDT")
})

test("a row's first refresh asks for no daily candles: its day comes from the 5-minute ones", () => {
  expect(roles(R.plan(B, "BTCUSDT", null, NOW))).toEqual(["quotes", "day", "instrument"])
})

test("a row that becomes featured asks for its year once", () => {
  const kept = { symbol: "BTCUSDT", instrument: btc(), candles: days(TODAY - DAY, 2), year: false }
  expect(limitOf(R.plan(B, "BTCUSDT", kept, NOW, true, true))).toBe(365)
  const text = answer(0, 200, body("tickers.json")) + answer(1, 200, body("kline-btcusdt-d.json")) + answer(2, 200, body("kline-btcusdt-5.json"))
  const got = R.read(F.answers(text, B.limits), ["quotes", "year", "day"], "BTCUSDT", kept, B)
  expect(got.kept.year).toBe(true)
  expect(limitOf(R.plan(B, "BTCUSDT", got.kept, NOW, true, true))).toBeLessThan(365)
})

test("once a year is kept, each minute asks for two candles and no instrument", () => {
  const kept = { symbol: "BTCUSDT", instrument: btc(), candles: days(TODAY - 364 * DAY, 365), year: true }
  const plan = R.plan(B, "BTCUSDT", kept, NOW, true, true)
  expect(roles(plan)).toEqual(LATER)
  expect(limitOf(plan)).toBe(2)
})

test("after days asleep, a refresh asks for every day missed", () => {
  const kept = { symbol: "BTCUSDT", instrument: btc(), candles: days(TODAY - 367 * DAY, 365), year: true }
  expect(limitOf(R.plan(B, "BTCUSDT", kept, NOW, true, true))).toBe(4)
})

test("what was kept for another symbol is asked for again", () => {
  const eth = { symbol: "ETHUSDT", instrument: { ...btc(), symbol: "ETHUSDT", name: "ETH" }, candles: days(TODAY - 364 * DAY, 365), year: true }
  const plan = R.plan(B, "BTCUSDT", eth, NOW, true, true)
  expect(roles(plan)).toEqual(["quotes", "year", "day", "instrument"])
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

test("fresh candles replace kept ones that start at the same time, in order", () => {
  const kept = days(TODAY - 364 * DAY, 365)
  const merged = R.mergeCandles(kept, [candle(TODAY - DAY, 99, 1), candle(TODAY + DAY)])
  expect(merged.length).toBe(366)
  expect(merged[0].t).toBe(TODAY - 364 * DAY)
  expect(merged.at(-2)).toEqual(candle(TODAY, 10, 5))
  expect(merged.at(-3)).toEqual(candle(TODAY - DAY, 99, 1))
  expect(merged.at(-1).t).toBe(TODAY + DAY)
})

test("the year's range comes from the kept candles, today's from the fresh ones", () => {
  // A year ending today, with its high and low 200 days ago; the fixture's
  // candles are the last three days, so they replace the kept ones.
  const year = days(TODAY - 364 * DAY, 365).map(c => c.t === TODAY - 200 * DAY ? candle(c.t, 99999, 1) : c)
  const kept = { symbol: "BTCUSDT", instrument: btc(), candles: year, day: null }
  const got = R.read(F.answers(later(), B.limits), LATER, "BTCUSDT", kept, B)
  expect(got.quote.high52w).toBe(99999)
  expect(got.quote.low52w).toBe(1)
  expect(got.quote.dayOpen).toBe(82991)
  expect(got.kept.candles.length).toBe(365)
})

// ---- The day's line ----

const FIVE = 300
const startOf = plan => Number(plan.urls[plan.asked.indexOf("day")].match(/start=(\d+)/)[1]) / 1000
const fives = (from, count) => Array.from({ length: count }, (_, i) => candle(from + i * FIVE))

test("the first refresh asks for today's 5-minute candles from 00:00 UTC", () => {
  expect(startOf(R.plan(B, "BTCUSDT", null, NOW))).toBe(TODAY)
})

test("later refreshes ask again from the newest kept candle, still open when it came", () => {
  const kept = { symbol: "BTCUSDT", instrument: btc(), candles: null, day: fives(TODAY, 10) }
  expect(startOf(R.plan(B, "BTCUSDT", kept, NOW))).toBe(TODAY + 9 * FIVE)
})

test("after midnight, yesterday's candles are not asked for again", () => {
  const kept = { symbol: "BTCUSDT", instrument: btc(), candles: null, day: fives(TODAY - DAY, 288) }
  expect(startOf(R.plan(B, "BTCUSDT", kept, NOW))).toBe(TODAY)
})

// The tickers moved to the 5-minute fixture's own time, so both are of one day.
const sameDay = () => {
  const day = JSON.parse(body("kline-btcusdt-5.json"))
  const tickers = JSON.parse(body("tickers.json"))
  tickers.time = day.time
  return { day, text: answer(0, 200, JSON.stringify(tickers)) + answer(1, 200, body("kline-btcusdt-d.json")) + answer(2, 200, JSON.stringify(day)) }
}

test("the quote's line is today's candles, and only today's are kept", () => {
  const { day, text } = sameDay()
  const today = Math.floor(day.time / 1000 / DAY) * DAY
  const kept = { symbol: "BTCUSDT", instrument: btc(), candles: null, day: [candle(today - FIVE)] }
  const got = R.read(F.answers(text, B.limits), LATER, "BTCUSDT", kept, B)
  expect(got.problem).toBe("")
  expect(got.kept.day.length).toBe(day.result.list.length)
  expect(got.kept.day[0].t).toBe(today)
  expect(got.quote.points.length).toBe(day.result.list.length)
})

test("a row's day is its 5-minute candles folded: open, close, extremes and sums", () => {
  const day = JSON.parse(body("kline-btcusdt-5.json"))
  const tickers = JSON.parse(body("tickers.json"))
  tickers.time = day.time
  const today = Math.floor(day.time / 1000 / DAY) * DAY
  const fives = B.parseCandles(day).filter(c => c.t >= today)
  const text = answer(0, 200, JSON.stringify(tickers)) + answer(1, 200, JSON.stringify(day))
  const got = R.read(F.answers(text, B.limits), ["quotes", "day"], "BTCUSDT", keep(btc()), B)
  expect(got.problem).toBe("")
  expect(got.quote.dayOpen).toBe(fives[0].open)
  expect(got.quote.dayHigh).toBe(Math.max(...fives.map(c => c.high)))
  expect(got.quote.dayLow).toBe(Math.min(...fives.map(c => c.low)))
  expect(got.quote.volume).toBeCloseTo(fives.reduce((a, c) => a + c.volume, 0))
  expect(got.kept.candles).toBeNull()
})

test("today's folded candle replaces a daily one kept from when the row was featured", () => {
  const c = (t, open, high, low, close) => ({ t, open, high, low, close, volume: 1, turnover: 2 })
  expect(R.dayCandle([c(TODAY - FIVE, 1, 1, 1, 1), c(TODAY, 5, 9, 4, 6), c(TODAY + FIVE, 6, 7, 2, 3)], TODAY))
    .toEqual([{ t: TODAY, open: 5, high: 9, low: 2, close: 3, volume: 2, turnover: 4 }])
  expect(R.dayCandle([], TODAY)).toEqual([])
  expect(R.dayCandle(null, TODAY)).toEqual([])
})

test("an instrument from the exchange's list is not asked for; one not in it still is", () => {
  const listed = { BTCUSDT: btc() }
  const kept = R.withListed({}, ["BTCUSDT", "NEWUSDT"], listed)
  expect(kept.BTCUSDT.instrument).toEqual(btc())
  expect(kept.NEWUSDT).toBeUndefined()
  const plan = R.planRun(B, ["BTCUSDT", "NEWUSDT"], "BTCUSDT", kept, NOW, 300)
  expect(rolesBy(plan)).toEqual(["BTCUSDT:quotes", "BTCUSDT:year", "BTCUSDT:day", "NEWUSDT:quotes", "NEWUSDT:day", "NEWUSDT:instrument"])
  // A kept instrument is never replaced, and no list leaves all to ask.
  const mine = { BTCUSDT: { symbol: "BTCUSDT", instrument: { ...btc(), name: "kept" } } }
  expect(R.withListed(mine, ["BTCUSDT"], listed).BTCUSDT.instrument.name).toBe("kept")
  expect(R.withListed({}, ["BTCUSDT"], null)).toEqual({})
})

test("5-minute candles Bybit turned down give Bybit's own words, and no quote", () => {
  const text = answer(0, 200, body("tickers.json")) + answer(1, 200, body("kline-btcusdt-d.json")) + answer(2, 200, '{"retCode":10001,"retMsg":"kline refused"}')
  const got = read(text, LATER, btc())
  expect(got.problem).toBe("Bybit: kline refused")
  expect(got.quote).toBeNull()
})

// ---- A run of several symbols ----

const readyKept = (symbol, candlesAt) =>
  ({ symbol, instrument: { ...btc(), symbol }, candles: days(TODAY - 364 * DAY, 365), year: true, day: [candle(TODAY)], candlesAt })
const rolesBy = plan => plan.asked.map(a => a.symbol + ":" + a.role)

test("a row asks for its candles every 5 minutes, the featured symbol every minute", () => {
  const kept = { BTCUSDT: readyKept("BTCUSDT", NOW - 90), ETHUSDT: readyKept("ETHUSDT", NOW - 90) }
  const plan = R.planRun(B, ["ETHUSDT", "BTCUSDT"], "BTCUSDT", kept, NOW, 300)
  // The featured symbol goes first, so the pill hears first.
  expect(rolesBy(plan)).toEqual(["BTCUSDT:quotes", "BTCUSDT:daily", "BTCUSDT:day", "ETHUSDT:quotes"])
  kept.ETHUSDT = readyKept("ETHUSDT", NOW - 300)
  expect(rolesBy(R.planRun(B, ["ETHUSDT"], "BTCUSDT", kept, NOW, 300))).toEqual(["ETHUSDT:quotes", "ETHUSDT:day"])
})

test("each symbol asks for its own price, never Bybit's 680 KB list of all of them", () => {
  const plan = R.planRun(B, ["BTCUSDT", "ETHUSDT"], "BTCUSDT", {}, NOW, 300)
  const prices = plan.urls.filter((u, i) => plan.asked[i].role === "quotes")
  expect(prices).toEqual([B.quotesUrl(["BTCUSDT"]), B.quotesUrl(["ETHUSDT"])])
})

test("a new UTC day asks for candles at once, so the day's open is never missing", () => {
  expect(R.candlesDue(readyKept("ETHUSDT", TODAY - 60), "ETHUSDT", TODAY + 30, 300)).toBe(true)
  expect(R.candlesDue(readyKept("ETHUSDT", NOW - 60), "ETHUSDT", NOW, 300)).toBe(false)
})

test("a price alone builds on the candles kept, and each symbol gets its own quote", () => {
  const time = JSON.parse(body("tickers.json")).time / 1000
  const today = Math.floor(time / DAY) * DAY
  const daily = B.parseCandles(JSON.parse(body("kline-btcusdt-d.json")))
  const kept = s => ({ symbol: s, instrument: { ...btc(), symbol: s }, candles: daily, day: [candle(today)], candlesAt: time - 60 })
  const asked = [{ symbol: "BTCUSDT", role: "quotes" }, { symbol: "ETHUSDT", role: "quotes" }]
  const text = answer(0, 200, body("tickers.json")) + answer(1, 200, body("tickers.json"))
  const got = R.readRun(F.answers(text, B.limits), asked, { BTCUSDT: kept("BTCUSDT"), ETHUSDT: kept("ETHUSDT") }, B)
  expect(got.problems).toEqual({ BTCUSDT: "", ETHUSDT: "" })
  expect(got.quotes.BTCUSDT.price).toBe(84440.8)
  expect(got.quotes.ETHUSDT.symbol).toBe("ETHUSDT")
  expect(got.quotes.ETHUSDT.price).not.toBe(84440.8)
})

test("a run cut short says so for the symbols it never reached", () => {
  const asked = [{ symbol: "BTCUSDT", role: "quotes" }, { symbol: "ETHUSDT", role: "quotes" }]
  const got = R.readRun(F.answers(answer(0, 200, body("tickers.json")), B.limits), asked, {}, B)
  expect(got.problems.ETHUSDT).toBe("The refresh stopped before every answer came")
  expect(got.quotes.ETHUSDT).toBe(null)
})

test("a refusal pauses the whole run, with Bybit's reason", () => {
  const asked = [{ symbol: "BTCUSDT", role: "quotes" }, { symbol: "ETHUSDT", role: "quotes" }]
  const text = answer(0, 403, "") + answer(1, 403, "")
  const got = R.readRun(F.answers(text, B.limits), asked, {}, B)
  expect(got.wait).toBe(600)
  expect(got.waitProblem).toContain("waiting 10 minutes")
})

test("a symbol joining the feed is asked for alone, and the rows wait for their minute", () => {
  const rows = ["BTCUSDT", "ETHUSDT", "SOLUSDT"]
  const joined = R.newcomers(rows, rows.concat(["LINKUSDT"]))
  expect(joined).toEqual(["LINKUSDT"])
  expect(R.runSymbols(rows.concat(["LINKUSDT"]), joined, false)).toEqual(["LINKUSDT"])
  // A preview passed by before its run goes is not asked for.
  expect(R.runSymbols(rows, ["LINKUSDT"], false)).toEqual([])
  // The minute's run asks for every one.
  expect(R.runSymbols(rows, [], true)).toEqual(rows)
})

// ---- Ranges ----

const wanted = (range, kept = keep(btc()), force = false) =>
  R.plan(B, "BTCUSDT", kept, NOW, false, false, range, force)

test("a range is asked for once, as its own role, and the day never is", () => {
  const got = wanted("1W")
  expect(got.asked).toEqual(["quotes", "history:1W"])
  expect(got.urls[1]).toBe(B.historyUrl("BTCUSDT", "1W", NOW))
  expect(wanted("1D").asked).toEqual(["quotes"])
  expect(wanted("").asked).toEqual(["quotes"])
})

test("a kept range is asked again when due, or when you ask for a refresh", () => {
  const kept = range => ({ ...keep(btc()), histories: { [range]: { candles: [], at: NOW - 100 } } })
  expect(wanted("1W", kept("1W")).asked).toEqual(["quotes"])
  expect(wanted("1W", kept("1W"), true).asked).toEqual(["quotes", "history:1W"])
  expect(wanted("1W", { ...kept("1W"), histories: { "1W": { candles: [], at: NOW - 900 } } }).asked).toContain("history:1W")
  expect(wanted("1Y", kept("1W")).asked).toContain("history:1Y")
})

test("only the symbol on show asks for its range in a run", () => {
  const run = R.planRun(B, ["ETHUSDT", "BTCUSDT"], "BTCUSDT", {}, NOW, 300, { symbol: "ETHUSDT", range: "1M" })
  expect(run.asked.filter(a => a.role.startsWith("history:"))).toEqual([{ symbol: "ETHUSDT", role: "history:1M" }])
})

test("a range that comes is kept and handed over as a history, with the day untouched", () => {
  const text = later() + answer(3, 200, body("kline-btcusdt-w.json"))
  const got = read(text, [...LATER, "history:5Y"], btc())
  expect(got.problem).toBe("")
  expect(got.quote.price).toBe(84440.8)
  expect(got.history.range).toBe("5Y")
  expect(got.history.bars).toHaveLength(4)
  expect(got.kept.histories["5Y"].candles).toHaveLength(4)
  expect(got.kept.histories["5Y"].at).toBe(B.parseQuotes(JSON.parse(body("tickers.json"))).time)
})

test("a range that fails keeps the price and says why, and keeps the last good range", () => {
  const before = { ...keep(btc()), histories: { "5Y": { candles: [{ t: 1 }], at: 5 } } }
  const text = later() + answer(3, 500)
  const got = read(text, [...LATER, "history:5Y"], btc())
  expect(got.quote.price).toBe(84440.8)
  expect(got.problem).toBe("Bybit sent an error (HTTP 500)")
  expect(got.history).toBeNull()
  const kept = R.read(F.answers(text, B.limits), [...LATER, "history:5Y"], "BTCUSDT", before, B)
  expect(kept.kept.histories["5Y"].candles).toEqual([{ t: 1 }])
  expect(kept.quote.price).toBe(84440.8)
})

test("a run cut short before its range says so, and a range alone needs no day", () => {
  const cut = read(later(), [...LATER, "history:1W"], btc())
  expect(cut.quote.price).toBe(84440.8)
  expect(cut.problem).toBe("The refresh stopped before every answer came")
})

test("a run reports each symbol's range by symbol and range", () => {
  const asked = [{ symbol: "BTCUSDT", role: "quotes" }, { symbol: "BTCUSDT", role: "history:5Y" }]
  const text = answer(0, 200, body("tickers.json")) + answer(1, 200, body("kline-btcusdt-w.json"))
  const got = R.readRun(F.answers(text, B.limits), asked, { BTCUSDT: { ...keep(btc()), candles: [], day: [] } }, B)
  expect(Object.keys(got.histories)).toEqual(["BTCUSDT|5Y"])
})

// ---- A second exchange: Binance sends the funding apart from the price ----

const N = load("adapters/binance.js")
const nbody = name => body("binance-" + name)
const nBtc = () => N.parseInstruments(JSON.parse(nbody("exchangeinfo.json"))).instruments[0]
const nRun = () =>
  answer(0, 200, JSON.stringify(JSON.parse(nbody("prices.json"))[0])) + answer(1, 200, JSON.stringify(JSON.parse(nbody("premium.json"))[1]))
  + answer(2, 200, nbody("kline-btcusdt-d.json")) + answer(3, 200, nbody("kline-btcusdt-5.json"))
const nRead = (text, asked = ["quotes", "funding", "daily", "day"]) =>
  R.read(F.answers(text, N.limits), asked, "BTCUSDT", keep(nBtc()), N)

test("an exchange with a funding URL is asked for the funding with the price", () => {
  const plan = R.plan(N, "BTCUSDT", null, 1792886132, true, false, "", false)
  expect(plan.asked).toEqual(["quotes", "funding", "day", "instrument"])
  expect(plan.urls[1]).toContain("premiumIndex?symbol=BTCUSDT")
  expect(R.plan(B, "BTCUSDT", null, 1792886132, true, false, "", false).asked).not.toContain("funding")
})

test("a Binance run gives the quote with the funding that came apart", () => {
  const got = nRead(nRun())
  expect(got.problem).toBe("")
  expect(got.quote.exchange).toBe("Binance")
  expect(got.quote.price).toBe(80891.4)
  expect(got.quote.dayOpen).toBe(81159.9)
  expect(got.quote.fundingRate).toBe(0.00009435)
})

test("a funding that failed leaves the price, with no funding", () => {
  const text = answer(0, 200, JSON.stringify(JSON.parse(nbody("prices.json"))[0])) + answer(1, 400, nbody("error.json"))
    + answer(2, 200, nbody("kline-btcusdt-d.json")) + answer(3, 200, nbody("kline-btcusdt-5.json"))
  const got = nRead(text)
  expect(got.quote.price).toBe(80891.4)
  expect(got.quote.fundingRate).toBeNull()
})

test("an instrument is picked out of the whole list Binance sends", () => {
  const eth = R.read(F.answers(answer(0, 200, JSON.stringify(JSON.parse(nbody("prices.json"))[1])) + answer(1, 200, nbody("exchangeinfo.json")), N.limits),
    ["quotes", "instrument"], "ETHUSDT", null, N)
  expect(eth.kept.instrument.symbol).toBe("ETHUSDT")
  const gone = R.read(F.answers(answer(0, 200, nbody("exchangeinfo.json")), N.limits), ["instrument"], "NOPEUSDT", null, N)
  expect(gone.problem).toBe("NOPEUSDT is not a USDT perpetual that trades on Binance")
})

test("Binance's own words are shown for a question it refused", () => {
  const text = answer(0, 200, nbody("error.json")) + answer(1, 200, nbody("error.json"))
  expect(nRead(text, ["quotes", "funding"]).problem).toBe("Binance: Invalid symbol.")
})

test("a 451 names both of its causes, as a 403 does for Bybit", () => {
  const got = nRead(answer(0, 451), ["quotes"])
  expect(got.problem).toBe("Binance refused us (too many requests from this IP, or Binance is not available where you are): waiting 10 minutes")
})

// ---- An exchange that answers a page of candles at a time: OKX ----

const O = load("adapters/okx.js")
const obody = name => body("okx-" + name)
const oBtc = () => O.parseInstruments(JSON.parse(obody("instruments.json"))).instruments.find(i => i.symbol === "BTCUSDT")
// OKX's older page: the same shape, its candles a day earlier each.
const olderPage = () => JSON.stringify({ code: "0", msg: "", data: [
  ["1792627200000", "81000", "81500", "80500", "81380.9", "100", "1", "81000", "1"],
  ["1792540800000", "80000", "81100", "79900", "81000", "100", "1", "80000", "1"]] })
const oRead = (text, asked, kept = keep(oBtc())) => R.read(F.answers(text, O.limits), asked, "BTCUSDT", kept, O)

test("a year of days is asked as two pages, with the older page's role numbered", () => {
  const now = 1792887309
  const first = R.plan(O, "BTCUSDT", keep(oBtc()), now, true, true, "", false)
  expect(first.asked).toEqual(["quotes", "funding", "year", "year#1", "day"])
  expect(first.urls[2]).toContain("/market/candles")
  expect(first.urls[3]).toContain("/market/history-candles")
  // Bybit has no pages, so its roles are as they were.
  expect(R.plan(B, "BTCUSDT", keep(btc()), now, true, true, "", false).asked).toEqual(["quotes", "year", "day"])
})

test("a long range is asked as a page for each 300 candles", () => {
  const now = 1792887309
  const got = R.plan(O, "BTCUSDT", keep(oBtc()), now, false, false, "1W", false)
  expect(got.asked).toEqual(["quotes", "funding", "history:1W", "history:1W#1", "history:1W#2"])
})

test("the pages of a year are joined into the candles kept, oldest first", () => {
  const text = answer(0, 200, obody("ticker-btc.json")) + answer(1, 200, obody("funding-btc.json"))
    + answer(2, 200, obody("candles-btc-d.json")) + answer(3, 200, olderPage()) + answer(4, 200, obody("candles-btc-5.json"))
  const got = oRead(text, ["quotes", "funding", "year", "year#1", "day"])
  expect(got.problem).toBe("")
  expect(got.kept.year).toBe(true)
  expect(got.kept.candles.map(c => c.t)).toEqual([1792540800, 1792627200, 1792713600, 1792800000, 1792886400])
  expect(got.quote.price).toBe(80744.5)
  expect(got.quote.fundingRate).toBe(0.0000244791294062)
})

test("a year whose older page did not come keeps no year and gives no half quote", () => {
  const text = answer(0, 200, obody("ticker-btc.json")) + answer(1, 200, obody("funding-btc.json"))
    + answer(2, 200, obody("candles-btc-d.json")) + answer(3, 500) + answer(4, 200, obody("candles-btc-5.json"))
  const got = oRead(text, ["quotes", "funding", "year", "year#1", "day"])
  expect(got.kept.year).toBeFalsy()
  expect(got.quote).toBeNull()
  expect(got.problem).toBe("OKX sent an error (HTTP 500)")
})

test("a range's pages are joined into its line; one missing is a slip, not a line", () => {
  const first = obody("candles-btc-d.json")
  const whole = answer(0, 200, obody("ticker-btc.json")) + answer(1, 200, obody("funding-btc.json"))
    + answer(2, 200, first) + answer(3, 200, olderPage())
  const got = oRead(whole, ["quotes", "funding", "history:1Y", "history:1Y#1"], { ...keep(oBtc()), candles: [], day: [] })
  expect(got.history.bars.length).toBe(5)
  expect(got.history.baseline).toBe(80000)
  const lacking = oRead(answer(0, 200, obody("ticker-btc.json")) + answer(1, 200, obody("funding-btc.json")) + answer(2, 200, first),
    ["quotes", "funding", "history:1Y", "history:1Y#1"], { ...keep(oBtc()), candles: [], day: [] })
  expect(lacking.history).toBeNull()
  expect(lacking.problem).toBe("The refresh stopped before every answer came")
})

test("OKX's own words are shown for a question it refused with HTTP 200", () => {
  const text = answer(0, 200, obody("error.json")) + answer(1, 200, obody("funding-btc.json"))
  expect(oRead(text, ["quotes", "funding"]).problem).toContain("OKX: Instrument ID")
})
