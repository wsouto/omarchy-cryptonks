// Adapted from Stonks by Gaurav Chande (MIT), omarchy-stonks v1.0.2,
// Plugin.qml. Changes: the data service and the theme's up and down only;
// the version watch, the window and the IPC target come in later steps.
import QtQuick

// The manifest's service entry: the data service and the theme's up and
// down, side by side, each on its own. The pill and the popup reach them
// through `serviceFor("wsouto.crypto-stonks")`: the data as `service`, the
// colours as `trendColors`.
Item {
  id: root

  property var shell: null

  readonly property alias service: dataService
  readonly property alias trendColors: colors

  Service { id: dataService }

  TrendColors { id: colors }
}
