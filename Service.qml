// Adapted from Stonks by Gaurav Chande (MIT), omarchy-stonks v1.0.2,
// Service.qml. Changes: one feed for every symbol; no lists, ranges,
// previews, fundamentals or overnight feeds; the files are this project's
// own.
import QtQuick
import Quickshell
import Quickshell.Io
import "Settings.js" as Settings

// The one data owner. The data settings live in wsouto.crypto-stonks.json
// and are written only here: the symbols, the featured one, the change mode
// and the look, which the pill and the popup share. The last good quotes are
// saved, so a restart shows a price at once, until its first answer.
//
// The featured symbol is kept fresh always, for the pill; every symbol of
// All while the popup is open, for its rows.
Item {
  id: root

  property var dataSettings: Settings.fileSettings(null)
  // The data file has been read, or found missing: until then nothing is
  // fetched or written, so the defaults never overwrite a file on its way.
  property bool ready: false
  // The data file is there but can't be read: empty, not JSON, or not an
  // object. The settings in memory stay, the defaults if it never could be
  // read, and changes still apply to them, but nothing is written until the
  // file reads again, so a typo in it never costs the user's symbols.
  property bool settingsUnreadable: false

  readonly property string dataPath: Quickshell.env("HOME") + "/.config/omarchy/wsouto.crypto-stonks.json"
  readonly property string quotesPath: (Quickshell.env("XDG_CACHE_HOME") || Quickshell.env("HOME") + "/.cache")
    + "/wsouto.crypto-stonks/quotes.json"

  readonly property var library: dataSettings.symbols
  readonly property string featured: ready ? dataSettings.featured : ""
  readonly property string changeMode: dataSettings.changeMode
  readonly property bool retro: dataSettings.style === "retro"
  // The popup says when it opens and closes.
  property bool popupOpen: false

  // Every symbol's quote and problem, as `PriceFeed` holds them, and the
  // featured one's on their own.
  readonly property var quotes: feed.quotes
  readonly property var problems: feed.problems
  readonly property var quote: feed.quotes[featured] || null
  readonly property string problem: feed.problems[featured] || ""
  readonly property bool fresh: !!feed.fresh[featured]
  function refresh() { feed.refresh() }

  // A row clicked, a number key: the symbol the pill and the hero show.
  function feature(symbol) {
    if (root.library.indexOf(symbol) >= 0) root.persist({ featured: symbol })
  }

  Screens { id: screenWatch }

  PriceFeed {
    id: feed
    symbols: !root.ready ? [] : root.popupOpen ? root.library : [root.featured]
    featured: root.featured
    screens: screenWatch
    onAnswered: root.saveQuotes()
  }

  // ---- The data file ----

  FileView {
    id: dataFile
    path: root.dataPath
    watchChanges: true
    atomicWrites: true
    // Written before setText returns. Quickshell 0.3.1's async write, cancelled
    // by the next, leaves the cancelled text as what it compares a third
    // against, so a change back to it while the second is in flight is never
    // written, and the watch reads the second back over it.
    blockWrites: true
    printErrors: false
    onFileChanged: root.readDataFile()
    onLoaded: root.dataReadEnded(root.takeLoadedSettings)
    // Only a file that isn't there is missing: one there that can't be
    // read, for its permissions or as a folder, is never written over.
    onLoadFailed: function(error) {
      root.dataReadEnded(error === FileViewError.FileNotFound ? root.takeMissingFile : root.takeUnreadableFile)
    }
    // A write drops a read in flight unheard: neither loaded nor failed.
    onSaved: root.dataReadEnded(null)
    onSaveFailed: function(error) {
      console.warn("crypto-stonks: failed to write " + root.dataPath + ": " + error)
      root.dataReadEnded(null)
    }
  }
  // A read of the data file is in flight, or owed; the first starts as its
  // path is set. Quickshell 0.3.1 ignores a reload() asked for while one is,
  // so a change saved meanwhile would never be read: it is held instead,
  // and read once that read ends, however it ends.
  property bool dataReading: true
  property bool dataChangedMeanwhile: false
  function readDataFile() {
    if (root.dataReading) {
      root.dataChangedMeanwhile = true
      return
    }
    root.dataReading = true
    dataFile.reload()
  }
  // TAKE, when the read found something, takes it first. A change held
  // during the read is read once the handler has returned: Quickshell lets
  // go of a read only after its loaded or loadFailed handlers have run.
  function dataReadEnded(take) {
    var again = root.dataChangedMeanwhile
    root.dataReading = again
    root.dataChangedMeanwhile = false
    if (take) take()
    if (again) Qt.callLater(function() { dataFile.reload() })
  }

  function parseDataText(text) {
    try {
      var parsed = JSON.parse(String(text || "").trim())
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null
      return Settings.fileSettings(parsed)
    } catch (e) {
      return null
    }
  }

  function adopt(settings) {
    root.dataSettings = Settings.fileSettings(settings)
    if (!root.ready) {
      root.ready = true
      feed.seed(root.savedQuotes)
    }
  }

  function takeLoadedSettings() {
    var parsed = root.parseDataText(dataFile.text())
    if (!parsed) {
      root.takeUnreadableFile()
      return
    }
    root.settingsUnreadable = false
    if (root.ready && Settings.settingsEqual(parsed, root.dataSettings)) return
    root.adopt(parsed)
  }

  // The settings in memory stay, the defaults if none were read, and
  // nothing is written until the file reads again.
  function takeUnreadableFile() {
    if (!root.settingsUnreadable)
      console.warn("crypto-stonks: " + root.dataPath + " can't be read; saving nothing until it can")
    root.settingsUnreadable = true
    if (!root.ready) root.adopt(root.dataSettings)
  }

  // A first start: the starters, written so they can be edited.
  function takeMissingFile() {
    root.settingsUnreadable = false
    var first = !root.ready
    root.adopt(Settings.fileSettings(null))
    if (first) root.writeDataFile(root.dataSettings)
  }

  function writeDataFile(settings) {
    dataFile.setText(JSON.stringify(Settings.fileSettings(settings), null, 2) + "\n")
  }

  // `values` over the settings, saved at once.
  function persist(values) {
    var next = Settings.fileSettings(root.dataSettings)
    for (var key in values) next[key] = values[key]
    next = Settings.fileSettings(next)
    root.dataSettings = next
    if (root.ready && !root.settingsUnreadable) root.writeDataFile(next)
  }

  // ---- The saved quotes ----

  FileView {
    id: quotesFile
    path: root.quotesPath
    blockLoading: true
    atomicWrites: true
    printErrors: false
  }

  // { symbol: quote }, read once at start; none when the file is missing or
  // unreadable.
  readonly property var savedQuotes: {
    try {
      var parsed = JSON.parse(quotesFile.text())
      return parsed && parsed.version === 1 && parsed.quotes ? parsed.quotes : {}
    } catch (e) {
      return {}
    }
  }
  // Written as answers come, at most every 10 minutes: at once, then, if
  // more came meanwhile, as the wait ends.
  property bool quotesUnsaved: false
  function saveQuotes() {
    root.quotesUnsaved = true
    if (!quotesWait.running) root.flushQuotes()
  }

  function flushQuotes() {
    if (!root.quotesUnsaved) return
    root.quotesUnsaved = false
    var saved = {}
    root.library.forEach(function(s) { if (feed.quotes[s]) saved[s] = feed.quotes[s] })
    quotesFile.setText(JSON.stringify({ version: 1, quotes: saved }) + "\n")
    quotesWait.restart()
  }

  Timer {
    id: quotesWait
    interval: 10 * 60 * 1000
    onTriggered: root.flushQuotes()
  }
}
