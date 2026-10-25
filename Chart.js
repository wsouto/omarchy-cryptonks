.pragma library
// Adapted from Stonks by Gaurav Chande (MIT), omarchy-stonks v1.0.2,
// Chart.js, `chartGeometry`. Changes: 1D is the last 24 hours, as the
// exchanges draw it, so there are no sessions, breaks, ticks or extended
// hours to lay out, and the baseline is the price 24 hours ago rather than
// the previous close. The scrub's helpers (`timeAtFraction`,
// `fractionAtTime`, `stepTime`, `yAt`) run by the clock alone, as the
// original's do for a day that is not laid out by print.
//
// The 24-hour line as a drawing reads it: each point's place across the 24
// hours and up its range, 0 to 1, with 0 at the top as a canvas counts.
// Knows nothing of how it is drawn.

var DAY = 86400

// { points: [{ x, y }], baselineY }, or null for a quote with no line or no
// open to measure from. The 24 hours end at the newest candle, so the line
// always reaches the right edge; a symbol younger than that starts partway
// across. The vertical range holds every point and the open, with headroom,
// so the baseline is always in view.
function dayGeometry(quote) {
  if (!quote || !quote.points || !quote.points.length || typeof quote.open24h !== "number") return null
  var pts = quote.points
  var start = windowStart(quote)
  var lo = quote.open24h, hi = quote.open24h
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
  return { points: out, baselineY: 1 - (quote.open24h - lo) / (hi - lo) }
}

// Where a quote's 24 hours begin, in seconds: a day before its newest candle.
function windowStart(quote) {
  return quote.points[quote.points.length - 1].t - DAY
}

// The moment at `fraction` across the 24 hours, 0..1, as the chart lays it out.
function timeAtFraction(quote, fraction) {
  return Math.round(windowStart(quote) + Math.max(0, Math.min(1, fraction)) * DAY)
}

// Where the moment `t` sits across the 24 hours, 0..1; -1 off them.
function fractionAtTime(quote, t) {
  var x = (t - windowStart(quote)) / DAY
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
