// The saved quotes file, SavedQuotes.js: what each exchange shows at once
// after a switch or a restart.
//
// Run with `bun test` (test/check.sh does).
import { test, expect } from "bun:test"
import { load } from "./load.js"

const Q = load("SavedQuotes.js")

const btc = { symbol: "BTCUSDT", exchange: "Bybit", price: 1 }
const eth = { symbol: "ETHUSDT", exchange: "OKX", price: 2 }

test("a version 3 file is read as written", () => {
  const quotes = { Bybit: { BTCUSDT: btc } }
  expect(Q.byExchange({ version: 3, quotes })).toEqual(quotes)
})

test("an older file, one that can't be read, or a later version shows no prices", () => {
  expect(Q.byExchange({ version: 1, quotes: { BTCUSDT: btc, ETHUSDT: eth } })).toEqual({})
  expect(Q.byExchange({ version: 2, quotes: { Bybit: { BTCUSDT: btc } } })).toEqual({})
  expect(Q.byExchange(null)).toEqual({})
  expect(Q.byExchange({ version: 4, quotes: {} })).toEqual({})
  expect(Q.byExchange({ version: 3 })).toEqual({})
})

test("saving one exchange's quotes keeps the others", () => {
  const all = { Bybit: { BTCUSDT: btc }, OKX: { ETHUSDT: eth } }
  expect(Q.withExchange(all, "Bybit", {})).toEqual({ Bybit: {}, OKX: { ETHUSDT: eth } })
  expect(all.Bybit).toEqual({ BTCUSDT: btc })
})
