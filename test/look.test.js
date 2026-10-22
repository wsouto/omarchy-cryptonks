// What the pill writes and draws, and in which colours: Format.js's prices,
// percents and side-bar stack, Chart.js's day line, Figures.js's arrow and
// animal, and Tones.js's up, down and secondary text. Each test names what
// a user would see go wrong in the bar.
//
// Run with `bun test` (test/check.sh does).
import { test, expect } from "bun:test"
import { load } from "./load.js"

const Fmt = load("Format.js")
const T = load("Tones.js")
const Ch = load("Chart.js")
const Fig = load("Figures.js")

const MINUS = "−"
const hex = T.hexColor

// ---- Prices ----

test("a price keeps its listing's decimals, with commas in the whole part only", () => {
  expect(Fmt.money(84440.8, 1)).toBe("84,440.8")
  expect(Fmt.money(0.00000541, 9)).toBe("0.000005410")
})

test("a price with no listing decimals drops cents from 10,000 up", () => {
  expect(Fmt.money(84440.8)).toBe("84,441")
  expect(Fmt.money(1234.567)).toBe("1,234.57")
})

test("a negative price takes a true minus, and one that rounds to zero takes none", () => {
  expect(Fmt.money(-5.5, 2)).toBe(MINUS + "5.50")
  expect(Fmt.money(-0.004, 2)).toBe("0.00")
})

test("a price that is not known shows a dash, never a 0", () => {
  expect(Fmt.money(null)).toBe("—")
  expect(Fmt.money(undefined)).toBe("—")
  expect(Fmt.money(NaN)).toBe("—")
})

// ---- Percents ----

test("a move shows its sign and two decimals", () => {
  expect(Fmt.pct(1.746)).toBe("+1.75%")
  expect(Fmt.pct(-1.746)).toBe(MINUS + "1.75%")
})

test("a move that rounds to nothing shows no sign", () => {
  expect(Fmt.pct(0.004)).toBe("0.00%")
  expect(Fmt.pct(-0.004)).toBe("0.00%")
})

test("a move four digits wide drops its decimals", () => {
  expect(Fmt.pct(1234.4)).toBe("+1,234%")
})

test("a move that is not known shows a dash", () => {
  expect(Fmt.pct(null)).toBe("—")
  expect(Fmt.pct(Infinity)).toBe("—")
})

// The bar colours by this sign, so it must agree with the sign drawn.
test("the colour's sign matches the sign drawn", () => {
  for (const v of [1.746, -1.746, 0.004, -0.006, 0, null]) {
    const sign = Fmt.shownSign(v, Fmt.pctDigits(Math.abs(v)))
    const text = Fmt.pct(v)
    expect(sign).toBe(text.startsWith("+") ? 1 : text.startsWith(MINUS) ? -1 : 0)
  }
})

// ---- Secondary text ----

test("secondary text is quieter than the foreground but keeps 4.5:1, on dark and light", () => {
  for (const [fg, ground] of [["#ffffff", "#000000"], ["#000000", "#ffffff"], ["#cdd6f4", "#1e1e2e"]]) {
    const dim = T.dim(hex(fg), hex(ground))
    expect(dim).not.toBe(fg)
    expect(T.contrast(hex(dim), hex(ground))).toBeLessThan(T.contrast(hex(fg), hex(ground)))
    expect(T.contrast(hex(dim), hex(ground))).toBeGreaterThanOrEqual(4.5)
  }
})

test("secondary text mixes only as far as 4.5:1 allows", () => {
  // #666666 on white is 5.74:1: a third of the way to white would fall
  // under, so it stops between. Checked as drawn, after rounding to #rrggbb.
  const dim = T.dim(hex("#666666"), hex("#ffffff"))
  expect(dim).not.toBe("#666666")
  expect(T.contrast(hex(dim), hex("#ffffff"))).toBeGreaterThanOrEqual(4.5)
  // #767676 is 4.54:1 and its next shade, #777777, is 4.48:1: no room to mix.
  expect(T.dim(hex("#767676"), hex("#ffffff"))).toBe("#767676")
})

test("a foreground already under 4.5:1 is left as it is", () => {
  expect(T.dim(hex("#999999"), hex("#ffffff"))).toBe("#999999")
})

// ---- Up and down ----

const dark = hex("#1e1e2e")

