.pragma library
.import "Change.js" as Change
.import "Chart.js" as Chart
.import "Format.js" as Format
// Adapted from Stonks by Gaurav Chande (MIT), omarchy-stonks v1.0.2,
// Figures.js. Changes: only the pill's two rules and the hero's figures are
// kept; the animal reads the move's sign as drawn, and the hero's figures
// (`heroView`, the original's `rowModel`) are measured from 00:00 UTC in
// two modes, percent and amount.
//
// What the pill's arrow and icon forms, and the popup's hero, make of the
// day's move.

// The 23-degrees idea: the arrow's tilt is the size of today's move, flat at
// zero and pinned at 45 degrees past a five percent day.
function arrowAngle(pctChange) {
  if (typeof pctChange !== "number" || !isFinite(pctChange)) return 0
  return Math.max(-1, Math.min(1, pctChange / 5)) * 45
}

// The day's animal by the move's sign as drawn: the bull up, the bear down,
// and none for a flat day.
function animalKind(sign) {
  return sign > 0 ? "bull" : sign < 0 ? "bear" : ""
}

// The hero's figures at the moment shown: now with `scrubT` 0, else the
// candle the scrub reads (`Chart.readingAt`). `mode` is "pct" or "abs", the
// change's unit; both are measured from the day's open. `sign` is the
// change's as drawn, in the mode shown, and `daySign` the percent's, which
// the animal reads in either mode. `time` is the moment's, null for now.
function heroView(quote, scrubT, mode) {
  var read = scrubT ? Chart.readingAt(quote, scrubT) : null
  var price = read ? read.p : quote.price
  var move = Change.sinceOpen({ price: price, dayOpen: quote.dayOpen })
  var sign = !move ? 0 : mode === "abs"
    ? Format.shownSign(move.abs, Format.moveDigits(Math.abs(move.abs), quote.priceDigits))
    : Format.shownSign(move.pct, Format.pctDigits(Math.abs(move.pct)))
  return {
    priceText: Format.money(price, quote.priceDigits),
    changeText: !move ? "—" : mode === "abs" ? Format.signedMoney(move.abs, quote.priceDigits) : Format.pct(move.pct),
    sign: sign,
    daySign: move ? Format.shownSign(move.pct, Format.pctDigits(Math.abs(move.pct))) : 0,
    time: read ? read.t : null
  }
}
