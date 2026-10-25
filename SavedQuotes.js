.pragma library
// The saved quotes file, ~/.cache/wsouto.cryptonks/quotes.json: the last
// quote of each symbol, by exchange, so a switch to an exchange shows its
// last prices at once. Knows nothing of where the file lives.
//
// Version 2 is { version: 2, quotes: { exchange: { symbol: quote } } }.
// Version 1 held one map, { symbol: quote }; each quote names its exchange,
// so it is read as version 2.

var VERSION = 2

// { exchange: { symbol: quote } } from the file's parsed JSON; {} for
// anything else.
function byExchange(parsed) {
  if (!parsed || typeof parsed !== "object" || !parsed.quotes || typeof parsed.quotes !== "object") return {}
  if (parsed.version === VERSION) return parsed.quotes
  if (parsed.version !== 1) return {}
  var out = {}
  for (var s in parsed.quotes) {
    var q = parsed.quotes[s]
    if (!q || typeof q.exchange !== "string") continue
    if (!out[q.exchange]) out[q.exchange] = {}
    out[q.exchange][s] = q
  }
  return out
}

// `all` with `exchange`'s quotes replaced by `quotes`; the others kept.
function withExchange(all, exchange, quotes) {
  var out = Object.assign({}, all)
  out[exchange] = quotes
  return out
}
