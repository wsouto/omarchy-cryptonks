// The saved quotes file, SavedQuotes.js: what each exchange shows at once
// after a switch or a restart.
//
// Run with `bun test` (test/check.sh does).
import { test, expect } from "bun:test"
import { load } from "./load.js"

const Q = load("SavedQuotes.js")

const btc = { symbol: "BTCUSDT", exchange: "Bybit", price: 1 }
const eth = { symbol: "ETHUSDT", exchange: "OKX", price: 2 }

test("an old file still shows its prices, each under its own exchange", () => {
  expect(Q.byExchange({ version: 1, quotes: { BTCUSDT: btc, ETHUSDT: eth } }))
    .toEqual({ Bybit: { BTCUSDT: btc }, OKX: { ETHUSDT: eth } })
})

test("a version 2 file is read as written", () => {
  const quotes = { Bybit: { BTCUSDT: btc } }
  expect(Q.byExchange({ version: 2, quotes })).toEqual(quotes)
})

test("a file that can't be read, or from a later version, shows no prices", () => {
  expect(Q.byExchange(null)).toEqual({})
  expect(Q.byExchange({ version: 3, quotes: {} })).toEqual({})
  expect(Q.byExchange({ version: 1 })).toEqual({})
})

test("saving one exchange's quotes keeps the others", () => {
  const all = { Bybit: { BTCUSDT: btc }, OKX: { ETHUSDT: eth } }
  expect(Q.withExchange(all, "Bybit", {})).toEqual({ Bybit: {}, OKX: { ETHUSDT: eth } })
  expect(all.Bybit).toEqual({ BTCUSDT: btc })
})
