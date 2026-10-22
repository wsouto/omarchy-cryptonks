// Adapted from Stonks by Gaurav Chande (MIT), omarchy-stonks v1.0.2,
// HeaderStatus.qml. Changes: the animal never sleeps, since a perpetual
// never rests; the retry comes with the statuses (roadmap step 11).
import QtQuick
import qs.Commons
import qs.Commons as Commons
import "Cells.js" as Cells
import "Tones.js" as Tones

// The animal, the status words, the look, and the help mark. Surfaces own the actions;
// this only draws and signals. The animal is the day's bull or bear in
// cells (`Cells.spriteFor`), the same in both looks, in one slot the status
// words start after, drawn or not, so neither the look nor a flat day moves
// them. The height is the slot's in both looks, and the look is one small
// icon in both, so toggling moves nothing. None of the three has a tooltip:
// under the header one covered the line naming the symbol, and what a click
// does is on the ? sheet with the keys.
Item {
  id: root

  property string statusText: ""
  property bool retro: false
  // The animal, as the body decides it: `kind` "bull", "bear", or "" (a
  // flat day, or no direction yet), and `chart`, what it reads. A turn of
  // the same chart crossfades in smooth; any other change, and every one in
  // retro, is at once.
  property var animal: ({ kind: "", chart: "" })
  property bool scrubbing: false
  property bool live: false
  // The surface is closing: the look icon's step and the animal's turn stop
  // where they are.
  property bool still: false
  property color foreground: Commons.Color.foreground
  property color dim: Tones.dim(foreground, Commons.Color.background)
  property color upColor: Commons.Color.foreground
  property color downColor: Commons.Color.urgent
  property string fontFamily: Style.font.family

  readonly property string kind: animal ? animal.kind : ""
  // The chart the animal last showed, by which a change is a turn.
  property string shownChart: ""

  signal replayRequested()
  signal styleRequested(string style)
  signal helpRequested()

  // At rest as a surface opens: the icon on the look, the animal on what
  // it reads.
  function settle() {
    lookIcon.settle()
    show(false)
  }

  // The layers to the animal: crossfading in smooth when it turns on the
  // chart it showed, from wherever a turn under way has them; else at once.
  function show(fade) {
    shownChart = animal ? animal.chart : ""
    turn.stop()
    turnBull.to = kind === "bull" ? 1 : 0
    turnBear.to = kind === "bear" ? 1 : 0
    if (fade && !retro) turn.start()
    else {
      bull.opacity = turnBull.to
      bear.opacity = turnBear.to
    }
  }

  Component.onCompleted: settle()
  // While still, nothing moves: a change waits for the open's `settle`.
  onAnimalChanged: if (!still) show(animal.chart === shownChart)
  onStillChanged: if (still && turn.running) turn.pause()

  implicitHeight: Style.space(28)
  implicitWidth: parent ? parent.width : 0
  height: implicitHeight
  width: parent ? parent.width : implicitWidth

  Item {
    id: slot
    width: Style.space(40)
    height: Style.space(28)
    anchors.left: parent.left
    anchors.verticalCenter: parent.verticalCenter

    // One layer each, so the turn crossfades between them.
    PixelSprite {
      id: bull
      anchors.fill: parent
      visible: opacity > 0
      pixels: Cells.spriteFor(true)
      color: root.upColor
    }
    PixelSprite {
      id: bear
      anchors.fill: parent
      visible: opacity > 0
      pixels: Cells.spriteFor(false)
      color: root.downColor
    }

    ParallelAnimation {
      id: turn
      NumberAnimation { id: turnBull; target: bull; property: "opacity"; duration: 160; easing.type: Easing.OutCubic }
      NumberAnimation { id: turnBear; target: bear; property: "opacity"; duration: 160; easing.type: Easing.OutCubic }
    }

    MouseArea {
      anchors.fill: parent
      enabled: root.kind !== ""
      cursorShape: Qt.PointingHandCursor
      onClicked: root.replayRequested()
    }
  }

  // Live is said by the chart's breathing dot and by these words in the
  // foreground; a mark in front of them would push them over each time it
  // came and went.
  Text {
    anchors.left: slot.right
    anchors.leftMargin: Style.space(14)
    anchors.right: lookIcon.left
    anchors.rightMargin: Style.space(8)
    anchors.verticalCenter: parent.verticalCenter
    textFormat: Text.PlainText
    text: root.statusText.toUpperCase()
    color: root.scrubbing || root.live ? root.foreground : root.dim
    font.family: root.fontFamily
    font.pixelSize: Style.font.caption
    font.bold: true
    font.letterSpacing: 1
    elide: Text.ElideRight
  }

  // The look a click switches to, as s does, about a word tall: the chart
  // already shows the current one. The target is the header's full height,
  // so a click above or below the icon still lands. It hovers in brighter
  // ink, and takes the pressed fill while the button is down.
  LookIcon {
    id: lookIcon
    anchors.right: helpMark.left
    anchors.rightMargin: Style.space(14)
    anchors.verticalCenter: parent.verticalCenter
    retro: root.retro
    still: root.still
    color: lookMouse.containsMouse ? root.foreground : root.dim

    Rectangle {
      z: -1
      anchors.centerIn: parent
      width: parent.width + Style.space(12)
      height: parent.height + Style.space(6)
      radius: root.retro ? 0 : Style.cornerRadius
      color: lookMouse.pressed ? Style.pressedFillFor(root.foreground, Commons.Color.accent) : "transparent"
    }

    MouseArea {
      id: lookMouse
      anchors.horizontalCenter: parent.horizontalCenter
      anchors.verticalCenter: parent.verticalCenter
      width: parent.width + Style.space(12)
      height: root.height
      hoverEnabled: true
      cursorShape: Qt.PointingHandCursor
      onClicked: root.styleRequested(root.retro ? "smooth" : "retro")
    }
  }

  // Inset by its fill's margin, so the pressed fill ends on the header's
  // edge: the popup clips anything past it.
  Text {
    id: helpMark
    anchors.right: parent.right
    anchors.rightMargin: Style.space(6)
    anchors.verticalCenter: parent.verticalCenter
    textFormat: Text.PlainText
    text: "?"
    color: helpMouse.containsMouse ? root.foreground : root.dim
    font.family: root.fontFamily
    font.pixelSize: Style.font.caption
    font.bold: true
    Behavior on color { ColorAnimation { duration: 160; easing.type: Easing.OutCubic } }
    Rectangle {
      z: -1
      anchors.centerIn: parent
      width: parent.implicitWidth + Style.space(12)
      height: parent.implicitHeight + Style.space(4)
      radius: root.retro ? 0 : Style.cornerRadius
      color: helpMouse.pressed ? Style.pressedFillFor(root.foreground, Commons.Color.accent) : "transparent"
    }
    MouseArea {
      id: helpMouse
      anchors.horizontalCenter: parent.horizontalCenter
      anchors.verticalCenter: parent.verticalCenter
      width: Math.max(Style.space(24), parent.width + Style.space(12))
      height: root.height
      hoverEnabled: true
      cursorShape: Qt.PointingHandCursor
      onClicked: root.helpRequested()
    }
  }
}
