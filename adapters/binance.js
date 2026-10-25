.pragma library
// Binance's USD-M futures API, read into this project's own shapes. The only
// file that names a Binance endpoint, a Binance field, or Binance's way of
// naming a symbol. Pure: it builds URLs and reads answers that were already
// fetched and parsed. It draws nothing, runs no command and reads no clock.
//
// Every reader gives `null` for an answer it can't use (Binance refuses a
// question with a {code, msg} object, HTTP 400), and `null` for a single
// figure it wasn't sent. It never guesses a number.
//
// Differs from adapters/bybit.js: Binance sends no full coin name (the name
// is the base coin), no funding interval, and the funding rate only in a
// request of its own (`fundingUrl`), not with the price.
//
// Free, no key. Limit: 2400 request weight per minute per IP (checked
// 2026-10-24 in exchangeInfo's rateLimits). Weights measured that day:
// ticker/24hr 1, premiumIndex 1, exchangeInfo 1, klines 2 for 100 to 499
// rows and 5 for 500 to 1000. Past the limit Binance answers 429 with
// Retry-After, and an IP that keeps going gets 418 for 2 minutes up to 3
// days. 451 means Binance is not available where you are.
//
// Docs: https://developers.binance.com/docs/derivatives/usds-margined-futures/market-data/rest-api/Exchange-Information
//       https://developers.binance.com/docs/derivatives/usds-margined-futures/market-data/rest-api/Symbol-Price-Ticker
//       https://developers.binance.com/docs/derivatives/usds-margined-futures/market-data/rest-api/Mark-Price
//       https://developers.binance.com/docs/derivatives/usds-margined-futures/market-data/rest-api/Kline-Candlestick-Data
//       https://developers.binance.com/docs/derivatives/usds-margined-futures/general-info

var NAME = "Binance"
// The one quote currency shown: every symbol is then BASE + USDT.
var QUOTE_COIN = "USDT"
var HOST = "https://fapi.binance.com"
var DAY = 86400

// Binance sends prices and volumes as strings.
function num(v) {
  if (typeof v === "number") return isFinite(v) ? v : null
  if (typeof v !== "string" || v.trim() === "") return null
  var n = Number(v)
  return isFinite(n) ? n : null
}

// What Binance said when it turned a question down: {"code":-1121,"msg":
// "Invalid symbol."}. "" when the answer holds no such words.
function said(json) {
  return json && typeof json.msg === "string" ? json.msg : ""
}

// What a refusal means, for the Fetch rules. 418 is the ban after 429 was
// ignored, 451 is "not available in your country"; the two cannot be told
// apart for the person by the words alone, so the words name both. A pause
// of 10 minutes covers either; a 429 and a Retry-After are Fetch's own.
var limits = {
  refusedStatuses: [418, 451],
  refusedPauseSeconds: 600,
  refusedReason: "too many requests from this IP, or Binance is not available where you are"
}

// ---- The symbols you can add ------------------------------------------

// A contract this project shows: a perpetual that is trading now, a crypto
// one, and quoted in USDT. Binance also lists dated futures (contractType
// CURRENT_QUARTER, NEXT_QUARTER), contracts winding down (status SETTLING)
// or not yet open (PENDING_TRADING), index contracts such as BTCDOMUSDT
// (underlyingType INDEX), and USDC perpetuals: left out.
function inScope(x) {
  return !!x && !!x.symbol && !!x.baseAsset
    && x.quoteAsset === QUOTE_COIN
    && x.contractType === "PERPETUAL"
    && x.status === "TRADING"
    && x.underlyingType === "COIN"
}

// Every contract, in one answer (about 930, 52 KB compressed): Binance has
// no paging, so `cursor` is ignored.
function instrumentsUrl(cursor) {
  return HOST + "/fapi/v1/exchangeInfo"
}

// One contract. exchangeInfo has no way to ask for one: checked 2026-10-24,
// `?symbol=BTCUSDT` still answers every contract (1.1 MB, 52 KB compressed),
// so this is the list's own URL and whoever reads it picks the symbol out.
// `runCap` is the cap of a run that asks for it.
function instrumentUrl(symbol) {
  return instrumentsUrl("")
}
var runCap = 2000000

// The instruments in scope as { instruments, truncated, cursor }; never
// truncated, no cursor. The name is the base coin ("BTC"): Binance sends no
// full name.
function parseInstruments(json) {
  if (!json || !Array.isArray(json.symbols)) return null
  var out = []
  for (var i = 0; i < json.symbols.length; i++) {
    var x = json.symbols[i]
    if (!inScope(x)) continue
    var launched = num(x.onboardDate)
    out.push({
      symbol: x.symbol,
      name: x.baseAsset,
      currency: x.quoteAsset,
      priceDigits: num(x.pricePrecision),
      firstTradeDate: launched === null ? null : Math.floor(launched / 1000),
      fundingInterval: null
    })
  }
  return { instruments: out, truncated: false, cursor: "" }
}

// ---- The latest price --------------------------------------------------

// The 24-hour tickers of `symbols`: for a single symbol Binance answers with
// just that one (weight 1). Omit `symbol` and it sends all of them (weight
// 40), which Refresh never asks for.
function quotesUrl(symbols) {
  var url = HOST + "/fapi/v1/ticker/24hr"
  if (symbols && symbols.length === 1) url += "?symbol=" + encodeURIComponent(symbols[0])
  return url
}

// Binance answers a list for all symbols and one object for one symbol.
function listOf(json) {
  return Array.isArray(json) ? json : json && typeof json === "object" && json.symbol ? [json] : null
}

