// Adapted from Stonks by Gaurav Chande (MIT), omarchy-stonks v1.0.2,
// Panel.qml and the hero and rows of StonksBody.qml and Watchlist.qml.
// Changes: the body is the header, the hero, the day chart and the rows of
// All, built here, and the key sheet in their place; the lists, search,
// order, ranges and footer come in roadmap steps 8 to 11, with the keys
// that drive them. The change has two
// modes, percent and amount, both since 00:00 UTC.
pragma ComponentBehavior: Bound

import QtQuick
import qs.Commons
import qs.Commons as Commons
import qs.Ui
import "Figures.js" as Figures
import "Format.js" as Format
import "KeySheet.js" as KeySheet
import "Tones.js" as Tones

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

  readonly property var quote: service ? service.quote : null
  readonly property string symbol: service ? service.featured : ""
  readonly property string problem: service ? service.problem : ""
  // All, in its manual order: the rows.
  readonly property var library: service ? service.library : []
  // The rows show up to six whole rows; more scroll.
  readonly property int maxRows: 6
  readonly property int rowGap: Style.space(2)
  // The one cursor the keys and the pointer both move, as in the shell's own
  // panels: the row you put it on, else the featured row.
  property string cursorSymbol: ""
  // The key sheet shows in the place of the hero, the chart and the rows.
  property bool showingHelp: false
  readonly property string cursorRow: library.indexOf(cursorSymbol) >= 0 ? cursorSymbol : symbol
  // The change's unit: "pct" or "abs", which c or a click on it switches.
  readonly property string changeMode: service ? service.changeMode : "pct"
  // The look, smooth or retro, which s or the look icon switches.
  readonly property bool retro: !!service && service.retro
  readonly property int scrubT: motion.scrubT
  readonly property var view: quote ? Figures.heroView(quote, scrubT, changeMode) : null
  // Live is honest only while refreshes land, the quote is this session's
  // own, and the moment shown is now.
  readonly property bool live: !!quote && !!service && service.fresh && problem === "" && !scrubT
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
      rows.positionViewAtIndex(Math.max(0, root.library.indexOf(root.symbol)), ListView.Contain)
      motion.reset()
      header.settle()
      motion.revealChart()
    }
    Qt.callLater(function() { if (root.opened) setCenterHoverRevealSuppressed(true) })
  }

  function close() {
    setCenterHoverRevealSuppressed(false)
    motion.freeze()
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
    var at = root.library.indexOf(root.cursorRow)
    root.cursorSymbol = root.library[Math.max(0, Math.min(root.library.length - 1, at + delta))] || ""
    rows.positionViewAtIndex(root.library.indexOf(root.cursorSymbol), ListView.Contain)
  }

  function feature(symbol) {
    if (root.service && symbol) root.service.feature(symbol)
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
      onMoveRequested: function(dx, dy) {
        root.showingHelp = false
        if (dy !== 0) root.moveCursor(dy)
        if (dx !== 0) motion.nudgeScrub(dx)
      }
      onActivateRequested: {
        root.showingHelp = false
        root.feature(root.cursorRow)
      }
      onCloseRequested: {
        if (root.showingHelp) root.showingHelp = false
        else if (motion.scrubT) motion.clearScrub()
        else root.close()
      }
      onTabRequested: function(direction) { root.switchPanel(direction) }
      onTextKey: function(text) {
        var t = text.toLowerCase()
        if (t === "?") {
          root.toggleHelp()
          return
        }
        root.showingHelp = false
        if (t === "c") root.cycleChangeMode()
        else if (t === "p") motion.replay()
        else if (t === "s") root.setStyle(root.retro ? "smooth" : "retro")
        else if (t === "r" && root.service) root.service.refresh()
        else if (t >= "1" && t <= "9") root.feature(root.library[Number(t) - 1])
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
            sheet: KeySheet.sheet()
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

        // The rows of All, up to six whole rows; the wheel scrolls more.
        // They show the day at the moment on screen, so a scrub moves them
        // with the hero.
        ListView {
          id: rows
          visible: !root.showingHelp
          width: parent.width
          height: Math.min(root.library.length, root.maxRows) * (Style.space(40) + root.rowGap) - root.rowGap
          clip: true
          spacing: root.rowGap
          boundsBehavior: Flickable.StopAtBounds
          model: root.library

          delegate: WatchlistRow {
            required property string modelData
            symbol: modelData
            width: rows.width
            quote: root.service ? root.service.quotes[modelData] || null : null
            view: quote ? Figures.heroView(quote, root.scrubT, root.changeMode) : null
            problem: root.service ? root.service.problems[modelData] || "" : ""
            featuredRow: modelData === root.symbol
            cursor: modelData === root.cursorRow
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
          }
        }
      }
    }
  }
}
