// The ranges: what each asks Bybit for, the line built from the answer, and
// how that line is laid out, scrubbed and said. Run on saved Bybit answers
// (test/fixtures/kline-btcusdt-*.json), so they pass without a network.
import { test, expect } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { load } from "./load.js"

const B = load("adapters/bybit.js")
const H = load("History.js")

const fixture = name => JSON.parse(readFileSync(join(import.meta.dir, "fixtures", name), "utf8"))
const DAY = 86400
// 2026-10-22 14:00 UTC.
const NOW = Date.UTC(2026, 9, 22, 14) / 1000
const query = url => Object.fromEntries(new URL(url).searchParams)

test("each range asks for its own interval, from where it starts", () => {
  const ask = range => query(B.historyUrl("BTCUSDT", range, NOW))
  expect(ask("1W")).toMatchObject({ symbol: "BTCUSDT", interval: "15", start: String((NOW - 7 * DAY) * 1000) })
  expect(ask("1M")).toMatchObject({ interval: "60", start: String((NOW - 30 * DAY) * 1000) })
  expect(ask("3M").interval).toBe("D")
  expect(ask("6M").interval).toBe("D")
  expect(ask("1Y")).toMatchObject({ interval: "D", start: String((NOW - 365 * DAY) * 1000) })
  expect(ask("2Y")).toMatchObject({ interval: "D", start: String((NOW - 730 * DAY) * 1000) })
  expect(ask("5Y").interval).toBe("W")
  expect(ask("10Y").interval).toBe("W")
  expect(ask("All").interval).toBe("M")
  expect(ask("1W").limit).toBe("1000")
})

test("YTD starts at 00:00 UTC on 1 January of the year of now, and All has no start", () => {
  expect(query(B.historyUrl("BTCUSDT", "YTD", NOW)).start).toBe(String(Date.UTC(2026, 0, 1)))
  expect(query(B.historyUrl("BTCUSDT", "YTD", Date.UTC(2027, 0, 1) / 1000)).start).toBe(String(Date.UTC(2027, 0, 1)))
  expect(query(B.historyUrl("BTCUSDT", "All", NOW)).start).toBeUndefined()
})

test("the day is not a range the adapter serves, and every other range of the row is", () => {
  expect(B.historyUrl("BTCUSDT", "1D", NOW)).toBeNull()
  for (const range of H.RANGES.slice(1)) expect(B.historyUrl("BTCUSDT", range, NOW)).not.toBeNull()
})

test("a history is the closes oldest first, from the first candle's open", () => {
  const candles = B.parseCandles(fixture("kline-btcusdt-w.json"))
  const history = B.buildHistory("BTCUSDT", "5Y", candles)
  expect(history.bars).toHaveLength(4)
  expect(history.bars[0]).toEqual({ t: candles[0].t, p: candles[0].close })
  expect(history.bars[3].t).toBeGreaterThan(history.bars[0].t)
  expect(history.baseline).toBe(candles[0].open)
  expect(history.step).toBe(7 * DAY)
  expect(B.buildHistory("BTCUSDT", "5Y", [])).toBeNull()
  expect(B.buildHistory("BTCUSDT", "1D", candles)).toBeNull()
})

test("the geometry holds every bar and the start price, evenly spaced", () => {
  const history = B.buildHistory("BTCUSDT", "1W", B.parseCandles(fixture("kline-btcusdt-15.json")))
  const g = H.geometry(history)
  expect(g.points.map(p => p.x)).toEqual([0, 1 / 3, 2 / 3, 1])
  for (const p of g.points) expect(p.y).toBeGreaterThan(0), expect(p.y).toBeLessThan(1)
  expect(g.baselineY).toBeGreaterThan(0)
  expect(g.baselineY).toBeLessThan(1)
  // Higher price, nearer the top.
  const hi = history.bars.reduce((a, b) => (b.p > a.p ? b : a))
  const lo = history.bars.reduce((a, b) => (b.p < a.p ? b : a))
  expect(g.points[history.bars.indexOf(hi)].y).toBeLessThan(g.points[history.bars.indexOf(lo)].y)
  expect(H.geometry({ range: "1W", bars: [], baseline: 1 })).toBeNull()
})

