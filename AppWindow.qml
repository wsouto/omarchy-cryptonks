// Adapted from Stonks by Gaurav Chande (MIT), omarchy-stonks v1.0.2, App.qml.
// Changes: no request payload (a symbol and a range to show), no version
// watch, no fundamentals; the window's title is "Crypto Stonks".
pragma ComponentBehavior: Bound

import QtQuick
import Quickshell
import qs.Commons
import qs.Commons as Commons
import "KeyText.js" as KeyText

// The tiled window. Owns its lifecycle and reads the keys; `Body` owns what
// is shown. The rows take the height the window has.
Item {
  id: root

  property var service: null
  property var trendColors: null
  property bool closingFromHost: false

  readonly property bool opened: window.visible
  readonly property var body: bodyLoader.item

  function open() {
    var opening = !window.visible
    closingFromHost = false
    bodyLoader.active = true
    window.visible = true
    if (service) service.windowOpen = true
    if (opening) root.body.resetInteraction()
    refocusKeys()
  }

  function close() {
    closingFromHost = true
    if (root.body) root.body.freeze()
    if (service) service.windowOpen = false
    window.visible = false
    closingFromHost = false
  }

  function refocusKeys() { Qt.callLater(function() { if (keyCatcher) keyCatcher.forceActiveFocus() }) }

  FloatingWindow {
    id: window
    title: "Crypto Stonks"
    color: Commons.Color.background
    implicitWidth: Style.space(520)
    implicitHeight: Style.space(760)
    visible: false

    // A close by the compositor freezes the body as one of ours does.
    onVisibleChanged: if (!visible && !root.closingFromHost) root.close()

    FocusScope {
      id: keyCatcher
      anchors.fill: parent
      focus: true
      Keys.onPressed: function(event) {
        var body = root.body
        if (!body || body.ownsKeys) return
        var t = KeyText.typed(event)
        if (event.key === Qt.Key_Escape) body.escapeKey()
        else if (event.key === Qt.Key_Up) body.moveKeys(0, -1)
        else if (event.key === Qt.Key_Down) body.moveKeys(0, 1)
        else if (event.key === Qt.Key_Left) body.moveKeys(-1, 0)
        else if (event.key === Qt.Key_Right) body.moveKeys(1, 0)
        else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) body.activate()
        else if (event.key === Qt.Key_Backspace || event.key === Qt.Key_Delete) body.deleteKey()
        else if (t !== "") body.textKey(t, event.modifiers)
        else return
        event.accepted = true
      }

      // A tiled window can be very wide; past the width the layout is drawn
      // for, the body keeps that width and centres, so a row never splits
      // into two islands. Narrower, it fills.
      Loader {
        id: bodyLoader
        active: false
        width: Math.min(parent.width, Style.space(520))
        height: parent.height
        anchors.horizontalCenter: parent.horizontalCenter
        sourceComponent: Body {
          anchors.fill: parent
          // The rows have what the fixed content leaves.
          rowsRoom: Math.max(0, height - chromeHeight - Style.space(8))
          service: root.service
          trendColors: root.trendColors
          surfaceOpen: window.visible
          ground: Commons.Color.background
          onKeysReleased: root.refocusKeys()
          onCloseRequested: root.close()
        }
      }
    }
  }
}
