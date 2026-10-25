// Adapted from Stonks by Gaurav Chande (MIT), omarchy-stonks v1.0.2,
// Hero.qml. Changes: the listing line says the coin's name, the exchange (a pill
// that steps to the next) and USDT;
// the change is since 00:00 UTC, and its caption says so at rest, or names
// the range; there is no extended-hours print; the freshness words have no
// trading phase.
import QtQuick
import qs.Commons
import qs.Commons as Commons
import "Cells.js" as Cells
import "Figures.js" as Figures
import "Format.js" as Format
import "Tones.js" as Tones

// Featured symbol, listing line, the price in both looks, the change, and
// the caption strip under them. One box serves both looks: one fitted ink
// height drives both digit renderers, so they share a top line, a
// baseline, and a left edge however narrow it gets. The change and its
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
  // A click on the change switches percent and amount only where the figure
  // follows the mode: the day's. A range's change is always its percentage.
  property bool changeCycles: true
  property bool retro: false
  // What the price says with no quote: "…" while the first is on its way,
  // "—" once it failed.
  property string missingText: "…"
  property color foreground: Commons.Color.foreground
  property color dim: Tones.dim(foreground, Commons.Color.background)
  property color upColor: Commons.Color.foreground
  property color downColor: Commons.Color.urgent
  property color ghost: Qt.rgba(foreground.r, foreground.g, foreground.b, 0.05)
  property string fontFamily: Style.font.family
  property string symbol: ""
  // What the chart's dashed line is: said in the strip while a scrub reads
  // against it.
  property string baselineText: ""
  property int priceSize: Style.font.displayLarge * 2

  readonly property string priceText: view ? view.priceText : missingText
  // What the feed has done for the symbol (`Figures.freshness`).
  property var freshness: null
  readonly property string freshnessText: Figures.freshnessText(freshness, false)
  // Only a failure takes the mark; an aged quote is said plainly, as its row
  // says it. A first fetch that failed says what the row says.
  readonly property string listingLead: quote
    ? (scrubbing || freshnessText === "" ? "" : (Figures.freshnessWarns(freshness) ? "! " : "") + freshnessText + " · ")
      + String(quote.name).toUpperCase()
    : (freshnessText !== "" ? "! " + freshnessText : "")
  readonly property string exchangeName: quote ? quote.exchange : ""
  // The funding at the line's right end: its sign in text and tone, and the
  // time to its settlement; nothing when Bybit sent none.
  readonly property var funding: quote ? Figures.fundingFact(quote) : null
  readonly property real fundingWidth: funding && funding.value !== "" ? fundingRow.implicitWidth + Style.space(12) : 0
  readonly property real listingRoom: Math.max(0, listingRow.width - symbolText.implicitWidth - Style.space(8) - fundingWidth)
  // The day here starts at 00:00 UTC, and the screen says so, so the change
  // is never taken for an exchange's rolling 24 hours. A scrub says its own
  // moment in the header instead.
  readonly property string changeCaption: view && !scrubbing ? (view.caption || "SINCE 00:00 UTC") : ""

  readonly property int gap: Style.space(28)
  // The digits' ink at the surface's price size, and the box kept for it: a
  // whole number of retro cells, so both renderers land on the same rows.
  readonly property real naturalInk: -digitInk.tightBoundingRect.y
  readonly property int naturalCell: Math.max(1, Math.floor(naturalInk / 5))
  readonly property int boxHeight: naturalCell * 5
  // The retro digits' width, from the price itself: the hidden look's
  // digits draw nothing, and the smooth size must not follow them.
  readonly property int cells: Cells.blockCells(priceText).columns
  readonly property real priceRoom: Math.max(1, width - gap - changeText.implicitWidth)
  // One fitted ink height for both looks: the largest cell at which each
  // renderer still fits the room the change leaves.
  readonly property int fittedCell: Math.max(1, Math.min(naturalCell,
    Math.floor(priceRoom * naturalInk / (5 * Math.max(1, priceInk.advanceWidth))),
    Math.floor(priceRoom / Math.max(1, cells))))
  readonly property int digitHeight: fittedCell * 5
  readonly property int fittedSize: Math.max(1, Math.round(priceSize * digitHeight / naturalInk))
  // Where the smooth digits' ink starts in their box: they are pulled left
  // by it, so their ink, like the retro cells, starts on the band's edge.
  readonly property real inkLeft: priceInk.tightBoundingRect.x * fittedSize / priceSize
  readonly property int baselineY: listingRow.height + Style.space(14) + boxHeight
  // The strip under the price starts below the retro comma's tail, one cell
  // under the baseline, in both looks, so the look moves nothing.
  readonly property int captionDrop: naturalCell + Style.space(4) + Math.ceil(captionMetrics.capitalHeight)

  signal changeClicked()
  signal exchangeClicked()

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
      width: Math.min(implicitWidth, leftPadding + Math.max(0, root.listingRoom - metaRow.implicitWidth))
      anchors.baseline: symbolText.baseline
      textFormat: Text.PlainText
      text: root.listingLead
      color: Figures.freshnessWarns(root.freshness) ? root.foreground : root.dim
      font.family: root.fontFamily
      font.pixelSize: Style.font.caption
      font.bold: true
      font.letterSpacing: 1
      elide: Text.ElideRight
    }
  }

  // The exchange and currency start where the name's drawn text ends, not
  // where its box does: a name cut short draws narrower than its box, and
  // the gap read as a double space before the dot. The exchange is a pill:
  // a click steps to the next one.
  Row {
    id: metaRow
    visible: root.exchangeName !== ""
    x: listingText.x + listingText.leftPadding + listingText.contentWidth
    // The pill is taller than the text by its padding; the text stays on the name's baseline.
    y: symbolText.baselineOffset - dotText.baselineOffset - Style.space(2)
    Text {
      id: dotText
      y: Style.space(2)
      textFormat: Text.PlainText
      text: " · "
      color: listingText.color
      font: listingText.font
    }
    Rectangle {
      width: exchangeText.implicitWidth + Style.space(16)
      height: exchangeText.implicitHeight + Style.space(4)
      color: "transparent"
      border.width: 1
      // Brighter border on hover, and while pressed.
      border.color: pillArea.pressed || pillArea.containsMouse ? root.foreground : root.dim
      Text {
        id: exchangeText
        anchors.centerIn: parent
        textFormat: Text.PlainText
        text: root.exchangeName
        color: listingText.color
        font: listingText.font
      }
      MouseArea {
        id: pillArea
        anchors.fill: parent
        hoverEnabled: true
        cursorShape: Qt.PointingHandCursor
        onClicked: root.exchangeClicked()
      }
    }
    Text {
      textFormat: Text.PlainText
      y: Style.space(2)
      text: " · " + (root.quote ? root.quote.currency : "")
      color: listingText.color
      font: listingText.font
    }
  }

  Row {
    id: fundingRow
    visible: root.fundingWidth > 0
    x: parent.width - width
    y: symbolText.baselineOffset - fundingValue.baselineOffset
    spacing: Style.space(6)
    Text {
      textFormat: Text.PlainText
      text: "FUNDING"
      color: root.dim
      font: listingText.font
    }
    Text {
      id: fundingValue
      textFormat: Text.PlainText
      text: root.funding ? Format.lookSigns(root.funding.value, root.retro) : ""
      color: !root.funding ? root.foreground : root.funding.tone === "up" ? root.upColor : root.funding.tone === "down" ? root.downColor : root.foreground
      font: listingText.font
    }
    Text {
      textFormat: Text.PlainText
      text: root.funding ? root.funding.after : ""
      color: root.dim
      font: listingText.font
    }
  }

  Text {
    visible: !root.retro
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

  BlockDigits {
    visible: root.retro
    y: root.baselineY - baselineOffset
    // Hidden, it rests: a scrub in smooth repainted it every step.
    text: root.retro ? root.priceText : ""
    cell: root.fittedCell
    color: root.foreground
    ghostColor: root.ghost
  }

  // A click switches the change between percent and amount, as c does.
  Text {
    id: changeText
    anchors.right: parent.right
    y: root.baselineY - baselineOffset
    textFormat: Text.PlainText
    text: root.view ? Format.lookSigns(root.view.changeText, root.retro) : ""
    color: root.signColor(root.view ? root.view.sign : 0)
    font.family: root.fontFamily
    font.pixelSize: Style.font.display
    font.bold: true
    MouseArea {
      anchors.fill: parent
      enabled: root.changeCycles
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
