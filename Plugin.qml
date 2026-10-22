// Adapted from Stonks by Gaurav Chande (MIT), omarchy-stonks v1.0.2,
// Plugin.qml. Changes: no version watch.
import QtQuick

// The manifest's service entry: the data service, the theme's up and down,
// the window's host, and the IPC target, side by side, each on its own. The
// pill and the popup reach them through `serviceFor("wsouto.cryptonks")`:
// the data as `service`, the colours as `trendColors`, the window as
// `windowHost`, and the IPC target as `ipc`.
Item {
  id: root

  property var shell: null

  readonly property alias service: dataService
  readonly property alias trendColors: colors
  readonly property alias windowHost: host
  readonly property alias ipc: target

  Service { id: dataService }

  TrendColors { id: colors }

  WindowHost {
    id: host
    shell: root.shell
    service: dataService
    trendColors: colors
  }

  IpcTarget {
    id: target
    shell: root.shell
    service: dataService
    windowHost: host
  }
}
