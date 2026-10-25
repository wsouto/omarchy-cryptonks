.pragma library
// OKX's V5 public API, read into this project's own shapes. The only file
// that names an OKX endpoint, an OKX field, or OKX's way of naming a
// symbol. Pure: it builds URLs and reads answers that were already fetched
// and parsed. It draws nothing, runs no command and reads no clock.
//
// Every reader gives `null` for an answer it can't use (OKX sends a "code"
// other than "0" when it refuses a question), and `null` for a single figure
// it wasn't sent. It never guesses a number.
//
// Differs from the other adapters:
//  - A symbol here is the base coin and USDT ("BTCUSDT", what a person types);
//    OKX's own is "BTC-USDT-SWAP" (`instId`).
//  - OKX answers at most 300 candles a request. A question that needs more
//    (a year of days, 1W on 15-minute candles) asks the first page with the
//    usual URL and the older pages with `dailyMore` and `historyMore`.
//  - Funding comes in a request of its own (`fundingUrl`), and there is no
//    funding interval or full coin name: the name is the base coin.
//
// Free, no key. Limits (docs, checked 2026-10-24): public endpoints are
// limited per IP and per instrument ID, in requests per 2 seconds:
// ticker 20, funding-rate 10, candles 40, history-candles 20, instruments 20.
// Past one OKX answers HTTP 429, or HTTP 200 with code "50011" ("Rate limit
// reached"), which reads as an answer OKX turned down. This project asks a
// symbol for one price, one funding, and a handful of candle pages a minute,
// so it stays far under.
//
// Docs: https://www.okx.com/docs-v5/en/#public-data-rest-api-get-instruments
//       https://www.okx.com/docs-v5/en/#order-book-trading-market-data-get-ticker
//       https://www.okx.com/docs-v5/en/#public-data-rest-api-get-funding-rate
//       https://www.okx.com/docs-v5/en/#order-book-trading-market-data-get-candlesticks
//       https://www.okx.com/docs-v5/en/#order-book-trading-market-data-get-candlesticks-history

var NAME = "OKX"
// The one quote currency shown: every symbol is then BASE + USDT.
var QUOTE_COIN = "USDT"
var HOST = "https://www.okx.com"
var DAY = 86400
// The most candles one candles request holds.
var PAGE = 300

// OKX sends every number as a string, and "" for a figure it doesn't have.
function num(v) {
  if (typeof v === "number") return isFinite(v) ? v : null
  if (typeof v !== "string" || v.trim() === "") return null
  var n = Number(v)
  return isFinite(n) ? n : null
}

// The data of an answer OKX accepted, else null.
function dataOf(json) {
  if (!json || json.code !== "0" || !Array.isArray(json.data)) return null
  return json.data
}

// What OKX said when it turned a question down: {"code":"51001","msg":
// "Instrument ID ... doesn't exist."}. "" when the answer holds no such words.
function said(json) {
  return json && json.code !== "0" && typeof json.msg === "string" ? json.msg : ""
}

// What a refusal means, for the Fetch rules: 429 is OKX's own and Fetch's.
// 403 is what OKX's front answers to an IP it blocks, such as a restricted
// country, and cannot be told from other causes by status alone.
var limits = {
  refusedStatuses: [403],
  refusedPauseSeconds: 600,
  refusedReason: "too many requests from this IP, or OKX is not available where you are"
}

// ---- Symbols -----------------------------------------------------------

var SWAP = /^([A-Z0-9]+)-USDT-SWAP$/

// OKX's id for a symbol such as BTCUSDT: BTC-USDT-SWAP. A symbol that does
// not end in USDT has no OKX id, and is asked for as it is, so OKX says so.
function instId(symbol) {
  var s = String(symbol)
  return /USDT$/.test(s) && s.length > 4 ? s.slice(0, -4) + "-USDT-SWAP" : s
}

// The symbol of an OKX id: BTC-USDT-SWAP is BTCUSDT; null for any other.
function symbolOf(id) {
  var m = SWAP.exec(String(id))
  return m ? m[1] + QUOTE_COIN : null
}

// ---- The symbols you can add ------------------------------------------

