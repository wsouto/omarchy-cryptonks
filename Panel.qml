// Adapted from Stonks by Gaurav Chande (MIT), omarchy-stonks v1.0.2,
// Panel.qml. Changes: the body is `Body.qml`, shared with the window; the
// statuses come in roadmap step 11.

import QtQuick
import qs.Commons
import qs.Commons as Commons
import qs.Ui

// The popup. Owns its lifecycle and reads the keys; `Body` owns what is
// shown, and the service the data and the saved look and change mode.
Panel {
  id: root
  moduleName: "wsouto.crypto-stonks"
  ipcTarget: "wsouto.crypto-stonks"
  manageIpc: false

  property var anchorItem: null
  property var hostWidget: null
  // The plugin's `Service` and `TrendColors`.
  property var service: null
  property var trendColors: null
  readonly property var barIdentity: hostWidget || root
  readonly property int panelWidth: Style.space(480)

  // The card's place along the bar, held from an open from closed until the
  // next; an open during the close fade keeps it, since the card is still on
  // screen.
  HeldAnchor {
    id: heldAnchor
    pill: root.anchorItem
  }

  // The views reset as the popup opens, before its first frame, not as it
  // closes: the card fades out showing what you were looking at.
  function open() {
    var opening = !root.opened
    var fading = opening && panel.visible
    root.controller.show()
    if (root.service) root.service.popupOpen = true
    if (opening) {
      if (!fading) heldAnchor.hold()
      body.resetInteraction()
    }
    Qt.callLater(function() { if (root.opened) setCenterHoverRevealSuppressed(true) })
  }

  function close() {
    setCenterHoverRevealSuppressed(false)
    body.freeze()
    if (root.service) root.service.popupOpen = false
    root.controller.hide()
  }

  function toggle() {
    if (root.opened) root.close()
    else root.open()
  }

  function switchPanel(direction) {
    if (root.bar && typeof root.bar.switchPanelFrom === "function")
      return root.bar.switchPanelFrom(root.barIdentity, direction)
    return false
  }

  function setCenterHoverRevealSuppressed(value) {
    if (root.bar && typeof root.bar.setCenterHoverRevealSuppressed === "function")
      root.bar.setCenterHoverRevealSuppressed(value)
  }

  KeyboardPanel {
    id: panel
    anchorItem: heldAnchor
    owner: root.barIdentity
    bar: root.bar
    open: root.opened
    focusTarget: keyCatcher
    contentWidth: panel.fittedContentWidth(root.panelWidth)
    contentHeight: panel.fittedContentHeight(body.wantedHeight)

    PanelKeyCatcher {
      id: keyCatcher
      anchors.fill: parent
      // The clip reaches `edge` past the body on each side, so a range
      // token's fill, which pads its word, is not cut at the band's edge.
      anchors.leftMargin: -body.edge
      anchors.rightMargin: -body.edge
      clip: true
      blocked: body.ownsKeys
      // Ctrl+↑ ↓ and Ctrl+J K move the selected row, as the shell's panels do.
      reorderable: true
      onReorderRequested: function(dy) { body.moveSelected(dy) }
      onMoveRequested: function(dx, dy) { body.moveKeys(dx, dy) }
      onActivateRequested: body.activate()
      onCloseRequested: body.escapeKey()
      onDeleteRequested: body.deleteKey()
      onTabRequested: function(direction) { root.switchPanel(direction) }
      onTextKey: function(text, modifiers) { body.textKey(text, modifiers) }

      Body {
        id: body
        anchors.fill: parent
        service: root.service
        trendColors: root.trendColors
        surfaceOpen: root.opened
        foreground: root.bar ? root.bar.foreground : Commons.Color.foreground
        fontFamily: root.bar ? root.bar.fontFamily : Style.font.family
        ground: Qt.rgba(Commons.Color.popups.background.r, Commons.Color.popups.background.g, Commons.Color.popups.background.b, 1)
        onKeysReleased: keyCatcher.forceActiveFocus()
        onCloseRequested: root.close()
      }
    }
  }
}
