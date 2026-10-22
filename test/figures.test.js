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
