.pragma library
// The saved quotes file, ~/.cache/wsouto.cryptonks/quotes.json: the last
// quote of each symbol, by exchange, so a switch to an exchange shows its
// last prices at once. Knows nothing of where the file lives.
//
// Version 3 is { version: 3, quotes: { exchange: { symbol: quote } } }, with
// the 24-hour record of docs/QUOTE-RECORD.md. Older files held the UTC day's
// fields and are not read: the first refresh writes the file again.

var VERSION = 3

// { exchange: { symbol: quote } } from the file's parsed JSON; {} for
// anything else.
function byExchange(parsed) {
  if (!parsed || typeof parsed !== "object" || parsed.version !== VERSION) return {}
  if (!parsed.quotes || typeof parsed.quotes !== "object") return {}
  return parsed.quotes
}

// `all` with `exchange`'s quotes replaced by `quotes`; the others kept.
function withExchange(all, exchange, quotes) {
  var out = Object.assign({}, all)
  out[exchange] = quotes
  return out
}
