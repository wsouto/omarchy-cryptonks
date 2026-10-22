.pragma library
.import "Format.js" as Format
// Adapted from Stonks by Gaurav Chande (MIT), omarchy-stonks v1.0.2,
// History.js. Changes: Yahoo's answer, its bars, clocks and sessions are
// gone: a history is the adapter's own (`buildHistory`: bars of a start and
// a close, and the price at the range's start), every date is read in UTC,
// and a range is asked again by its age alone, since the market never
// closes. The range line of the info block comes with the info block.
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
