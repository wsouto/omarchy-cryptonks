.pragma library
// Copied from Stonks by Gaurav Chande (MIT), omarchy-stonks v1.0.2, Format.js.
// Changes: only what this project uses is kept, writing a price and a percent;
// the clock times, durations, stacking for a side bar and range texts were
// removed until a screen needs them. Kept as plain JavaScript on purpose.
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

function pct(value) {
  return isFiniteNumber(value) ? percent(value, pctDigits(Math.abs(value))) : "—"
}

function percent(value, digits) {
  return signText(shownSign(value, digits)) + grouped(Math.abs(value).toFixed(digits)) + "%"
}
