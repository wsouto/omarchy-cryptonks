.pragma library
.import "History.js" as History
// One refresh of one symbol, and a run of several in one curl
// (`planRun`, `readRun`): what to ask the exchange, and what its answers
// mean for the feed: the quote to show, what to keep for the next refresh,
// the words for what went wrong, and how long to leave the exchange alone.
// Pure: the answers come already split by `Fetch.answers`, the adapter is
// handed in, and the time is an argument, so the feed reads the clock and
// turns `wait` into a time. It names no exchange.
//
// What the feed keeps between refreshes is { symbol, instrument, candles,
// year, day, candlesAt, histories }: the instrument, up to a year of daily
// candles, whether a whole year was asked for, and the 5-minute candles of
// the UTC day the exchange last answered in, each oldest first, the
// exchange's time when the candles last came, and the candles of each range
// asked for, with the time they came ({ range: { candles, at } }). All of it
// belongs to `symbol`, and is dropped whole when the symbol changes, so one
// symbol's decimals or year never dress another's price.

var DAY = 86400
// The candles kept: the year that `high52w` and `low52w` cover.
var YEAR = 365

// What is kept for `symbol`: `kept` when it is that symbol's, else nothing.
function keptFor(kept, symbol) {
  if (kept && kept.symbol === symbol) return kept
  return { symbol: symbol, instrument: null, candles: null, year: false, day: null, candlesAt: 0, histories: {} }
}

// How many daily candles to ask for at `now` (seconds). With `year` and no
// year asked for yet, a year: only the featured symbol needs `high52w` and
// `low52w`, and a year is 40 KB, too much for each of a long list's rows.
// With none kept, 2. Else every day since the newest kept candle and today,
// and never fewer than 2: yesterday's candle is final only after midnight,
// and the machine's clock and the exchange's may disagree about when that
// was, so asking for it again is how its last high and low are never missed.
// This is a few hundred bytes a minute.
function dailyCount(mine, now, year) {
  if (year && !mine.year) return YEAR
  var candles = mine.candles
  if (!candles || candles.length === 0) return 2
  var newest = candles[candles.length - 1].t
  var missed = Math.floor(now / DAY) - Math.floor(newest / DAY)
  return Math.min(YEAR, Math.max(2, missed + 1))
}

// Where the next run's 5-minute candles start: at the newest kept one, which
// was still open when it came, or with none kept from today, at 00:00 UTC.
function dayStart(day, now) {
  var today = Math.floor(now / DAY) * DAY
  var newest = day && day.length ? day[day.length - 1].t : 0
  return newest >= today ? newest : today
}

// Whether a refresh at `now` asks for candles as well as the price: when
// none are kept, when the kept ones are `every` seconds old or more, and
// when a new UTC day has begun since, so its open is never missing. A row's
// line moves little in a minute, so the rows ask every 5 minutes, and the
// featured symbol, whose line the pill and the hero draw, every minute.
function candlesDue(kept, symbol, now, every) {
  var mine = keptFor(kept, symbol)
  if (!mine.candles || !mine.day || !mine.candlesAt) return true
  return now - mine.candlesAt >= every || Math.floor(now / DAY) > Math.floor(mine.candlesAt / DAY)
}

// { urls, asked }: the URLs of the next run and the role of each, in order.
// The candles are asked for only with `candles`, a year of them with `year`
// (`dailyCount`), and the instrument only when none is kept for this
// symbol: it does not change by the minute. A year's daily candles are asked
// as "year", the rest as "daily". A `range` other than the day is asked for
// as "history:<range>" when none is kept or the kept one is due again
// (`History.due`), or with `force`, a refresh you asked for.
function plan(adapter, symbol, kept, now, candles, year, range, force) {
  var mine = keptFor(kept, symbol)
  var urls = [adapter.quotesUrl([symbol])]
  var asked = ["quotes"]
  if (candles !== false) {
    var count = dailyCount(mine, now, year)
    urls.push(adapter.dailyUrl(symbol, count), adapter.candlesUrl(symbol, dayStart(mine.day, now)))
    asked.push(year && !mine.year ? "year" : "daily", "day")
  }
  if (range && range !== "1D" && (force || History.due(range, mine.histories[range] && mine.histories[range].at, now))) {
    urls.push(adapter.historyUrl(symbol, range, now))
    asked.push("history:" + range)
  }
  if (mine.instrument === null) {
    urls.push(adapter.instrumentUrl(symbol))
    asked.push("instrument")
  }
  return { urls: urls, asked: asked }
}

