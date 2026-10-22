.pragma library
// Adapted from Stonks by Gaurav Chande (MIT), omarchy-stonks v1.0.2,
// Settings.js. Changes: only the data file's keys are kept, with this
// project's starter symbols and its two change modes; the lists, orders,
// ranges and refresh interval come back with the screens that change them
// (roadmap steps 8b, 8c and 9), so adding, removing and undoing touch All
// alone; and nothing is read from the bar entry, which never held this
// project's symbols.
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
