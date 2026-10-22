import QtQuick
import Quickshell.Io
import "Fetch.js" as Fetch
import "Refresh.js" as Refresh
import "adapters/bybit.js" as Bybit

// Fetches the symbols it is handed from Bybit once a minute and holds their
// quotes. It is the only part that runs a command: a `Process` for curl,
// and nothing else does. What to ask, and how to read the answer, is the
// adapter's (`adapters/bybit.js`); how to run curl and what an HTTP status
// means is `Fetch.js`'s; what a run's answers mean for the quotes is
// `Refresh.js`'s. This file only joins them to a timer.
//
// It reads the clock (to know when a pause ends, and which candles to ask
// for), which an adapter or a rule file may not.
//
// Every symbol goes in one run, one curl over one connection, each asking
// for its own price: a request per symbol is under 1 KB, where Bybit's
// all-tickers answer is 680 KB. A symbol that joins (a preview, an add, an
// undo, the popup's rows as it opens) or becomes featured is asked for in a
// run of its own, so the rest wait for their minute rather than being asked
// again. The candles come every 5 minutes for a row,
// every minute for the featured symbol (`Refresh.planRun`). Before each run
// it asks whether a screen is on (`Screens.qml`): while every one is off,
// nothing is fetched, and the run goes as soon as one is back. A refusal
// leaves Bybit alone for as long as it asks, 10 minutes for its 403.
Item {
  id: root

  // The symbols to keep fresh, the featured one among them; none until the
  // service has read its settings.
  property var symbols: []
  property string featured: ""
  // `Screens.qml`, or null, as in a harness, to fetch whatever the screens.
  property var screens: null
  // Seconds between refreshes, and between a row's candles.
  property int interval: 60
  property int rowEvery: 300

  // By symbol: the quote record of docs/QUOTE-RECORD.md; why its last
  // refresh failed, in words for a person, "" when it did not; and whether
  // its quote is this session's own answer, not one saved from before
  // (`seed`): only then is it live. A quote is kept while it fails: an old
  // price with a "!" beside it says more than a row gone blank.
  property var quotes: ({})
  property var problems: ({})
  property var fresh: ({})

  // What is kept between refreshes, by symbol: its instrument, up to a year
  // of daily candles and today's 5-minute ones (see `Refresh.js`), so each
  // minute asks only for the prices and the candles due.
  property var kept: ({})
  // The time, in seconds, before which Bybit is left alone.
  property real pausedUntil: 0
  // What each URL of the run in flight asks for, in the order sent.
  property var asked: []
  // Whether the run in flight's curl began at all.
  property bool began: false
  // A run waits for the screens' answer.
  property bool owed: false
  // Another run was asked for while one was out: it goes as that one ends.
  property bool again: false
  // The symbols last handed in, those owed a run of their own, and whether
  // the next run asks for every symbol (`Refresh.runSymbols`).
  property var watched: []
  property var pending: []
  property bool whole: false

  // Quotes answered, for the service to save.
  signal answered()

  // A symbol newly watched, or newly featured, is asked for at once, alone.
  onSymbolsChanged: {
    root.pending = root.pending.concat(Refresh.newcomers(root.watched, root.symbols))
    root.watched = root.symbols.slice()
    Qt.callLater(request, false)
  }
  onFeaturedChanged: {
    if (root.featured !== "") root.pending = root.pending.concat([root.featured])
    Qt.callLater(request, false)
  }

  // The last quotes saved, { symbol: quote }, each shown until its first
  // answer.
  function seed(saved) {
    var next = Object.assign({}, root.quotes)
    for (var s in saved) if (!next[s]) next[s] = saved[s]
    root.quotes = next
  }

  function nowSeconds() { return Math.floor(Date.now() / 1000) }

  // Every symbol: the minute's run, or one you asked for.
  function refresh() { request(true) }

  // A run, of every symbol with `all`, else of those owed one. A run owed
  // while one is out, or while the screens answer, keeps what it owes.
  function request(all) {
    if (all) root.whole = true
    if (root.symbols.length === 0 || nowSeconds() < pausedUntil) return
    if (proc.running) {
      root.again = true
      return
    }
    if (root.screens && root.screens.ask()) root.owed = true
    else run()
  }

  function screensAnswered() {
    if (!root.owed || root.screens.screensOff) return
    root.owed = false
    run()
  }

  function run() {
    if (proc.running) return
    var list = Refresh.runSymbols(root.symbols, root.pending, root.whole)
    root.whole = false
    root.pending = []
    if (list.length === 0) return
    var next = Refresh.planRun(Bybit, list, featured, kept, nowSeconds(), rowEvery)
    asked = next.asked
    began = false
    // One curl, all of the URLs over one connection. The largest answer is
    // a year of daily candles, so its cap is each answer's.
    proc.command = Fetch.curlCommand(next.urls, Fetch.DAILY_CAP)
    proc.running = true
  }

  // A run's output, read by `Refresh.js`; this file only keeps the result.
  // A refusal's words go to every symbol: Bybit is left alone for all.
  function receive(text) {
    var got = Refresh.readRun(Fetch.answers(text, Bybit.limits), asked, kept, Bybit)
    root.kept = got.kept
    if (got.wait > 0) root.pausedUntil = nowSeconds() + got.wait
    var quotes = Object.assign({}, root.quotes)
    var problems = Object.assign({}, root.problems)
    var fresh = Object.assign({}, root.fresh)
    var landed = false
    for (var s in got.problems) {
      problems[s] = got.wait > 0 ? got.waitProblem : got.problems[s]
      if (got.quotes[s] === null) continue
      quotes[s] = got.quotes[s]
      fresh[s] = true
      landed = true
    }
    root.quotes = quotes
    root.problems = problems
    root.fresh = fresh
    if (landed) root.answered()
    if (root.again) {
      root.again = false
      Qt.callLater(request, false)
    }
  }

  Connections {
    target: root.screens
    function onAnswered() { root.screensAnswered() }
  }

  Timer {
    interval: root.interval * 1000
    repeat: true
    running: true
    onTriggered: root.refresh()
  }

  // A run ends with its stream, never with the process stopping: both fire
  // for one run, and a failed curl still ends the stream. A curl that cannot
  // start at all, because it is not installed, has no stream to end and
  // fires no `started` and no `exited` (checked in Quickshell): only
  // `running` goes back to false, so that is read as a run with no output.
  Process {
    id: proc
    onStarted: root.began = true
    onRunningChanged: if (!running && !root.began) root.receive("")
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.receive(String(text || ""))
    }
  }
}