// The kept candles with the fresh ones in, oldest first: a fresh candle
// replaces a kept one that starts at the same time, since the newest moves
// until it closes.
function mergeCandles(kept, fresh) {
  var byDay = {}
  var all = (kept || []).concat(fresh)
  for (var i = 0; i < all.length; i++) byDay[all[i].t] = all[i]
  var out = []
  for (var t in byDay) out.push(byDay[t])
  out.sort(function (a, b) { return a.t - b.t })
  return out
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
  var out = { kept: { symbol: symbol, instrument: mine.instrument, candles: mine.candles, year: mine.year, day: mine.day, candlesAt: mine.candlesAt, histories: mine.histories },
    quote: null, problem: "", wait: 0, history: null }
  // No answer at all, not even "no network", means curl never ran or died
  // before its first URL: the exchange was never asked.
  if (all.length === 0) {
    out.problem = "curl sent nothing: is it installed?"
    return out
  }

  var json = {}
  var trouble = ""
  // A range's candles failing leaves the price and the day as they are, but
  // says so.
  var slip = ""
  var refusal = ""
  var note = function (role, words) {
    if (role.indexOf("history:") === 0) slip = words
    else trouble = words
  }
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
      note(role, "No network")
    } else if (answer.kind !== "ok") {
      note(role, adapter.NAME + " sent an error (HTTP " + answer.status + ")")
    } else {
      try { json[role] = JSON.parse(answer.body) }
      catch (e) { note(role, adapter.NAME + " sent an answer that cannot be read") }
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
  var wanted = asked.filter(function (role) { return role.indexOf("history:") === 0 })[0]
  if (wanted && !json[wanted] && !slip) slip = "The refresh stopped before every answer came"
  if (wanted && json[wanted]) {
    var range = wanted.slice("history:".length)
    var ranged = adapter.parseCandles(json[wanted])
    if (ranged === null) slip = slip || said(adapter, json[wanted])
    else if (ranged.length === 0) slip = slip || adapter.NAME + " sent no candles for " + symbol + " over " + range
    else {
      var histories = Object.assign({}, mine.histories)
      histories[range] = { candles: ranged, at: quotes ? quotes.time : 0 }
      out.kept.histories = histories
      out.history = adapter.buildHistory(symbol, range, ranged)
    }
  }
  var daily = json.daily || json.year
  var candles = daily ? adapter.parseCandles(daily) : null
  if (daily && candles === null) trouble = trouble || said(adapter, daily)
  if (candles !== null) out.kept.candles = mergeCandles(out.kept.candles, candles).slice(-YEAR)
  if (candles !== null && json.year) out.kept.year = true
  var day = json.day ? adapter.parseCandles(json.day) : null
  if (json.day && day === null) trouble = trouble || said(adapter, json.day)
  // Only the day the exchange answered in is kept: at midnight the line
  // starts again.
  if (day !== null && quotes !== null) {
    var today = Math.floor(quotes.time / DAY) * DAY
    out.kept.day = mergeCandles(out.kept.day, day).filter(function (c) { return c.t >= today })
  }
  // A run that asked for the price alone builds on the candles kept.
  var askedCandles = asked.indexOf("daily") >= 0 || asked.indexOf("year") >= 0
  var haveCandles = askedCandles ? candles !== null && day !== null : !!out.kept.candles && !!out.kept.day
  if (askedCandles && haveCandles && quotes !== null) out.kept.candlesAt = quotes.time
  if (out.kept.instrument === null || quotes === null || !haveCandles || !(symbol in quotes.prices)) {
    out.problem = trouble || adapter.NAME + " sent no price for " + symbol
    return out
  }

  out.quote = adapter.buildQuote(out.kept.instrument, quotes.prices[symbol], quotes.time, out.kept.candles, out.kept.day)
  out.problem = slip
  return out
}

