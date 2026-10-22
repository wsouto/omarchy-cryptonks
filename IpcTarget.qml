// Adapted from Stonks by Gaurav Chande (MIT), omarchy-stonks v1.0.2,
// IpcTarget.qml. Changes: the plugin's own id; `openWindow` takes no payload.
import QtQuick
import Quickshell.Io

// The plugin's one IPC target, `omarchy-shell wsouto.cryptonks <function>`,
// with or without a pill on the bar. The popup's verbs go through the shell,
// which opens the popup on the focused screen's pill.
Item {
  id: root

  property var shell: null
  property var service: null
  property var windowHost: null

  // Every property and signal of the handler is offered over IPC, so what
  // it is wired to lives on the item around it.
  IpcHandler {
    id: handler
    target: "wsouto.cryptonks"

    function refresh(): void { if (root.service) root.service.refresh() }

    function open(): void { if (root.shell) root.shell.summon("wsouto.cryptonks", "{}") }
    function close(): void { if (root.shell) root.shell.hide("wsouto.cryptonks") }
    function toggle(): void { if (root.shell) root.shell.toggle("wsouto.cryptonks", "{}") }

    function toggleWindow(): void { if (root.windowHost) root.windowHost.toggle() }
    function openWindow(): void { if (root.windowHost) root.windowHost.open() }
  }
}
