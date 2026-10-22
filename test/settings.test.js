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
    style: "smooth",
    lists: [],
    list: ""
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
  expect(S.fileSettings({ range: "1W" }).range).toBe("1W")
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
  expect(S.withMembership(one, "BTCUSDT", "", false, ["BTCUSDT"]).symbols).toEqual(["BTCUSDT"])
})

test("removing the featured row hands the hero to the next row, or the one before at the end", () => {
  const shown = four().symbols
  expect(S.withMembership(four(), "ETHUSDT", "", false, shown).featured).toBe("SOLUSDT")
  const last = S.fileSettings({ ...four(), featured: "XRPUSDT" })
  expect(S.withMembership(last, "XRPUSDT", "", false, shown).featured).toBe("SOLUSDT")
  expect(S.withMembership(four(), "BTCUSDT", "", false, shown).featured).toBe("ETHUSDT")
})

test("an undo puts the symbol back at its place, and the hero back if nothing moved it since", () => {
  const before = four()
  const removed = S.withMembership(before, "ETHUSDT", "", false, before.symbols)
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
  expect(S.withListOrder(S.fileSettings({ order: "name", reversed: true }), "pct").reversed).toBe(false)
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
  const sorted = S.withListOrder(S.fileSettings({ symbols: all }), "symbol")
  expect(sorted.symbols).toEqual(all)
})

test("a move by hand keeps every symbol and makes the order manual; a different set is refused", () => {
  const sorted = S.withListOrder(S.fileSettings({ symbols: all }), "pct")
  const moved = S.withManualOrder(sorted, S.movedSymbols(all, 0, 2))
  expect(moved.symbols).toEqual(["XRPUSDT", "BTCUSDT", "SOLUSDT", "ETHUSDT"])
  expect(moved.order).toBe("manual")
  expect(S.withManualOrder(sorted, ["BTCUSDT"]).symbols).toEqual(all)
  expect(S.movedSymbols(all, 0, 9)).toEqual(all)
})

// ---- Lists ----

// Adapted from the original's test/model.test.js ("membership across
// several lists"), its stocks swapped for perpetuals.
const library = (extra = {}) => S.fileSettings({
  symbols: ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT"], featured: "BTCUSDT", order: "pct",
  lists: [
    { name: "My Watchlist", symbols: ["BTCUSDT", "ETHUSDT"], order: "manual" },
    { name: "Majors", symbols: ["ETHUSDT", "SOLUSDT"], order: "name" }
  ],
  ...extra
})

test("a list file someone edited reads whole: orphans join All, names are cleaned, an unknown list is All", () => {
  const orphan = S.fileSettings({ symbols: ["BTCUSDT"], lists: [{ name: "Majors", symbols: ["ETHUSDT"] }], list: "Gone" })
  expect(orphan.symbols).toEqual(["BTCUSDT", "ETHUSDT"])
  expect(orphan.list).toBe("")
  expect(S.fileSettings({ symbols: ["BTCUSDT"], lists: [{ name: "Majors" }], list: "majors" }).list).toBe("Majors")
  const edited = S.fileSettings({ symbols: ["ETHUSDT"], order: "bogus", reversed: true, lists: [
    { name: "  Majors  ", symbols: ["ethusdt", "ETHUSDT"], reversed: true }, { name: "majors", symbols: ["X"] },
    { name: "All", symbols: [] }, { name: "", symbols: [] }, { name: "Wins", order: "bogus" },
    { name: "Losers", order: "pct", reversed: true }
  ] })
  expect([edited.order, edited.reversed]).toEqual(["manual", false])
  expect(edited.lists).toEqual([
    { name: "Majors", symbols: ["ETHUSDT"], order: "manual", reversed: false },
    { name: "Wins", symbols: [], order: "manual", reversed: false },
    { name: "Losers", symbols: [], order: "pct", reversed: true }
  ])
})

