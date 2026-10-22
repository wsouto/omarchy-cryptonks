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