// { time, prices, funding, stats }: when the newest ticker was read, in
// seconds (its `closeTime`, the end of its 24 hours), the last traded price
// by symbol, an empty funding (that is `parseFunding`'s), and the rolling 24
// hours by symbol as { open, high, low, volume, turnover }: the price 24
// hours ago, the high and low since, the volume in the base coin and in the
// quote coin. A ticker with no price is left out.
function parseQuotes(json) {
  var list = listOf(json)
  if (!list) return null
  var prices = {}
  var stats = {}
  var time = null
  for (var i = 0; i < list.length; i++) {
    var t = list[i]
    var price = num(t && t.lastPrice)
    var at = num(t && t.closeTime)
    if (!t || !t.symbol || price === null || at === null) continue
    prices[t.symbol] = price
    stats[t.symbol] = { open: num(t.openPrice), high: num(t.highPrice), low: num(t.lowPrice), volume: num(t.volume), turnover: num(t.quoteVolume) }
    if (time === null || at > time) time = at
  }
  if (time === null) return null
  return { time: Math.floor(time / 1000), prices: prices, funding: {}, stats: stats }
}

// The funding of `symbol`, asked for apart from the price.
function fundingUrl(symbol) {
  return HOST + "/fapi/v1/premiumIndex?symbol=" + encodeURIComponent(symbol)
}

// Funding by symbol as { rate, nextTime }: the rate of the next settlement
// (a fraction, 0.0001 = 0.01%) and when that is, in seconds; either is null
// when Binance sends none.
function parseFunding(json) {
  var list = listOf(json)
  if (!list) return null
  var funding = {}
  for (var i = 0; i < list.length; i++) {
    var t = list[i]
    if (!t || !t.symbol) continue
    var next = num(t.nextFundingTime)
    funding[t.symbol] = { rate: num(t.lastFundingRate), nextTime: next !== null && next > 0 ? Math.floor(next / 1000) : null }
  }
  return funding
}

// ---- Candles -----------------------------------------------------------

// The last `count` daily candles of one symbol (1 to 1500). The newest is
// today's, still open, and starts at 00:00 UTC.
function dailyUrl(symbol, count) {
  var n = Math.max(1, Math.min(1500, Math.floor(count)))
  return HOST + "/fapi/v1/klines?symbol=" + encodeURIComponent(symbol) + "&interval=1d&limit=" + n
}

// The 5-minute candles of one symbol from `start` (seconds) on: at most 288
// in 24 hours, so one request holds the whole line.
function candlesUrl(symbol, start) {
  return HOST + "/fapi/v1/klines?symbol=" + encodeURIComponent(symbol)
    + "&interval=5m&startTime=" + Math.floor(start) * 1000 + "&limit=288"
}

// Daily candles (dailyUrl) or 5-minute ones (candlesUrl), oldest first, as
// Binance sends them: { t, open, high, low, close, volume, turnover }, `t`
// the start in seconds. Volume is in the base coin and turnover in the quote
// coin. A row with a figure missing is left out whole.
function parseCandles(json) {
  if (!Array.isArray(json)) return null
  var out = []
  for (var i = 0; i < json.length; i++) {
    var row = json[i]
    if (!Array.isArray(row) || row.length < 8) continue
    var f = [num(row[0]), num(row[1]), num(row[2]), num(row[3]), num(row[4]), num(row[5]), num(row[7])]
    if (f.indexOf(null) >= 0) continue
    out.push({ t: Math.floor(f[0] / 1000), open: f[1], high: f[2], low: f[3], close: f[4], volume: f[5], turnover: f[6] })
  }
  return out
}

// ---- A range's candles -------------------------------------------------

// What each range asks for: Binance's interval code, that interval in
// seconds, and how far back the first candle may be, in days. Every range is
// under 1000 candles, so one request holds it (weight 5 for 500 or more
// rows), and a symbol younger than the range simply gets the candles it has.
// YTD starts at 00:00 UTC on 1 January and All has no start: monthly
// candles, the newest 1000 of them, are older than any perpetual.
var RANGES = {
  "1W": { interval: "15m", step: 900, days: 7 },
  "1M": { interval: "1h", step: 3600, days: 30 },
  "3M": { interval: "1d", step: DAY, days: 90 },
  "6M": { interval: "1d", step: DAY, days: 180 },
  "YTD": { interval: "1d", step: DAY },
  "1Y": { interval: "1d", step: DAY, days: 365 },
  "2Y": { interval: "1d", step: DAY, days: 730 },
  "5Y": { interval: "1w", step: 7 * DAY, days: 1826 },
  "10Y": { interval: "1w", step: 7 * DAY, days: 3652 },
  "All": { interval: "1M", step: 31 * DAY }
}

// The candles of `range` for one symbol at `now` (seconds), or null for a
// range this adapter does not serve (the day).
function historyUrl(symbol, range, now) {
  var spec = RANGES[range]
  if (!spec) return null
  var start = range === "YTD" ? Date.UTC(new Date(now * 1000).getUTCFullYear(), 0, 1) / 1000
    : spec.days ? now - spec.days * DAY : null
  return HOST + "/fapi/v1/klines?symbol=" + encodeURIComponent(symbol)
    + "&interval=" + spec.interval + (start === null ? "" : "&startTime=" + Math.floor(start) * 1000) + "&limit=1000"
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
// The 24-hour figures are Binance's own, from the ticker; with no stats they
// are null. The year's high and low come from the last 365 daily candles.
// The line, `points`, is each 5-minute candle of the last 24 hours at its
// start and close.
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
