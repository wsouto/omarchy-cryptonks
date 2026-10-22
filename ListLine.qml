// Adapted from Stonks by Gaurav Chande (MIT), omarchy-stonks v1.0.2, the
// list line of HeroBand.qml. Changes: its own file; "TODAY", which says the
// rows keep the day on every range, comes with the ranges in roadmap step 9.
// The breadth rule rests while the popup is closed.
import QtQuick
import qs.Commons
import qs.Commons as Commons
import "Settings.js" as Settings

// The line over the rows: the list's name on the left, which opens the list
// menu, its order on the right, and the list's breadth between them.
Item {
  id: root

  property string listLabel: "All"
  property string order: "manual"
  property bool reversed: false
  property bool retro: false
  property color foreground: Commons.Color.foreground
  property color dim: Commons.Color.foreground
  property string fontFamily: Style.font.family
  property color upColor: Commons.Color.foreground
  property color downColor: Commons.Color.urgent
  property var breadth: ({ list: "", up: 0, flat: 0, down: 0, none: 0 })
  property bool still: false
  function settle() { breadthRule.settle() }

  signal listClicked()
  signal orderClicked()
  signal orderReverseClicked()

  implicitHeight: listText.implicitHeight

  Text {
    id: listText
    anchors.left: parent.left
    anchors.verticalCenter: parent.verticalCenter
    width: Math.min(implicitWidth, parent.width - orderText.implicitWidth - Style.space(60))
    textFormat: Text.PlainText
    text: root.listLabel.toUpperCase()
    color: root.foreground
    font.family: root.fontFamily
    font.pixelSize: Style.font.caption
    font.bold: true
    font.letterSpacing: 1
    elide: Text.ElideRight
  }

  Text {
    id: listChevron
    anchors.left: listText.right
    anchors.leftMargin: Style.space(6)
    anchors.verticalCenter: parent.verticalCenter
    text: "󰅀"
    color: root.dim
    font.family: root.fontFamily
    font.pixelSize: Style.font.caption
    font.bold: true
  }

  MouseArea {
    id: listMouse
    anchors.left: listText.left
    anchors.right: listChevron.right
    anchors.top: parent.top
    anchors.bottom: parent.bottom
    anchors.margins: -Style.space(6)
    hoverEnabled: true
    cursorShape: Qt.PointingHandCursor
    onClicked: root.listClicked()
  }

  // The rule between the name and the order is the list's breadth.
  BreadthRule {
    id: breadthRule
    anchors.left: listChevron.right
    anchors.leftMargin: Style.space(12)
    anchors.right: orderText.left
    anchors.rightMargin: Style.space(16)
    anchors.top: parent.top
    anchors.bottom: parent.bottom
    breadth: root.breadth
    retro: root.retro
    still: root.still
    foreground: root.foreground
    dim: root.dim
    upColor: root.upColor
    downColor: root.downColor
    fontFamily: root.fontFamily
  }

  // The order control hovers the way a button does: the fill and the
  // brighter word, so it reads as a control and not a label. In a sorted
  // order the arrow and the word are two controls, each with its own fill:
  // the arrow reverses the order, the word steps to the next. Manual has no
  // direction, so there they are one control that steps.
  Rectangle {
    objectName: "orderControl"
    anchors.right: orderText.right
    anchors.rightMargin: -Style.space(6)
    anchors.verticalCenter: orderText.verticalCenter
    width: orderText.sorted ? orderText.implicitWidth - orderText.wordStart + Style.space(12)
      : orderText.implicitWidth + Style.space(12)
    height: parent.height + Style.space(4)
    radius: root.retro ? 0 : Style.cornerRadius
    readonly property bool hovered: wordMouse.containsMouse || !orderText.sorted && arrowMouse.containsMouse
    readonly property bool pressed: wordMouse.pressed || !orderText.sorted && arrowMouse.pressed
    color: pressed ? Style.pressedFillFor(root.foreground, Commons.Color.accent)
      : hovered ? Style.hoverFillFor(root.foreground, Commons.Color.accent) : "transparent"
    Behavior on color { ColorAnimation { duration: 160; easing.type: Easing.OutCubic } }
  }

  // The arrow's fill pads it as the word's fill pads the word, so the two
  // read as two buttons.
  Rectangle {
    objectName: "orderArrowFill"
    visible: orderText.sorted
    x: orderText.x - Style.space(6)
    width: Math.round(arrowMetrics.advanceWidth) + Style.space(12)
    anchors.verticalCenter: orderText.verticalCenter
    height: parent.height + Style.space(4)
    radius: root.retro ? 0 : Style.cornerRadius
    color: arrowMouse.pressed ? Style.pressedFillFor(root.foreground, Commons.Color.accent)
      : arrowMouse.containsMouse ? Style.hoverFillFor(root.foreground, Commons.Color.accent) : "transparent"
    Behavior on color { ColorAnimation { duration: 160; easing.type: Easing.OutCubic } }
  }

  // The arrow alone, and the arrow with the two spaces after it, as the
  // label draws them.
  TextMetrics {
    id: arrowMetrics
    font: orderText.font
    text: orderText.text.slice(0, 1)
  }
  TextMetrics {
    id: gapMetrics
    font: orderText.font
    text: orderText.text.slice(0, 3)
  }

  Text {
    id: orderText
    objectName: "orderLabel"
    anchors.right: parent.right
    anchors.rightMargin: Style.space(6)
    anchors.verticalCenter: parent.verticalCenter
    textFormat: Text.PlainText
    text: Settings.orderLabel(root.order, root.reversed)
    readonly property bool sorted: root.order !== "manual"
    // Where the word's first letter starts: the arrow's target runs up to
    // it, through the gap.
    readonly property real wordStart: Math.round(gapMetrics.advanceWidth)
    // A sorted order is bright and manual dim, at once with the word; only
    // the hover's brightening eases.
    property real lift: arrowMouse.containsMouse || wordMouse.containsMouse ? 1 : 0
    Behavior on lift { NumberAnimation { duration: 160; easing.type: Easing.OutCubic } }
    color: sorted ? root.foreground
      : Qt.tint(root.dim, Qt.rgba(root.foreground.r, root.foreground.g, root.foreground.b, lift))
    font.family: root.fontFamily
    font.pixelSize: Style.font.caption
    font.bold: true
    font.letterSpacing: 1

    MouseArea {
      id: arrowMouse
      objectName: "orderArrow"
      x: -Style.space(6)
      y: -Style.space(6)
      width: Style.space(6) + orderText.wordStart
      height: parent.height + Style.space(12)
      hoverEnabled: true
      cursorShape: Qt.PointingHandCursor
      onClicked: orderText.sorted ? root.orderReverseClicked() : root.orderClicked()
    }

    MouseArea {
      id: wordMouse
      x: orderText.wordStart
      y: -Style.space(6)
      width: parent.width - orderText.wordStart + Style.space(6)
      height: parent.height + Style.space(12)
      hoverEnabled: true
      cursorShape: Qt.PointingHandCursor
      onClicked: function(mouse) {
        if (mouse.modifiers & Qt.ShiftModifier) root.orderReverseClicked()
        else root.orderClicked()
      }
    }
  }
}
