import QtQuick
import Quickshell.Io
import "Fetch.js" as Fetch
import "Refresh.js" as Refresh
import "adapters/bybit.js" as Bybit

// Fetches one symbol from Bybit once a minute and holds its quote. It is the
// only part that runs a command: a `Process` for curl, and nothing else
// does. What to ask, and how to read the answer, is the adapter's
// (`adapters/bybit.js`); how to run curl and what an HTTP status means is
// `Fetch.js`'s; what a run's answers mean for the quote is `Refresh.js`'s.
// This file only joins them to a timer.
//
// It reads the clock (to know when a pause ends, and how many days of
// candles to ask for), which an adapter or a rule file may not.
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

  // What is kept between refreshes for one symbol: its instrument and up to
  // a year of daily candles (see `Refresh.js`), so each minute asks only for
  // the price and the last two candles.
  property var kept: null
  // The time, in seconds, before which Bybit is left alone.
  property real pausedUntil: 0
  // The run in flight: which symbol it asks about, and what each of its URLs
  // asks for, in the order sent.
  property string askedFor: ""
  property var asked: []
  // Whether the run in flight's curl began at all.
  property bool began: false

  // A quote, or a "!", belongs to the symbol it was fetched for. A pause
  // Bybit asked for is not about a symbol, so its "!" stays.
  onSymbolChanged: {
    root.quote = null
    if (nowSeconds() >= pausedUntil) root.problem = ""
    refresh()
  }

  function nowSeconds() { return Math.floor(Date.now() / 1000) }

  function refresh() {
    if (proc.running || nowSeconds() < pausedUntil) return
    var next = Refresh.plan(Bybit, symbol, kept, nowSeconds())
    askedFor = symbol
    asked = next.asked
    began = false
    // One curl, all of the URLs over one connection. The largest answer is
    // a year of daily candles, so its cap is the run's.
    proc.command = Fetch.curlCommand(next.urls, Fetch.DAILY_CAP)
    proc.running = true
  }

  // A run's output, read by `Refresh.js`; this file only keeps the result.
  // A run for a symbol no longer shown is dropped.
  function receive(text) {
    if (askedFor !== symbol) return
    var got = Refresh.read(Fetch.answers(text, Bybit.limits), asked, symbol, kept, Bybit)
    root.kept = got.kept
    if (got.wait > 0) root.pausedUntil = nowSeconds() + got.wait
    if (got.quote !== null) root.quote = got.quote
    root.problem = got.problem
  }

  Timer {
    interval: root.interval * 1000
    repeat: true
    running: true
    triggeredOnStart: true
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
