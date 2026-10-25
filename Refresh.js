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
// none are kept (the daily ones only with `daily`, the featured symbol's),
// when the kept ones are `every` seconds old or more, and when a new UTC day
// has begun since, so its open is never missing. A row's line moves little
// in a minute, so the rows ask every 5 minutes, and the featured symbol,
// whose line the pill and the hero draw, every minute.
function candlesDue(kept, symbol, now, every, daily) {
  var mine = keptFor(kept, symbol)
  if (!mine.day || !mine.candlesAt || (daily && !mine.candles)) return true
  return now - mine.candlesAt >= every || Math.floor(now / DAY) > Math.floor(mine.candlesAt / DAY)
}

// { urls, asked }: the URLs of the next run and the role of each, in order.
// The candles are asked for only with `candles`, and the daily ones only
// with `year`, the featured symbol's, which needs a year of them for its
// 52-week high and low (`dailyCount`): a row's day comes from its 5-minute
// candles (`dayCandle`). The instrument is asked only when none is kept for
// this symbol: it does not change by the minute. A year's daily candles are
// asked as "year", the rest as "daily". A `range` other than the day is asked for
// as "history:<range>" when none is kept or the kept one is due again
// (`History.due`), or with `force`, a refresh you asked for.
function plan(adapter, symbol, kept, now, candles, year, range, force) {
  var mine = keptFor(kept, symbol)
  var urls = [adapter.quotesUrl([symbol])]
  var asked = ["quotes"]
  // An exchange that sends the funding rate apart from the price (the
  // adapter has `fundingUrl`) is asked for it with the price.
  if (adapter.fundingUrl) {
    urls.push(adapter.fundingUrl(symbol))
    asked.push("funding")
  }
  if (candles !== false) {
    if (year) {
      var count = dailyCount(mine, now, year)
      var base = mine.year ? "daily" : "year"
      urls.push(adapter.dailyUrl(symbol, count))
      asked.push(base)
      morePages(adapter.dailyMore ? adapter.dailyMore(symbol, count, now) : null, base, urls, asked)
    }
    urls.push(adapter.candlesUrl(symbol, dayStart(mine.day, now)))
    asked.push("day")
  }
  if (range && range !== "1D" && (force || History.due(range, mine.histories[range] && mine.histories[range].at, now))) {
    urls.push(adapter.historyUrl(symbol, range, now))
    asked.push("history:" + range)
    morePages(adapter.historyMore ? adapter.historyMore(symbol, range, now) : null, "history:" + range, urls, asked)
  }
  if (mine.instrument === null) {
    urls.push(adapter.instrumentUrl(symbol))
    asked.push("instrument")
  }
  return { urls: urls, asked: asked }
}

// The further pages of a question the exchange answers only 300 candles at a
// time (the adapter's `dailyMore`, `historyMore`): the older candles' URLs,
// each asked as the question's role and its place, "year#1", "year#2".
function morePages(more, base, urls, asked) {
  if (!more) return
  for (var i = 0; i < more.length; i++) {
    urls.push(more[i])
    asked.push(base + "#" + (i + 1))
  }
}

// The roles of one question: its own, then its pages.
function pagesOf(asked, base) {
  return asked.filter(function (r) { return r === base || r.indexOf(base + "#") === 0 })
}

// The candles of every page of one question, as { candles, bad }: `candles`
// all of them oldest first, or null when a page did not come or can't be
// read; `bad` the first page that came but can't be read, else null (a
// page that did not come has been explained by its HTTP status).
function readPages(adapter, json, roles) {
  var all = []
  var bad = null
  var missing = false
  for (var i = 0; i < roles.length; i++) {
    if (!json[roles[i]]) { missing = true; continue }
    var page = adapter.parseCandles(json[roles[i]])
    if (page === null) {
      if (bad === null) bad = json[roles[i]]
      continue
    }
    all = mergeCandles(all, page)
  }
  return { candles: missing || bad !== null ? null : all, bad: bad, missing: missing }
}

