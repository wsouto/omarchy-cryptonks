.pragma library
// Adapted from Stonks by Gaurav Chande (MIT), omarchy-stonks v1.0.2,
// Settings.js. Changes: only the data file's keys are kept, with this
// project's starter symbols and its two change modes; the lists, orders,
// ranges and refresh interval come back with the screens that change them
// (roadmap steps 8 and 9), and nothing is read from the bar entry, which
// never held this project's symbols.
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
