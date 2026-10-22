// Adapted from Stonks by Gaurav Chande (MIT), omarchy-stonks v1.0.2,
// AddFooter.qml. Changes: no hint, and a notice that only says the data file
// can't be read, not that a newer version is out or how to install it; no scrollbar gutter, since the rows here
// keep none.
import QtQuick
import qs.Commons
import qs.Commons as Commons
import qs.Ui
import "Tones.js" as Tones

// Pinned "+ Add a symbol" bar. The popup owns the add flow. For a moment it
// can carry a note instead, in the foreground: why a key did nothing, or
// what a removal took, with what a click does about it (`noteAction`), said
// whole so a long note is what gets cut. It stays while the pointer is on
// it (`hovered`).
Item {
  id: root

  property bool retro: false
  property color foreground: Commons.Color.foreground
  property color dim: Tones.dim(foreground, Commons.Color.background)
  property string fontFamily: Style.font.family
  property int rowHeight: Style.space(30)
  property string note: ""
  property string noteAction: ""
  // Until what it says is fixed, in the foreground too, under any note; its
  // click does nothing (`acts`).
  property string notice: ""
  // A click does something: the add, an undo.
  property bool acts: true
  property string label: "+  Add a symbol"

  readonly property bool hovered: addMouse.containsMouse
  // The note as its moment ends, 1 to 0; what it covered fades in after it
  // (fadeIn), in the house 160 ms.
  property real noteOpacity: 1
  property real coveredOpacity: 1
  function fadeIn() { coveredIn.restart() }
  function settle() {
    coveredIn.stop()
    coveredOpacity = 1
  }
  NumberAnimation {
    id: coveredIn
    target: root
    property: "coveredOpacity"
    from: 0
    to: 1
    duration: 160
    easing.type: Easing.OutCubic
  }

  signal clicked()

  implicitHeight: rowHeight + Style.space(6)
  height: implicitHeight

  PanelSeparator {
    width: root.width
    foreground: root.foreground
    strength: 0.08
  }

  Rectangle {
    objectName: "footerFill"
    anchors.fill: parent
    anchors.topMargin: Style.space(6)
    radius: root.retro ? 0 : Style.cornerRadius
    color: !root.acts ? "transparent"
      : addMouse.pressed ? Style.pressedFillFor(root.foreground, Commons.Color.accent)
      : addMouse.containsMouse ? Style.hoverFillFor(root.foreground, Commons.Color.accent) : "transparent"

    Row {
      anchors.centerIn: parent

      Text {
        objectName: "footerText"
        width: Math.min(implicitWidth, root.width - Style.space(20) - (noteAction.visible ? noteAction.implicitWidth : 0))
        elide: Text.ElideRight
        // Cut short, it ends against its action, not a gap's width away.
        horizontalAlignment: Text.AlignRight
        textFormat: Text.PlainText
        text: root.note !== "" ? root.note : root.notice !== "" ? root.notice : root.label
        color: root.note !== "" || root.notice !== "" ? root.foreground : root.dim
        opacity: root.note !== "" ? root.noteOpacity : root.coveredOpacity
        font.family: root.fontFamily
        font.pixelSize: Style.font.bodySmall
      }

      Text {
        id: noteAction
        objectName: "footerAction"
        visible: root.note !== "" && root.noteAction !== ""
        textFormat: Text.PlainText
        text: root.noteAction
        color: root.foreground
        opacity: root.noteOpacity
        font.family: root.fontFamily
        font.pixelSize: Style.font.bodySmall
      }
    }

    MouseArea {
      id: addMouse
      anchors.fill: parent
      hoverEnabled: true
      cursorShape: root.acts ? Qt.PointingHandCursor : Qt.ArrowCursor
      onClicked: root.clicked()
      // A double-click is one click: an undo, then not a search.
      onDoubleClicked: {}
    }
  }
}
