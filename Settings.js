.pragma library
.import "Change.js" as Change
// Adapted from Stonks by Gaurav Chande (MIT), omarchy-stonks v1.0.2,
// Settings.js. Changes: only the data file's keys are kept, with this
// project's starter symbols and its two change modes; the lists, orders,
// ranges and refresh interval come back with the screens that change them
// (roadmap steps 8c and 9), so adding, removing, undoing and the order touch
// All alone; the change sorted by is since 00:00 UTC; and nothing is read
// from the bar entry, which never held this project's symbols.
//
// The data file's settings: settings in, settings out. Knows nothing of
// quotes.

// What the pill shows before you choose: the five largest perpetuals.
var STARTERS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "DOGEUSDT"]

function normalizeSymbols(value) {
  var list = []
  if (typeof value === "string") list = value.split(/[\s,]+/)
  else if (value && typeof value.length === "number") list = value
  var out = []
  for (var i = 0; i < list.length; i++) {
    var s = String(list[i] || "").trim().toUpperCase()
    if (s && out.indexOf(s) < 0) out.push(s)
  }
  return out
}

// All always keeps one symbol: the pill, the hero, and the window all need
// one to show. The popup refuses All's last removal and says why, from this
// one rule.
function canRemove(symbols) {
  return !!symbols && symbols.length > 1
}

// A list's order. Manual is the symbols array as saved; the rest are views
// over it, so sorting never rewrites what you arranged by hand. The order
// and the change mode are separate settings: sorting by % change ranks the
// rows without changing what their change figures say. There is no order by
// the amount: a dollar's move means nothing beside a coin's price, so a
// cheap coin's would always rank last.
var ORDERS = ["manual", "symbol", "name", "pct"]

var ORDER_LABELS = { manual: "MANUAL", symbol: "SYMBOL", name: "NAME", pct: "% CHANGE" }

function normalizeOrder(value) {
  return ORDERS.indexOf(value) >= 0 ? value : "manual"
}

function nextOrder(order) {
  return ORDERS[(ORDERS.indexOf(normalizeOrder(order)) + 1) % ORDERS.length]
}

// A sorted order runs its own way, A to Z or biggest gain first, or,
// reversed, the other. Manual has no direction, so it is never reversed.
function normalizeReversed(order, value) {
  return normalizeOrder(order) !== "manual" && value === true
}

// True when a sorted order puts the smallest value first: text unreversed,
// a change reversed.
function sortsAscending(order, reversed) {
  order = normalizeOrder(order)
  return (order === "pct") === normalizeReversed(order, reversed)
}

// The order control's word, its arrow the way the values run down the list:
// ↑ ascending, ↓ descending, ↕ manual.
function orderLabel(order, reversed) {
  order = normalizeOrder(order)
  var arrow = order === "manual" ? "↕" : sortsAscending(order, reversed) ? "↑" : "↓"
  return arrow + "  " + ORDER_LABELS[order]
}

// Symbols in display order. Sorted views keep quotes that have not
// arrived at the bottom, in their manual order, and the sort is stable so
// ties keep their manual order too, whichever way it runs.
function sortedSymbols(symbols, quotes, order, reversed) {
  order = normalizeOrder(order)
  if (order === "manual") return symbols.slice()
  var keyed = []
  for (var i = 0; i < symbols.length; i++) {
    var q = quotes[symbols[i]]
    keyed.push({ symbol: symbols[i], index: i, key: q ? sortKey(q, order) : null })
  }
  var first = sortsAscending(order, reversed) ? -1 : 1
  keyed.sort(function(a, b) {
    if (a.key === null && b.key === null) return a.index - b.index
    if (a.key === null) return 1
    if (b.key === null) return -1
    if (a.key < b.key) return first
    if (a.key > b.key) return -first
    return a.index - b.index
  })
  return keyed.map(function(k) { return k.symbol })
}

