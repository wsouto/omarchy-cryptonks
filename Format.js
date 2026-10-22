.pragma library
// Copied from Stonks by Gaurav Chande (MIT), omarchy-stonks v1.0.2, Format.js.
// Changes: only what this project uses is kept, writing a price, a percent, a
// move in money, the month names and a UTC clock, the retro look's signs, and stacking a
// symbol, a percent and a move in money for a side bar; the local
// clock times, durations and range texts were removed until a screen needs
// them. A stacked symbol
// splits at its quote currency, as the original splits BTC-USD at its dash.
// Kept as plain JavaScript on purpose.
// How numbers are checked and written: prices, changes and their signs.
// Knows nothing of markets, quotes, or where the data comes from.

function isFiniteNumber(v) {
  return typeof v === "number" && isFinite(v)
}

// A true minus, the width of the plus, so signed figures line up.
var MINUS = "\u2212"

// Thousands commas in the whole part only: 0.000005410 keeps its decimals
// together.
function grouped(digits) {
  var parts = String(digits).split(".")
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  return parts.join(".")
}

// The sign a figure shows once it is rounded the way it is drawn. A move
// that rounds to nothing is no move: it takes no sign and no colour.
function shownSign(value, digits) {
  if (!isFiniteNumber(value) || Number(Math.abs(value).toFixed(digits)) === 0) return 0
  return value > 0 ? 1 : -1
}

function moneyDigits(abs) {
  return abs >= 10000 ? 0 : 2
}

// Decimals stop mattering once a move is four digits wide.
function pctDigits(abs) {
  return abs >= 1000 ? 0 : 2
}

function signText(sign) {
  return sign > 0 ? "+" : sign < 0 ? MINUS : ""
}

// A price, in its listing's decimals (`priceDigits`) when given.
function money(value, digits) {
  if (value === null || value === undefined || isNaN(value)) return "—"
  var abs = Math.abs(value)
  var shown = isFiniteNumber(digits) ? digits : moneyDigits(abs)
  return (shownSign(value, shown) < 0 ? MINUS : "") + grouped(abs.toFixed(shown))
}

// One sign language per look: smooth says + and −, retro says ▲ and ▼. An
// unmoved figure has no sign in either.
function lookSigns(text, retro) {
  return retro ? String(text).replace("+", "▲").replace(MINUS, "▼") : text
}

// A move in money takes the listing's decimals, never fewer than two, and
// none from 10,000 up, where a cent no longer says anything.
function moveDigits(abs, digits) {
  return abs >= 10000 ? 0 : Math.max(2, isFiniteNumber(digits) ? digits : 2)
}

function signedMoney(value, digits) {
  if (!isFiniteNumber(value)) return "—"
  var shown = moveDigits(Math.abs(value), digits)
  return signText(shownSign(value, shown)) + money(Math.abs(value), shown)
}

var MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]

function pad2(n) {
  return n < 10 ? "0" + n : String(n)
}

// A time of the UTC day, "14:35": the day here is the UTC day, so its
// moments are said in UTC whatever the machine's zone.
function utcClock(t) {
  var d = new Date(t * 1000)
  return pad2(d.getUTCHours()) + ":" + pad2(d.getUTCMinutes())
}

function pct(value) {
  return isFiniteNumber(value) ? percent(value, pctDigits(Math.abs(value))) : "—"
}

// A move in money stacked, as `signedMoney` writes it, split at its point
// with its sign kept: −3 over .84, and a fraction too long for a line
// broken after its fourth character, as a coin under a cent's is. From a
// thousand, in its unit: 8.9 over K.
function stackedMoney(value, digits) {
  if (!isFiniteNumber(value)) return { lines: ["—"], sign: 0 }
  var shown = moveDigits(Math.abs(value), digits)
  var sign = shownSign(value, shown)
  var fixed = Math.abs(value).toFixed(shown)
  if (Number(fixed) >= 1000) {
    var big = stackedThousands(Number(fixed))
    return { lines: [signText(sign) + big.figure, big.unit], sign: sign }
  }
  var parts = fixed.split(".")
  return { lines: [signText(sign) + parts[0]].concat(parts.length > 1 ? stackChunks("." + parts[1]) : []), sign: sign }
}

function percent(value, digits) {
  return signText(shownSign(value, digits)) + grouped(Math.abs(value).toFixed(digits)) + "%"
}

// A move rounded for a side bar's stack: one decimal under 10%, none from
// there. It is the pill's figure (`pct`) rounded half up, in whole
// hundredths so no float can tip it, so the two never disagree: +9.95%
// reads +10, +0.05% +0.1, however the quote's prices made it. `shown` is
// its size.
function narrowPctShown(value) {
  var abs = Math.abs(value)
  var hundredths = Math.round(Number(abs.toFixed(pctDigits(abs))) * 100)
  var tenths = Math.round(hundredths / 10)
  return tenths >= 100 ? { digits: 0, shown: Math.round(hundredths / 100) } : { digits: 1, shown: tenths / 10 }
}

// A bar at the side of the screen stacks the pill as Omarchy's clock stacks
// its lines, one to an icon slot, each at most STACK_WIDTH characters: as
// many as fit its 28 px at the clock's sizes.
var STACK_WIDTH = 4

// `text` broken after every STACK_WIDTH characters.
function stackChunks(text) {
  var out = []
  for (var i = 0; i < text.length; i += STACK_WIDTH) out.push(text.slice(i, i + STACK_WIDTH))
  return out
}

// A symbol's stacked lines: its base over its quote currency when it ends
// with one (BTC over USDT), and any part still longer broken after its
// fourth character (1000 PEPE). Before the currency is known, the symbol is
// only broken (BTCU SDT).
function stackedSymbol(symbol, currency) {
  var s = String(symbol)
  if (s.length <= STACK_WIDTH) return [s]
  var at = currency && s.length > currency.length && s.slice(-currency.length) === currency ? s.length - currency.length : -1
  var parts = at > 0 ? [s.slice(0, at), s.slice(at)] : [s]
  return parts.reduce(function(out, part) { return out.concat(stackChunks(part)) }, [])
}

// A magnitude of a thousand or more, in its unit: one decimal under 10,
// none from there, and a figure that rounds to 1,000 of its unit is one of
// the next. At most three characters, so its sign fits beside it.
function stackedThousands(abs) {
  var units = ["K", "M", "B", "T"]
  var v = abs
  var u = -1
  do {
    v /= 1000
    u++
  } while (Math.round(v) >= 1000 && u < units.length - 1)
  return { figure: Math.round(v * 10) < 100 ? v.toFixed(1) : String(Math.round(v)), unit: units[u] }
}

// A move in percent stacked, its sign and figure over its %: −1.5 over %,
// −12 over % from 10% (`narrowPctShown`), and from 1,000% in thousands,
// 1.2 over K%. `sign` is the figure's as drawn.
function stackedPct(value) {
  if (!isFiniteNumber(value)) return { lines: ["—"], sign: 0 }
  var narrow = narrowPctShown(value)
  var sign = narrow.shown === 0 ? 0 : value > 0 ? 1 : -1
  if (narrow.shown >= 1000) {
    var big = stackedThousands(narrow.shown)
    return { lines: [signText(sign) + big.figure, big.unit + "%"], sign: sign }
  }
  return { lines: [signText(sign) + narrow.shown.toFixed(narrow.digits), "%"], sign: sign }
}
