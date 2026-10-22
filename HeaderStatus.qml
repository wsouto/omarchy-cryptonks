// Adapted from Stonks by Gaurav Chande (MIT), omarchy-stonks v1.0.2,
// HeaderStatus.qml. Changes: the animal never sleeps, since a perpetual
// never rests; the look icon comes back with the retro look, and the help
// mark and the retry with the key sheet and the statuses (roadmap steps 8
// and 11).
import QtQuick
import qs.Commons
import qs.Commons as Commons
import "Cells.js" as Cells
import "Tones.js" as Tones

// The animal and the status words. Surfaces own the actions; this only
// draws and signals. The animal is the day's bull or bear in cells
// (`Cells.spriteFor`), in one slot the status words start after, drawn or
// not, so a flat day moves nothing. It has no tooltip: under the header one
// covered the line naming the symbol.
Item {
  id: root

  property string statusText: ""
  // The animal, as the body decides it: `kind` "bull", "bear", or "" (a
  // flat day, or no direction yet), and `chart`, what it reads. A turn of
  // the same chart crossfades; any other change is at once.
  property var animal: ({ kind: "", chart: "" })
  property bool scrubbing: false
  property bool live: false
  // The surface is closing: the animal's turn stops where it is.
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

  // At rest as a surface opens: the animal on what it reads.
  function settle() { show(false) }

  // The layers to the animal: crossfading when it turns on the chart it
  // showed, from wherever a turn under way has them; else at once.
  function show(fade) {
    shownChart = animal ? animal.chart : ""
    turn.stop()
    turnBull.to = kind === "bull" ? 1 : 0
    turnBear.to = kind === "bear" ? 1 : 0
    if (fade) turn.start()
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
    anchors.right: parent.right
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
}
