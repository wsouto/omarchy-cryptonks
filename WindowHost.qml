// Adapted from Stonks by Gaurav Chande (MIT), omarchy-stonks v1.0.2,
// WindowHost.qml. Changes: only the window and what a request for it does
// with the popup and Hyprland's workspaces; the screens are `Screens.qml`
// and a window out of sight is not told apart from one in view.
pragma ComponentBehavior: Bound

import QtQuick
import Quickshell.Hyprland

// Hosts the window, whatever is on the bar, and decides what a request for
// it does with the popup and Hyprland's workspaces. The window itself is
// `AppWindow`'s.
Item {
  id: root

  property var shell: null
  property var service: null
  property var trendColors: null

  readonly property bool opened: win.opened
  // The window as Hyprland lists it, once it is mapped.
  readonly property var toplevel: win.opened ? Hyprland.toplevels.values.find(root.isWindow) || null : null
  // Hyprland has it on a workspace other than the focused one.
  readonly property bool elsewhere: !!toplevel && !!toplevel.workspace && toplevel.workspace !== Hyprland.focusedWorkspace

  function isWindow(t) {
    return t.title === "Cryptonks" && !!t.wayland && t.wayland.appId === "org.quickshell"
  }

  function popupOpen() {
    return !!shell && typeof shell.isPluginOpen === "function" && shell.isPluginOpen("wsouto.cryptonks")
  }

  // The pill's right-click and IPC toggleWindow: the window open on this
  // workspace, with no popup over it, closes; otherwise it comes forward.
  function toggle() {
    if (win.opened && !elsewhere && !popupOpen()) win.close()
    else open()
  }

  // Opens the window, or brings it forward where it is, closing the popup.
  function open() {
    var shown = win.opened
    if (popupOpen()) shell.hide("wsouto.cryptonks")
    win.open()
    if (shown) focusWindow()
  }

  // Omarchy 4 configures Hyprland in Lua, where the classic dispatcher
  // syntax fails.
  function focusWindow() {
    if (!toplevel || !toplevel.address) return
    Hyprland.dispatch("hl.dsp.focus({ window = \"address:0x" + toplevel.address + "\" })")
  }

  AppWindow {
    id: win
    service: root.service
    trendColors: root.trendColors
  }
}