test("membership across several lists", () => {
  // A new symbol added on a named list joins All; one added on All joins no list.
  const onMajors = S.withSymbolAdded(library({ list: "Majors" }), "linkusdt")
  expect(onMajors.symbols).toEqual(["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "LINKUSDT"])
  expect(S.listSymbols(onMajors)).toEqual(["ETHUSDT", "SOLUSDT", "LINKUSDT"])
  expect(onMajors.featured).toBe("BTCUSDT")
  const onAll = S.withSymbolAdded(library(), "LINKUSDT")
  expect(onAll.symbols).toContain("LINKUSDT")
  expect(onAll.lists.every(list => list.symbols.indexOf("LINKUSDT") < 0)).toBe(true)
  // ETH is in both named lists: leaving Majors keeps it in My Watchlist and
  // All; leaving All takes it out of both.
  const offMajors = S.withMembership(library({ list: "Majors" }), "ETHUSDT", "Majors", false, ["ETHUSDT", "SOLUSDT"])
  expect([offMajors.symbols, offMajors.lists.map(list => list.symbols)])
    .toEqual([["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT"], [["BTCUSDT", "ETHUSDT"], ["SOLUSDT"]]])
  const offAll = S.withMembership(library(), "ETHUSDT", "", false, ["ETHUSDT", "BTCUSDT", "SOLUSDT", "XRPUSDT"])
  expect([offAll.symbols, offAll.lists.map(list => list.symbols)])
    .toEqual([["BTCUSDT", "SOLUSDT", "XRPUSDT"], [["BTCUSDT"], ["SOLUSDT"]]])
  // The featured symbol leaving All from the last row shown hands the hero
  // to the row above it.
  expect(S.withMembership(library(), "BTCUSDT", "", false, ["ETHUSDT", "SOLUSDT", "XRPUSDT", "BTCUSDT"]).featured).toBe("XRPUSDT")
  // Each list keeps its own order and manual arrangement, apart from All's.
  const majors = S.withListOrder(library({ list: "Majors" }), "symbol")
  expect([S.listOrder(majors), majors.order, majors.lists[0].order]).toEqual(["symbol", "pct", "manual"])
  const all = S.withListOrder(library(), "symbol")
  expect([all.order, all.lists[1].order]).toEqual(["symbol", "name"])
  const moved = S.withManualOrder(library({ list: "Majors" }), ["SOLUSDT", "ETHUSDT"])
  expect([S.listSymbols(moved), S.listOrder(moved), moved.symbols])
    .toEqual([["SOLUSDT", "ETHUSDT"], "manual", ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT"]])
  expect(S.listSymbols(S.withManualOrder(library({ list: "Majors" }), ["SOLUSDT"]))).toEqual(["ETHUSDT", "SOLUSDT"])
  // A list's direction is its own, survives a change of its members, and
  // goes with a new order or a hand arrangement.
  const losers = S.withListReversed(library({ list: "Majors" }))
  expect([S.listReversed(losers), losers.reversed, losers.lists[0].reversed]).toEqual([true, false, false])
  expect(S.listReversed(S.withSymbolAdded(losers, "LINKUSDT"))).toBe(true)
  expect(S.listReversed(S.withMembership(losers, "ETHUSDT", "Majors", false, ["SOLUSDT", "ETHUSDT"]))).toBe(true)
  expect(S.listReversed(S.withListOrder(losers, "pct"))).toBe(false)
  expect(S.listReversed(S.withManualOrder(losers, ["SOLUSDT", "ETHUSDT"]))).toBe(false)
  expect(S.listReversed(S.withListReversed(library({ list: "My Watchlist" })))).toBe(false)
})

test("an undo puts a symbol back in every list that held it", () => {
  const before = library()
  const removed = S.withMembership(before, "ETHUSDT", "", false, before.symbols)
  const back = S.withRemovalUndone(removed, before, "ETHUSDT", removed.featured)
  expect(back.lists.map(list => list.symbols)).toEqual(before.lists.map(list => list.symbols))
})

test("lists are made, named, moved, stepped and deleted; All stays first and unnamed", () => {
  const made = S.withListCreated(library(), " Alts ")
  expect([made.list, S.listSymbols(made)]).toEqual(["Alts", []])
  expect(S.listNameProblem("all", made.lists)).toBe("All already exists")
  expect(S.listNameProblem("alts", made.lists)).toBe("alts already exists")
  expect(S.withListCreated(made, "").lists.length).toBe(3)
  // A change of case only is a rename, and the current list follows it.
  const renamed = S.withListRenamed(made, "Alts", "ALTS")
  expect([renamed.list, renamed.lists[2].name]).toEqual(["ALTS", "ALTS"])
  expect(S.withListRenamed(made, "Alts", "Majors").lists[2].name).toBe("Alts")
  expect(S.withListMoved(made, "Alts", -1).lists.map(list => list.name)).toEqual(["My Watchlist", "Alts", "Majors"])
  expect([S.steppedList(made, 1), S.steppedList(library(), -1)]).toEqual(["", "Majors"])
  const gone = S.withListDeleted(made, "Alts")
  expect([gone.list, gone.lists.length]).toEqual(["", 2])
})
