// The list's breadth, Figures.js: how many rows are up, flat and down, by
// the rows' own rule.
import { test, expect } from "bun:test"
import { load } from "./load.js"

const F = load("Figures.js")
const quote = (price, open24h) => ({ price, open24h, priceDigits: 2, points: [] })

test("the breadth counts rows as their change reads, and a row with no figure apart", () => {
  const quotes = { UP: quote(101, 100), DOWN: quote(99, 100), FLAT: quote(100.001, 100), OPENLESS: quote(5, null) }
  expect(F.listBreadth(["UP", "DOWN", "FLAT", "OPENLESS", "MISSING"], quotes, 0, "pct"))
    .toEqual({ up: 1, flat: 1, down: 1, none: 2 })
})

test("a range's hero measures the live price from the range's start, always in percent", () => {
  const history = { range: "1W", step: 900, baseline: 100, bars: [{ t: 10, p: 101 }, { t: 20, p: 90 }, { t: 30, p: 120 }] }
  const now = F.rangeView(history, quote(110, 100), 0, "1W")
  expect(now).toMatchObject({ changeText: "+10.00%", sign: 1, time: null, caption: "1W" })
  // A scrub reads the bar at or before it: the price and the change both move.
  expect(F.rangeView(history, quote(110, 100), 25, "1W")).toMatchObject({ priceText: "90.00", changeText: "−10.00%", sign: -1, time: 20 })
})

test("a range not yet in keeps the live price and has no change to show", () => {
  expect(F.rangeView(null, quote(110, 100), 0, "All")).toMatchObject({ priceText: "110.00", changeText: "—", sign: 0, caption: "ALL" })
})

// ---- The info block ----

const full = { symbol: "BTCUSDT", currency: "USDT", turnover24h: 1.5e9, price: 82, priceDigits: 1, open24h: 80, low24h: 79, high24h: 85, volume24h: 12345.6, low52w: 70, high52w: 90 }

test("the 1D line is the 24 hours' range with the price between, then their turnover", () => {
  const line = F.dayLine(full)
  expect(line.title).toBe("1D")
  expect(line.range).toMatchObject({ low: 79, high: 85, price: 82, lowText: "79.0", highText: "85.0", lowTone: "", highTone: "" })
  expect(line.facts.map(f => [f.label, f.value])).toEqual([["OPEN", "80.0"], ["VOL", "1.5B"]])
  expect(line.facts.map(f => !!f.edge)).toEqual([false, true])
  expect(F.dayLine(null)).toBeNull()
})

test("a day end that is also the year's is toned, and an unknown figure leaves its slot empty", () => {
  expect(F.dayLine({ ...full, high24h: 90 }).range.highTone).toBe("up")
  expect(F.dayLine({ ...full, low24h: 70 }).range.lowTone).toBe("down")
  expect(F.dayLine({ ...full, turnover24h: null }).facts.map(f => f.value)).toEqual(["80.0", ""])
  expect(F.dayLine({ ...full, open24h: null }).facts.map(f => f.value)).toEqual(["", "1.5B"])
  expect(F.dayLine({ ...full, price: 82000, open24h: 80123.4, low24h: 79000, high24h: 85000 }).facts[0].value).toBe("80,123")
})

test("the 52-week line is the year's low and high, toned where the 24 hours set one, with the open interest as its fact", () => {
  const line = F.yearLine(full)
  expect(line).toMatchObject({ title: "52W" })
  expect(line.facts.map(f => [f.label, f.value, !!f.edge])).toEqual([["OI", "", true]])
  expect(F.yearLine({ ...full, openInterest: 3.1e9 }).facts[0].value).toBe("3.1B")
  expect(line.range).toMatchObject({ low: 70, high: 90, highTone: "", lowTone: "" })
  expect(F.yearLine({ ...full, high24h: 90 }).range.highTone).toBe("up")
  expect(F.yearLine({ ...full, low52w: null }).range.lowText).toBe("")
  expect(F.yearLine({ ...full, price: 82000, low52w: 57758.6, high52w: 116380.2 }).range).toMatchObject({ lowText: "57,759", highText: "116,380" })
})

// ---- Freshness ----

const NOW = 1700000000
const quoted = { marketTime: NOW - 30 }

test("a quote is fresh until a refresh fails, or it is older than two minutes, or it was saved", () => {
  expect(F.freshness("", true, quoted, NOW).state).toBe("fresh")
  expect(F.freshness("", true, { marketTime: NOW - 121 }, NOW).state).toBe("aged")
  expect(F.freshness("", false, quoted, NOW).state).toBe("saved")
  expect(F.freshness("Bybit says no", true, quoted, NOW).state).toBe("failed")
  expect(F.freshness("", false, null, NOW).state).toBe("unavailable")
})

test("the words say what failed and when the quote is from, in capitals or in sentence case", () => {
  const at = Date.UTC(2023, 10, 14, 22, 13) / 1000
  const same = { marketTime: at }
  expect(F.freshnessText(F.freshness("x", true, same, at + 10))).toBe("REFRESH FAILED · AS OF 22:13 UTC")
  expect(F.freshnessText(F.freshness("x", true, same, at + 10), true)).toBe("Refresh failed · As of 22:13 UTC")
  expect(F.freshnessText(F.freshness("", true, same, at + 10))).toBe("")
  expect(F.freshnessText(F.freshness("", false, same, at + 10))).toBe("AS OF 22:13 UTC")
})

test("a quote from another UTC day names its day; with no quote only a failure speaks", () => {
  const at = Date.UTC(2023, 10, 14, 22, 13) / 1000
  const old = F.freshness("", false, { marketTime: at }, at + 86400)
  expect(F.freshnessText(old)).toBe("AS OF 14 NOV 22:13 UTC")
  expect(F.freshnessText(old, true)).toBe("As of 14 Nov 22:13 UTC")
  expect(F.freshnessText(F.freshness("x", false, null, NOW))).toBe("NO DATA FOR THIS SYMBOL")
  expect(F.freshnessText(F.freshness("", false, null, NOW))).toBe("")
  expect(F.freshnessWarns(F.freshness("x", true, quoted, NOW))).toBe(true)
  expect(F.freshnessWarns(F.freshness("", false, quoted, NOW))).toBe(false)
})

test("funding reads its sign in text and tone, and the time left to settle", () => {
  const f = (rate, next) => F.fundingFact({ marketTime: 1000, fundingRate: rate, nextFundingTime: next })
  expect(f(0.0001, 1000 + 3 * 3600 + 12 * 60)).toMatchObject({ label: "FUNDING", value: "+0.0100%", after: "3h12m", tone: "up" })
  expect(f(-0.00019795, 1000 + 600)).toMatchObject({ value: "\u22120.0198%", after: "10m", tone: "down" })
  expect(f(0, 1000 + 600)).toMatchObject({ value: "0.0000%", tone: "" })
  expect(f(null, null)).toMatchObject({ value: "", after: "" })
})
