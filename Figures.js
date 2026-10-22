.pragma library
.import "Change.js" as Change
.import "Chart.js" as Chart
.import "Format.js" as Format
.import "History.js" as History
// Adapted from Stonks by Gaurav Chande (MIT), omarchy-stonks v1.0.2,
// Figures.js. Changes: only the pill's two rules and the hero's figures are
// kept; the animal reads the move's sign as drawn, and the hero's figures
// (`heroView`, the original's `rowModel`) are measured from 00:00 UTC in
// two modes, percent and amount; the info block's day and 52-week lines
// (`dayLine`, `yearLine`) have no market cap or P/E; a range's (`rangeView`) from the price at
// its start.
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

// How the list reads on the figures its rows show: up, flat, and down, and
// the rows with no figure yet. The rows' own rule (`heroView`), so the rule
// beside the list's name never disagrees with them.
function listBreadth(symbols, quotes, scrubT, mode) {
  var out = { up: 0, flat: 0, down: 0, none: 0 }
  for (var i = 0; i < symbols.length; i++) {
    var quote = quotes[symbols[i]]
    var view = quote && Change.sinceOpen(quote) ? heroView(quote, scrubT, mode) : null
    if (!view) out.none++
    else out[view.sign > 0 ? "up" : view.sign < 0 ? "down" : "flat"]++
  }
  return out
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

// The hero's figures on a range: the live price, or with `scrubT` the close
// of the bar the scrub reads (`History.barAt`), against the price at the
// range's start. A range's change is always its percentage. With no history
// yet the price stays and the change is "—". The shape of `heroView`'s, with
// `caption`, what the change is measured over.
function rangeView(history, quote, scrubT, range) {
  var bar = history && scrubT ? History.barAt(history, scrubT) : null
  var price = bar ? bar.p : quote.price
  var move = history ? Change.sinceOpen({ price: price, dayOpen: history.baseline }) : null
  var sign = move ? Format.shownSign(move.pct, Format.pctDigits(Math.abs(move.pct))) : 0
  return {
    priceText: Format.money(price, quote.priceDigits),
    changeText: move ? Format.pct(move.pct) : "—",
    sign: sign,
    daySign: sign,
    time: bar ? bar.t : null,
    caption: String(range).toUpperCase()
  }
}

// The info block's first line on the day: its low and high with the price's
// place between them, then its open. An end that is also the 52 weeks'
// takes that direction's tone, as the 52-week line's does. OPEN keeps its
// slot when the day's candle is not in. With no quote there is no line.
function dayLine(quote) {
  if (!quote) return null
  var range = Format.infoRange(quote.dayLow, quote.dayHigh, quote.price, quote.priceDigits)
  if (range.high !== null && Format.isFiniteNumber(quote.high52w) && range.high >= quote.high52w) range.highTone = "up"
  if (range.low !== null && Format.isFiniteNumber(quote.low52w) && range.low <= quote.low52w) range.lowTone = "down"
  return {
    title: "1D",
    range: range,
    facts: [
      { label: "OPEN", value: Format.isFiniteNumber(quote.dayOpen) ? Format.money(quote.dayOpen, quote.priceDigits) : "", widest: range.widest }
    ]
  }
}

// The info block's second line: the last year's low and high, which already
// hold today's, so an end the day set is the day's own and takes its tone.
// A perpetual has no market cap or P/E, so VOL, the day's volume in the base
// coin, stands here in their place, under OPEN; its slot is as wide as 999.9M.
function yearLine(quote) {
  if (!quote) return null
  var range = Format.infoRange(quote.low52w, quote.high52w, quote.price, quote.priceDigits)
  var both = range.low !== null && range.high !== null
  if (both && Format.isFiniteNumber(quote.dayHigh) && quote.dayHigh >= quote.high52w) range.highTone = "up"
  if (both && Format.isFiniteNumber(quote.dayLow) && quote.dayLow <= quote.low52w) range.lowTone = "down"
  return {
    title: "52W",
    range: range,
    facts: [{ label: "VOL", value: Format.isFiniteNumber(quote.volume) ? Format.compactNumber(quote.volume) : "", widest: Format.widest("999.9M") }]
  }
}
