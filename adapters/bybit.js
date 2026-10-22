.pragma library
// Bybit's V5 public API, read into this project's own shapes. The only file
// that names a Bybit endpoint, a Bybit field, or Bybit's way of naming a
// symbol. Pure: it builds URLs and reads answers that were already fetched
// and parsed. It draws nothing, runs no command and reads no clock.
//
// Every reader gives `null` for an answer it can't use (Bybit sends
// "retCode" other than 0 when it refuses a question), and `null` for a
// single figure it wasn't sent. It never guesses a number.
//
// Docs: https://bybit-exchange.github.io/docs/v5/market/instrument
//       https://bybit-exchange.github.io/docs/v5/market/tickers
//       https://bybit-exchange.github.io/docs/v5/market/kline
//       https://bybit-exchange.github.io/docs/v5/rate-limit

var NAME = "Bybit"
// The one quote currency shown: every symbol is then BASE + USDT.
var QUOTE_COIN = "USDT"
var HOST = "https://api.bybit.com"
var DAY = 86400

// Bybit sends every number as a string, and "" for a figure it doesn't have.
function num(v) {
  if (typeof v === "number") return isFinite(v) ? v : null
  if (typeof v !== "string" || v.trim() === "") return null
  var n = Number(v)
  return isFinite(n) ? n : null
}

// The "result" of an answer Bybit accepted, else null. Bybit can answer
// HTTP 200 with a "retCode" that says no.
function resultOf(json) {
  if (!json || json.retCode !== 0 || !json.result) return null
  return json.result
}

// What the request limits are and what a refusal means. For the Fetch rules:
// Bybit allows 600 requests per 5 seconds per IP. Past that it answers
// HTTP 403 and bans the IP for at least 10 minutes, so a 403 is a refusal
// that must be left alone for 10 minutes, not the 1 minute of a plain 429.
// Bybit also answers 403 to the places it does not serve, such as the US,
// and the two cannot be told apart by status alone, so the words name both.
var limits = {
  requestsPerWindow: 600,
  windowSeconds: 5,
  refusedStatuses: [403],
  refusedPauseSeconds: 600,
  refusedReason: "too many requests from this IP, or Bybit is not available where you are"
}

// ---- The symbols you can add ------------------------------------------

// All of the linear contracts in one request. About 900 exist, and Bybit
// sends at most 1000 here, so there is no paging.
function instrumentsUrl() {
  return HOST + "/v5/market/instruments-info?category=linear&limit=1000"
}

// A contract this project shows: a perpetual that is trading now, a crypto
// one, and quoted in USDT. Bybit also lists dated futures (contractType
// LinearFutures), contracts not yet open (a status other than Trading, or
// isPreListing), stock-like "TradFi" perpetuals, which carry a marketRegion
// and an underlyingTicker (both "" on a crypto contract), and USDC
// perpetuals. Those are named BTCPERP, not BTCUSDC, and would put a second
// quote currency in the list, for about 7% of the contracts: left out.
function inScope(x) {
  return !!x && !!x.symbol && !!x.baseCoin
    && x.quoteCoin === QUOTE_COIN
    && x.contractType === "LinearPerpetual"
    && x.status === "Trading"
    && !x.isPreListing
    && !x.marketRegion
    && !x.underlyingTicker
}

// One contract, such as BTCUSDT: the same answer as the list, with one item.
function instrumentUrl(symbol) {
  return HOST + "/v5/market/instruments-info?category=linear&symbol=" + encodeURIComponent(symbol)
}

// The instruments in scope, one entry each, as { instruments, truncated }.
// A symbol is the base coin and USDT, such as BTCUSDT, which is what a person
// types. `truncated` is true when Bybit says more instruments exist than it
// sent (a non-empty nextPageCursor): the list is then incomplete, and whoever
// shows it must say so rather than pass it off as whole.
function parseInstruments(json) {
  var r = resultOf(json)
  if (!r || !Array.isArray(r.list)) return null
  var out = []
  for (var i = 0; i < r.list.length; i++) {
    var x = r.list[i]
    if (!inScope(x)) continue
    var launched = num(x.launchTime)
    out.push({
      symbol: x.symbol,
      name: x.baseCoin,
      currency: x.quoteCoin,
      priceDigits: num(x.priceScale),
      firstTradeDate: launched === null ? null : Math.floor(launched / 1000),
      fundingInterval: num(x.fundingInterval)
    })
  }
  return { instruments: out, truncated: !!r.nextPageCursor }
}

