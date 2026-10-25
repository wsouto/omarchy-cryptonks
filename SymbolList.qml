import QtQuick
import Quickshell.Io
import "Fetch.js" as Fetch

// The symbols you can add: every contract this project follows, which search
// looks through on this machine, so nothing goes out while you type, and
// whose instruments the feed then need not ask one by one. The whole list is
// 850 KB (98 KB compressed), so it is asked for only at start, on a new
// exchange and when search opens (`want`), and only when it is missing or a
// day old, and saved, so a restart searches at once. A list that fails to come keeps
// the one saved; with none, search says so and offers RETRY.
Item {
  id: root

  required property string cachePath
  // The exchange's adapter (`Exchanges.byName`); its list is the one asked for.
  required property var adapter

  // The instruments as `adapter.parseInstruments` reads them, A to Z as the
  // exchange sends them; none until a list is in. Search reads `symbol` and
  // `name`, the feed the whole record (`bySymbol`).
  property var instruments: []
  readonly property var bySymbol: {
    var out = {}
    for (var i = 0; i < root.instruments.length; i++) out[root.instruments[i].symbol] = root.instruments[i]
    return out
  }
  // "loading" while a list is on its way, "failed" when the last one did
  // not come, else "".
  property string status: ""
  // When the list in hand came, in milliseconds; 0 for none.
  property real fetchedAt: 0
  readonly property int maxAge: 24 * 3600 * 1000
  // Bybit and Binance send the whole list in one page; a few more are allowed, and
  // a list longer than that is kept as far as it got.
  readonly property int maxPages: 5

  // The list so far, the pages asked for, and the next one's cursor, ""
  // when no page is owed.
  property var pages: []
  property int asked: 0
  property string cursor: ""
  // The path whose file was read, and the one the list in flight is for.
  property string loadedPath: ""
  property string askedPath: ""

  Component.onCompleted: loadCache()
  // Each exchange has a list file of its own: a new path is a new list. The
  // file is read once `cacheFile` has the new path too, which is not yet
  // here; and a missing file leaves `text()` as the last one read
  // (Quickshell 0.3.1), so a file names its exchange and one that names
  // another is not read.
  onCachePathChanged: {
    root.instruments = []
    root.fetchedAt = 0
    root.status = ""
    root.pages = []
    root.cursor = ""
    Qt.callLater(loadCache)
  }

  function loadCache() {
    if (root.loadedPath === root.cachePath) return
    root.loadedPath = root.cachePath
    try {
      var saved = JSON.parse(cacheFile.text())
      // Version 1 kept only symbol and name: it is asked for again.
      if (saved && saved.version === 2 && saved.exchange === root.adapter.NAME && Array.isArray(saved.instruments)) {
        root.instruments = saved.instruments
        root.fetchedAt = Number(saved.time) || 0
      }
    } catch (e) {}
  }

  // Search opened: the list is asked for unless one is on its way or the
  // one in hand is under a day old. RETRY asks for it whatever its age.
  function want() {
    loadCache()
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
    root.askedPath = root.cachePath
    ask()
  }

  function ask() {
    root.asked += 1
    proc.command = Fetch.curlCommand([root.adapter.instrumentsUrl(root.cursor)], Fetch.LIST_CAP)
    proc.running = true
  }

  function receive(text) {
    // The list of an exchange left behind is not this one's. shortcut: the
    // new exchange's list waits for the next `want`; ask it here if a switch
    // during a list fetch turns out to be common.
    if (root.askedPath !== root.cachePath) {
      root.status = ""
      root.cursor = ""
      return
    }
    var got = Fetch.answers(text, root.adapter.limits)
    var parsed = null
    if (got.length && got[0].kind === "ok") {
      try { parsed = root.adapter.parseInstruments(JSON.parse(got[0].body)) } catch (e) {}
    }
    if (!parsed) {
      root.status = "failed"
      root.cursor = ""
      return
    }
    root.pages = root.pages.concat(parsed.instruments)
    // The next page goes as this curl ends (`onRunningChanged`).
    if (parsed.cursor && root.asked < root.maxPages) {
      root.cursor = parsed.cursor
      return
    }
    root.cursor = ""
    root.instruments = root.pages
    root.fetchedAt = Date.now()
    root.status = ""
    cacheFile.setText(JSON.stringify({ version: 2, exchange: root.adapter.NAME, time: root.fetchedAt, instruments: root.instruments }) + "\n")
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
