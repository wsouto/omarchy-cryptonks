import QtQuick
import Quickshell.Io
import "Fetch.js" as Fetch
import "adapters/bybit.js" as Bybit

// Fetches one symbol from Bybit once a minute and holds its quote. It is the
// only part that runs a command: a `Process` for curl, and nothing else
// does. What to ask, and how to read the answer, is the adapter's
// (`adapters/bybit.js`); how to run curl and what an HTTP status means is
// `Fetch.js`'s. This file only joins them to a timer.
//
// It reads the clock (to know when a pause ends), which an adapter may not.
//
// For now it serves one symbol and lives inside the pill. When the list
// arrives (roadmap step 6) it moves into a service shared by every screen,
// and a `Gate.qml` replaces the small pause kept here.
Item {
  id: root

  property string symbol: "BTCUSDT"
  // Seconds between refreshes.
  property int interval: 60

  // The quote record of docs/QUOTE-RECORD.md, null until the first answer.
  property var quote: null
  // Why the last refresh failed, in words for a person; "" when it did not.
  // The quote is kept while it fails: an old price with a "!" beside it
  // says more than a pill gone blank.
  property string problem: ""

  // What the instrument is (decimals, launch time, funding interval). It
  // does not change by the minute, so it is asked once and then kept.
  property var instrument: null
  // The time, in seconds, before which Bybit is left alone.
  property real pausedUntil: 0
  // What each URL of the run in flight asks for, in the order sent.
  property var asked: []

  function nowSeconds() { return Math.floor(Date.now() / 1000) }

  function refresh() {
    if (proc.running || nowSeconds() < pausedUntil) return
    var urls = [Bybit.quotesUrl([symbol]), Bybit.dailyUrl(symbol, 365)]
    var roles = ["quotes", "daily"]
    if (instrument === null) {
      urls.push(Bybit.instrumentUrl(symbol))
      roles.push("instrument")
    }
    asked = roles
    // One curl, all of the URLs over one connection. The largest answer is
    // the 365 daily candles, so its cap is the run's.
    proc.command = Fetch.curlCommand(urls, Fetch.DAILY_CAP)
    proc.running = true
  }

  // The words for how long Bybit asked us to wait.
  function waitWords(seconds) {
    return seconds >= 120 ? Math.round(seconds / 60) + " minutes" : seconds + " seconds"
  }

  // What Bybit itself said when it turned a question down: it answers HTTP
  // 200 with a "retMsg", such as "params error: symbol invalid".
  function said(json) {
    return json && json.retMsg ? "Bybit: " + json.retMsg : "Bybit sent no usable answer"
  }

  // A run's output. Each answer is read as the role its URL had, and the
  // quote is rebuilt only if all of what it needs came: a half answer never
  // replaces a whole one.
  function receive(text) {
    var all = Fetch.answers(text, Bybit.limits)
    var json = {}
    var trouble = ""
    var wait = 0
    for (var i = 0; i < all.length; i++) {
      var answer = all[i]
      var role = asked[answer.index]
      if (answer.kind === "refused") {
        wait = Math.max(wait, answer.retryAfter > 0 ? answer.retryAfter : 60)
      } else if (answer.kind === "none") {
        trouble = "No network"
      } else if (answer.kind !== "ok") {
        trouble = "Bybit sent an error (HTTP " + answer.status + ")"
      } else {
        try { json[role] = JSON.parse(answer.body) }
        catch (e) { trouble = "Bybit sent an answer that cannot be read" }
      }
    }

    if (wait > 0) {
      root.pausedUntil = nowSeconds() + wait
      root.problem = "Bybit asked for fewer requests: waiting " + waitWords(wait)
      return
    }

    if (json.instrument) {
      var listed = Bybit.parseInstruments(json.instrument)
      if (listed === null) trouble = said(json.instrument)
      else if (listed.instruments.length === 0) trouble = symbol + " is not a USDT perpetual that trades on Bybit"
      else root.instrument = listed.instruments[0]
    }
    var quotes = json.quotes ? Bybit.parseQuotes(json.quotes) : null
    var candles = json.daily ? Bybit.parseDaily(json.daily) : null
    if (root.instrument === null || quotes === null || candles === null || !(symbol in quotes.prices)) {
      root.problem = trouble || (json.quotes && quotes === null ? said(json.quotes) : "Bybit sent no price for " + symbol)
      return
    }

    root.quote = Bybit.buildQuote(root.instrument, quotes.prices[symbol], quotes.time, candles)
    root.problem = ""
  }

  Timer {
    interval: root.interval * 1000
    repeat: true
    running: true
    triggeredOnStart: true
    onTriggered: root.refresh()
  }

  // A run ends with its stream, never with the process stopping: both fire
  // for one run, and a failed curl still ends the stream.
  Process {
    id: proc
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.receive(String(text || ""))
    }
  }
}
