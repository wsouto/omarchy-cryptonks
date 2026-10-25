.pragma library
.import "adapters/bybit.js" as Bybit
.import "adapters/binance.js" as Binance
.import "adapters/okx.js" as Okx

// The exchanges this project can read, in the order a click steps through
// them, and the one that is meant when a name is unknown. Pure: it only
// picks an adapter by its name.

var ADAPTERS = [Bybit, Binance, Okx]

function names() {
  return ADAPTERS.map(function (a) { return a.NAME })
}

// The adapter called `name`, else Bybit's: a data file naming an exchange
// this version doesn't know still shows prices.
function byName(name) {
  for (var i = 0; i < ADAPTERS.length; i++) if (ADAPTERS[i].NAME === name) return ADAPTERS[i]
  return ADAPTERS[0]
}

// The exchange after `name`, the first one after the last.
function next(name) {
  var at = names().indexOf(normalize(name))
  return ADAPTERS[(at + 1) % ADAPTERS.length].NAME
}

function normalize(name) {
  return byName(name).NAME
}