// Today's daily candle, folded from the 5-minute candles of `day` from
// `today` (00:00 UTC, seconds), as [candle]; [] with none. Its open is the
// first one's, its close the last one's, its high and low the extremes, and
// its volume and turnover the sums: the same figures as the exchange's own
// daily candle, without asking for it.
function dayCandle(day, today) {
  var mine = (day || []).filter(function (c) { return c.t >= today && c.t < today + DAY })
  if (mine.length === 0) return []
  var out = { t: today, open: mine[0].open, high: mine[0].high, low: mine[0].low, close: mine[mine.length - 1].close, volume: 0, turnover: 0 }
  for (var i = 0; i < mine.length; i++) {
    out.high = Math.max(out.high, mine[i].high)
    out.low = Math.min(out.low, mine[i].low)
    out.volume += mine[i].volume
    out.turnover += mine[i].turnover
  }
  return [out]
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

// What the exchange itself said when it turned a question down, in the
// adapter's reading of its answer (`adapter.said`).
function said(adapter, json) {
  var words = adapter.said(json)
  return words ? adapter.NAME + ": " + words : adapter.NAME + " sent no usable answer"
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
    else {
      // An exchange that cannot narrow the question answers every contract.
      var mineListed = listed.instruments.filter(function (i) { return i.symbol === symbol })[0]
      if (!mineListed) trouble = trouble || symbol + " is not a " + adapter.QUOTE_COIN + " perpetual that trades on " + adapter.NAME
      else out.kept.instrument = mineListed
    }
  }
  var quotes = json.quotes ? adapter.parseQuotes(json.quotes) : null
  if (json.quotes && quotes === null) trouble = trouble || said(adapter, json.quotes)
  // The funding came apart from the price: without it the price still
  // stands, with no funding.
  if (quotes !== null && json.funding) {
    var apart = adapter.parseFunding(json.funding)
    if (apart !== null) quotes.funding = apart
  }
  var wantedRoles = asked.filter(function (role) { return role.indexOf("history:") === 0 && role.indexOf("#") < 0 })
  var wanted = wantedRoles[0]
  if (wanted) {
    var range = wanted.slice("history:".length)
    var ranged = readPages(adapter, json, pagesOf(asked, wanted))
    if (ranged.bad !== null) slip = slip || said(adapter, ranged.bad)
    else if (ranged.missing) slip = slip || "The refresh stopped before every answer came"
    else if (ranged.candles.length === 0) slip = slip || adapter.NAME + " sent no candles for " + symbol + " over " + range
    else {
      var histories = Object.assign({}, mine.histories)
      histories[range] = { candles: ranged.candles, at: quotes ? quotes.time : 0 }
      out.kept.histories = histories
      out.history = adapter.buildHistory(symbol, range, ranged.candles)
    }
  }
  var dailyBase = asked.indexOf("year") >= 0 ? "year" : asked.indexOf("daily") >= 0 ? "daily" : ""
  var dailyGot = dailyBase ? readPages(adapter, json, pagesOf(asked, dailyBase)) : { candles: null, bad: null }
  var candles = dailyGot.candles
  if (dailyGot.bad !== null) trouble = trouble || said(adapter, dailyGot.bad)
  if (candles !== null) out.kept.candles = mergeCandles(out.kept.candles, candles).slice(-YEAR)
  if (candles !== null && dailyBase === "year") out.kept.year = true
  var day = json.day ? adapter.parseCandles(json.day) : null
  if (json.day && day === null) trouble = trouble || said(adapter, json.day)
  // Only the day the exchange answered in is kept: at midnight the line
  // starts again.
  if (day !== null && quotes !== null) {
    var today = Math.floor(quotes.time / DAY) * DAY
    out.kept.day = mergeCandles(out.kept.day, day).filter(function (c) { return c.t >= today })
  }
  // A run that asked for the price alone builds on the candles kept. A row
  // asks no daily candles: its day alone is enough.
  var askedCandles = asked.indexOf("day") >= 0
  var haveCandles = askedCandles ? (!dailyBase || candles !== null) && day !== null : !!out.kept.day
  if (askedCandles && haveCandles && quotes !== null) out.kept.candlesAt = quotes.time
  if (out.kept.instrument === null || quotes === null || !haveCandles || !(symbol in quotes.prices)) {
    out.problem = trouble || adapter.NAME + " sent no price for " + symbol
    return out
  }

  // Today's daily candle is always the one folded from the 5-minute ones, so
  // a row that was featured never shows its day as it was then.
  var daily = mergeCandles(out.kept.candles, dayCandle(out.kept.day, Math.floor(quotes.time / DAY) * DAY))
  out.quote = adapter.buildQuote(out.kept.instrument, quotes.prices[symbol], quotes.time, daily, out.kept.day, quotes.funding[symbol])
  out.problem = slip
  return out
}

// ---- A run of several symbols ----

// `kept` with the instrument of each of `symbols` that has none, from
// `listed`, the exchange's list by symbol, so it is not asked for. A symbol
// not in the list is left to ask, and that answer says if it is not listed.
function withListed(kept, symbols, listed) {
  var out = Object.assign({}, kept)
  for (var i = 0; i < symbols.length; i++) {
    var s = symbols[i]
    var mine = keptFor(out[s] || null, s)
    if (mine.instrument !== null || !listed || !listed[s]) continue
    out[s] = Object.assign({}, mine, { instrument: listed[s] })
  }
  return out
}

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
    var one = plan(adapter, symbol, mine, now, candlesDue(mine, symbol, now, symbol === featured ? 60 : rowEvery, symbol === featured), symbol === featured,
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
