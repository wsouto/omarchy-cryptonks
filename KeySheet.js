.pragma library
.import "Settings.js" as Settings
// Adapted from Stonks by Gaurav Chande (MIT), omarchy-stonks v1.0.2,
// KeySheet.js. Changes: only the keys that work today are on it; the
// ranges join it with roadmap step 9. `c` switches between two
// modes here, and the README's table of every key comes in step 12, so the
// sheet has no note pointing to it yet.

// What the key sheet shows. Knows nothing of how the keys are handled.

// The key sheet behind the header's ?: the everyday keys, grouped by what
// they touch, and the mouse in a few lines, so it stays short enough to
// read at a glance. J K, a row's drag, and the order's arrow show only where
// they act: J K and the drag on manual order, the arrow on a sorted one.
function sheet(order) {
  var manual = Settings.normalizeOrder(order) === "manual"
  var rows = [
    { key: "↑ ↓", does: "Move the selection" },
    { key: "⏎", does: "Show the row's chart" },
    { key: "1–9", does: "Show that row's chart" },
    { key: "a", does: "Search and add a symbol" },
    { key: "x", does: "Remove the selected row" },
    { key: "u", does: "Undo the last removal" }
  ]
  if (manual) rows.push({ key: "J K", does: "Move the row up or down" })
  var mouse = [
    { key: "pill", does: "Click opens this · middle-click changes form" },
    { key: "row", does: "Click shows its chart · right-click removes it" }
  ]
  if (manual) mouse.push({ key: "", does: "Drag moves it" })
  return {
    groups: [
      { title: "Rows", rows: rows },
      { title: "Chart", rows: [
        { key: "← →", does: "Scrub one chart step" },
        { key: "p", does: "Replay the chart" }
      ]},
      { title: "Lists", rows: [
        { key: "w", does: "Open the list menu" },
        { key: "o", does: "Change the list's order" },
        { key: ", .", does: "Previous or next list" }
      ]},
      { title: "Look", rows: [
        { key: "s", does: "Switch smooth and retro" },
        { key: "c", does: "Switch % and amount" },
        { key: "r", does: "Refresh" }
      ]}
    ],
    mouse: { title: "Mouse", rows: mouse.concat([
      // The sort word beside the list's name: in manual order the arrow and
      // the word are one control that steps.
      { key: "order", does: manual ? "Click changes the order" : "Click changes the order · click its arrow reverses it" },
      // The replay had a tooltip under the animal, which covered the line
      // naming the symbol: the sheet says it instead.
      { key: "animal", does: "Click the bull or bear to replay the chart" }
    ])},
    note: ""
  }
}
