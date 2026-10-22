.pragma library
// Adapted from Stonks by Gaurav Chande (MIT), omarchy-stonks v1.0.2,
// Search.js. Changes: no lookup is asked of anyone: the results come from
// the instrument list already fetched (`SymbolList.qml`), so nothing goes
// out while you type, and every result is one this project follows.
//
// Search's results: the instruments a query finds, best first. Knows
// nothing of where the list came from.

// What a full answer holds, as the original's lookup sent at most.
var MAX_RESULTS = 8

// How well `item` ({ symbol, name }) matches `q`, lower is better, or -1
// for no match: "eth" puts ETHUSDT, whose coin is ETH, before ETHFIUSDT and
// both before a name that only holds the word. `quote` is the quote coin
// every symbol ends in, so a coin is its symbol without it.
function rank(item, q, quote) {
  var symbol = item.symbol.toLowerCase()
  var coin = symbol.slice(-quote.length) === quote ? symbol.slice(0, -quote.length) : symbol
  var name = String(item.name || "").toLowerCase()
  if (coin === q || symbol === q || name === q) return 0
  if (coin.indexOf(q) === 0) return 1
  if (name.indexOf(q) === 0) return 2
  if (symbol.indexOf(q) >= 0) return 3
  if (name.indexOf(q) >= 0) return 4
  return -1
}

// The best `max` matches of `query` in `instruments`, best first; a tie
// goes to the shorter symbol, then A to Z. An empty query finds nothing.
function find(instruments, query, quote, max) {
  var q = String(query || "").trim().toLowerCase()
  if (q === "") return []
  var low = String(quote || "").toLowerCase()
  var found = []
  for (var i = 0; i < (instruments || []).length; i++) {
    var r = rank(instruments[i], q, low)
    if (r >= 0) found.push({ rank: r, item: instruments[i] })
  }
  found.sort(function(a, b) {
    return a.rank - b.rank || a.item.symbol.length - b.item.symbol.length || (a.item.symbol < b.item.symbol ? -1 : 1)
  })
  return found.slice(0, max || MAX_RESULTS).map(function(f) { return f.item })
}
