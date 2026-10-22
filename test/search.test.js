// Search's results, Search.js: what typing finds in the instrument list,
// built from the list Bybit really sent (test/fixtures/instruments.json),
// so they pass without a network.
import { test, expect } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { load } from "./load.js"

const B = load("adapters/bybit.js")
const Q = load("Search.js")
const list = [
  { symbol: "ETHFIUSDT", name: "ether.fi" },
  { symbol: "ETHBTCUSDT", name: "ethbtc" },
  { symbol: "ETHUSDT", name: "Ethereum" },
  { symbol: "BTCUSDT", name: "Bitcoin" },
  { symbol: "LDOUSDT", name: "Lido DAO" }
]
const symbols = q => Q.find(list, q, "USDT").map(i => i.symbol)

test("typing eth puts ETHUSDT first, then the coins that start with it", () => {
  expect(symbols("eth")).toEqual(["ETHUSDT", "ETHFIUSDT", "ETHBTCUSDT"])
})

test("a name finds its coin, and the symbol typed whole finds itself", () => {
  expect(symbols("bitcoin")).toEqual(["BTCUSDT"])
  expect(symbols("ethusdt")[0]).toBe("ETHUSDT")
  expect(symbols("dao")).toEqual(["LDOUSDT"])
})

test("an empty query finds nothing, and no match is an empty answer", () => {
  expect(symbols("  ")).toEqual([])
  expect(symbols("zzz")).toEqual([])
})

test("an answer holds at most eight", () => {
  const many = Array.from({ length: 20 }, (_, i) => ({ symbol: "A" + i + "USDT", name: "a" }))
  expect(Q.find(many, "a", "USDT").length).toBe(8)
})

test("the saved instrument list is searchable as parsed", () => {
  const fixture = JSON.parse(readFileSync(join(import.meta.dir, "fixtures", "instruments.json"), "utf8"))
  const parsed = B.parseInstruments(fixture)
  expect(parsed.cursor).toBe("")
  expect(Q.find(parsed.instruments, "btc", "USDT")[0].symbol).toBe("BTCUSDT")
})
