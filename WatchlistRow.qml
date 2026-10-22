// Adapted from Stonks by Gaurav Chande (MIT), omarchy-stonks v1.0.2,
// WatchlistRow.qml. Changes: the row's figures are the hero's
// (`Figures.heroView`), since the day is the UTC day for both; the
// Ctrl-click lists come with lists (roadmap step 8c), and the freshness
// words with the statuses (step 11), so the name line says only a refresh's
// problem; there is no draw-in, and no slide but the drag's.
pragma ComponentBehavior: Bound
import QtQuick
import qs.Commons
import qs.Commons as Commons
import "Cells.js" as Cells
import "Chart.js" as Chart
import "Format.js" as Format
import "Tones.js" as Tones

// One watchlist row: symbol over name, the day line, price over change.
// The featured row sits in the shell's selected fill; the cursor, which the
// keys and the pointer both move, takes the shell's hover-cursor fill and a
// bar down the left edge, and on the featured row only the bar. A row held
// in a drag takes the pressed fill and a border. A cursor you
// put there, by pointer or key, shows a remove button, as the shell's
// Bluetooth panel shows Forget on its cursor's row.
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
  // The cursor is yours here, not resting on the featured row: the remove
  // button shows.
  property bool removable: false
  // True while the pointer carries this row; the popup positions it.
  property bool lifted: false
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
  // The ×, a right-click or a middle-click.
  signal removeRequested()
  // Drag positions are in the parent's coordinates, since the row itself
  // moves under the pointer.
  signal dragStarted(real y)
  signal dragMoved(real y)
  signal dragEnded()
  signal dragCanceled()

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
  readonly property color fill: lifted ? Style.pressedFillFor(foreground, Commons.Color.accent)
    : featuredRow ? Style.selectedFillFor(foreground, Commons.Color.accent)
    : cursor ? Style.hoverFillFor(foreground, Commons.Color.accent) : "transparent"
  color: fill
  border.width: lifted ? 1 : 0
  border.color: Style.normalBorderFor(foreground, Commons.Color.accent)

  // The shell's own speed (CursorSurface), so the fill keeps up with the
  // pointer.
  Behavior on color { ColorAnimation { duration: 60 } }

  // Under the fill while the row is held: the rows it passes never show
  // through.
  Rectangle {
    z: -1
    anchors.fill: parent
    radius: row.radius
    visible: row.lifted
    color: row.ground
  }

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
    id: symbolText
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

  // The shell's row action (PanelActionButton, as Bluetooth's Forget): dim
  // at rest, the foreground under the pointer, never the urgent colour,
  // which here means a falling price. It sits just after the symbol it
  // removes, on its line, so nothing on the row moves or narrows for it,
  // and it has no tip: the × says what it does, and the ? sheet says a
  // right-click does the same. The row's own pointer handles it.
  Item {
    id: removeButton
    objectName: "rowRemove"
    visible: row.removable
    width: Style.space(22)
    height: width
    x: symbolText.x + symbolText.width + Style.space(4)
    y: symbolText.y + (symbolText.height - height) / 2
    readonly property bool hovered: mouse.containsMouse && mouse.onRemove(mouse.mouseX, mouse.mouseY)
    readonly property color ink: hovered ? row.foreground : row.dim

    // The shell's 22 px target; its fill 2 px inside it, so on a 40 px row
    // it keeps clear of the row's top edge.
    Rectangle {
      anchors.fill: parent
      anchors.margins: Style.space(2)
      radius: row.retro ? 0 : Style.cornerRadius
      color: removeButton.hovered && mouse.pressed && mouse.pressedOnRemove && !mouse.dragged ? Style.pressedFillFor(row.foreground, Commons.Color.accent)
        : removeButton.hovered ? Style.hoverFillFor(row.foreground, Commons.Color.accent) : "transparent"
      Behavior on color { ColorAnimation { duration: 60 } }
    }

    // Smooth: a plain ×, the weight of the symbol beside it.
    Text {
      visible: !row.retro
      anchors.centerIn: parent
      textFormat: Text.PlainText
      text: "󰅖"
      color: removeButton.ink
      font.family: row.fontFamily
      font.pixelSize: Style.font.body
    }

    // Retro: an × in the rows' own 2 px cells, built only in that look.
    Loader {
      anchors.centerIn: parent
      active: row.retro
      sourceComponent: Component {
        PixelSprite {
          width: Cells.REMOVE_SPRITE[0].length * 2
          height: Cells.REMOVE_SPRITE.length * 2
          columns: Cells.REMOVE_SPRITE[0].length
          rows: Cells.REMOVE_SPRITE.length
          pixels: Cells.spritePixels(Cells.REMOVE_SPRITE)
          color: removeButton.ink
        }
      }
    }
  }

  // Moving the pointer puts the cursor on the row under it; a click
  // features it, or on the × removes it, as a right or middle click does; a
  // left press moved 6 px carries it. A double-click is one click: its
  // second would land on whatever took the first one's place, the row
  // sliding up after a removal.
  MouseArea {
    id: mouse
    anchors.fill: parent
    hoverEnabled: true
    // The list would take a vertical drag as a scroll.
    preventStealing: true
    acceptedButtons: Qt.LeftButton | Qt.RightButton | Qt.MiddleButton
    cursorShape: row.lifted ? Qt.ClosedHandCursor : Qt.PointingHandCursor

    property real pressY: -1
    property bool dragged: false
    // The press began on the remove button: only its release, on the
    // button and with no drag between, removes, and a release off it does
    // nothing, as a button's does.
    property bool pressedOnRemove: false

    function onRemove(x, y) {
      return removeButton.visible && x >= removeButton.x && x < removeButton.x + removeButton.width
        && y >= removeButton.y && y < removeButton.y + removeButton.height
    }
    onPressed: function(event) {
      pressY = event.button === Qt.LeftButton ? event.y : -1
      dragged = false
      pressedOnRemove = event.button === Qt.LeftButton && onRemove(event.x, event.y)
    }
    onPositionChanged: function(event) {
      if (!pressed || pressY < 0) {
        row.pointed()
        return
      }
      if (!dragged) {
        if (Math.abs(event.y - pressY) < 6) return
        dragged = true
        row.dragStarted(row.mapToItem(row.parent, event.x, pressY).y)
      }
      row.dragMoved(row.mapToItem(row.parent, event.x, event.y).y)
    }
    onReleased: function(event) {
      if (dragged) row.dragEnded()
      else if (pressedOnRemove && onRemove(event.x, event.y)) row.removeRequested()
    }
    onCanceled: if (dragged) row.dragCanceled()
    onClicked: function(event) {
      if (dragged || pressedOnRemove) return
      if (event.button !== Qt.LeftButton) row.removeRequested()
      else row.featureRequested()
    }
    onDoubleClicked: {}
  }
}