test("a theme with a real green and red keeps its own", () => {
  // Catppuccin Mocha's green and red.
  expect(T.trend("#a6e3a1", hex("#f38ba8"), dark)).toEqual({ up: "#a6e3a1", down: hex("#f38ba8") })
})

test("a theme with two greens gets Stonks' own pair, picked for the ground", () => {
  expect(T.trend("#00ff00", hex("#00cc00"), dark)).toEqual(T.OWN_PAIRS[0])
  expect(T.trend("#00ff00", hex("#00cc00"), hex("#ffffff"))).toEqual(T.OWN_PAIRS[1])
})

test("a theme with no green at all gets Stonks' own pair", () => {
  expect(T.trend("", hex("#f38ba8"), dark)).toEqual(T.OWN_PAIRS[0])
})

test("a theme's green is read from colors.toml, then from color2", () => {
  expect(T.themeColor('green = "#a6e3a1"\ncolor2 = "#000000"', ["green", "color2"])).toBe("#a6e3a1")
  expect(T.themeColor("color2 = '#40a02b'", ["green", "color2"])).toBe("#40a02b")
  expect(T.themeColor("", ["green", "color2"])).toBe("")
})

// ---- The day's line ----

const DAY = 86400
const D0 = 1792627200

test("the line runs across the UTC day by time, ending where the day has got to", () => {
  const g = Ch.dayGeometry({ dayOpen: 100, points: [{ t: D0, p: 100 }, { t: D0 + DAY / 2, p: 110 }] })
  expect(g.points.map(p => p.x)).toEqual([0, 0.5])
})

test("the open is the baseline, in view, and a rise draws above it", () => {
  const g = Ch.dayGeometry({ dayOpen: 100, points: [{ t: D0, p: 101 }, { t: D0 + 300, p: 110 }] })
  expect(g.baselineY).toBeGreaterThan(0)
  expect(g.baselineY).toBeLessThan(1)
  for (const p of g.points) expect(p.y).toBeLessThan(g.baselineY)
})

test("a day that never moved draws level on its baseline", () => {
  const g = Ch.dayGeometry({ dayOpen: 0.000005, points: [{ t: D0, p: 0.000005 }] })
  expect(g.points[0].y).toBe(g.baselineY)
})

test("with no candles or no open there is no line, never a guessed one", () => {
  expect(Ch.dayGeometry(null)).toBeNull()
  expect(Ch.dayGeometry({ dayOpen: 100, points: [] })).toBeNull()
  expect(Ch.dayGeometry({ dayOpen: null, points: [{ t: D0, p: 1 }] })).toBeNull()
})

// ---- The arrow and the animal ----

test("the arrow tilts with the move and stops at 45 degrees past 5%", () => {
  expect(Fig.arrowAngle(0)).toBe(0)
  expect(Fig.arrowAngle(2.5)).toBe(22.5)
  expect(Fig.arrowAngle(-12)).toBe(-45)
  expect(Fig.arrowAngle(null)).toBe(0)
})

test("the bull for a day up, the bear for a day down, none for a flat one", () => {
  expect(Fig.animalKind(1)).toBe("bull")
  expect(Fig.animalKind(-1)).toBe("bear")
  expect(Fig.animalKind(0)).toBe("")
})

// ---- A side bar's stack ----

test("a symbol stacks as its coin over its quote currency", () => {
  expect(Fmt.stackedSymbol("BTCUSDT", "USDT")).toEqual(["BTC", "USDT"])
  expect(Fmt.stackedSymbol("1000PEPEUSDT", "USDT")).toEqual(["1000", "PEPE", "USDT"])
  expect(Fmt.stackedSymbol("BTCUSDT", "")).toEqual(["BTCU", "SDT"])
})

test("a stacked move is its sign and figure over %, the pill's figure rounded", () => {
  expect(Fmt.stackedPct(1.746)).toEqual({ lines: ["+1.8", "%"], sign: 1 })
  expect(Fmt.stackedPct(9.95)).toEqual({ lines: ["+10", "%"], sign: 1 })
  expect(Fmt.stackedPct(-0.04)).toEqual({ lines: ["0.0", "%"], sign: 0 })
  expect(Fmt.stackedPct(1234)).toEqual({ lines: ["+1.2", "K%"], sign: 1 })
  expect(Fmt.stackedPct(null)).toEqual({ lines: ["—"], sign: 0 })
})
