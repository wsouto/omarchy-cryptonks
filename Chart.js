.pragma library
// Adapted from Stonks by Gaurav Chande (MIT), omarchy-stonks v1.0.2,
// Chart.js, `chartGeometry`. Changes: the day is the UTC day, 00:00 to
// 24:00, so there are no sessions, breaks, ticks or extended hours to lay
// out, and the baseline is the day's open rather than the previous close.
// The scrub's helpers (`timeAtFraction`, `fractionAtTime`, `stepTime`,
// `yAt`) run by the clock alone, as the original's do for a day that is not
// laid out by print.
//
// The day line as a drawing reads it: each point's place across the UTC day
// and up its range, 0 to 1, with 0 at the top as a canvas counts. Knows
// nothing of how it is drawn.

var DAY = 86400

// { points: [{ x, y }], baselineY }, or null for a quote with no line or no
// open to measure from. A line partway through the day ends partway across,
// as the original's does before the close. The vertical range holds every
// point and the open, with headroom, so the baseline is always in view.
function dayGeometry(quote) {
  if (!quote || !quote.points || !quote.points.length || typeof quote.dayOpen !== "number") return null
  var pts = quote.points
  var start = Math.floor(pts[0].t / DAY) * DAY
  var lo = quote.dayOpen, hi = quote.dayOpen
  for (var j = 0; j < pts.length; j++) {
    if (pts[j].p < lo) lo = pts[j].p
    if (pts[j].p > hi) hi = pts[j].p
  }
  // A day that never moved has no range: any headroom draws it level.
  var pad = (hi - lo) * 0.08 || 0.5
  lo -= pad; hi += pad
  var out = []
  for (var k = 0; k < pts.length; k++)
    out.push({ x: (pts[k].t - start) / DAY, y: 1 - (pts[k].p - lo) / (hi - lo) })
  return { points: out, baselineY: 1 - (quote.dayOpen - lo) / (hi - lo) }
}

// The UTC day a quote's line belongs to: its 00:00, in seconds.
function dayStart(quote) {
  return Math.floor(quote.points[0].t / DAY) * DAY
}

// The moment at `fraction` across the day, 0..1, as the chart lays it out.
function timeAtFraction(quote, fraction) {
  return Math.round(dayStart(quote) + Math.max(0, Math.min(1, fraction)) * DAY)
}

// Where the moment `t` sits across the day, 0..1; -1 off the day.
function fractionAtTime(quote, t) {
  var x = (t - dayStart(quote)) / DAY
  return x < 0 || x > 1 ? -1 : x
}

// The candle a moment reads: the last at or before `t`, as { t, p }; null
// before the first. A scrub shows a candle's close, the price the exchange
// sent, never one drawn between two candles.
function readingAt(quote, t) {
  var pts = quote.points
  var read = null
  for (var i = 0; i < pts.length && pts[i].t <= t; i++) read = pts[i]
  return read
}

// `t` moved `steps` candles of five minutes, kept between the first candle
// and the last.
function stepTime(quote, t, steps) {
  var pts = quote.points
  return Math.max(pts[0].t, Math.min(pts[pts.length - 1].t, t + steps * 300))
}

// Interpolated normalized y for a normalized x, or null past the line.
function yAt(points, x) {
  if (!points || !points.length) return null
  if (x < points[0].x || x > points[points.length - 1].x) return null
  if (points.length === 1) return points[0].y
  for (var i = 1; i < points.length; i++) {
    if (points[i].x >= x) {
      var a = points[i - 1], b = points[i]
      var f = b.x === a.x ? 0 : (x - a.x) / (b.x - a.x)
      return a.y + (b.y - a.y) * f
    }
  }
  return null
}