// ---- The latest price --------------------------------------------------

// The tickers of `symbols` in one request. Omit `symbol` and Bybit sends all
// of them (900 tickers, 680 KB), so a long list costs one request, not one
// per row. For a single symbol that is wasteful, and Bybit answers for just
// that one (under 1 KB).
function quotesUrl(symbols) {
  var url = HOST + "/v5/market/tickers?category=linear"
  if (symbols && symbols.length === 1) url += "&symbol=" + encodeURIComponent(symbols[0])
  return url
}

// { time, prices }: when Bybit answered, in seconds, and the last traded
// price by symbol. A ticker with no price is left out. The ticker also holds
// a rolling 24-hour change, which is not used: the day here starts at
// 00:00 UTC, from the daily candle.
function parseQuotes(json) {
  var r = resultOf(json)
  var time = num(json && json.time)
  if (!r || !Array.isArray(r.list) || time === null) return null
  var prices = {}
  for (var i = 0; i < r.list.length; i++) {
    var t = r.list[i]
    var price = num(t && t.lastPrice)
    if (t && t.symbol && price !== null) prices[t.symbol] = price
  }
  return { time: Math.floor(time / 1000), prices: prices }
}

// ---- Daily candles -----------------------------------------------------

// The last `count` daily candles of one symbol (1 to 1000). The newest is
// today's, still open, and starts at 00:00 UTC.
function dailyUrl(symbol, count) {
  var n = Math.max(1, Math.min(1000, Math.floor(count)))
  return HOST + "/v5/market/kline?category=linear&symbol=" + encodeURIComponent(symbol)
    + "&interval=D&limit=" + n
}

// The candles, oldest first (Bybit sends newest first): { t, open, high, low,
// close, volume, turnover }, `t` the start in seconds. Volume is in the base
// coin and turnover in the quote coin. A row with a figure missing is left
// out whole, since half a candle says nothing true.
function parseDaily(json) {
  var r = resultOf(json)
  if (!r || !Array.isArray(r.list)) return null
  var out = []
  for (var i = r.list.length - 1; i >= 0; i--) {
    var row = r.list[i]
    if (!Array.isArray(row) || row.length < 7) continue
    var f = [num(row[0]), num(row[1]), num(row[2]), num(row[3]), num(row[4]), num(row[5]), num(row[6])]
    if (f.indexOf(null) >= 0) continue
    out.push({ t: Math.floor(f[0] / 1000), open: f[1], high: f[2], low: f[3], close: f[4], volume: f[5], turnover: f[6] })
  }
  return out
}

// ---- The quote record --------------------------------------------------

// The record of docs/QUOTE-RECORD.md for one symbol: its instrument entry
// (from parseInstruments), its latest `price` and `marketTime` (from
// parseQuotes) and its daily `candles` (from parseDaily).
//
// The day figures belong to today's UTC day, so they come only from a newest
// candle that starts at today's 00:00 UTC. A newest candle from another day
// means the candles are not today's, and the day figures are null: not a
// figure from the wrong day. The year's high and low come from the last 365
// candles, or fewer for a young symbol, which `firstTradeDate` tells.
function buildQuote(instrument, price, marketTime, candles) {
  if (!instrument || price === null || marketTime === null) return null
  var list = candles || []
  var last = list.length ? list[list.length - 1] : null
  var today = Math.floor(marketTime / DAY) * DAY
  var isToday = last !== null && last.t === today
  var year = list.slice(-365)
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
    dayOpen: isToday ? last.open : null,
    dayHigh: isToday ? last.high : null,
    dayLow: isToday ? last.low : null,
    volume: isToday ? last.volume : null,
    turnover: isToday ? last.turnover : null,
    high52w: high,
    low52w: low,
    firstTradeDate: instrument.firstTradeDate,
    fundingInterval: instrument.fundingInterval,
    points: null
  }
}
