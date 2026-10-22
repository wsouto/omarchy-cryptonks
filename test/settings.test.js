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