// A contract this project shows: a perpetual swap that is trading now,
// linear, settled and quoted in USDT, and a crypto one. OKX also lists
// inverse swaps (BTC-USD-SWAP), USDC swaps, dated futures (another instType),
// and stock, commodity and index swaps, which carry an instCategory other
// than "1" (crypto): about 220 of 520 USDT swaps on 2026-10-24, left out.
function inScope(x) {
  return !!x && symbolOf(x.instId) !== null
    && x.instType === "SWAP"
    && x.ctType === "linear"
    && x.settleCcy === QUOTE_COIN
    && x.state === "live"
    && x.instCategory === "1"
}

// Every swap, in one answer (about 520, 40 KB compressed): OKX has no
// paging, so `cursor` is ignored.
function instrumentsUrl(cursor) {
  return HOST + "/api/v5/public/instruments?instType=SWAP"
}

// One contract, which OKX can narrow to: the same answer with one item.
function instrumentUrl(symbol) {
  return HOST + "/api/v5/public/instruments?instType=SWAP&instId=" + encodeURIComponent(instId(symbol))
}

// Decimals in a tick size such as "0.001": the price's digits.
function digitsOf(tick) {
  var t = String(tick)
  var i = t.indexOf(".")
  return num(t) === null ? null : i < 0 ? 0 : t.length - i - 1
}

// The instruments in scope as { instruments, truncated, cursor }; never
// truncated, no cursor. The name is the base coin ("BTC"): OKX sends no full
// name.
function parseInstruments(json) {
  var list = dataOf(json)
  if (list === null) return null
  var out = []
  for (var i = 0; i < list.length; i++) {
    var x = list[i]
    if (!inScope(x)) continue
    var listed = num(x.listTime)
    out.push({
      symbol: symbolOf(x.instId),
      name: SWAP.exec(x.instId)[1],
      currency: x.settleCcy,
      priceDigits: digitsOf(x.tickSz),
      firstTradeDate: listed === null ? null : Math.floor(listed / 1000),
      fundingInterval: null
    })
  }
  return { instruments: out, truncated: false, cursor: "" }
}

// ---- The latest price --------------------------------------------------

// The prices of `symbols`: one ticker for one symbol, else every swap's
// (170 KB), as Refresh never asks for.
function quotesUrl(symbols) {
  if (symbols && symbols.length === 1) return HOST + "/api/v5/market/ticker?instId=" + encodeURIComponent(instId(symbols[0]))
  return HOST + "/api/v5/market/tickers?instType=SWAP"
}

// { time, prices, funding, stats }: when OKX answered, in seconds (the
// newest ticker's), the last traded price by symbol, an empty funding (that
// is `parseFunding`'s), and the rolling 24 hours by symbol as { open, high,
// low, volume, turnover }: the price 24 hours ago, the high and low since,
// and the volume in the base coin (`volCcy24h`; `vol24h` counts contracts).
// OKX sends no quote-coin volume for a swap, so the turnover is the base
// volume at the last price: close, not exact. A ticker with no price is
// left out.
function parseQuotes(json) {
  var list = dataOf(json)
  if (list === null) return null
  var prices = {}
  var stats = {}
  var time = null
  for (var i = 0; i < list.length; i++) {
    var t = list[i]
    var symbol = symbolOf(t && t.instId)
    var price = num(t && t.last)
    var at = num(t && t.ts)
    if (symbol === null || price === null || at === null) continue
    prices[symbol] = price
    var volume = num(t.volCcy24h)
    stats[symbol] = { open: num(t.open24h), high: num(t.high24h), low: num(t.low24h), volume: volume, turnover: volume === null ? null : volume * price }
    if (time === null || at > time) time = at
  }
  if (time === null) return null
  return { time: Math.floor(time / 1000), prices: prices, funding: {}, stats: stats }
}

// The funding of `symbol`, asked for apart from the price.
function fundingUrl(symbol) {
  return HOST + "/api/v5/public/funding-rate?instId=" + encodeURIComponent(instId(symbol))
}

