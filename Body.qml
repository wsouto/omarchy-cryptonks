// Adapted from Stonks by Gaurav Chande (MIT), omarchy-stonks v1.0.2,
// StonksBody.qml and Watchlist.qml. Changes: the body is the header, the
// hero, the day chart, the list line and its menu, the rows, search and the
// footer, built here, and the key sheet in their place, and the range row;
// the statuses come in roadmap step 11, with the keys that drive them; a new
// list's name is not kept through a close. The rows are a ListView whose rows
// a drag shifts in place, so the row under the pointer is never rebuilt
// mid-drag. An add is featured at once, so there is no landing to wait for.
// The change has two modes, percent and amount, both since 00:00 UTC. The
// keys are read by the surface (popup or window) and passed to `textKey`,
// `moveKeys`, `activate`, `escapeKey` and `deleteKey`.

pragma ComponentBehavior: Bound

import QtQuick
import qs.Commons
import qs.Commons as Commons
import qs.Ui
import "Figures.js" as Figures
import "Settings.js" as Settings
import "Format.js" as Format
import "History.js" as History
import "KeySheet.js" as KeySheet
import "Tones.js" as Tones
import "adapters/bybit.js" as Bybit

// What the popup and the window both show. Owns the rows' cursor and what the
// hero and the rows show at the moment on screen; the chart's motion is
// `ChartMotion`'s, the data and the saved look and change mode the service's.
// The surface lends it its state (`surfaceOpen`, the colours) and the room.
Item {
  id: root

  // The plugin's `Service` and `TrendColors`.
  property var service: null
  property var trendColors: null
  // The surface is on screen: the popup open, the window shown.
  property bool surfaceOpen: false
  property color foreground: Commons.Color.foreground
  property string fontFamily: Style.font.family
  // The card's colour, opaque whatever the theme's popup alpha.
  property color ground: Commons.Color.background
  property int chartHeight: Style.space(190)
  // The rows show up to this many whole rows; more scroll.
  property int maxRows: 6
  // The room the rows may have, or 0 for `maxRows` rows.
  property int rowsRoom: 0
  // Ask the surface to close (Escape with nothing left to let go of).
  signal closeRequested()
  // Between the band's blocks, and between the header and what it heads.
  readonly property int bandGap: Style.space(16)
  readonly property int groupGap: Style.space(8)
  readonly property int edge: Style.space(8)

  // The hero's symbol: search's choice while search is open, else the
  // featured one, which the pill shows whatever the popup previews.
  readonly property string symbol: service ? service.previewSymbol || service.featured : ""
  readonly property var quote: service ? service.quotes[symbol] || null : null
  readonly property string problem: service ? service.problems[symbol] || "" : ""
  readonly property string featured: service ? service.featured : ""
  // All, in its manual order; the list on show, "" for All, and its name;
  // and the rows: that list in its order.
  readonly property var library: service ? service.library : []
  readonly property string listName: service ? service.listName : ""
  readonly property string listLabel: listName !== "" ? listName : "All"
  readonly property var listSymbols: service ? service.symbols : []
  readonly property string order: service ? service.order : "manual"
  readonly property bool reversed: !!service && service.reversed
  readonly property bool manualOrder: order === "manual"
  readonly property var shownRows: service ? Settings.sortedSymbols(listSymbols, service.quotes, order, reversed) : []
  readonly property int rowPitch: Style.space(40) + rowGap
  // Whole rows shown: `maxRows`, or what `rowsRoom` holds; an empty named
  // list keeps one row, which says so.
  readonly property int shownCount: Math.max(1, Math.min(shownRows.length,
    rowsRoom > 0 ? Math.floor((rowsRoom + rowGap) / rowPitch) : maxRows))
  readonly property int rowGap: Style.space(2)
  // The one cursor the keys and the pointer both move, as in the shell's own
  // panels: the row you put it on, else the featured row.
  property string cursorSymbol: ""
  // The key sheet shows in the place of the hero, the chart and the rows.
  property bool showingHelp: false
  readonly property string cursorRow: shownRows.indexOf(cursorSymbol) >= 0 ? cursorSymbol : featured
  // Search is open in the rows' place, with the hero on its choice.
  property bool adding: false
  // The list menu lies over the rows. Manage lists, and the lists of one
  // symbol (`listsSymbol`), take the rows' and the footer's place.
  property bool listMenuOpen: false
  property bool managingLists: false
  property string listsSymbol: ""
  readonly property bool listViewOpen: managingLists || listsSymbol !== ""
  // A view has the keys, its field's or its own; as it lets them go, they
  // come back to the surface's own handler.
  readonly property bool ownsKeys: adding || listMenuOpen || listViewOpen
  signal keysReleased()
  onOwnsKeysChanged: if (!ownsKeys) Qt.callLater(function() { if (root.surfaceOpen && !root.ownsKeys) root.keysReleased() })
  // Why a key did nothing, or what a removal took, in the footer for a
  // moment (`say`, `offerUndo`); `offered` is the removal it offers back,
  // while it is still the service's one on offer.
  property string note: ""
  property var offered: null
  readonly property var removal: service ? service.lastRemoval : null
  onRemovalChanged: if (offered !== null && removal !== offered) clearNote()
  // The change's unit: "pct" or "abs", which c or a click on it switches.
  readonly property string changeMode: service ? service.changeMode : "pct"
  // The look, smooth or retro, which s or the look icon switches.
  readonly property bool retro: !!service && service.retro
  // The chart range, the day or another; another's line, once it came.
  readonly property string range: service ? service.range : "1D"
  readonly property bool onDay: range === "1D"
  readonly property var history: !onDay && service ? service.histories[symbol + "|" + range] || null : null
  readonly property int scrubT: motion.scrubT
  // The rows and the rule keep the day on every range, so a scrub of
  // another range moves neither.
  readonly property int dayScrubT: onDay ? scrubT : 0
  readonly property var view: !quote ? null
    : onDay ? Figures.heroView(quote, scrubT, changeMode) : Figures.rangeView(history, quote, scrubT, range)
  // Live is honest only while refreshes land, the quote is this session's
  // own, and the moment shown is now.
  readonly property bool live: !!quote && !!service && !!service.freshness[symbol] && problem === "" && !scrubT
  // The info block's two lines: the day's or the range's, over the 52
  // weeks'; and every list of facts the first can hold on any range, so a
  // range change moves none of them.
  readonly property var periodLine: !quote ? null : onDay ? Figures.dayLine(quote)
    : history ? History.rangeLine(history, quote, History.youngRoom(quote)) : null
  readonly property var yearLine: Figures.yearLine(quote)
  readonly property var infoFactLists: [Figures.dayLine(quote || {}).facts]
    .concat(History.rangeFactLists(History.youngRoom(quote)))
  readonly property string statusText: scrubT && view && view.time !== null
      ? (onDay ? "At " + Format.utcClock(view.time) + " UTC" : History.momentText(history, view.time))
    : problem !== "" ? "! " + problem
    : quote ? "Live" : ""
  readonly property string baselineText: !quote ? ""
    : onDay ? (typeof quote.dayOpen === "number" ? "OPEN 00:00 UTC " + Format.money(quote.dayOpen, quote.priceDigits) : "")
    : history ? "START " + History.momentText(history, history.bars[0].t) + " " + Format.money(history.baseline, quote.priceDigits) : ""


  readonly property color upColor: trendColors ? trendColors.upOn(ground) : Commons.Color.foreground
  readonly property color downColor: trendColors ? trendColors.downOn(ground) : Commons.Color.urgent
  readonly property color dim: Tones.dim(foreground, ground)
  readonly property color dimmer: Tones.dimmer(foreground, ground)
  readonly property color ghost: Qt.rgba(foreground.r, foreground.g, foreground.b, 0.05)
  readonly property string newestPrice: quote && quote.points.length ? String(quote.points[quote.points.length - 1].p) : ""


  function setStyle(style) {
    if (root.service) root.service.persist({ style: style })
  }

  function setRange(range) {
    root.showingHelp = false
    if (root.service) root.service.persist({ range: range })
  }

  function stepRange(delta) {
    root.setRange(History.steppedRange(root.range, delta))
  }

  function toggleHelp() {
    root.showingHelp = !root.showingHelp
    if (root.showingHelp) helpSheet.contentY = 0
  }

  function moveCursor(delta) {
    var at = root.shownRows.indexOf(root.cursorRow)
    root.cursorSymbol = root.shownRows[Math.max(0, Math.min(root.shownRows.length - 1, at + delta))] || ""
    rows.positionViewAtIndex(root.shownRows.indexOf(root.cursorSymbol), ListView.Contain)
  }

  // ---- Order ----

  function cycleOrder() {
    root.showingHelp = false
    if (root.service) root.service.setOrder(Settings.nextOrder(root.order))
  }

  // Manual has no direction: there it does nothing at all.
  function reverseOrder() {
    if (root.manualOrder) return
    root.showingHelp = false
    if (root.service) root.service.reverseOrder()
  }

  // A row moves only in manual order: a sort would put it straight back.
  function moveSelected(delta) {
    root.showingHelp = false
    if (!root.manualOrder) {
      root.say("Switch to manual order to move rows")
      return
    }
    var symbol = root.cursorRow
    var from = root.shownRows.indexOf(symbol)
    var to = from + delta
    if (from < 0 || to < 0 || to >= root.shownRows.length) return
    root.service.setManualOrder(Settings.movedSymbols(root.shownRows, from, to))
    root.cursorSymbol = symbol
    rows.positionViewAtIndex(to, ListView.Contain)
  }

  // The row the pointer carries, where it is drawn in the list's content,
  // the slot it would drop into, and where the pointer took it.
  property string dragSymbol: ""
  property real dragY: 0
  property int dragTarget: -1
  property real dragOffset: 0

  // Where a row sits while one is carried: the rows between the carried
  // row's slot and its target shift one place to make room.
  function slotOf(symbol) {
    var i = root.shownRows.indexOf(symbol)
    if (root.dragSymbol === "") return i
    var from = root.shownRows.indexOf(root.dragSymbol)
    if (from < root.dragTarget && i > from && i <= root.dragTarget) return i - 1
    if (root.dragTarget < from && i >= root.dragTarget && i < from) return i + 1
    return i
  }

  function beginDrag(symbol, y) {
    if (!root.manualOrder) {
      root.say("Switch to manual order to move rows")
      return
    }
    var from = root.shownRows.indexOf(symbol)
    if (from < 0) return
    root.showingHelp = false
    root.cursorSymbol = symbol
    root.dragOffset = y - from * root.rowPitch
    root.dragY = from * root.rowPitch
    root.dragTarget = from
    root.dragSymbol = symbol
  }

  function dragTo(y) {
    if (root.dragSymbol === "") return
    root.dragY = Math.max(0, Math.min((root.shownRows.length - 1) * root.rowPitch, y - root.dragOffset))
    root.dragTarget = Math.round(root.dragY / root.rowPitch)
  }

  function endDrag() {
    var from = root.shownRows.indexOf(root.dragSymbol)
    var to = root.dragTarget
    var moved = from >= 0 && to >= 0 && from !== to ? Settings.movedSymbols(root.shownRows, from, to) : null
    root.cancelDrag()
    if (moved && root.service) root.service.setManualOrder(moved)
  }

  function cancelDrag() {
    root.dragSymbol = ""
    root.dragTarget = -1
  }

  function feature(symbol) {
    root.cancelAdding()
    if (root.service && symbol) root.service.feature(symbol)
  }

  // ---- Search, removal and undo ----

  // The list to search is asked for as search opens, unless one is fresh.
  function startAdding() {
    root.showingHelp = false
    root.listMenuOpen = false
    root.closeListViews()
    root.clearNote()
    root.adding = true
    if (root.service) root.service.symbolList.want()
  }

  function cancelAdding() {
    root.adding = false
    previewWait.stop()
    if (root.service) root.service.preview("")
  }

  // ---- Lists ----

  function openListMenu() {
    root.cancelAdding()
    root.closeListViews()
    root.showingHelp = false
    root.listMenuOpen = true
  }

  function closeListMenu() {
    root.listMenuOpen = false
  }

  function chooseList(name) {
    root.closeListMenu()
    if (root.service && name !== root.listName) root.service.switchList(name)
  }

  // A new list is empty, so search opens straight away to fill it.
  function createList(name) {
    if (!root.service) return
    var problem = root.service.createList(name)
    if (problem !== "") {
      listMenu.problem = problem
      return
    }
    root.startAdding()
  }

  function stepList(delta) {
    root.showingHelp = false
    if (root.service) root.service.stepList(delta)
  }

  function openManageLists() {
    root.closeListMenu()
    root.cancelAdding()
    root.showingHelp = false
    root.listsSymbol = ""
    root.managingLists = true
  }

  function openSymbolLists(symbol) {
    if (!symbol) return
    root.closeListMenu()
    root.cancelAdding()
    root.showingHelp = false
    root.managingLists = false
    root.listsSymbol = symbol
  }

  function closeListViews() {
    root.managingLists = false
    root.listsSymbol = ""
  }

  function renameList(name, newName) {
    if (!root.service) return
    var problem = root.service.renameList(name, newName)
    if (problem !== "") manageLists.problem = problem
    else manageLists.stopEditing()
  }

  // Unticking All is a removal from All: its last symbol stays, and the
  // symbol it takes away has no lists left to show.
  function setMembership(name, member) {
    if (!root.service) return
    if (name === "" && !member && !Settings.canRemove(root.library)) {
      root.say("Keep at least one symbol")
      return
    }
    var symbol = root.listsSymbol
    root.service.setMembership(symbol, name, member, root.shownRows)
    if (name === "" && !member) {
      root.closeListViews()
      root.offerUndo(symbol, "")
    }
  }

  // The hero follows search's choice after a moment's pause, so typing and
  // the arrows ask for a quote only for the choice they stop on.
  property string chosen: ""
  function previewTo(symbol) {
    root.chosen = symbol
    previewWait.restart()
  }
  Timer {
    id: previewWait
    interval: 250
    onTriggered: if (root.adding && root.service) root.service.preview(root.chosen)
  }

  // A result already in the list on show is shown, as a click on its row
  // shows it; a new one is added, to the list and All, and featured, and the
  // rows bring it into view.
  function acceptSymbol(symbol) {
    if (!root.service || !symbol) return
    var member = root.listSymbols.indexOf(symbol) >= 0
    root.cancelAdding()
    if (member) root.service.feature(symbol)
    else root.service.addSymbol(symbol)
    root.cursorSymbol = ""
    Qt.callLater(function() { rows.positionViewAtIndex(root.shownRows.indexOf(symbol), ListView.Contain) })
  }

  // Every removal comes through here, from a key or a click, so All's last
  // row's refusal is said once, in the footer. A named list may empty. Removing the row the cursor
  // is on hands the cursor to the row that takes its place, as Mail and
  // Finder do: the next row, or the one before when it was the last.
  function removeRow(symbol) {
    root.showingHelp = false
    if (!root.service || !symbol) return
    if (root.listName === "" && !Settings.canRemove(root.library)) {
      root.say("Keep at least one symbol")
      return
    }
    var shown = root.shownRows
    var at = shown.indexOf(symbol)
    var successor = symbol === root.cursorSymbol && at >= 0 ? (shown[at + 1] || shown[at - 1] || "") : ""
    root.service.removeSymbol(symbol, shown)
    root.cursorSymbol = successor
    root.offerUndo(symbol, root.listName)
  }

  function say(text) {
    root.offered = null
    root.note = text
    root.holdNote()
  }

  // A removal is instant and needs no confirm, and the row may be off
  // screen, so the footer names what went and offers it back. `u` takes it
  // back until the next add, long after the note has gone.
  function offerUndo(symbol, from) {
    root.offered = root.removal
    root.note = "Removed " + symbol + (from !== "" ? " from " + from : "")
    root.holdNote()
  }

  function undoRemoval() {
    root.showingHelp = false
    if (!root.removal) {
      root.say("Nothing to undo")
      return
    }
    var symbol = root.removal.symbol
    root.clearNote()
    root.service.undoRemoval()
    root.cursorSymbol = symbol
    rows.positionViewAtIndex(root.shownRows.indexOf(symbol), ListView.Contain)
  }

  // The note's moment starts again, and waits while the pointer is on it,
  // so it never turns into the add under a click on its way.
  function holdNote() {
    noteFade.stop()
    root.noteShown = 1
    if (root.note !== "" && root.surfaceOpen && !footer.hovered) noteTimer.restart()
    else noteTimer.stop()
  }

  function clearNote() {
    noteTimer.stop()
    noteFade.stop()
    root.noteShown = 1
    root.note = ""
    root.offered = null
  }

  // The footer's click acts on what it shows: an undo offer undoes, else it
  // opens search.
  function footerClicked() {
    if (root.offered !== null) root.undoRemoval()
    else root.startAdding()
  }

  // A refusal stays a moment; an offer to undo long enough to act on it.
  // Its last 600 ms it fades, still taking a click while any of it shows,
  // and what it covered fades in after it, so the change under a click is
  // seen coming.
  property real noteShown: 1
  Timer {
    id: noteTimer
    interval: (root.offered !== null ? 5000 : 2500) - noteFade.duration
    onTriggered: noteFade.start()
  }
  NumberAnimation {
    id: noteFade
    target: root
    property: "noteShown"
    from: 1
    to: 0
    duration: 600
    onFinished: {
      root.clearNote()
      footer.fadeIn()
    }
  }

  function cycleChangeMode() {
    if (root.service) root.service.persist({ changeMode: root.changeMode === "pct" ? "abs" : "pct" })
  }

  // ---- What the surface asks of the body ----

  // The height the body wants: its column, or the list menu and the footer
  // under it when the menu hangs lower.
  readonly property real wantedHeight: Math.max(body.implicitHeight,
    listMenuOpen ? listMenu.y + listMenu.height + groupGap + footer.height : 0)
  // What the column holds besides the rows, while the rows show: the window
  // gives the rest of its height to the rows (`rowsRoom`).
  property real chromeHeight: 0
  function measureChrome() {
    if (rowsBlock.visible && body.implicitHeight > 0) root.chromeHeight = body.implicitHeight - rows.height
  }
  Connections {
    target: body
    function onImplicitHeightChanged() { root.measureChrome() }
    function onVisibleChanged() { root.measureChrome() }
  }
  onShownCountChanged: measureChrome()
  Component.onCompleted: measureChrome()

  // The views reset as the surface opens, before its first frame, not as it
  // closes: the card fades out showing what you were looking at.
  function resetInteraction() {
    root.cursorSymbol = ""
    root.showingHelp = false
    root.cancelAdding()
    root.listMenuOpen = false
    root.closeListViews()
    root.clearNote()
    footer.settle()
    listLine.settle()
    root.cancelDrag()
    rowPointer.rest()
    rows.positionViewAtIndex(Math.max(0, root.shownRows.indexOf(root.featured)), ListView.Contain)
    motion.reset()
    header.settle()
    motion.revealChart()
  }

  function freeze() {
    motion.freeze()
    root.cancelAdding()
    root.listMenuOpen = false
    root.cancelDrag()
    noteTimer.stop()
  }

  // Escape hides the key sheet first, then lets go of a scrub, then asks the
  // surface to close; any other key acts, and hides the sheet so what it does
  // shows.
  function escapeKey() {
    if (root.showingHelp) root.showingHelp = false
    else if (root.adding) root.cancelAdding()
    else if (motion.scrubT) motion.clearScrub()
    else root.closeRequested()
  }

  function moveKeys(dx, dy) {
    root.showingHelp = false
    if (dy !== 0) root.moveCursor(dy)
    if (dx !== 0) motion.nudgeScrub(dx)
  }

  function activate() {
    root.showingHelp = false
    root.feature(root.cursorRow)
  }

  function deleteKey() { root.removeRow(root.cursorRow) }

  // The letters are read whatever Caps Lock says: no key here tells a
  // capital from its letter. Shift is read from the modifiers, so O, J and K
  // mean the same with Caps Lock on or off.
  function textKey(text, modifiers) {
    var t = text.toLowerCase()
    var shifted = !!(modifiers & Qt.ShiftModifier)
    if (t === "?") {
      root.toggleHelp()
      return
    }
    root.showingHelp = false
    if (t === "c") root.cycleChangeMode()
    else if (t === "[") root.stepRange(-1)
    else if (t === "]") root.stepRange(1)
    else if (t === "p") motion.replay()
    else if (t === "s") root.setStyle(root.retro ? "smooth" : "retro")
    else if (t === "r" && root.service) root.service.refresh()
    else if (t === "a" || t === "+") root.startAdding()
    else if (t === "x") root.removeRow(root.cursorRow)
    else if (t === "u") root.undoRemoval()
    else if (t === "o") shifted ? root.reverseOrder() : root.cycleOrder()
    else if (t === "w") shifted ? root.openManageLists() : root.openListMenu()
    else if (t === "m") root.openSymbolLists(root.cursorRow)
    else if (t === ",") root.stepList(-1)
    else if (t === ".") root.stepList(1)
    else if (t === "j" && shifted) root.moveSelected(1)
    else if (t === "k" && shifted) root.moveSelected(-1)
    else if (t >= "1" && t <= "9") root.feature(root.shownRows[Number(t) - 1])
  }

  ChartMotion {
    id: motion
    quote: root.quote
    range: root.range
    history: root.history
    surfaceOpen: root.surfaceOpen
  }

  // The Column and the list menu.
  Column {
    id: body
    x: root.edge
    width: parent.width - 2 * root.edge
    spacing: root.bandGap

    // The header stands a group's gap over the hero it heads.
    Column {
      width: parent.width
      spacing: root.groupGap

      HeaderStatus {
        id: header
        width: parent.width
        statusText: root.statusText
        retro: root.retro
        animal: ({ kind: root.view ? Figures.animalKind(root.view.daySign) : "", chart: root.symbol })
        scrubbing: root.scrubT !== 0
        live: root.live
        still: !root.surfaceOpen
        foreground: root.foreground
        dim: root.dim
        upColor: root.upColor
        downColor: root.downColor
        fontFamily: root.fontFamily
        onReplayRequested: motion.replay()
        onStyleRequested: function(style) { root.setStyle(style) }
        onHelpRequested: root.toggleHelp()
      }

      Hero {
        visible: !root.showingHelp
        width: parent.width
        symbol: root.symbol
        quote: root.quote
        view: root.view
        scrubbing: root.scrubT !== 0
        retro: root.retro
        ghost: root.ghost
        missingText: root.problem !== "" ? "—" : "…"
        baselineText: root.baselineText
        changeCycles: root.onDay
        foreground: root.foreground
        dim: root.dim
        upColor: root.upColor
        downColor: root.downColor
        fontFamily: root.fontFamily
        onChangeClicked: root.cycleChangeMode()
      }

      HelpSheet {
        id: helpSheet
        visible: root.showingHelp
        width: parent.width
        height: contentHeight
        sheet: KeySheet.sheet(root.order)
        retro: root.retro
        foreground: root.foreground
        dim: root.dim
        fontFamily: root.fontFamily
        edge: Style.space(6)
        onCloseRequested: root.showingHelp = false
      }
    }

    Item {
      visible: !root.showingHelp
      width: parent.width
      height: root.chartHeight

      DayChart {
        id: dayChart
        visible: !root.retro
        anchors.fill: parent
        // The hidden look rests: it draws nothing until it shows, so a
        // new chart paints once, in the look on screen, and it neither
        // draws in nor follows the scrub.
        geometry: root.retro ? null : motion.geometry
        up: root.view && root.view.daySign !== 0 ? root.view.daySign > 0 : true
        upColor: root.upColor
        downColor: root.downColor
        baselineColor: root.dimmer
        hairlineColor: root.foreground
        ground: root.ground
        scrubX: root.retro ? -1 : motion.scrubX
        reveal: root.retro ? 1 : motion.reveal
        replayX: root.retro ? -1 : motion.replayX
        live: root.live && !root.retro && root.onDay
        newestPrice: root.newestPrice
        surfaceOpen: root.surfaceOpen
        still: !root.surfaceOpen
      }

      PixelChart {
        visible: root.retro
        anchors.fill: parent
        geometry: root.retro ? motion.geometry : null
        up: root.view && root.view.daySign !== 0 ? root.view.daySign > 0 : true
        upColor: root.upColor
        downColor: root.downColor
        baselineColor: root.dimmer
        glow: true
        live: root.live && root.retro && root.onDay
        newestPrice: root.newestPrice
        surfaceOpen: root.surfaceOpen
        still: !root.surfaceOpen
        hairlineColor: root.foreground
        ghostColor: root.ghost
        ground: root.ground
        scrubX: root.retro ? motion.scrubX : -1
        reveal: root.retro ? motion.reveal : 1
        replayX: root.retro ? motion.replayX : -1
      }

      // The pointer reads the chart where it is drawn; a click goes back
      // to now.
      MouseArea {
        anchors.fill: parent
        hoverEnabled: true
        onPositionChanged: function(mouse) {
          if (!motion.replayRunning) motion.scrubTo(root.retro ? mouse.x / width : dayChart.fractionAt(mouse.x))
        }
        onExited: if (!motion.replayRunning) motion.clearScrub()
        onClicked: motion.clearScrub()
      }
    }

    // The chart's range, from the day to all of the symbol's life.
    RangeSelector {
      visible: !root.showingHelp
      width: parent.width
      options: History.RANGES
      value: root.range
      retro: root.retro
      foreground: root.foreground
      dim: root.dim
      fontFamily: root.fontFamily
      onSelected: function(value) { root.setRange(value) }
    }

    // The period and the 52 weeks: two lines that are always there, so
    // the rows keep their place for every symbol and range.
    InfoTable {
      visible: !root.showingHelp
      width: parent.width
      height: implicitHeight
      lines: [root.periodLine, root.yearLine]
      titles: History.RANGES.map(function(r) { return r.toUpperCase() }).concat(["52W"])
      factLists: root.infoFactLists
      retro: root.retro
      foreground: root.foreground
      dim: root.dim
      upColor: root.upColor
      downColor: root.downColor
      fontFamily: root.fontFamily
    }

    // The list's name and its order, a group's gap over the rows.
    Column {
      id: rowsBlock
      visible: !root.showingHelp && !root.adding && !root.listViewOpen
      width: parent.width
      spacing: root.groupGap

      ListLine {
        id: listLine
        width: parent.width
        listLabel: root.listLabel
        // The rows' figures at the moment on screen, the scrub's too.
        breadth: Object.assign({ list: root.listName },
          Figures.listBreadth(root.shownRows, root.service ? root.service.quotes : {}, root.dayScrubT, root.changeMode))
        still: !root.surfaceOpen
        upColor: root.upColor
        downColor: root.downColor
        onListClicked: root.listMenuOpen ? root.closeListMenu() : root.openListMenu()
        order: root.order
        reversed: root.reversed
        retro: root.retro
        foreground: root.foreground
        dim: root.dim
        fontFamily: root.fontFamily
        onOrderClicked: root.cycleOrder()
        onOrderReverseClicked: root.reverseOrder()
      }

      // The rows of All, up to six whole rows; the wheel scrolls more.
      // They show the day at the moment on screen, so a scrub moves them
      // with the hero.
      ListView {
        id: rows
        width: parent.width
        // An empty named list keeps one row, which says so.
        height: root.shownCount * root.rowPitch - root.rowGap
        clip: true
        spacing: root.rowGap
        boundsBehavior: Flickable.StopAtBounds
        // A carried row is held where the pointer is, not scrolled away.
        interactive: root.dragSymbol === ""
        model: root.shownRows

      Text {
        visible: root.shownRows.length === 0
        anchors.centerIn: parent
        textFormat: Text.PlainText
        text: "No symbols in " + root.listLabel + " yet"
        color: root.dim
        font.family: root.fontFamily
        font.pixelSize: Style.font.bodySmall
      }
      // The rows shown again, behind search or the key sheet before: the
      // pointer resting over them is no move (RowPointer.rest).
      onVisibleChanged: if (visible) rowPointer.rest()

      // The cursor to the row the pointer really moved onto. A carried
      // row is the drag's, so the pointer moves no cursor then.
      RowPointer {
        id: rowPointer
        onMoved: function(x, y) {
          if (!root.surfaceOpen || root.dragSymbol !== "") return
          var seen = rows.mapFromItem(null, x, y)
          var at = rows.indexAt(seen.x + rows.contentX, seen.y + rows.contentY)
          if (at >= 0) root.cursorSymbol = root.shownRows[at]
        }
      }

        delegate: WatchlistRow {
          id: rowItem
          required property string modelData
          required property int index
          readonly property bool carried: modelData === root.dragSymbol
          z: carried ? 2 : 0
          lifted: carried
          // The carried row follows the pointer, the rest slide aside to
          // make room; the drop rebuilds them in their new order.
          transform: Translate {
            y: rowItem.carried ? root.dragY - rowItem.index * root.rowPitch
              : (root.slotOf(rowItem.modelData) - rowItem.index) * root.rowPitch
            Behavior on y {
              enabled: root.dragSymbol !== "" && !rowItem.carried
              NumberAnimation { duration: 160; easing.type: Easing.OutCubic }
            }
          }
          symbol: modelData
          width: rows.width
          quote: root.service ? root.service.quotes[modelData] || null : null
          view: quote ? Figures.heroView(quote, root.dayScrubT, root.changeMode) : null
          problem: root.service ? root.service.problems[modelData] || "" : ""
          featuredRow: modelData === root.featured
          cursor: modelData === root.cursorRow
          removable: modelData === root.cursorSymbol
          retro: root.retro
          scrubX: root.onDay ? motion.scrubX : -1
          ground: root.ground
          foreground: root.foreground
          dim: root.dim
          dimmer: root.dimmer
          upColor: root.upColor
          downColor: root.downColor
          fontFamily: root.fontFamily
            onFeatureRequested: root.feature(modelData)
          onRemoveRequested: root.removeRow(modelData)
        onListsRequested: root.openSymbolLists(modelData)
          onDragStarted: function(y) { root.beginDrag(modelData, y) }
          onDragMoved: function(y) { root.dragTo(y) }
          onDragEnded: root.endDrag()
          onDragCanceled: root.cancelDrag()
        }
      }
    }

    // Search, in the rows' and the footer's place, with the room for a
    // full answer.
    SymbolSearch {
      id: search
      visible: root.adding && !root.showingHelp
      active: root.adding && root.surfaceOpen
      width: parent.width
      height: desiredHeight
      instruments: root.service ? root.service.symbolList.instruments : []
      listStatus: root.service ? root.service.symbolList.status : ""
      quoteCoin: Bybit.QUOTE_COIN
      members: root.listSymbols
      retro: root.retro
      foreground: root.foreground
      dim: root.dim
      fontFamily: root.fontFamily
      onChose: function(symbol) { root.previewTo(symbol) }
      onPicked: function(symbol) { root.acceptSymbol(symbol) }
      onCancelled: root.cancelAdding()
      onRetryRequested: if (root.service) root.service.symbolList.retry()
    }

    ManageLists {
      id: manageLists
      visible: root.managingLists && !root.showingHelp
      active: root.managingLists && root.surfaceOpen
      width: parent.width
      height: contentHeight
      choices: root.service ? root.service.lists : []
      retro: root.retro
      foreground: root.foreground
      dim: root.dim
      fontFamily: root.fontFamily
      onRenameRequested: function(name, newName) { root.renameList(name, newName) }
      onMoveRequested: function(name, delta) { if (root.service) root.service.moveList(name, delta) }
      onDeleteRequested: function(name) { if (root.service) root.service.deleteList(name) }
      onDismissed: root.closeListViews()
    }

    SymbolLists {
      id: symbolLists
      visible: root.listsSymbol !== "" && !root.showingHelp
      active: root.listsSymbol !== "" && root.surfaceOpen
      width: parent.width
      height: contentHeight
      choices: root.service ? root.service.lists : []
      symbol: root.listsSymbol
      symbolName: root.service && root.service.quotes[root.listsSymbol] ? root.service.quotes[root.listsSymbol].name : ""
      note: root.note
      retro: root.retro
      foreground: root.foreground
      dim: root.dim
      fontFamily: root.fontFamily
      onToggled: function(name, member) { root.setMembership(name, member) }
      onDismissed: root.closeListViews()
    }

    AddFooter {
      id: footer
      visible: !root.showingHelp && !root.adding && !root.listViewOpen
      width: parent.width
      retro: root.retro
      foreground: root.foreground
      dim: root.dim
      fontFamily: root.fontFamily
      note: root.note
      noteAction: root.offered !== null ? " · click to undo" : ""
      noteOpacity: root.noteShown
      onClicked: root.footerClicked()
      onHoveredChanged: if (root.note !== "") root.holdNote()
    }
  }


  // A click anywhere off the open menu closes it, and nothing under it
  // acts, not even to a resting pointer: the chart would scrub. While a
  // new list's name is typed, it keeps the name as Enter does: the list
  // is made, or the menu stays open saying why not; an empty field just
  // closes.
  MouseArea {
    anchors.fill: parent
    visible: root.listMenuOpen
    hoverEnabled: true
    z: 9
    onClicked: listMenu.typedName.trim() !== "" ? root.createList(listMenu.typedName) : root.closeListMenu()
    onWheel: function(wheel) { wheel.accepted = true }
  }

  // Under the list's name, over the rows; the card makes room for it
  // and the footer under it (`wantedHeight`).
  ListMenu {
    id: listMenu
    visible: root.listMenuOpen
    active: root.listMenuOpen && root.surfaceOpen
    z: 10
    x: root.edge
    y: rowsBlock.y + listLine.y + listLine.height + Style.space(4)
    choices: root.service ? root.service.lists : []
    current: root.listName
    retro: root.retro
    foreground: root.foreground
    dim: root.dim
    fontFamily: root.fontFamily
    onChosen: function(name) { root.chooseList(name) }
    onCreateRequested: function(name) { root.createList(name) }
    onManageRequested: root.openManageLists()
    onDismissed: root.closeListMenu()
  }
}
