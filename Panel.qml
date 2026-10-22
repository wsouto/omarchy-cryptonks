// Adapted from Stonks by Gaurav Chande (MIT), omarchy-stonks v1.0.2,
// Panel.qml and the hero and rows of StonksBody.qml and Watchlist.qml.
// Changes: the body is the header, the hero, the day chart, the rows of
// All, search and the footer, built here, and the key sheet in their place;
// the lists, ranges and statuses come in roadmap steps 8c to 11, with the
// keys that drive them. The rows are a ListView whose rows a drag shifts in
// place, so the row under the pointer is never rebuilt mid-drag. An add is featured at once, so there is no
// landing to wait for. The change has two modes, percent and amount, both
// since 00:00 UTC.
pragma ComponentBehavior: Bound

import QtQuick
import qs.Commons
import qs.Commons as Commons
import qs.Ui
import "Figures.js" as Figures
import "Settings.js" as Settings
import "Format.js" as Format
import "KeySheet.js" as KeySheet
import "Tones.js" as Tones
import "adapters/bybit.js" as Bybit

// The popup. Owns its lifecycle, keys, the rows' cursor, and what the hero
// and the rows show at the moment on screen; the chart's motion is `ChartMotion`'s, the data and the saved
// look and change mode the service's.
Panel {
  id: root
  moduleName: "wsouto.crypto-stonks"
  ipcTarget: "wsouto.crypto-stonks"
  manageIpc: false

  property var anchorItem: null
  property var hostWidget: null
  // The plugin's `Service` and `TrendColors`.
  property var service: null
  property var trendColors: null
  readonly property var barIdentity: hostWidget || root
  readonly property int panelWidth: Style.space(480)
  readonly property int chartHeight: Style.space(190)
  // Between the band's blocks, and between the header and what it heads.
  readonly property int bandGap: Style.space(16)
  readonly property int groupGap: Style.space(8)

  // The hero's symbol: search's choice while search is open, else the
  // featured one, which the pill shows whatever the popup previews.
  readonly property string symbol: service ? service.previewSymbol || service.featured : ""
  readonly property var quote: service ? service.quotes[symbol] || null : null
  readonly property string problem: service ? service.problems[symbol] || "" : ""
  readonly property string featured: service ? service.featured : ""
  // All, in its manual order, and the rows: All in its order.
  readonly property var library: service ? service.library : []
  readonly property string order: service ? service.order : "manual"
  readonly property bool reversed: !!service && service.reversed
  readonly property bool manualOrder: order === "manual"
  readonly property var shownRows: service ? Settings.sortedSymbols(library, service.quotes, order, reversed) : []
  readonly property int rowPitch: Style.space(40) + rowGap
  // The rows show up to six whole rows; more scroll.
  readonly property int maxRows: 6
  readonly property int rowGap: Style.space(2)
  // The one cursor the keys and the pointer both move, as in the shell's own
  // panels: the row you put it on, else the featured row.
  property string cursorSymbol: ""
  // The key sheet shows in the place of the hero, the chart and the rows.
  property bool showingHelp: false
  readonly property string cursorRow: shownRows.indexOf(cursorSymbol) >= 0 ? cursorSymbol : featured
  // Search is open in the rows' place, with the hero on its choice.
  property bool adding: false
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
  readonly property int scrubT: motion.scrubT
  readonly property var view: quote ? Figures.heroView(quote, scrubT, changeMode) : null
  // Live is honest only while refreshes land, the quote is this session's
  // own, and the moment shown is now.
  readonly property bool live: !!quote && !!service && !!service.freshness[symbol] && problem === "" && !scrubT
  readonly property string statusText: scrubT && view && view.time !== null ? "At " + Format.utcClock(view.time) + " UTC"
    : problem !== "" ? "! " + problem
    : quote ? "Live" : ""
  readonly property string baselineText: quote && typeof quote.dayOpen === "number"
    ? "OPEN 00:00 UTC " + Format.money(quote.dayOpen, quote.priceDigits) : ""

  // The card's colour, opaque whatever the theme's popup alpha.
  readonly property color ground: Qt.rgba(Commons.Color.popups.background.r, Commons.Color.popups.background.g, Commons.Color.popups.background.b, 1)
  readonly property color foreground: root.bar ? root.bar.foreground : Commons.Color.foreground
  readonly property string fontFamily: root.bar ? root.bar.fontFamily : Style.font.family
  readonly property color upColor: trendColors ? trendColors.upOn(ground) : Commons.Color.foreground
  readonly property color downColor: trendColors ? trendColors.downOn(ground) : Commons.Color.urgent
  readonly property color dim: Tones.dim(foreground, ground)
  readonly property color dimmer: Tones.dimmer(foreground, ground)
  readonly property color ghost: Qt.rgba(foreground.r, foreground.g, foreground.b, 0.05)
  readonly property string newestPrice: quote && quote.points.length ? String(quote.points[quote.points.length - 1].p) : ""

  // The card's place along the bar, held from an open from closed until the
  // next; an open during the close fade keeps it, since the card is still on
  // screen.
  HeldAnchor {
    id: heldAnchor
    pill: root.anchorItem
  }

  // The views reset as the popup opens, before its first frame, not as it
  // closes: the card fades out showing what you were looking at.
  function open() {
    var opening = !root.opened
    var fading = opening && panel.visible
    root.controller.show()
    if (root.service) root.service.popupOpen = true
    if (opening) {
      if (!fading) heldAnchor.hold()
      root.cursorSymbol = ""
      root.showingHelp = false
      root.cancelAdding()
      root.clearNote()
      footer.settle()
      root.cancelDrag()
      rows.positionViewAtIndex(Math.max(0, root.shownRows.indexOf(root.featured)), ListView.Contain)
      motion.reset()
      header.settle()
      motion.revealChart()
    }
    Qt.callLater(function() { if (root.opened) setCenterHoverRevealSuppressed(true) })
  }

  function close() {
    setCenterHoverRevealSuppressed(false)
    motion.freeze()
    root.cancelAdding()
    root.cancelDrag()
    noteTimer.stop()
    if (root.service) root.service.popupOpen = false
    root.controller.hide()
  }

  function toggle() {
    if (root.opened) root.close()
    else root.open()
  }

  function switchPanel(direction) {
    if (root.bar && typeof root.bar.switchPanelFrom === "function")
      return root.bar.switchPanelFrom(root.barIdentity, direction)
    return false
  }

  function setCenterHoverRevealSuppressed(value) {
    if (root.bar && typeof root.bar.setCenterHoverRevealSuppressed === "function")
      root.bar.setCenterHoverRevealSuppressed(value)
  }

  function setStyle(style) {
    if (root.service) root.service.persist({ style: style })
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
    root.clearNote()
    root.adding = true
    if (root.service) root.service.symbolList.want()
  }

  // The keys go back to the popup's own handler: the field held them.
  function cancelAdding() {
    var was = root.adding
    root.adding = false
    previewWait.stop()
    if (root.service) root.service.preview("")
    if (was) Qt.callLater(function() { if (root.opened) keyCatcher.forceActiveFocus() })
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

  // A result already in All is shown, as a click on its row shows it; a new
  // one is added and featured, and the rows bring it into view.
  function acceptSymbol(symbol) {
    if (!root.service || !symbol) return
    var member = root.library.indexOf(symbol) >= 0
    root.cancelAdding()
    if (member) root.service.feature(symbol)
    else root.service.addSymbol(symbol)
    root.cursorSymbol = ""
    Qt.callLater(function() { rows.positionViewAtIndex(root.shownRows.indexOf(symbol), ListView.Contain) })
  }

  // Every removal comes through here, from a key or a click, so All's last
  // row's refusal is said once, in the footer. Removing the row the cursor
  // is on hands the cursor to the row that takes its place, as Mail and
  // Finder do: the next row, or the one before when it was the last.
  function removeRow(symbol) {
    root.showingHelp = false
    if (!root.service || !symbol) return
    if (!Settings.canRemove(root.library)) {
      root.say("Keep at least one symbol")
      return
    }
    var shown = root.shownRows
    var at = shown.indexOf(symbol)
    var successor = symbol === root.cursorSymbol && at >= 0 ? (shown[at + 1] || shown[at - 1] || "") : ""
    root.service.removeSymbol(symbol, shown)
    root.cursorSymbol = successor
    root.offerUndo(symbol)
  }

  function say(text) {
    root.offered = null
    root.note = text
    root.holdNote()
  }

  // A removal is instant and needs no confirm, and the row may be off
  // screen, so the footer names what went and offers it back. `u` takes it
  // back until the next add, long after the note has gone.
  function offerUndo(symbol) {
    root.offered = root.removal
    root.note = "Removed " + symbol
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
    if (root.note !== "" && root.opened && !footer.hovered) noteTimer.restart()
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

  ChartMotion {
    id: motion
    quote: root.quote
    surfaceOpen: root.opened
  }

  KeyboardPanel {
    id: panel
    anchorItem: heldAnchor
    owner: root.barIdentity
    bar: root.bar
    open: root.opened
    focusTarget: keyCatcher
    contentWidth: panel.fittedContentWidth(root.panelWidth)
    contentHeight: panel.fittedContentHeight(body.implicitHeight)

    // Escape hides the key sheet first, then lets go of a scrub, then
    // closes; any other key acts, and hides the sheet so what it does
    // shows. The letters are read whatever Caps Lock says: no key here
    // tells a capital from its letter.
    PanelKeyCatcher {
      id: keyCatcher
      anchors.fill: parent
      clip: true
      // Ctrl+↑ ↓ and Ctrl+J K move the selected row, as the shell's panels do.
      reorderable: true
      onReorderRequested: function(dy) { root.moveSelected(dy) }
      onMoveRequested: function(dx, dy) {
        root.showingHelp = false
        if (dy !== 0) root.moveCursor(dy)
        if (dx !== 0) motion.nudgeScrub(dx)
      }
      onActivateRequested: {
        root.showingHelp = false
        root.feature(root.cursorRow)
      }
      // Search takes its own keys, Escape among them, while its field has
      // the keyboard.
      onCloseRequested: {
        if (root.showingHelp) root.showingHelp = false
        else if (root.adding) root.cancelAdding()
        else if (motion.scrubT) motion.clearScrub()
        else root.close()
      }
      onDeleteRequested: root.removeRow(root.cursorRow)
      onTabRequested: function(direction) { root.switchPanel(direction) }
      // Shift is read from the modifiers, so O, J and K mean the same with
      // Caps Lock on or off.
      onTextKey: function(text, modifiers) {
        var t = text.toLowerCase()
        var shifted = !!(modifiers & Qt.ShiftModifier)
        if (t === "?") {
          root.toggleHelp()
          return
        }
        root.showingHelp = false
        if (t === "c") root.cycleChangeMode()
        else if (t === "p") motion.replay()
        else if (t === "s") root.setStyle(root.retro ? "smooth" : "retro")
        else if (t === "r" && root.service) root.service.refresh()
        else if (t === "a" || t === "+") root.startAdding()
        else if (t === "x") root.removeRow(root.cursorRow)
        else if (t === "u") root.undoRemoval()
        else if (t === "o") shifted ? root.reverseOrder() : root.cycleOrder()
        else if (t === "j" && shifted) root.moveSelected(1)
        else if (t === "k" && shifted) root.moveSelected(-1)
        else if (t >= "1" && t <= "9") root.feature(root.shownRows[Number(t) - 1])
      }

      Column {
        id: body
        width: parent.width
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
            still: !root.opened
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
            live: root.live && !root.retro
            newestPrice: root.newestPrice
            surfaceOpen: root.opened
            still: !root.opened
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
            live: root.live && root.retro
            newestPrice: root.newestPrice
            surfaceOpen: root.opened
            still: !root.opened
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

        // The list's name and its order, a group's gap over the rows.
        Column {
          visible: !root.showingHelp && !root.adding
          width: parent.width
          spacing: root.groupGap

          ListLine {
            width: parent.width
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
            height: Math.min(root.shownRows.length, root.maxRows) * root.rowPitch - root.rowGap
            clip: true
            spacing: root.rowGap
            boundsBehavior: Flickable.StopAtBounds
            // A carried row is held where the pointer is, not scrolled away.
            interactive: root.dragSymbol === ""
            model: root.shownRows

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
              view: quote ? Figures.heroView(quote, root.scrubT, root.changeMode) : null
              problem: root.service ? root.service.problems[modelData] || "" : ""
              featuredRow: modelData === root.featured
              cursor: modelData === root.cursorRow
              removable: modelData === root.cursorSymbol
              retro: root.retro
              scrubX: motion.scrubX
              ground: root.ground
              foreground: root.foreground
              dim: root.dim
              dimmer: root.dimmer
              upColor: root.upColor
              downColor: root.downColor
              fontFamily: root.fontFamily
              onPointed: if (root.opened) root.cursorSymbol = modelData
              onFeatureRequested: root.feature(modelData)
              onRemoveRequested: root.removeRow(modelData)
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
          active: root.adding && root.opened
          width: parent.width
          height: desiredHeight
          instruments: root.service ? root.service.symbolList.instruments : []
          listStatus: root.service ? root.service.symbolList.status : ""
          quoteCoin: Bybit.QUOTE_COIN
          members: root.library
          retro: root.retro
          foreground: root.foreground
          dim: root.dim
          fontFamily: root.fontFamily
          onChose: function(symbol) { root.previewTo(symbol) }
          onPicked: function(symbol) { root.acceptSymbol(symbol) }
          onCancelled: root.cancelAdding()
          onRetryRequested: if (root.service) root.service.symbolList.retry()
        }

        AddFooter {
          id: footer
          visible: !root.showingHelp && !root.adding
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
    }
  }
}
