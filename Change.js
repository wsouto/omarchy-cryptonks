.pragma library
// How far a quote has moved since 00:00 UTC: its price against `dayOpen`, the
// open of today's UTC daily candle. Knows nothing of where the quote came
// from or how it is drawn.
//
// This is not Bybit's own "price24hPcnt", which counts a rolling 24 hours
// and so is a different number at every minute of the day. The screen says
// "since 00:00 UTC" next to it so the two are never mixed up.

// { abs, pct } of the move, or null when the quote has no price or no open
// to measure from: a missing figure is never replaced by a guess. An open of
// zero is no open to measure from either, since a percent of nothing says
// nothing.
function sinceOpen(quote) {
  if (!quote || typeof quote.price !== "number" || typeof quote.dayOpen !== "number") return null
  if (!isFinite(quote.price) || !isFinite(quote.dayOpen) || quote.dayOpen === 0) return null
  var abs = quote.price - quote.dayOpen
  return { abs: abs, pct: abs / quote.dayOpen * 100 }
}
