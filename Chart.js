.pragma library
// Adapted from Stonks by Gaurav Chande (MIT), omarchy-stonks v1.0.2,
// Chart.js, `chartGeometry`. Changes: the day is the UTC day, 00:00 to
// 24:00, so there are no sessions, breaks, ticks or extended hours to lay
// out, and the baseline is the day's open rather than the previous close.
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
