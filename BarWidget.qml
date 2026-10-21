pragma ComponentBehavior: Bound

import QtQuick
import qs.Commons
import qs.Commons as Commons
import qs.Ui
import "Change.js" as Change
import "Format.js" as Format
import "Tones.js" as Tones

// The bar pill: one symbol, its price, and how far it has moved since
// 00:00 UTC, as a ticker reads. The data is `PriceFeed`'s; the pill only
// shows it. Until the first answer it shows "…", and a refresh that failed
// puts a "!" before the change (the words are in the hover) while the last
// price stays.
//
// `BarWidget` comes from the Omarchy shell (qs.Ui). `moduleName` must equal
// the id in manifest.json; the shell uses it to find this widget's settings.
BarWidget {
  id: root
  moduleName: "wsouto.crypto-stonks"

  readonly property string symbol: feed.symbol
  readonly property var quote: feed.quote
  readonly property bool warns: feed.problem !== ""
  // How far the price has moved since 00:00 UTC; null while it is not known.
  readonly property var move: Change.sinceOpen(quote)

  // Up and down are the theme's green and red, picked for the bar's own
  // ground (`TrendColors`), and the dim of a flat move is quieter than the
  // bar's ink by the same rule everywhere (`Tones.dim`).
  readonly property color barGround: Qt.rgba(Commons.Color.bar.background.r, Commons.Color.bar.background.g, Commons.Color.bar.background.b, 1)
  readonly property color upColor: colors.upOn(barGround)
  readonly property color downColor: colors.downOn(barGround)
  readonly property color dimColor: Tones.dim(button.foreground, barGround)
  // 1 up, -1 down, 0 flat: the sign as it is drawn, so a move that rounds to
  // +0.00% is flat and takes no colour.
  readonly property int sign: move ? Format.shownSign(move.pct, Format.pctDigits(Math.abs(move.pct))) : 0
  readonly property color moveColor: !move ? dimColor : sign > 0 ? upColor : sign < 0 ? downColor : dimColor

  readonly property string priceText: quote ? Format.money(quote.price, quote.priceDigits) : ""
  readonly property string changeText: (warns ? "! " : "") + (move ? Format.pct(move.pct) : quote ? "—" : warns ? "No data" : "…")

  PriceFeed { id: feed }

  TrendColors { id: colors }

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  WidgetButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    labelVisible: false
    hasVisualContent: true
    fixedWidth: content.implicitWidth + Style.space(17)
    // The pill has no room to say what its change is measured from, or why
    // a "!" stands there, so the hover does.
    tooltipText: "Change since 00:00 UTC" + (root.warns ? " · ! " + feed.problem : "")

    Row {
      id: content
      anchors.centerIn: parent
      spacing: Style.space(6)

      Text {
        anchors.verticalCenter: parent.verticalCenter
        textFormat: Text.PlainText
        text: root.symbol
        color: button.foreground
        font.family: button.fontFamily
        font.pixelSize: button.fontSize
        font.bold: true
      }

      Text {
        visible: root.priceText !== ""
        anchors.verticalCenter: parent.verticalCenter
        textFormat: Text.PlainText
        text: root.priceText
        color: button.foreground
        font.family: button.fontFamily
        font.pixelSize: button.fontSize
      }

      Text {
        anchors.verticalCenter: parent.verticalCenter
        textFormat: Text.PlainText
        text: root.changeText
        color: root.moveColor
        font.family: button.fontFamily
        font.pixelSize: button.fontSize
      }
    }
  }
}
