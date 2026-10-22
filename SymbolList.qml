import QtQuick
import Quickshell.Io
import "Fetch.js" as Fetch
import "adapters/bybit.js" as Bybit

// The symbols you can add: every contract this project follows, as { symbol,
// name }, which search looks through on this machine, so nothing goes out
// while you type. The whole list is 850 KB (98 KB compressed), so it is
// asked for only when search opens (`want`) and it is missing or a day old,
// and saved, so a restart searches at once. A list that fails to come keeps
// the one saved; with none, search says so and offers RETRY.
Item {
  id: root

  required property string cachePath

  // { symbol, name }, A to Z as Bybit sends them; none until a list is in.
  property var instruments: []
  // "loading" while a list is on its way, "failed" when the last one did
  // not come, else "".
  property string status: ""
  // When the list in hand came, in milliseconds; 0 for none.
  property real fetchedAt: 0
  readonly property int maxAge: 24 * 3600 * 1000
  // Bybit has sent the whole list in one page; a few more are allowed, and
  // a list longer than that is kept as far as it got.
  readonly property int maxPages: 5

  // The list so far, the pages asked for, and the next one's cursor, ""
  // when no page is owed.
  property var pages: []
  property int asked: 0
  property string cursor: ""

  Component.onCompleted: {
    try {
      var saved = JSON.parse(cacheFile.text())
      if (saved && saved.version === 1 && Array.isArray(saved.instruments)) {
        root.instruments = saved.instruments
        root.fetchedAt = Number(saved.time) || 0
      }
    } catch (e) {}
  }

  // Search opened: the list is asked for unless one is on its way or the
  // one in hand is under a day old. RETRY asks for it whatever its age.
  function want() {
    if (root.status === "loading") return
    if (root.instruments.length > 0 && Date.now() - root.fetchedAt < root.maxAge) return
    retry()
  }

  function retry() {
    if (proc.running) return
    root.status = "loading"
    root.pages = []
    root.asked = 0
    root.cursor = ""
    ask()
  }

  function ask() {
    root.asked += 1
    proc.command = Fetch.curlCommand([Bybit.instrumentsUrl(root.cursor)], Fetch.LIST_CAP)
    proc.running = true
  }

  function receive(text) {
    var got = Fetch.answers(text, Bybit.limits)
    var parsed = null
    if (got.length && got[0].kind === "ok") {
      try { parsed = Bybit.parseInstruments(JSON.parse(got[0].body)) } catch (e) {}
    }
    if (!parsed) {
      root.status = "failed"
      root.cursor = ""
      return
    }
    root.pages = root.pages.concat(parsed.instruments.map(function(i) { return { symbol: i.symbol, name: i.name } }))
    // The next page goes as this curl ends (`onRunningChanged`).
    if (parsed.cursor && root.asked < root.maxPages) {
      root.cursor = parsed.cursor
      return
    }
    root.cursor = ""
    root.instruments = root.pages
    root.fetchedAt = Date.now()
    root.status = ""
    cacheFile.setText(JSON.stringify({ version: 1, time: root.fetchedAt, instruments: root.instruments }) + "\n")
  }

  FileView {
    id: cacheFile
    path: root.cachePath
    blockLoading: true
    atomicWrites: true
    printErrors: false
  }

  // As the feed's curl: a run ends with its stream, and one that never
  // started ends when `running` goes back to false.
  property bool began: false
  Process {
    id: proc
    onStarted: root.began = true
    onRunningChanged: {
      if (running) return
      if (!root.began) root.receive("")
      root.began = false
      if (root.cursor !== "") root.ask()
    }
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.receive(String(text || ""))
    }
  }
}
