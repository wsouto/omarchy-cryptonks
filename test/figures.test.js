// The list's breadth, Figures.js: how many rows are up, flat and down, by
// the rows' own rule.
import { test, expect } from "bun:test"
import { load } from "./load.js"

const F = load("Figures.js")
const quote = (price, dayOpen) => ({ price, dayOpen, priceDigits: 2, points: [] })

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

const full = { price: 82, priceDigits: 1, dayOpen: 80, dayLow: 79, dayHigh: 85, volume: 12345.6, low52w: 70, high52w: 90 }

test("the day line is the day's range with the price between, then its open", () => {
  const line = F.dayLine(full)
  expect(line.title).toBe("1D")
  expect(line.range).toMatchObject({ low: 79, high: 85, price: 82, lowText: "79.0", highText: "85.0", lowTone: "", highTone: "" })
  expect(line.facts.map(f => [f.label, f.value])).toEqual([["OPEN", "80.0"]])
  expect(F.dayLine(null)).toBeNull()
})

test("a day end that is also the year's is toned, and an unknown figure leaves its slot empty", () => {
  expect(F.dayLine({ ...full, dayHigh: 90 }).range.highTone).toBe("up")
  expect(F.dayLine({ ...full, dayLow: 70 }).range.lowTone).toBe("down")
  const open = F.dayLine({ ...full, dayOpen: null, volume: null })
  expect(open.facts.map(f => f.value)).toEqual([""])
  expect(F.yearLine({ ...full, volume: null }).facts.map(f => f.value)).toEqual([""])
})

test("the 52-week line is the year's low and high, toned where today set one, then the volume", () => {
  const line = F.yearLine(full)
  expect(line).toMatchObject({ title: "52W" })
  expect(line.facts.map(f => [f.label, f.value])).toEqual([["VOL", "12K"]])
  expect(line.range).toMatchObject({ low: 70, high: 90, highTone: "", lowTone: "" })
  expect(F.yearLine({ ...full, dayHigh: 90 }).range.highTone).toBe("up")
  expect(F.yearLine({ ...full, low52w: null }).range.lowText).toBe("")
})
