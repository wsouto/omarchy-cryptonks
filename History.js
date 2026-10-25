.pragma library
.import "Format.js" as Format
// Adapted from Stonks by Gaurav Chande (MIT), omarchy-stonks v1.0.2,
// History.js. Changes: Yahoo's answer, its bars, clocks and sessions are
// gone: a history is the adapter's own (`buildHistory`: bars of a start and
// a close, a high and a low, and the price at the range's start), every date
// is read in UTC, and a range is asked again by its age alone, since the
// market never closes. The range line is the original's, with its dates and
// its SINCE for a symbol younger than the range.
//
// Ranges: the names, how long one is kept, how its line is laid out, and how
// a moment on it is said. Knows nothing of Bybit's intervals or of how the
// line is drawn.

var RANGES = ["1D", "1W", "1M", "3M", "6M", "YTD", "1Y", "2Y", "5Y", "10Y", "All"]

// From 5Y up the scale is logarithmic, so years of growth read as a slope
// and not a flat line and a wall.
var LOG = ["5Y", "10Y", "All"]

function normalizeRange(value) {
  return RANGES.indexOf(value) >= 0 ? value : "1D"
}

// The range to the side of `range`, kept at its ends.
function steppedRange(range, delta) {
  var at = RANGES.indexOf(normalizeRange(range))
  return RANGES[Math.max(0, Math.min(RANGES.length - 1, at + delta))]
}

// Whether the range's answer `at` (the exchange's time, seconds) is asked
// again at `now`: after 15 minutes for the ranges of candles within the
// day's hours (1W, 1M), whose line moves with the hour, and after an hour
// for the rest. Never asked, always.
function due(range, at, now) {
  if (!at) return true
  return now - at >= (range === "1W" || range === "1M" ? 900 : 3600)
}

