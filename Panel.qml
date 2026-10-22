// Adapted from Stonks by Gaurav Chande (MIT), omarchy-stonks v1.0.2,
// Panel.qml and the hero part of StonksBody.qml. Changes: one symbol, the
// pill's feed, so the body is the header, the hero and the day chart, built
// here; the rows, lists, search, ranges, key sheet and footer come in
// roadmap steps 7 to 11, with the keys that drive them. The change has two
// modes, percent and amount, both since 00:00 UTC, kept until the shell
// restarts (the saved settings come in step 7).
pragma ComponentBehavior: Bound

import QtQuick
import qs.Commons
import qs.Commons as Commons
import qs.Ui
import "Figures.js" as Figures
import "Format.js" as Format
import "Tones.js" as Tones

// The popup. Owns its lifecycle, keys, and what the hero shows at the moment
// on screen; the chart's motion is `ChartMotion`'s, the data the feed's.
Panel {
  id: root
  moduleName: "wsouto.crypto-stonks"
  ipcTarget: "wsouto.crypto-stonks"
  manageIpc: false

  property var anchorItem: null
  property var hostWidget: null
  // The pill's `PriceFeed` and `TrendColors`.
  property var feed: null
  property var trendColors: null
  readonly property var barIdentity: hostWidget || root
  readonly property int panelWidth: Style.space(480)
  readonly property int chartHeight: Style.space(190)
  // Between the band's blocks, and between the header and what it heads.
  readonly property int bandGap: Style.space(16)
  readonly property int groupGap: Style.space(8)

  readonly property var quote: feed ? feed.quote : null
  readonly property string symbol: feed ? feed.symbol : ""
  readonly property string problem: feed ? feed.problem : ""
  // The change's unit: "pct" or "abs", which c or a click on it switches.
  property string changeMode: "pct"
  readonly property int scrubT: motion.scrubT
  readonly property var view: quote ? Figures.heroView(quote, scrubT, changeMode) : null
  // Live is honest only while refreshes land and the moment shown is now.
  readonly property bool live: !!quote && problem === "" && !scrubT
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
    if (opening) {
      if (!fading) heldAnchor.hold()
      motion.reset()
      header.settle()
      motion.revealChart()
    }
    Qt.callLater(function() { if (root.opened) setCenterHoverRevealSuppressed(true) })
  }

  function close() {
    setCenterHoverRevealSuppressed(false)
    motion.freeze()
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

  function cycleChangeMode() {
    root.changeMode = root.changeMode === "pct" ? "abs" : "pct"
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

    // Escape lets go of a scrub first, then closes. The letters are read
    // whatever Caps Lock says: no key here tells a capital from its letter.
    PanelKeyCatcher {
      id: keyCatcher
      anchors.fill: parent
      clip: true
      onMoveRequested: function(dx, dy) { if (dx !== 0) motion.nudgeScrub(dx) }
      onCloseRequested: {
        if (motion.scrubT) motion.clearScrub()
        else root.close()
      }
      onTabRequested: function(direction) { root.switchPanel(direction) }
      onTextKey: function(text) {
        var t = text.toLowerCase()
        if (t === "c") root.cycleChangeMode()
        else if (t === "p") motion.replay()
        else if (t === "r" && root.feed) root.feed.refresh()
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
          }

          Hero {
            width: parent.width
            symbol: root.symbol
            quote: root.quote
            view: root.view
            scrubbing: root.scrubT !== 0
            missingText: root.problem !== "" ? "—" : "…"
            baselineText: root.baselineText
            foreground: root.foreground
            dim: root.dim
            upColor: root.upColor
            downColor: root.downColor
            fontFamily: root.fontFamily
            onChangeClicked: root.cycleChangeMode()
          }
        }

        Item {
          width: parent.width
          height: root.chartHeight

          DayChart {
            id: dayChart
            anchors.fill: parent
            geometry: motion.geometry
            up: root.view && root.view.daySign !== 0 ? root.view.daySign > 0 : true
            upColor: root.upColor
            downColor: root.downColor
            baselineColor: root.dimmer
            hairlineColor: root.foreground
            ground: root.ground
            scrubX: motion.scrubX
            reveal: motion.reveal
            replayX: motion.replayX
            live: root.live
            newestPrice: root.quote && root.quote.points.length ? String(root.quote.points[root.quote.points.length - 1].p) : ""
            surfaceOpen: root.opened
            still: !root.opened
          }

          // The pointer reads the chart where it is drawn; a click goes back
          // to now.
          MouseArea {
            anchors.fill: parent
            hoverEnabled: true
            onPositionChanged: function(mouse) {
              if (!motion.replayRunning) motion.scrubTo(dayChart.fractionAt(mouse.x))
            }
            onExited: if (!motion.replayRunning) motion.clearScrub()
            onClicked: motion.clearScrub()
          }
        }
      }
    }
  }
}