test("5Y, 10Y and All are drawn on a log scale, unless a price is zero", () => {
  const bars = [{ t: 0, p: 1 }, { t: 1, p: 10 }, { t: 2, p: 100 }]
  const at = (range, extra) => H.geometry({ range, bars: bars.concat(extra || []), baseline: 1 }).points[1].y
  // Log: 10 sits midway between 1 and 100 (within the headroom); linear: far below.
  expect(Math.abs(at("All") - H.geometry({ range: "All", bars, baseline: 1 }).baselineY)).toBeLessThan(0.6)
  expect(at("All")).not.toBeCloseTo(at("1Y"), 2)
  expect(at("5Y")).toBeCloseTo(at("All"), 6)
  expect(at("1Y")).toBeGreaterThan(0.8)
  expect(at("All")).toBeLessThan(0.7)
  const withZero = [{ t: 3, p: 0 }]
  expect(at("All", withZero)).toBeCloseTo(H.geometry({ range: "1Y", bars: bars.concat(withZero), baseline: 1 }).points[1].y, 6)
})

test("a scrub reads the bar at or before it, and steps by bars", () => {
  const history = B.buildHistory("BTCUSDT", "1M", B.parseCandles(fixture("kline-btcusdt-60.json")))
  const [a, b, c, d] = history.bars.map(bar => bar.t)
  expect(H.barAt(history, b + 10).t).toBe(b)
  expect(H.barAt(history, a - 1)).toBeNull()
  expect(H.timeAtFraction(history, 0)).toBe(a)
  expect(H.timeAtFraction(history, 1)).toBe(d)
  expect(H.timeAtFraction(history, 0.34)).toBe(b)
  expect(H.fractionAtTime(history, c)).toBeCloseTo(2 / 3, 6)
  expect(H.fractionAtTime(history, d + 1)).toBe(-1)
  expect(H.stepTime(history, c, 1)).toBe(d)
  expect(H.stepTime(history, d, 1)).toBe(d)
  expect(H.stepTime(history, a, -1)).toBe(a)
})

test("a moment is said as its bar is: an hour, a day, a week, a month", () => {
  const at = (range, name) => {
    const history = B.buildHistory("BTCUSDT", range, B.parseCandles(fixture(name)))
    return H.momentText(history, history.bars[history.bars.length - 1].t)
  }
  expect(at("1W", "kline-btcusdt-15.json")).toMatch(/^\d{1,2} [A-Z]{3} \d\d:(00|15|30|45) UTC$/)
  expect(at("1M", "kline-btcusdt-60.json")).toMatch(/^\d{1,2} [A-Z]{3} \d\d:00 UTC$/)
  expect(at("1Y", "kline-btcusdt-d.json")).toMatch(/^\d{1,2} [A-Z]{3}$/)
  expect(at("5Y", "kline-btcusdt-w.json")).toMatch(/^WEEK OF \d{1,2} [A-Z]{3} \d{4}$/)
  expect(at("All", "kline-btcusdt-m.json")).toMatch(/^[A-Z]{3} \d{4}$/)
})

test("a day's bar carries its year when the range crosses one", () => {
  const history = { range: "1Y", step: DAY, baseline: 1, bars: [{ t: Date.UTC(2025, 11, 31) / 1000, p: 1 }, { t: Date.UTC(2026, 0, 1) / 1000, p: 1 }] }
  expect(H.momentText(history, history.bars[1].t)).toBe("1 JAN 2026")
})

test("a range is asked again after 15 minutes within the hours, else an hour", () => {
  expect(H.due("1W", 0, NOW)).toBe(true)
  expect(H.due("1W", NOW - 899, NOW)).toBe(false)
  expect(H.due("1W", NOW - 900, NOW)).toBe(true)
  expect(H.due("1M", NOW - 900, NOW)).toBe(true)
  expect(H.due("1Y", NOW - 900, NOW)).toBe(false)
  expect(H.due("1Y", NOW - 3600, NOW)).toBe(true)
})

test("the range steps along the row and stops at its ends", () => {
  expect(H.steppedRange("1D", 1)).toBe("1W")
  expect(H.steppedRange("1D", -1)).toBe("1D")
  expect(H.steppedRange("All", 1)).toBe("All")
  expect(H.steppedRange("YTD", -1)).toBe("6M")
  expect(H.normalizeRange("nope")).toBe("1D")
})
