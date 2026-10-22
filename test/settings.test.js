// The data file's rules, Settings.js: what a first start shows, and what a
// file someone edited, or a later version wrote, keeps. Each test names what
// a user would see go wrong.
//
// Run with `bun test` (test/check.sh does).
import { test, expect } from "bun:test"
import { load } from "./load.js"

const S = load("Settings.js")

test("a first start shows the five starters, BTCUSDT featured, smooth and in percent", () => {
  expect(S.fileSettings(null)).toEqual({
    version: 1,
    symbols: ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "DOGEUSDT"],
    featured: "BTCUSDT",
    order: "manual",
    reversed: false,
    changeMode: "pct",
    style: "smooth"
  })
})

test("a hand-typed list is cleaned up, never lost: case, spaces and repeats", () => {
  expect(S.fileSettings({ symbols: " ethusdt, BTCUSDT ethusdt" }).symbols).toEqual(["ETHUSDT", "BTCUSDT"])
})

test("a featured symbol that is not in the list falls back to its first", () => {
  expect(S.fileSettings({ symbols: ["SOLUSDT"], featured: "BTCUSDT" }).featured).toBe("SOLUSDT")
  expect(S.fileSettings({ symbols: ["SOLUSDT", "ETHUSDT"], featured: "ethusdt" }).featured).toBe("ETHUSDT")
})

test("an unknown look or change mode reads as the default, a known one is kept", () => {
  expect(S.fileSettings({ style: "neon", changeMode: "open" })).toMatchObject({ style: "smooth", changeMode: "pct" })
  expect(S.fileSettings({ style: "retro", changeMode: "abs" })).toMatchObject({ style: "retro", changeMode: "abs" })
})

test("a key this version does not know is kept on write", () => {
  expect(S.fileSettings({ lists: [{ name: "Majors" }] }).lists).toEqual([{ name: "Majors" }])
})

// ---- Adding, removing, undoing ----

const four = () => S.fileSettings({ symbols: ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT"], featured: "ETHUSDT" })

test("an added symbol goes to the end of All, once", () => {
  expect(S.withSymbolAdded(four(), "DOGEUSDT").symbols.slice(-1)).toEqual(["DOGEUSDT"])
  expect(S.withSymbolAdded(four(), "BTCUSDT").symbols).toEqual(four().symbols)
})

test("All keeps its last symbol", () => {
  const one = S.fileSettings({ symbols: ["BTCUSDT"] })
  expect(S.canRemove(one.symbols)).toBe(false)
  expect(S.withSymbolRemoved(one, "BTCUSDT", ["BTCUSDT"]).symbols).toEqual(["BTCUSDT"])
})

test("removing the featured row hands the hero to the next row, or the one before at the end", () => {
  const shown = four().symbols
  expect(S.withSymbolRemoved(four(), "ETHUSDT", shown).featured).toBe("SOLUSDT")
  const last = S.fileSettings({ ...four(), featured: "XRPUSDT" })
  expect(S.withSymbolRemoved(last, "XRPUSDT", shown).featured).toBe("SOLUSDT")
  expect(S.withSymbolRemoved(four(), "BTCUSDT", shown).featured).toBe("ETHUSDT")
})

test("an undo puts the symbol back at its place, and the hero back if nothing moved it since", () => {
  const before = four()
  const removed = S.withSymbolRemoved(before, "ETHUSDT", before.symbols)
  const back = S.withRemovalUndone(removed, before, "ETHUSDT", removed.featured)
  expect(back.symbols).toEqual(before.symbols)
  expect(back.featured).toBe("ETHUSDT")
  // A hero chosen since stays.
  const chosen = S.fileSettings({ ...removed, featured: "XRPUSDT" })
  expect(S.withRemovalUndone(chosen, before, "ETHUSDT", removed.featured).featured).toBe("XRPUSDT")
})

// ---- Order ----

const quote = (symbol, name, price, dayOpen) => ({ symbol, name, price, dayOpen })
const quotes = {
  BTCUSDT: quote("BTCUSDT", "Bitcoin", 101, 100),
  ETHUSDT: quote("ETHUSDT", "Ethereum", 95, 100),
  SOLUSDT: quote("SOLUSDT", "Solana", 110, 100)
}
const all = ["SOLUSDT", "XRPUSDT", "BTCUSDT", "ETHUSDT"]

test("orders run manual, symbol, name, % change and back, each starting its own way", () => {
  expect(["manual", "symbol", "name", "pct"].map(S.nextOrder)).toEqual(["symbol", "name", "pct", "manual"])
  expect(S.orderLabel("manual", true)).toBe("↕  MANUAL")
  expect(S.orderLabel("symbol", false)).toBe("↑  SYMBOL")
  expect(S.orderLabel("pct", false)).toBe("↓  % CHANGE")
  expect(S.withOrder(S.fileSettings({ order: "name", reversed: true }), "pct").reversed).toBe(false)
})

test("a sort ranks the rows and keeps a row with no quote at the bottom, in its place", () => {
  expect(S.sortedSymbols(all, quotes, "manual", false)).toEqual(all)
  expect(S.sortedSymbols(all, quotes, "symbol", false)).toEqual(["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT"])
  expect(S.sortedSymbols(all, quotes, "name", true)).toEqual(["SOLUSDT", "ETHUSDT", "BTCUSDT", "XRPUSDT"])
  expect(S.sortedSymbols(all, quotes, "pct", false)).toEqual(["SOLUSDT", "BTCUSDT", "ETHUSDT", "XRPUSDT"])
  expect(S.sortedSymbols(all, quotes, "pct", true)).toEqual(["ETHUSDT", "BTCUSDT", "SOLUSDT", "XRPUSDT"])
})

test("manual has no direction, and a sort never rewrites the order arranged by hand", () => {
  expect(S.fileSettings({ order: "manual", reversed: true }).reversed).toBe(false)
  const sorted = S.withOrder(S.fileSettings({ symbols: all }), "symbol")
  expect(sorted.symbols).toEqual(all)
})

test("a move by hand keeps every symbol and makes the order manual; a different set is refused", () => {
  const sorted = S.withOrder(S.fileSettings({ symbols: all }), "pct")
  const moved = S.withManualOrder(sorted, S.movedSymbols(all, 0, 2))
  expect(moved.symbols).toEqual(["XRPUSDT", "BTCUSDT", "SOLUSDT", "ETHUSDT"])
  expect(moved.order).toBe("manual")
  expect(S.withManualOrder(sorted, ["BTCUSDT"]).symbols).toEqual(all)
  expect(S.movedSymbols(all, 0, 9)).toEqual(all)
})
