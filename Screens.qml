// Adapted from Stonks by Gaurav Chande (MIT), omarchy-stonks v1.0.2, the
// screens part of WindowHost.qml. Changes: on its own, since the window it
// shared a file with comes in roadmap step 10.
pragma ComponentBehavior: Bound

import QtQuick
import Quickshell
import Quickshell.Hyprland

// Hyprland's screens: whether every one is off (DPMS) as Hyprland last
// answered, which holds the feed's runs. `ask` asks afresh, before each
// run; each screen's answer says so (`answered`). With no screens to ask, as
// in a harness, it asks nothing and says so. While every screen is off, any
// word from Hyprland asks again, so a run waits no longer than it must.
Item {
  id: root

  readonly property var monitors: Hyprland.monitors.values
  readonly property bool screensOff: monitors.length > 0 && monitors.every(function(m) {
    return !!m.lastIpcObject && m.lastIpcObject.dpmsStatus === false
  })

  signal answered()

  function ask() {
    if (root.monitors.length === 0) return false
    Hyprland.refreshMonitors()
    return true
  }

  Instantiator {
    model: root.monitors
    delegate: Connections {
      required property var modelData
      target: modelData
      function onLastIpcObjectChanged() { root.answered() }
    }
  }

  Connections {
    target: Hyprland
    enabled: root.screensOff
    function onRawEvent(event) { Hyprland.refreshMonitors() }
  }
}
