// Adapted from Stonks by Gaurav Chande (MIT), omarchy-stonks v1.0.2,
// WatchlistRow.qml. Changes: the row's figures are the hero's
// (`Figures.heroView`), since the day is the UTC day for both; the remove
// button, the drag, the Ctrl-click lists and the draw-in come with lists
// and search (roadmap step 8), and the freshness words with the statuses
// (step 11), so the name line says only a refresh's problem.
pragma ComponentBehavior: Bound
import QtQuick
import qs.Commons
import qs.Commons as Commons
import "Chart.js" as Chart
import "Format.js" as Format
import "Tones.js" as Tones

// One watchlist row: symbol over name, the day line, price over change.
// The featured row sits in the shell's selected fill; the cursor, which the
// keys and the pointer both move, takes the shell's hover-cursor fill and a
// bar down the left edge, and on the featured row only the bar.
Rectangle {
  id: row

  required property string symbol
  property var quote: null
  // The figures at the moment shown (`Figures.heroView`), null with no quote.
  property var view: null
  // Why its last refresh failed, "" when it did not.
  property string problem: ""
  property bool featuredRow: false
  property bool cursor: false
  property bool retro: false
  property real scrubX: -1
  property color ground: "transparent"
  property color foreground: Commons.Color.foreground
  property color dim: Tones.dim(foreground, Commons.Color.background)
  property color dimmer: Tones.dimmer(foreground, Commons.Color.background)
  property color upColor: Commons.Color.foreground
  property color downColor: Commons.Color.urgent
  property string fontFamily: Style.font.family

  // The pointer is on the row, and a click on it.
  signal pointed()
  signal featureRequested()

  // The day line is the quote's own drawing: it changes when the quote does,
  // never with the clock, the change mode, or another symbol's quote. A day
  // with no candle leaves the cell empty: the hero alone draws its baseline.
  readonly property var geometry: quote && quote.points.length ? Chart.dayGeometry(quote) : null
  // The line's direction: up or down from the open, or none without one.
  readonly property var dayUp: view && quote && typeof quote.dayOpen === "number" ? view.daySign >= 0 : null

  readonly property color trend: !view || view.sign === 0 ? dim : view.sign > 0 ? upColor : downColor
  readonly property bool warns: problem !== ""
  // A failed refresh is said in words on the name line, so it reads without
  // hover and without colour.
  readonly property string detail: warns ? "! " + problem : quote ? quote.name : "Loading…"

  // Two lines, the way Apple's Stocks sets a row: symbol over name on the
  // left, price over change on the right, the day line between them.
  readonly property int sparkWidth: Style.space(72)
  readonly property int priceWidth: Style.space(96)
  readonly property int gap: Style.space(10)
  readonly property int inset: Style.space(4)

  height: Style.space(40)
  radius: retro ? 0 : Style.cornerRadius
  // The fill the row's state asks for; the row eases to it, and the retro
  // stems are weighed against it over the ground, so a featured or cursor
  // row's two colours still read alike.
  readonly property color fill: featuredRow ? Style.selectedFillFor(foreground, Commons.Color.accent)
    : cursor ? Style.hoverFillFor(foreground, Commons.Color.accent) : "transparent"
  color: fill

  // The shell's own speed (CursorSurface), so the fill keeps up with the
  // pointer.
  Behavior on color { ColorAnimation { duration: 60 } }

  // Only the shown look is built: `s` builds the other, which draws before
  // that frame.
  Loader {
    x: row.width - row.gap - row.priceWidth - row.gap - row.sparkWidth
    width: row.sparkWidth
    height: Style.space(22)
    anchors.verticalCenter: parent.verticalCenter
    sourceComponent: row.retro ? cellsLine : smoothLine
  }

  Component {
    id: smoothLine
    Sparkline {
      geometry: row.geometry
      // The hero's rule at row size: up above the baseline, down below it.
      up: row.dayUp
      upColor: row.upColor
      downColor: row.downColor
      lineColor: row.dim
      baselineColor: row.dimmer
      cursorX: row.scrubX
    }
  }

  // The hero histogram at a finer pitch, so a row and the hero are one
  // drawing at two sizes.
  Component {
    id: cellsLine
    PixelChart {
      geometry: row.geometry
      // Unknown direction draws dim, the way the hero's chart does.
      up: row.dayUp
      upColor: row.upColor
      downColor: row.downColor
      baselineColor: row.dimmer
      hairlineColor: row.foreground
      ground: Qt.tint(row.ground, row.fill)
      pixel: 2
      gap: 1
      scrubX: row.scrubX
    }
  }

  CursorBar {
    visible: row.cursor
    retro: row.retro
    foreground: row.foreground
  }

  Text {
    x: row.gap
    y: row.inset
    textFormat: Text.PlainText
    text: row.symbol
    color: row.foreground
    font.family: row.fontFamily
    font.pixelSize: Style.font.body
    font.bold: true
  }

  Text {
    x: row.gap
    anchors.bottom: parent.bottom
    anchors.bottomMargin: row.inset
    width: row.width - x - row.priceWidth - row.gap * 2 - row.sparkWidth - row.gap
    textFormat: Text.PlainText
    text: row.detail
    color: row.warns ? row.foreground : row.dim
    font.family: row.fontFamily
    font.pixelSize: Style.font.bodySmall
    font.bold: row.warns
    elide: Text.ElideRight
  }

  Text {
    x: row.width - row.gap - row.priceWidth
    y: row.inset
    width: row.priceWidth
    horizontalAlignment: Text.AlignRight
    textFormat: Text.PlainText
    text: row.view ? row.view.priceText : ""
    color: row.foreground
    font.family: row.fontFamily
    font.pixelSize: Style.font.body
  }

  Text {
    x: row.width - row.gap - row.priceWidth
    width: row.priceWidth
    anchors.bottom: parent.bottom
    anchors.bottomMargin: row.inset
    horizontalAlignment: Text.AlignRight
    textFormat: Text.PlainText
    text: row.view ? Format.lookSigns(row.view.changeText, row.retro) : ""
    color: row.trend
    font.family: row.fontFamily
    font.pixelSize: Style.font.body
    font.bold: true
  }

  // Moving the pointer puts the cursor on the row under it; a click
  // features it.
  MouseArea {
    anchors.fill: parent
    hoverEnabled: true
    cursorShape: Qt.PointingHandCursor
    onPositionChanged: row.pointed()
    onClicked: row.featureRequested()
  }
}