// Normalized x/y for a history: bars evenly spaced, and a vertical range
// that holds every close and the price at the range's start, with headroom.
// A log scale has no place for zero or a negative price, so a history
// holding one stays linear. Null with no bars.
function geometry(history) {
  var bars = history && history.bars ? history.bars : []
  if (bars.length === 0) return null
  var log = LOG.indexOf(history.range) >= 0 && history.baseline > 0
    && bars.every(function (bar) { return bar.p > 0 })
  var scale = log ? Math.log : function (p) { return p }
  var lo = scale(history.baseline)
  var hi = lo
  for (var i = 0; i < bars.length; i++) {
    var v = scale(bars[i].p)
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  var pad = (hi - lo) * 0.08 || 0.5
  lo -= pad
  hi += pad
  var denominator = Math.max(1, bars.length - 1)
  var points = []
  for (var k = 0; k < bars.length; k++)
    points.push({ x: k / denominator, y: 1 - (scale(bars[k].p) - lo) / (hi - lo) })
  return { points: points, baselineY: 1 - (scale(history.baseline) - lo) / (hi - lo) }
}

// The bar at or before `t`: its index, or -1 before the first.
function indexAt(history, t) {
  var at = -1
  for (var i = 0; i < history.bars.length && history.bars[i].t <= t; i++) at = i
  return at
}

// The bar a moment reads, as the day's chart reads a candle: the last at or
// before `t`; null before the first.
function barAt(history, t) {
  var i = indexAt(history, t)
  return i < 0 ? null : history.bars[i]
}

// The bar `fraction` of the way along the line, 0..1: bars are evenly
// spaced, so the nearest.
function timeAtFraction(history, fraction) {
  var n = history.bars.length
  return history.bars[Math.round(Math.max(0, Math.min(1, fraction)) * (n - 1))].t
}

// Where the bar at `t` sits along the line, 0..1; -1 off the range.
function fractionAtTime(history, t) {
  var bars = history.bars
  if (t < bars[0].t || t > bars[bars.length - 1].t) return -1
  return bars.length === 1 ? 0 : indexAt(history, t) / (bars.length - 1)
}

// `t` moved `steps` bars, kept between the first and the last.
function stepTime(history, t, steps) {
  var i = Math.max(0, Math.min(history.bars.length - 1, indexAt(history, t) + steps))
  return history.bars[i].t
}

function spansYears(history) {
  var bars = history.bars
  return new Date(bars[0].t * 1000).getUTCFullYear() !== new Date(bars[bars.length - 1].t * 1000).getUTCFullYear()
}

// A moment of a history in words, in UTC like the day's: "15 OCT 14:00 UTC"
// for a candle of an hour or less, "15 OCT" for a day's, "WEEK OF 12 OCT"
// for a week's and "OCT 2026" for a month's. A week or a month always
// carries its year, so a five-year high inside one calendar year doesn't
// read "JUL"; a day's does when the range crosses a year.
function momentText(history, t) {
  var d = new Date(t * 1000)
  var month = Format.MONTHS[d.getUTCMonth()]
  var year = d.getUTCFullYear()
  var step = history.step
  if (step >= 28 * 86400) return month + " " + year
  var date = d.getUTCDate() + " " + month + (step >= 86400 && (step > 86400 || spansYears(history)) ? " " + year : "")
  if (step > 86400) return "WEEK OF " + date
  if (step === 86400) return date
  return date + " " + Format.utcClock(t) + " UTC"
}

// ---- The info block's range line ----

// How far back a range reaches, in days, and the seconds one of its bars
// spans: what `youngRoom` tells a young symbol by. They are the adapter's
// (`RANGES`), which a test holds them to. All reaches the symbol's start.
var SPECS = {
  "1W": { days: 7, step: 900 },
  "1M": { days: 30, step: 3600 },
  "3M": { days: 90, step: 86400 },
  "6M": { days: 180, step: 86400 },
  "YTD": { days: 366, step: 86400 },
  "1Y": { days: 365, step: 86400 },
  "2Y": { days: 730, step: 86400 },
  "5Y": { days: 1826, step: 7 * 86400 },
  "10Y": { days: 3652, step: 7 * 86400 }
}

// A history's high and low (of the bars' highs and lows, with when), its
// last close, and its coverage: when it starts and ends, how many bars, and
// whether its first bar holds the symbol's start (`firstTradeDate`), so the
// symbol is younger than the range.
function periodStats(history, firstTradeDate) {
  var bars = history.bars
  var high = null
  var low = null
  for (var i = 0; i < bars.length; i++) {
    if (!high || bars[i].h > high.p) high = { p: bars[i].h, t: bars[i].t }
    if (!low || bars[i].l < low.p) low = { p: bars[i].l, t: bars[i].t }
  }
  var first = bars[0]
  var step = history.step
  var short = typeof firstTradeDate === "number" && first.t <= firstTradeDate + step && first.t + step >= firstTradeDate
  return { high: high, low: low, bars: bars.length, short: short }
}

// A bar's date on the info line. A week or a month has no day to place it,
// so it always carries its year: a five-year high inside one calendar year
// would otherwise read "JUL". A day's or an hour's takes the year only when
// the range crosses one. `asDay` writes a moment, as a symbol's start, by its day.
function statsDate(history, t, withYear, asDay) {
  var d = new Date(t * 1000)
  var month = Format.MONTHS[d.getUTCMonth()]
  if (history.step > 86400 && !asDay) return month + " " + d.getUTCFullYear()
  return d.getUTCDate() + " " + month + (withYear || spansYears(history) ? " " + d.getUTCFullYear() : "")
}

// The widest date `statsDate` writes: a week's or a month's with its year, a
// day's or an hour's with a two-digit day but no year, which it takes only
// when the range crosses one; then the slot grows. `withYear`, as SINCE,
// always has it. The original sizes a day's with the year: next to a coin's
// prices that left HIGH no room.
function statsDateWidest(step, withYear) {
  return step > 86400 ? "MMM 8888" : withYear ? "88 MMM 8888" : "88 MMM"
}

// A range line's facts for bars of `step` seconds: when the symbol is
// younger than the range (`since`), its start before the low and high, and,
// where it can have fewer than eight bars (`bars`), the slot for how few
// after them. `values` holds what each says, "" when not known.
function rangeFacts(step, since, bars, values) {
  var facts = []
  if (since) facts.push({ label: "SINCE", value: values.since || "", widest: statsDateWidest(86400, true) })
  facts.push({ label: "LOW", value: values.low || "", widest: statsDateWidest(step) })
  facts.push({ label: "HIGH", value: values.high || "", widest: statsDateWidest(step), edge: true })
  if (since && bars) facts.push({ label: "", value: values.bars || "", after: "BARS", widest: "8" })
  return facts
}

// The longest a symbol can have traded and still have fewer than eight bars
// on a range short of All: eight of the coarsest, a week, and one more.
var FEW_BARS_AGE = 9 * 7 * 86400

// What a range line can say beyond its low and high, from when the symbol
// began trading (`quote.firstTradeDate`) to the quote's time: SINCE on each
// range short of All it is younger than (`since`, their names), and how few
// bars it has where it is young enough to have fewer than eight (`bars`).
// Not knowing when it began, all of it.
function youngRoom(quote) {
  var listed = quote ? quote.firstTradeDate : null
  var asOf = quote ? quote.marketTime : null
  var known = typeof listed === "number" && typeof asOf === "number"
  var age = known ? asOf - listed : 0
  var since = Object.keys(SPECS).filter(function (r) {
    return !known || age <= SPECS[r].days * 86400 + SPECS[r].step
  })
  return { since: since, bars: !known || age <= FEW_BARS_AGE }
}

// Every list of facts a range line can hold, on any range: what the info
// table sizes its columns for, so a range change moves none of them.
function rangeFactLists(room) {
  var lists = []
  for (var r in SPECS) {
    lists.push(rangeFacts(SPECS[r].step, false, false, {}))
    if (room.since.indexOf(r) >= 0) lists.push(rangeFacts(SPECS[r].step, true, room.bars, {}))
  }
  lists.push(rangeFacts(31 * 86400, false, false, {}))
  return lists
}

// The info block's first line on a range: the range, its low and high with
// the quote's price between them, then what only a range says: when a symbol
// younger than a range short of All began, the dates of its low and high,
// and how few bars a young symbol has. The bars' slot is kept while the
// symbol is younger than its range, where it can have so few (`room.bars`),
// so the eighth bar empties it and moves nothing.
function rangeLine(history, quote, room) {
  var stats = periodStats(history, quote.firstTradeDate)
  var since = stats.short && history.range !== "All"
  var dated = function (point) { return point ? statsDate(history, point.t, false) : "" }
  return {
    title: history.range.toUpperCase(),
    range: Format.infoRange(stats.low.p, stats.high.p, quote.price, quote.priceDigits),
    facts: rangeFacts(history.step, since, !room || room.bars, {
      since: since ? statsDate(history, quote.firstTradeDate, true, true) : "",
      low: dated(stats.low),
      high: dated(stats.high),
      bars: stats.bars < 8 ? String(stats.bars) : ""
    })
  }
}
