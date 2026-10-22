.pragma library
// One refresh of one symbol: what to ask the exchange, and what its answers
// mean for the feed: the quote to show, what to keep for the next refresh,
// the words for what went wrong, and how long to leave the exchange alone.
// Pure: the answers come already split by `Fetch.answers`, the adapter is
// handed in, and the time is an argument, so the feed reads the clock and
// turns `wait` into a time. It names no exchange.
//
// What the feed keeps between refreshes is { symbol, instrument, candles }:
// the instrument and up to a year of daily candles, oldest first. All of it
// belongs to `symbol`, and is dropped whole when the symbol changes, so one
// symbol's decimals or year never dress another's price.

var DAY = 86400
// The candles kept: the year that `high52w` and `low52w` cover.
var YEAR = 365

// What is kept for `symbol`: `kept` when it is that symbol's, else nothing.
function keptFor(kept, symbol) {
  if (kept && kept.symbol === symbol) return kept
  return { symbol: symbol, instrument: null, candles: null }
}

// How many daily candles to ask for at `now` (seconds). With none kept, a
// year. Else every day since the newest kept candle and today, and never
// fewer than 2: yesterday's candle is final only after midnight, and the
// machine's clock and the exchange's may disagree about when that was, so
// asking for it again is how its last high and low are never missed. This is
// a few hundred bytes a minute, not the year's 40 KB.
function dailyCount(candles, now) {
  if (!candles || candles.length === 0) return YEAR
  var newest = candles[candles.length - 1].t
  var missed = Math.floor(now / DAY) - Math.floor(newest / DAY)
  return Math.min(YEAR, Math.max(2, missed + 1))
}

// { urls, asked }: the URLs of the next run and the role of each, in order.
// The instrument is asked for only when none is kept for this symbol: it
// does not change by the minute.
function plan(adapter, symbol, kept, now) {
  var mine = keptFor(kept, symbol)
  var urls = [adapter.quotesUrl([symbol]), adapter.dailyUrl(symbol, dailyCount(mine.candles, now))]
  var asked = ["quotes", "daily"]
  if (mine.instrument === null) {
    urls.push(adapter.instrumentUrl(symbol))
    asked.push("instrument")
  }
  return { urls: urls, asked: asked }
}

// The kept candles with the fresh ones in, oldest first: a fresh candle
// replaces a kept one of the same day, since today's moves until midnight.
// Only the last year is kept.
function mergeDaily(kept, fresh) {
  var byDay = {}
  var all = (kept || []).concat(fresh)
  for (var i = 0; i < all.length; i++) byDay[all[i].t] = all[i]
  var out = []
  for (var t in byDay) out.push(byDay[t])
  out.sort(function (a, b) { return a.t - b.t })
  return out.slice(-YEAR)
}

// What the exchange itself said when it turned a question down: it answers
// HTTP 200 with a "retMsg", such as "params error: symbol invalid".
function said(adapter, json) {
  return json && json.retMsg ? adapter.NAME + ": " + json.retMsg : adapter.NAME + " sent no usable answer"
}

// The words for how long the exchange asked us to wait.
function waitWords(seconds) {
  return seconds >= 120 ? Math.round(seconds / 60) + " minutes" : seconds + " seconds"
}

// Why a refusal came, in words. A status the adapter names as its own
// refusal has the adapter's reason; 429 and 503 ask for fewer requests.
function refusedWords(adapter, status) {
  var limits = adapter.limits
  if (limits && limits.refusedReason && limits.refusedStatuses.indexOf(status) >= 0)
    return adapter.NAME + " refused us (" + limits.refusedReason + ")"
  return adapter.NAME + " asked for fewer requests"
}

// `all` is a run's answers, `asked` the role of each URL in the order sent,
// `kept` what the feed kept from before (or null). Returns { kept, quote,
// problem, wait }: `kept` to keep for the next refresh, `quote` null keeps
// the one shown, `problem` "" says the refresh worked, and `wait` is the
// seconds to pause, 0 for none. Each answer is read as the role its URL had,
// and the quote is rebuilt only if all of what it needs came: a half answer
// never replaces a whole one.
//
// When several things went wrong, the problem names the first in the order
// a person would fix them: the network, then a run cut short, then what the
// exchange said about each question, and last a price it did not send.
function read(all, asked, symbol, kept, adapter) {
  var mine = keptFor(kept, symbol)
  var out = { kept: { symbol: symbol, instrument: mine.instrument, candles: mine.candles }, quote: null, problem: "", wait: 0 }
  // No answer at all, not even "no network", means curl never ran or died
  // before its first URL: the exchange was never asked.
  if (all.length === 0) {
    out.problem = "curl sent nothing: is it installed?"
    return out
  }

  var json = {}
  var trouble = ""
  var refusal = ""
  for (var i = 0; i < all.length; i++) {
    var answer = all[i]
    var role = asked[answer.index]
    if (answer.kind === "refused") {
      // The longest wait is the one kept, and its refusal gives the words.
      var wait = answer.retryAfter > 0 ? answer.retryAfter : 60
      if (wait > out.wait) {
        out.wait = wait
        refusal = refusedWords(adapter, answer.status)
      }
    } else if (answer.kind === "none") {
      trouble = "No network"
    } else if (answer.kind !== "ok") {
      trouble = adapter.NAME + " sent an error (HTTP " + answer.status + ")"
    } else {
      try { json[role] = JSON.parse(answer.body) }
      catch (e) { trouble = adapter.NAME + " sent an answer that cannot be read" }
    }
  }

  if (out.wait > 0) {
    out.problem = refusal + ": waiting " + waitWords(out.wait)
    return out
  }
  if (!trouble && all.length < asked.length) trouble = "The refresh stopped before every answer came"

  if (json.instrument) {
    var listed = adapter.parseInstruments(json.instrument)
    if (listed === null) trouble = trouble || said(adapter, json.instrument)
    else if (listed.instruments.length === 0) trouble = trouble || symbol + " is not a " + adapter.QUOTE_COIN + " perpetual that trades on " + adapter.NAME
    else out.kept.instrument = listed.instruments[0]
  }
  var quotes = json.quotes ? adapter.parseQuotes(json.quotes) : null
  if (json.quotes && quotes === null) trouble = trouble || said(adapter, json.quotes)
  var candles = json.daily ? adapter.parseDaily(json.daily) : null
  if (json.daily && candles === null) trouble = trouble || said(adapter, json.daily)
  if (candles !== null) out.kept.candles = mergeDaily(out.kept.candles, candles)
  if (out.kept.instrument === null || quotes === null || candles === null || !(symbol in quotes.prices)) {
    out.problem = trouble || adapter.NAME + " sent no price for " + symbol
    return out
  }

  out.quote = adapter.buildQuote(out.kept.instrument, quotes.prices[symbol], quotes.time, out.kept.candles)
  return out
}