// A quote's place in a sorted order: null, with the unsorted at the bottom,
// when it has no change to rank by.
function sortKey(quote, order) {
  if (order === "symbol") return quote.symbol.toUpperCase()
  if (order === "name") return String(quote.name || quote.symbol).toUpperCase()
  var move = Change.sinceOpen(quote)
  return move ? move.pct : null
}

// The data file. `symbols` is All, the library, in its manual order, and
// never empty: the pill and the hero need one to show. `featured` is the
// symbol they show, one of All, else All's first. A key this version doesn't
// know stays as it is: a later version's, after a downgrade or from another
// machine sharing the file.
function fileSettings(src) {
  var from = src || {}
  var symbols = normalizeSymbols(from.symbols && from.symbols.length ? from.symbols : STARTERS)
  if (!symbols.length) symbols = STARTERS.slice()
  var featured = String(from.featured || "").toUpperCase()
  return Object.assign({}, from, {
    version: 1,
    symbols: symbols,
    featured: symbols.indexOf(featured) >= 0 ? featured : symbols[0],
    order: normalizeOrder(from.order),
    reversed: normalizeReversed(from.order, from.reversed),
    changeMode: from.changeMode === "abs" ? "abs" : "pct",
    style: from.style === "retro" ? "retro" : "smooth"
  })
}

function settingsEqual(left, right) {
  return JSON.stringify(fileSettings(left)) === JSON.stringify(fileSettings(right))
}

// An added symbol goes to the end of All.
function withSymbolAdded(settings, symbol) {
  var next = fileSettings(settings)
  next.symbols = normalizeSymbols(next.symbols.concat([symbol]))
  return next
}

// A symbol out of All, which keeps one. A featured symbol that leaves hands
// the hero to its neighbour in `shown`, the rows as the popup shows them:
// the next, or the one before when it was the last.
function withSymbolRemoved(settings, symbol, shown) {
  var next = fileSettings(settings)
  if (!canRemove(next.symbols) || next.symbols.indexOf(symbol) < 0) return next
  next.symbols = next.symbols.filter(function(s) { return s !== symbol })
  if (next.featured === symbol) {
    var at = (shown || []).indexOf(symbol)
    next.featured = at < 0 ? next.symbols[0] : shown[at === shown.length - 1 ? at - 1 : at + 1]
  }
  return fileSettings(next)
}

// A removal taken back: the symbol returns to the place it had in All, as
// `before` recorded it, and to the hero only if the removal moved it off and
// the hero is still the one it `left`. Anything else changed since stays as
// it is now.
function withRemovalUndone(settings, before, symbol, left) {
  var next = fileSettings(settings)
  var then = fileSettings(before)
  var at = then.symbols.indexOf(symbol)
  if (at >= 0 && next.symbols.indexOf(symbol) < 0) {
    next.symbols = next.symbols.slice()
    next.symbols.splice(Math.min(at, next.symbols.length), 0, symbol)
  }
  if (then.featured === symbol && left !== symbol && next.featured === left) next.featured = symbol
  return fileSettings(next)
}

// Another order starts in its own direction.
function withOrder(settings, order) {
  return fileSettings(Object.assign({}, fileSettings(settings), { order: normalizeOrder(order), reversed: false }))
}

// The sorted order the other way; manual has no direction.
function withReversed(settings) {
  var next = fileSettings(settings)
  return fileSettings(Object.assign({}, next, { reversed: !next.reversed }))
}

// A hand-arranged order of All, which must hold the same symbols; it is
// manual from then on.
function withManualOrder(settings, symbols) {
  var next = fileSettings(settings)
  var moved = normalizeSymbols(symbols)
  var same = moved.length === next.symbols.length && moved.every(function(s) { return next.symbols.indexOf(s) >= 0 })
  return same ? fileSettings(Object.assign({}, next, { symbols: moved, order: "manual", reversed: false })) : next
}

// A list with one symbol moved to a new slot.
function movedSymbols(symbols, from, to) {
  var list = symbols.slice()
  if (from < 0 || from >= list.length || to < 0 || to >= list.length) return list
  var item = list.splice(from, 1)[0]
  list.splice(to, 0, item)
  return list
}
