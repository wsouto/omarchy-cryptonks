.pragma library
// How far a quote has moved in the last 24 hours: its price against
// `open24h`, the exchange's own price 24 hours ago, so the change is the one
// the exchange shows. Knows nothing of where the quote came from or how it
// is drawn.

// { abs, pct } of the move, or null when the quote has no price or no open
// to measure from: a missing figure is never replaced by a guess. An open of
// zero is no open to measure from either, since a percent of nothing says
// nothing.
function sinceOpen(quote) {
  if (!quote || typeof quote.price !== "number" || typeof quote.open24h !== "number") return null
  if (!isFinite(quote.price) || !isFinite(quote.open24h) || quote.open24h === 0) return null
  var abs = quote.price - quote.open24h
  return { abs: abs, pct: abs / quote.open24h * 100 }
}
