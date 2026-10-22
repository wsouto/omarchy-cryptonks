// Adapted from Stonks by Gaurav Chande (MIT), omarchy-stonks v1.0.2,
// Service.qml. Changes: one feed for every symbol, a search preview among
// them; the symbols to add come from a list fetched once a day, not a
// lookup per query; ranges ride the same feed, with no history feed, gate,
// or charts fetched ahead; no fundamentals or overnight feeds; an add
// features its symbol at once; no list keeps a scroll place, so lists have
// no session keys; the files are this project's own.
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
// the list on show while the popup is open, for its rows, and search's
// choice, for the hero's preview.
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
  readonly property string cacheDir: (Quickshell.env("XDG_CACHE_HOME") || Quickshell.env("HOME") + "/.cache")
    + "/wsouto.crypto-stonks"
  readonly property string quotesPath: cacheDir + "/quotes.json"

  readonly property var library: dataSettings.symbols
  readonly property string featured: ready ? dataSettings.featured : ""
  readonly property string changeMode: dataSettings.changeMode
  // The chart range the popup shows; the day is the pill's own.
  readonly property string range: dataSettings.range
  // The list on show, "" for All; All and the named lists, as the menu
  // offers them (`Settings.listChoices`); the list's symbols in its manual
  // order; its order (`Settings.ORDERS`) and whether a sorted one runs the
  // other way.
  readonly property string listName: dataSettings.list
  readonly property var lists: Settings.listChoices(dataSettings)
  readonly property var symbols: Settings.listSymbols(dataSettings)
  readonly property string order: Settings.listOrder(dataSettings)
  readonly property bool reversed: Settings.listReversed(dataSettings)
  readonly property bool retro: dataSettings.style === "retro"
  // The popup and the window say when they open and close; either shows
  // every row, and the chart's range.
  property bool popupOpen: false
  property bool windowOpen: false
  readonly property bool shown: popupOpen || windowOpen
  // Search's choice, which the popup's hero shows unadded: "" for none.
  property string previewSymbol: ""
  // What the last removal took and the settings from just before it, on
  // offer until the next change to what the lists hold, however it comes: a
  // change here or in the data file. { symbol, before, left }, `left` the
  // hero it left.
  property var lastRemoval: null
  property string listsHeld: ""
  onDataSettingsChanged: {
    var held = Settings.listsHeld(root.dataSettings)
    if (held === root.listsHeld) return
    root.listsHeld = held
    root.lastRemoval = null
  }

  // Every symbol's quote and problem, as `PriceFeed` holds them, and the
  // featured one's on their own.
  readonly property var quotes: feed.quotes
  readonly property var problems: feed.problems
  readonly property var quote: feed.quotes[featured] || null
  readonly property string problem: feed.problems[featured] || ""
  readonly property bool fresh: !!feed.fresh[featured]
  // By symbol, whether its quote is this session's own (`PriceFeed.fresh`).
  readonly property var freshness: feed.fresh
  // The ranges that came, by "SYMBOL|RANGE" (`PriceFeed.histories`).
  readonly property var histories: feed.histories
  function refresh() { feed.refresh() }

  // The symbols you can add (`SymbolList`).
  readonly property alias symbolList: symbolSource

  // A row clicked, a number key: the symbol the pill and the hero show.
  function feature(symbol) {
    if (root.library.indexOf(symbol) >= 0) root.persist({ featured: symbol })
  }

  function preview(symbol) {
    root.previewSymbol = symbol
  }

  // An add is featured at once: the hero already shows it as the preview,
  // so the chart on show never changes. On a named list it joins that list
  // and All.
  function addSymbol(symbol) {
    var next = Settings.withSymbolAdded(root.dataSettings, symbol)
    next.featured = symbol
    root.previewSymbol = ""
    root.persist(next)
  }

  // Out of the list on show: a named list's membership, or All, and every
  // list with it. A featured symbol that leaves All hands the hero to its
  // neighbour in `shown`, the rows as the popup shows them.
  function removeSymbol(symbol, shown) {
    root.remove(symbol, Settings.withSymbolRemoved(root.dataSettings, symbol, root.listName, shown))
  }

  // A tick or untick in a symbol's checklist; "" is All. Unticking All is a
  // removal, and can be taken back like one.
  function setMembership(symbol, name, member, shown) {
    var next = Settings.withMembership(root.dataSettings, symbol, name, member, shown)
    if (name === "" && !member) root.remove(symbol, next)
    else root.persist(next)
  }

  // A removal remembers the settings before it and the hero it left, so it
  // can be taken back as it was without undoing anything chosen since. Its
  // quote stays in the feed, so an undo shows it at once.
  function remove(symbol, next) {
    var before = root.dataSettings
    root.persist(next)
    root.lastRemoval = { symbol: symbol, before: before, left: root.dataSettings.featured }
  }

  function setOrder(order) {
    root.persist(Settings.withListOrder(root.dataSettings, order))
  }

  // The current sorted order the other way; manual stays as it is.
  function reverseOrder() {
    root.persist(Settings.withListReversed(root.dataSettings))
  }

  function switchList(name) {
    root.persist({ list: name })
  }

  function stepList(delta) {
    root.switchList(Settings.steppedList(root.dataSettings, delta))
  }

  // Makes and opens an empty list. Returns why not, or "" once it exists.
  function createList(name) {
    var problem = Settings.listNameProblem(name, root.dataSettings.lists)
    if (problem === "") root.persist(Settings.withListCreated(root.dataSettings, name))
    return problem
  }

  // Returns why not, or "" once renamed.
  function renameList(name, newName) {
    var problem = Settings.renameProblem(root.dataSettings, name, newName)
    if (problem === "") root.persist(Settings.withListRenamed(root.dataSettings, name, newName))
    return problem
  }

  function moveList(name, delta) {
    root.persist(Settings.withListMoved(root.dataSettings, name, delta))
  }

  function deleteList(name) {
    root.persist(Settings.withListDeleted(root.dataSettings, name))
  }

  // A hand-arranged order of the rows.
  function setManualOrder(symbols) {
    root.persist(Settings.withManualOrder(root.dataSettings, symbols))
  }

  // The last removal, put back where it was. Only once.
  function undoRemoval() {
    var removal = root.lastRemoval
    if (!removal) return
    root.lastRemoval = null
    root.persist(Settings.withRemovalUndone(root.dataSettings, removal.before, removal.symbol, removal.left))
  }

  Screens { id: screenWatch }

  SymbolList {
    id: symbolSource
    cachePath: root.cacheDir + "/instruments.json"
  }

  PriceFeed {
    id: feed
    symbols: !root.ready ? [] : !root.shown ? [root.featured]
      : Settings.normalizeSymbols(root.symbols.concat([root.featured, root.previewSymbol]))
    featured: root.featured
    // Only the popup and the window show a range, and it shows the hero's symbol.
    want: root.ready && root.shown && root.range !== "1D" ? { symbol: root.previewSymbol || root.featured, range: root.range } : null
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
