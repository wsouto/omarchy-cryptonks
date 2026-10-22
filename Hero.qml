// Adapted from Stonks by Gaurav Chande (MIT), omarchy-stonks v1.0.2,
// Hero.qml. Changes: the listing line says the coin's name, Bybit and USDT;
// the change is since 00:00 UTC, and its caption says so at rest; there is
// no extended-hours print and no freshness word yet (roadmap step 11), and
// only the smooth look until the retro one comes back.
import QtQuick
import qs.Commons
import qs.Commons as Commons
import "Tones.js" as Tones

// Featured symbol, listing line, the price, the change, and the caption
// strip under them. The price's box is a whole number of retro cells tall,
// so both looks will share a top line and a baseline. The change and its
// caption are pinned to the hero's right edge, so they never move with what
// else is on show. The strip under the price carries the dashed baseline's
// legend on the left while a scrub reads against it, and the change's
// caption on the right, and keeps its height when there is neither.
// Surfaces own scrub.
Item {
  id: root

  // The figures at the moment shown (`Figures.heroView`), null before the
  // first quote.
  property var view: null
  property var quote: null
  property bool scrubbing: false
  // What the price says with no quote: "…" while the first is on its way,
  // "—" once it failed.
  property string missingText: "…"
  property color foreground: Commons.Color.foreground
  property color dim: Tones.dim(foreground, Commons.Color.background)
  property color upColor: Commons.Color.foreground
  property color downColor: Commons.Color.urgent
  property string fontFamily: Style.font.family
  property string symbol: ""
  // What the chart's dashed line is: said in the strip while a scrub reads
  // against it.
  property string baselineText: ""
  property int priceSize: Style.font.displayLarge * 2

  readonly property string priceText: view ? view.priceText : missingText
  readonly property string listingLead: quote ? String(quote.name).toUpperCase() : ""
  readonly property string listingMeta: quote ? " · " + quote.exchange + " · " + quote.currency : ""
  readonly property real listingRoom: Math.max(0, listingRow.width - symbolText.implicitWidth - Style.space(8))
  // The day here starts at 00:00 UTC, and the screen says so, so the change
  // is never taken for an exchange's rolling 24 hours. A scrub says its own
  // moment in the header instead.
  readonly property string changeCaption: view && !scrubbing ? "SINCE 00:00 UTC" : ""

  readonly property int gap: Style.space(28)
  // The digits' ink at the surface's price size, and the box kept for it: a
  // whole number of retro cells, so both renderers land on the same rows.
  readonly property real naturalInk: -digitInk.tightBoundingRect.y
  readonly property int naturalCell: Math.max(1, Math.floor(naturalInk / 5))
  readonly property int boxHeight: naturalCell * 5
  readonly property real priceRoom: Math.max(1, width - gap - changeText.implicitWidth)
  // The largest cell at which the price still fits the room the change
  // leaves.
  readonly property int fittedCell: Math.max(1, Math.min(naturalCell,
    Math.floor(priceRoom * naturalInk / (5 * Math.max(1, priceInk.advanceWidth)))))
  readonly property int digitHeight: fittedCell * 5
  readonly property int fittedSize: Math.max(1, Math.round(priceSize * digitHeight / naturalInk))
  // Where the digits' ink starts in their box: they are pulled left by it,
  // so their ink starts on the band's edge.
  readonly property real inkLeft: priceInk.tightBoundingRect.x * fittedSize / priceSize
  readonly property int baselineY: listingRow.height + Style.space(14) + boxHeight
  // The strip under the price starts below the retro comma's tail, one cell
  // under the baseline, in both looks, so the look moves nothing.
  readonly property int captionDrop: naturalCell + Style.space(4) + Math.ceil(captionMetrics.capitalHeight)

  signal changeClicked()

  // An unmoved figure is neither colour.
  function signColor(sign) {
    return sign > 0 ? upColor : sign < 0 ? downColor : dim
  }

  implicitHeight: baselineY + captionDrop + Math.ceil(captionMetrics.descent)
  implicitWidth: parent ? parent.width : 0
  height: implicitHeight
  width: parent ? parent.width : implicitWidth

  TextMetrics {
    id: digitInk
    font.family: root.fontFamily
    font.pixelSize: root.priceSize
    font.bold: true
    text: "0123456789"
  }

  TextMetrics {
    id: priceInk
    font.family: root.fontFamily
    font.pixelSize: root.priceSize
    font.bold: true
    font.letterSpacing: -1
    text: root.priceText
  }

  FontMetrics {
    id: captionMetrics
    font.family: root.fontFamily
    font.pixelSize: Style.font.caption
    font.bold: true
  }

  Row {
    id: listingRow
    width: parent.width
    Text {
      id: symbolText
      textFormat: Text.PlainText
      text: root.symbol || "—"
      color: root.foreground
      font.family: root.fontFamily
      font.pixelSize: Style.font.title
      font.bold: true
    }
    // The name gives way to the exchange and currency, which stay whole.
    Text {
      id: listingText
      leftPadding: Style.space(8)
      width: Math.min(implicitWidth, leftPadding + Math.max(0, root.listingRoom - metaText.implicitWidth))
      anchors.baseline: symbolText.baseline
      textFormat: Text.PlainText
      text: root.listingLead
      color: root.dim
      font.family: root.fontFamily
      font.pixelSize: Style.font.caption
      font.bold: true
      font.letterSpacing: 1
      elide: Text.ElideRight
    }
  }

  // The exchange and currency start where the name's drawn text ends, not
  // where its box does: a name cut short draws narrower than its box, and
  // the gap read as a double space before the dot.
  Text {
    id: metaText
    x: listingText.x + listingText.leftPadding + listingText.contentWidth
    y: symbolText.baselineOffset - baselineOffset
    textFormat: Text.PlainText
    text: root.listingMeta
    color: listingText.color
    font: listingText.font
  }

  Text {
    x: -Math.round(root.inkLeft)
    y: root.baselineY - baselineOffset
    textFormat: Text.PlainText
    text: root.priceText
    color: root.foreground
    font.family: root.fontFamily
    font.pixelSize: root.fittedSize
    font.bold: true
    font.letterSpacing: -1
  }

  // A click switches the change between percent and amount, as c does.
  Text {
    id: changeText
    anchors.right: parent.right
    y: root.baselineY - baselineOffset
    textFormat: Text.PlainText
    text: root.view ? root.view.changeText : ""
    color: root.signColor(root.view ? root.view.sign : 0)
    font.family: root.fontFamily
    font.pixelSize: Style.font.display
    font.bold: true
    MouseArea {
      anchors.fill: parent
      cursorShape: Qt.PointingHandCursor
      onClicked: root.changeClicked()
    }
  }

  Text {
    visible: root.scrubbing && root.baselineText !== ""
    y: root.baselineY + root.captionDrop - baselineOffset
    textFormat: Text.PlainText
    text: "┄ " + root.baselineText
    color: root.dim
    font.family: root.fontFamily
    font.pixelSize: Style.font.caption
    font.bold: true
    font.letterSpacing: 1
  }

  Text {
    anchors.right: parent.right
    y: root.baselineY + root.captionDrop - baselineOffset
    textFormat: Text.PlainText
    text: root.changeCaption
    color: root.dim
    font.family: root.fontFamily
    font.pixelSize: Style.font.caption
    font.bold: true
    font.letterSpacing: 1
  }
}
