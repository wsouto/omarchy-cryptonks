import QtQuick
import qs.Commons as Commons
import qs.Ui

// The bar pill. For now it is a placeholder that proves the plugin installs
// and loads: it draws the word "CRYPTO" in the theme's foreground colour.
// The real pill (price, sparkline, change) replaces this in roadmap step 4.
//
// `BarWidget` comes from the Omarchy shell (qs.Ui). `moduleName` must equal
// the id in manifest.json; the shell uses it to find this widget's settings.
BarWidget {
  id: root
  moduleName: "wsouto.crypto-stonks"

  // The shell sizes the pill from these two values.
  implicitWidth: label.implicitWidth + 16
  implicitHeight: label.implicitHeight

  Text {
    id: label
    anchors.centerIn: parent
    text: "CRYPTO"
    color: Commons.Color.foreground
  }
}
