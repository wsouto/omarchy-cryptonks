pragma ComponentBehavior: Bound

import QtQuick
import qs.Commons
import qs.Commons as Commons
import qs.Ui
import "Cells.js" as Cells
import "Change.js" as Change
import "Chart.js" as Chart
import "Figures.js" as Figures
import "Format.js" as Format
import "Tones.js" as Tones

// The bar pill: one symbol and how far it has moved since 00:00 UTC, as the
// day's line (the default), an arrow, text with the price, or the day's bull
// or bear. Left click opens the popup (`Panel.qml`), and middle-click cycles
// the form, which each section of the bar keeps on its own. The data is
// `PriceFeed`'s; the pill and the popup only show it. Until the
// first answer it shows "…", and a refresh that failed puts a "!" on the
// pill (the words are in the hover) while the last price stays.
//
// The forms, the animal's turn and the side bar's stack follow Stonks'
// BarWidget.qml by Gaurav Chande (MIT, omarchy-stonks v1.0.2), as does the
// way the popup is loaded and opened, and the retro look's line and signs;
// its window and list come back in later steps.
//
// `BarWidget` comes from the Omarchy shell (qs.Ui). `moduleName` must equal
// the id in manifest.json; the shell uses it to find this widget's settings.
BarWidget {
  id: root
  moduleName: "wsouto.crypto-stonks"

  readonly property string symbol: feed.symbol
  readonly property var quote: feed.quote
  readonly property string problem: feed.problem
  readonly property bool warns: problem !== ""
  // How far the price has moved since 00:00 UTC; null while it is not known.
  readonly property var move: Change.sinceOpen(quote)
  // The day's line, from 00:00 UTC to the newest candle; null with none.
  readonly property var lineGeometry: Chart.dayGeometry(quote)

  // In the bar's right section, among its bare icons, the pill has a form of
  // its own, `barStyleRight`: the icon until a middle-click there picks
  // another. The centre and left share `barStyle`. On a side bar it has
  // `barStyleVertical`: the icon, as Omarchy's text widgets fall back to
  // theirs there, until a middle-click picks the symbol over its change
  // ("stacked"). Each rides the entry, as the clock keeps verticalFormat
  // beside format, so a move between sections or between the top and a side
  // brings back each one's own.
  readonly property bool onRight: {
    var layout = bar && bar.layoutConfig ? bar.layoutConfig : null
    var right = layout && Array.isArray(layout.right) ? layout.right : []
    return right.some(function(entry) {
      return (typeof entry === "string" ? entry : entry && entry.id) === root.moduleName
    })
  }
  readonly property string styleKey: vertical ? "barStyleVertical" : onRight ? "barStyleRight" : "barStyle"
  readonly property string barStyle: setting(styleKey, vertical || onRight ? "icon" : "sparkline")
  // Just the day's animal, a quiet icon among the bar's own.
  readonly property bool iconOnly: barStyle === "icon"
  // The look, smooth or retro, which the popup switches: kept on the bar
  // entry, as the original pill reads it before its service loads, until
  // the saved settings come (roadmap step 7).
  readonly property bool retro: setting("style", "smooth") === "retro"

  // Up and down are the theme's green and red, picked for the bar's own
  // ground (`TrendColors`), and the dim of a flat move is quieter than the
  // bar's ink by the same rule everywhere (`Tones.dim`).
  readonly property color barGround: Qt.rgba(Commons.Color.bar.background.r, Commons.Color.bar.background.g, Commons.Color.bar.background.b, 1)
  readonly property color upColor: colors.upOn(barGround)
  readonly property color downColor: colors.downOn(barGround)
  readonly property color dimColor: Tones.dim(button.foreground, barGround)
  // 1 up, -1 down, 0 flat: the sign as it is drawn, so a move that rounds to
  // +0.00% is flat and takes no colour.
  readonly property int sign: signOf(quote)
  readonly property color moveColor: !move ? dimColor : sign > 0 ? upColor : sign < 0 ? downColor : dimColor

  function signOf(q) {
    var m = Change.sinceOpen(q)
    return m ? Format.shownSign(m.pct, Format.pctDigits(Math.abs(m.pct))) : 0
  }

  readonly property string priceText: quote ? Format.money(quote.price, quote.priceDigits) : ""
  readonly property string changeText: (warns ? "! " : "") + (move ? Format.lookSigns(Format.pct(move.pct), retro) : quote ? "—" : warns ? "No data" : "…")

  // The day and animal the icon form shows. A new price that turns the same
  // symbol's day between the bull and the bear steps the animal
  // (`BarAnimal.turnTo`); another symbol or another day shows at once: the
  // turn says a price crossed the open. Read from the quote in the handler,
  // never from a binding, so it can't lag the quote.
  function animalDay(q) {
    return q ? root.symbol + "|" + Math.floor(q.marketTime / 86400) : ""
  }
  property string shownDay: ""
  property string shownKind: ""
  onQuoteChanged: {
    var kind = Figures.animalKind(signOf(quote))
    var day = animalDay(quote)
    if (day !== "" && day === shownDay) animal.turnTo(kind, shownKind)
    else animal.settle()
    shownDay = day
    shownKind = kind
  }

  // The shell copies a hover's words only as the pointer enters. While it
  // stays, a warning that starts, ends, or changes its words goes to the bar
  // again, as does another symbol, so no bubble names a warning that has
  // ended. A new figure alone never re-shows it, so a resting pointer sees
  // no blink.
  function reshowTooltip() {
    if (button.tooltipHovered && button.bar) button.bar.showTooltip(button, button.tooltipText)
  }
  onProblemChanged: Qt.callLater(reshowTooltip)
  onSymbolChanged: Qt.callLater(reshowTooltip)

  // A side bar's stacked form: the symbol's lines over the move's, each at
  // most four characters (`Format.stackedSymbol`), the move in percent
  // (`Format.stackedPct`), coloured by its sign as drawn. A warning's "!"
  // goes on a short line of its own before the move, kept whether the "!"
  // shows or not: the pill never changes height for a warning. With no
  // quote at all the "!" is the move, in the place of the waiting "…".
  readonly property var stackedMove: !quote ? { lines: warns ? [] : ["…"], sign: 0 }
    : Format.stackedPct(move ? move.pct : null)
  readonly property var stackedLines: Format.stackedSymbol(symbol, quote ? quote.currency : "")
    .map(function(t) { return { text: t, move: false, warning: false } })
    .concat(quote ? [{ text: warns ? "!" : "", move: false, warning: true }]
      : warns ? [{ text: "!", move: false, warning: false }] : [])
    .concat(stackedMove.lines.map(function(t) { return { text: t, move: true, warning: false } }))
  // The warning's line: the "!"'s ink and a gap each side, as the icon form
  // keeps under its animal.
  readonly property int stackedWarningHeight: Math.ceil(stackedWarningMetrics.tightBoundingRect("!").height) + 2 * 2
  readonly property int stackedHeight: stackedLines.reduce(function(sum, line) {
    return sum + (line.warning ? stackedWarningHeight : Style.bar.iconSlot)
  }, 0)
  FontMetrics {
    id: stackedWarningMetrics
    font.family: button.fontFamily
    font.pixelSize: Math.max(1, Math.round(button.fontSize))
  }

  // One setting of the bar entry, the others kept as they are.
  function persistSetting(name, value) {
    var entry = { id: root.moduleName }
    for (var key in root.settings) if (key !== "id") entry[key] = root.settings[key]
    entry[name] = value
    root.settings = entry
    if (root.bar && root.bar.shell && typeof root.bar.shell.updateEntryInline === "function")
      root.bar.shell.updateEntryInline(root.moduleName, entry)
  }

  // A side bar has two forms, the icon and the symbol over its change, so a
  // middle-click there steps between them.
  function cycleBarStyle() {
    var ring = ["sparkline", "arrow", "text", "icon"]
    root.persistSetting(root.styleKey, root.vertical ? (root.iconOnly ? "stacked" : "icon")
      : ring[(ring.indexOf(barStyle) + 1) % ring.length])
  }

  // Shape contract for shell.summon/hide/toggle routing (Bar.findPanelWidget
  // requires open/close/opened on the bar-widget root).
  readonly property var panel: panelLoader.item
  readonly property bool opened: panel ? panel.opened === true : false

  function open() { if (panel) panel.open() }
  function close() { if (panel) panel.close() }
  function togglePanel() { if (panel) panel.toggle() }

  readonly property real openPanelIndicatorWidth: content.implicitWidth
  readonly property real openPanelIndicatorHeight: Math.max(Style.space(10), Math.round(Style.bar.iconSlot * 0.55))

  readonly property bool popoutSwitchClosing: panel ? panel.popoutSwitchClosing === true : false

  function closeForPopoutSwitch() {
    if (panel) panel.closeForPopoutSwitch()
  }

  // The popup is loaded by its file: inside this file `Panel` names the
  // shell's own type (qs.Ui), which ours is built on.
  function injectPanel() {
    var target = panelLoader.item
    if (!target) return
    target.bar = root.bar
    target.settings = root.settings
    target.anchorItem = button
    target.hostWidget = root
    target.feed = feed
    target.trendColors = colors
  }

  onBarChanged: injectPanel()
  onSettingsChanged: injectPanel()

  Loader {
    id: panelLoader
    active: true
    source: Qt.resolvedUrl("Panel.qml")
    visible: false
    onLoaded: {
      root.injectPanel()
      Qt.callLater(root.injectPanel)
    }
  }

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
    fixedWidth: root.vertical ? -1 : (root.iconOnly ? Style.bar.iconSlot : content.implicitWidth + Style.space(17))
    // A side bar's icon slot holds the animal and the room under it for a
    // warning's "!", with a pixel to spare each end.
    fixedHeight: root.vertical ? (root.iconOnly ? Math.max(Style.bar.iconSlot, Math.ceil(iconForm.implicitHeight) + 2)
      : root.stackedHeight) : -1
    // The pill has no room to say what its change is measured from, or why
    // a "!" stands there, so the hover does; the icon names nothing, so its
    // hover also says what the other forms show, the symbol and its change.
    // None while the popup is open: the bubble lands on the card's header.
    tooltipText: root.opened ? "" : (root.iconOnly ? root.symbol + " " + root.changeText + " · " : "")
      + "Change since 00:00 UTC" + (root.warns ? " · ! " + root.problem : "")

    onPressed: function(b) {
      if (b === Qt.MiddleButton) root.cycleBarStyle()
      else if (b === Qt.LeftButton) root.togglePanel()
    }

    Row {
      id: content
      anchors.centerIn: parent
      spacing: Style.space(6)
      visible: !root.vertical || root.iconOnly

      Sparkline {
        visible: root.barStyle === "sparkline" && !root.retro
        anchors.verticalCenter: parent.verticalCenter
        width: Style.space(40)
        height: Style.space(12)
        geometry: root.lineGeometry
        lineColor: root.moveColor
        baselineColor: Qt.rgba(button.foreground.r, button.foreground.g, button.foreground.b, 0.25)
        lineWidth: 1.5
      }

      // The popup's pixel chart at pill size, so the pill and the hero are
      // one drawing at two sizes.
      PixelChart {
        visible: root.barStyle === "sparkline" && root.retro
        anchors.verticalCenter: parent.verticalCenter
        width: Style.space(40)
        height: Style.space(12)
        geometry: root.retro ? root.lineGeometry : null
        upColor: root.moveColor
        downColor: root.moveColor
        baselineColor: Qt.rgba(button.foreground.r, button.foreground.g, button.foreground.b, 0.25)
        pixel: 2
        gap: 1
      }

      // The 23-degrees idea: an arrow whose tilt is the size of today's move,
      // flat at zero and pinned at 45 degrees past a five percent day.
      Text {
        visible: root.barStyle === "arrow"
        anchors.verticalCenter: parent.verticalCenter
        text: "➜"
        color: root.moveColor
        font.family: button.fontFamily
        font.pixelSize: Style.font.icon
        rotation: root.move ? -Figures.arrowAngle(root.move.pct) : 0
        Behavior on rotation { NumberAnimation { duration: 160; easing.type: Easing.OutCubic } }
      }

      // The icon form, on either bar: the day's animal, one cell a pixel, as
      // tall as the bar's icons allow. A day that crosses its open turns it
      // column by column (`shownKind`). With no animal it says what the
      // other forms say: a flat day lies level in the dim of a flat change,
      // and before the first quote the dim "…" of the text form.
      Item {
        id: iconForm
        visible: root.iconOnly
        anchors.verticalCenter: parent.verticalCenter
        // A side bar is barely wider than the animal, so a warning's "!" goes
        // under it there, in room the slot keeps whether the "!" shows or
        // not: the animal never moves for a warning.
        readonly property int warningGap: 2
        readonly property rect warningInk: warningMetrics.tightBoundingRect("!")
        implicitWidth: animal.implicitWidth
        implicitHeight: animal.implicitHeight + (root.vertical ? warningGap + warningInk.height : 0)

        BarAnimal {
          id: animal
          kind: Figures.animalKind(root.sign)
          upColor: root.upColor
          downColor: root.downColor
          cell: Math.max(1, Math.floor(Style.bar.iconCanvas / rows))
        }

        Rectangle {
          visible: !!root.move && animal.kind === ""
          y: Math.round((animal.height - height) / 2)
          width: animal.width
          height: Cells.RULE_THICKNESS
          color: root.dimColor
        }

        Text {
          visible: !root.quote && !root.warns
          anchors.centerIn: animal
          textFormat: Text.PlainText
          text: "…"
          color: root.dimColor
          font.family: button.fontFamily
          font.pixelSize: button.fontSize
        }

        // A warning's "!", in the bar's ink. On a top or bottom bar it hangs
        // in the slot's margin right of the animal; on a side bar it sits
        // under it, its ink centred across the bar. With nothing shown, a
        // first fetch that failed, it stands alone where the animal would be.
        Text {
          id: warning
          readonly property bool under: root.vertical && !!root.quote
          visible: root.warns
          x: Math.round(under ? (animal.width - iconForm.warningInk.width) / 2 - iconForm.warningInk.x
            : root.quote ? animal.width + 1 : (animal.width - width) / 2)
          y: Math.round(under ? animal.height + iconForm.warningGap - baselineOffset - iconForm.warningInk.y
            : (animal.height - height) / 2)
          textFormat: Text.PlainText
          text: "!"
          color: button.foreground
          font.family: button.fontFamily
          font.pixelSize: button.fontSize
          font.bold: true
        }
        FontMetrics { id: warningMetrics; font: warning.font }
      }

      Text {
        visible: !root.iconOnly
        anchors.verticalCenter: parent.verticalCenter
        textFormat: Text.PlainText
        text: root.symbol
        color: button.foreground
        font.family: button.fontFamily
        font.pixelSize: button.fontSize
        font.bold: true
      }

      // The text form says the price too, as a ticker does: the bar is
      // where a glance asks what it is now.
      Text {
        visible: root.barStyle === "text" && root.priceText !== ""
        anchors.verticalCenter: parent.verticalCenter
        textFormat: Text.PlainText
        text: root.priceText
        color: button.foreground
        font.family: button.fontFamily
        font.pixelSize: button.fontSize
      }

      Text {
        visible: !root.iconOnly
        anchors.verticalCenter: parent.verticalCenter
        textFormat: Text.PlainText
        text: root.changeText
        color: root.moveColor
        font.family: button.fontFamily
        font.pixelSize: button.fontSize
      }
    }

    // As Omarchy's clock draws a vertical bar: one line to an icon slot, at
    // the bar's size, 90% at four characters, never smaller; the warning's
    // line is shorter (`stackedWarningHeight`).
    Column {
      visible: root.vertical && !root.iconOnly
      anchors.centerIn: parent

      Repeater {
        model: root.stackedLines

        OpticalGlyph {
          required property var modelData
          width: button.width
          height: modelData.warning ? root.stackedWarningHeight : Style.bar.iconSlot
          text: modelData.move ? Format.lookSigns(modelData.text, root.retro) : modelData.text
          fontFamily: button.fontFamily
          fontSize: modelData.text.length > 3 ? button.fontSize * 0.9 : button.fontSize
          color: !modelData.move ? button.foreground : root.stackedMove.sign > 0 ? root.upColor
            : root.stackedMove.sign < 0 ? root.downColor : root.dimColor
        }
      }
    }
  }
}