// Funding by symbol as { rate, nextTime }: the rate for the settlement to
// come (a fraction, 0.0001 = 0.01%) and when that is, in seconds. OKX's
// `fundingTime` is that settlement and its `nextFundingTime` the one after.
function parseFunding(json) {
  var list = dataOf(json)
  if (list === null) return null
  var funding = {}
  for (var i = 0; i < list.length; i++) {
    var t = list[i]
    var symbol = symbolOf(t && t.instId)
    if (symbol === null) continue
    var next = num(t.fundingTime)
    funding[symbol] = { rate: num(t.fundingRate), nextTime: next !== null && next > 0 ? Math.floor(next / 1000) : null }
  }
  return funding
}

// ---- Candles -----------------------------------------------------------

// The newest `count` candles of `bar`, up to 300 a request.
function newest(symbol, bar, count) {
  var n = Math.max(1, Math.min(PAGE, Math.floor(count)))
  return HOST + "/api/v5/market/candles?instId=" + encodeURIComponent(instId(symbol)) + "&bar=" + bar + "&limit=" + n
}

// The URLs of the older candles when `count` is over a page, newest page
// first: each asks, from OKX's history, the candles older than where the
// page before ended. `step` is a candle's seconds, `now` the time in
// seconds. A page ends about where it should, to a candle: the next asks
// one candle past that, so pages may share a candle (the reader merges by
// start) and never leave a gap, whatever a week's or month's own alignment.
function older(symbol, bar, step, count, now) {
  var urls = []
  var newestStart = Math.floor(now / step) * step
  for (var k = 1; k * PAGE < count; k++) {
    var after = (newestStart - (k * PAGE - 2) * step) * 1000
    var limit = Math.min(PAGE, count - k * PAGE + 2)
    urls.push(HOST + "/api/v5/market/history-candles?instId=" + encodeURIComponent(instId(symbol))
      + "&bar=" + bar + "&after=" + after + "&limit=" + limit)
  }
  return urls
}

// The last `count` daily candles of one symbol, UTC days: the first page
// (the newest 300), and `dailyMore` the older ones. The newest is today's,
// still open, and starts at 00:00 UTC.
function dailyUrl(symbol, count) {
  return newest(symbol, "1Dutc", count)
}

function dailyMore(symbol, count, now) {
  return older(symbol, "1Dutc", DAY, count, now)
}

// The 5-minute candles of one symbol from `start` (seconds) on: at most 288
// in 24 hours, so one request holds the whole line. `before` is exclusive, so
// it is a millisecond short of `start`, and the candle at `start` is in.
function candlesUrl(symbol, start) {
  return HOST + "/api/v5/market/candles?instId=" + encodeURIComponent(instId(symbol))
    + "&bar=5m&before=" + (Math.floor(start) * 1000 - 1) + "&limit=" + PAGE
}

// Daily candles (dailyUrl) or 5-minute ones (candlesUrl), oldest first (OKX
// sends newest first): { t, open, high, low, close, volume, turnover }, `t`
// the start in seconds. Volume is in the base coin (OKX's own "vol" counts
// contracts, and a contract is a fraction of a coin) and turnover in the
// quote coin. A row with a figure missing is left out whole.
function parseCandles(json) {
  var list = dataOf(json)
  if (list === null) return null
  var out = []
  for (var i = list.length - 1; i >= 0; i--) {
    var row = list[i]
    if (!Array.isArray(row) || row.length < 8) continue
    var f = [num(row[0]), num(row[1]), num(row[2]), num(row[3]), num(row[4]), num(row[6]), num(row[7])]
    if (f.indexOf(null) >= 0) continue
    out.push({ t: Math.floor(f[0] / 1000), open: f[1], high: f[2], low: f[3], close: f[4], volume: f[5], turnover: f[6] })
  }
  return out
}

// ---- A range's candles -------------------------------------------------