// ---- A run of several symbols ----

// The symbols newly in `after`, not in `before`, in `after`'s order: a
// symbol joining the feed (a preview, an add, an undo) is asked for in a
// run of its own, and the rows wait for their minute.
function newcomers(before, after) {
  return (after || []).filter(function (s) { return (before || []).indexOf(s) < 0 })
}

// The symbols the next run asks for: every one watched with `whole` (the
// minute's run, or a refresh you asked for), else those owed a run of their
// own that are still watched.
function runSymbols(watched, owed, whole) {
  if (whole) return watched.slice()
  return watched.filter(function (s) { return owed.indexOf(s) >= 0 })
}

// { urls, asked }: every symbol's URLs in one run, the featured one first so
// the pill hears first; `asked` holds each URL's { symbol, role }. A
// symbol's candles come every `rowEvery` seconds, the featured one's every
// minute (`candlesDue`), and only the featured one asks for a year. `want`
// is the chart on show, { symbol, range }: only its symbol asks for a range.
function planRun(adapter, symbols, featured, kept, now, rowEvery, want, force) {
  var order = symbols.indexOf(featured) >= 0 ? [featured].concat(symbols.filter(function (s) { return s !== featured })) : symbols
  var urls = []
  var asked = []
  for (var i = 0; i < order.length; i++) {
    var symbol = order[i]
    var mine = kept[symbol] || null
    var one = plan(adapter, symbol, mine, now, candlesDue(mine, symbol, now, symbol === featured ? 60 : rowEvery), symbol === featured,
      want && want.symbol === symbol ? want.range : "", force)
    for (var j = 0; j < one.urls.length; j++) {
      urls.push(one.urls[j])
      asked.push({ symbol: symbol, role: one.asked[j] })
    }
  }
  return { urls: urls, asked: asked }
}

// A run's answers read symbol by symbol (`read`): { kept, quotes, problems,
// histories, wait, waitProblem }, each of the first three by symbol,
// `histories` the ranges that came, by "SYMBOL|RANGE", and the longest
// wait any refusal asked for, with its words. A symbol the run never reached, as it stopped short,
// says so; with no answer at all, every symbol blames curl, as `read` does.
function readRun(all, asked, kept, adapter) {
  var out = { kept: Object.assign({}, kept), quotes: {}, problems: {}, histories: {}, wait: 0, waitProblem: "" }
  var mine = {}
  for (var i = 0; i < asked.length; i++) {
    var symbol = asked[i].symbol
    if (!mine[symbol]) mine[symbol] = { answers: [], roles: [], first: i }
    mine[symbol].roles.push(asked[i].role)
  }
  for (var k = 0; k < all.length; k++) {
    var to = asked[all[k].index]
    if (!to) continue
    var m = mine[to.symbol]
    m.answers.push(Object.assign({}, all[k], { index: all[k].index - m.first }))
  }
  for (var s in mine) {
    var got = all.length > 0 && mine[s].answers.length === 0
      ? { kept: keptFor(kept[s] || null, s), quote: null, problem: "The refresh stopped before every answer came", wait: 0 }
      : read(mine[s].answers, mine[s].roles, s, kept[s] || null, adapter)
    out.kept[s] = got.kept
    out.quotes[s] = got.quote
    out.problems[s] = got.problem
    if (got.history) out.histories[s + "|" + got.history.range] = got.history
    if (got.wait > out.wait) {
      out.wait = got.wait
      out.waitProblem = got.problem
    }
  }
  return out
}
