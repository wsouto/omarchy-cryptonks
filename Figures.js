.pragma library
.import "Change.js" as Change
.import "Chart.js" as Chart
.import "Format.js" as Format
.import "History.js" as History
// Adapted from Stonks by Gaurav Chande (MIT), omarchy-stonks v1.0.2,
// Figures.js. Changes: only the pill's two rules and the hero's figures are
// kept; the animal reads the move's sign as drawn, and the hero's figures
// (`heroView`, the original's `rowModel`) are measured over the last 24
// hours in two modes, percent and amount; the info block's day and 52-week lines
// (`dayLine`, `yearLine`) have no market cap or P/E; freshness has no trading
// phase and no overdue (see below); a range's (`rangeView`) from the price at
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
// change's unit; both are measured from the price 24 hours ago. `sign` is the
// change's as drawn, in the mode shown, and `daySign` the percent's, which
// the animal reads in either mode. `time` is the moment's, null for now.
function heroView(quote, scrubT, mode) {
  var read = scrubT ? Chart.readingAt(quote, scrubT) : null
  var price = read ? read.p : quote.price
  var move = Change.sinceOpen({ price: price, open24h: quote.open24h })
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
  var move = history ? Change.sinceOpen({ price: price, open24h: history.baseline }) : null
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

// The info block's first line on 1D: the 24 hours' low and high with the
// price's place between them, then their volume (`volumeFact`) where the
// original has OPEN and VOL: next to an open, a coin's prices leave VOL no
// room. An end that is also the 52 weeks' takes that direction's tone, as
// the 52-week line's does. With no quote there is no line.
function dayLine(quote) {
  if (!quote) return null
  var range = Format.infoRange(quote.low24h, quote.high24h, quote.price, quote.priceDigits)
  if (range.high !== null && Format.isFiniteNumber(quote.high52w) && range.high >= quote.high52w) range.highTone = "up"
  if (range.low !== null && Format.isFiniteNumber(quote.low52w) && range.low <= quote.low52w) range.lowTone = "down"
  return {
    title: "1D",
    range: range,
    facts: [
      volumeFact(quote)
    ]
  }
}

// A perpetual's funding, for the hero's listing line: the rate the next
// settlement would pay (positive, longs pay shorts; negative, shorts pay
// longs) in the tone of its sign, and the time left to that settlement.
function fundingFact(quote) {
  var known = Format.isFiniteNumber(quote.fundingRate)
  var sign = known ? Format.shownSign(quote.fundingRate * 100, 4) : 0
  var left = Format.isFiniteNumber(quote.nextFundingTime) && Format.isFiniteNumber(quote.marketTime)
    ? Format.untilText(quote.nextFundingTime - quote.marketTime) : ""
  return {
    label: "FUNDING",
    value: known ? Format.fundingRate(quote.fundingRate) : "",
    after: known ? left : "",
    tone: sign > 0 ? "up" : sign < 0 ? "down" : ""
  }
}

// The 1D line's VOL: the 24 hours' turnover, their worth in the quote coin,
// as "$4.2B", which is the volume Bybit's ticker shows. Its slot is as wide
// as $999.9B, and stays when the exchange sent none.
function volumeFact(quote) {
  return {
    label: "VOL",
    value: Format.isFiniteNumber(quote.turnover24h) ? "$" + Format.compactNumber(quote.turnover24h) : "",
    widest: Format.widest("$999.9B")
  }
}

// The info block's second line: the last year's low and high, which already
// hold the 24 hours', so an end the 24 hours set is theirs and takes its tone.
// A perpetual has no market cap or P/E, so it has no facts.
function yearLine(quote) {
  if (!quote) return null
  var range = Format.infoRange(quote.low52w, quote.high52w, quote.price, quote.priceDigits)
  var both = range.low !== null && range.high !== null
  if (both && Format.isFiniteNumber(quote.high24h) && quote.high24h >= quote.high52w) range.highTone = "up"
  if (both && Format.isFiniteNumber(quote.low24h) && quote.low24h <= quote.low52w) range.lowTone = "down"
  return {
    title: "52W",
    range: range,
    facts: []
  }
}

// ---- Freshness ----

// A quote is aged when it is older than the refresh interval and a minute
// more: the market always trades, so the age is only about our refreshes.
var AGED_AFTER = 120

// What the feed has done for a symbol, kept as separate facts: whether its
// last refresh failed (`problem`), whether its quote is this session's own
// answer (`fresh`, else it was saved before), and the time it stands for.
// There is no overdue state: every request ends within curl's 10 seconds,
// so a run that does not answer fails, and says so.
function freshness(problem, fresh, quote, now) {
  var asOf = quote && Format.isFiniteNumber(quote.marketTime) ? quote.marketTime : null
  var state = problem !== "" ? "failed"
    : asOf === null ? "unavailable"
    : !fresh ? "saved"
    : now - asOf > AGED_AFTER ? "aged"
    : "fresh"
  return { state: state, asOf: asOf, earlier: asOf !== null && Math.floor(asOf / 86400) !== Math.floor(now / 86400) }
}

// The words for a freshness state, "" when nothing needs saying: in capitals
// for the hero's line, in sentence case for a row's. A quote kept from an
// earlier session says when it is from until its first answer. With nothing
// ever answered there was nothing to refresh: "Refresh failed" is for a
// symbol that had data and lost it.
function freshnessText(fresh, sentence) {
  if (!fresh) return ""
  var say = function(text) { return sentence ? text.charAt(0) + text.slice(1).toLowerCase() : text }
  if (fresh.asOf === null) return fresh.state === "failed" ? say("NO DATA FOR THIS SYMBOL") : ""
  var d = new Date(fresh.asOf * 1000)
  var day = fresh.earlier ? (sentence ? d.getUTCDate() + " " + Format.MONTHS[d.getUTCMonth()].charAt(0) + Format.MONTHS[d.getUTCMonth()].slice(1).toLowerCase() : d.getUTCDate() + " " + Format.MONTHS[d.getUTCMonth()]) + " " : ""
  var asOf = (sentence ? "As of " : "AS OF ") + day + Format.utcClock(fresh.asOf) + " UTC"
  if (fresh.state === "failed") return say("REFRESH FAILED") + " · " + asOf
  if (fresh.state === "aged" || fresh.state === "saved") return asOf
  return ""
}

function freshnessWarns(fresh) {
  return !!fresh && fresh.state === "failed"
}