// What each range asks for: OKX's bar, that bar in seconds, and how far back
// the first candle may be, in days. Days, weeks and months are UTC ("1Dutc",
// "1Wutc", "1Mutc"): OKX's plain "1D" starts at 00:00 in UTC+8. A symbol
// younger than the range simply gets the candles it has. YTD starts at
// 00:00 UTC on 1 January and All has no start: the newest 300 monthly
// candles are older than any perpetual.
var RANGES = {
  "1W": { bar: "15m", step: 900, days: 7 },
  "1M": { bar: "1H", step: 3600, days: 30 },
  "3M": { bar: "1Dutc", step: DAY, days: 90 },
  "6M": { bar: "1Dutc", step: DAY, days: 180 },
  "YTD": { bar: "1Dutc", step: DAY },
  "1Y": { bar: "1Dutc", step: DAY, days: 365 },
  "2Y": { bar: "1Dutc", step: DAY, days: 730 },
  "5Y": { bar: "1Wutc", step: 7 * DAY, days: 1826 },
  "10Y": { bar: "1Wutc", step: 7 * DAY, days: 3652 },
  "All": { bar: "1Mutc", step: 31 * DAY }
}

// How many candles a range holds at `now` (seconds), one more than its span
// so the first starts at or before the range's start; 300 for All.
function rangeCount(range, now) {
  var spec = RANGES[range]
  if (range === "YTD") {
    var jan = Date.UTC(new Date(now * 1000).getUTCFullYear(), 0, 1) / 1000
    return Math.floor((now - jan) / spec.step) + 1
  }
  return spec.days ? Math.ceil(spec.days * DAY / spec.step) + 1 : PAGE
}

// The candles of `range` for one symbol at `now` (seconds): the newest page,
// and `historyMore` the older ones. Null for a range this adapter does not
// serve (the day).
function historyUrl(symbol, range, now) {
  if (!RANGES[range]) return null
  return newest(symbol, RANGES[range].bar, rangeCount(range, now))
}

function historyMore(symbol, range, now) {
  if (!RANGES[range]) return []
  return older(symbol, RANGES[range].bar, RANGES[range].step, rangeCount(range, now), now)
}

// A range's line as the chart reads it: { symbol, range, step, bars,
// baseline }. A bar is a candle's start, close, high and low; `step` is the
// seconds one candle spans. The baseline is the first candle's open, the
// price at the range's start. Null with no candles.
function buildHistory(symbol, range, candles) {
  var spec = RANGES[range]
  if (!spec || !candles || candles.length === 0) return null
  return {
    symbol: symbol,
    range: range,
    step: spec.step,
    bars: candles.map(function (c) { return { t: c.t, p: c.close, h: c.high, l: c.low } }),
    baseline: candles[0].open
  }
}

// ---- The quote record --------------------------------------------------

// The record of docs/QUOTE-RECORD.md for one symbol: its instrument entry
// (from parseInstruments), its latest `price` and `marketTime` (from
// parseQuotes), its daily `candles`, and `lineCandles`, its 5-minute candles
// (both from parseCandles), its `funding` (from parseFunding) and its
// 24-hour `stats` (from parseQuotes).
//
// The 24-hour figures are OKX's own, from the ticker; with no stats they are
// null. The year's high and low come from the last 365 daily candles. The
// line, `points`, is each 5-minute candle of the last 24 hours at its start
// and close.
function buildQuote(instrument, price, marketTime, candles, lineCandles, funding, stats) {
  if (!instrument || price === null || marketTime === null) return null
  var year = (candles || []).slice(-365)
  var day = stats || {}
  var points = (lineCandles || []).filter(function (c) { return c.t > marketTime - DAY && c.t <= marketTime })
    .map(function (c) { return { t: c.t, p: c.close } })
  var high = null
  var low = null
  for (var i = 0; i < year.length; i++) {
    if (high === null || year[i].high > high) high = year[i].high
    if (low === null || year[i].low < low) low = year[i].low
  }
  return {
    symbol: instrument.symbol,
    name: instrument.name,
    exchange: NAME,
    instrumentType: "PERPETUAL",
    currency: instrument.currency,
    priceDigits: instrument.priceDigits,
    price: price,
    marketTime: marketTime,
    open24h: num(day.open),
    high24h: num(day.high),
    low24h: num(day.low),
    volume24h: num(day.volume),
    turnover24h: num(day.turnover),
    openInterest: null,
    high52w: high,
    low52w: low,
    firstTradeDate: instrument.firstTradeDate,
    fundingInterval: instrument.fundingInterval,
    fundingRate: funding ? funding.rate : null,
    nextFundingTime: funding ? funding.nextTime : null,
    points: points
  }
}
