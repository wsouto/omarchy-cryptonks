.pragma library
// Adapted from Stonks by Gaurav Chande (MIT), omarchy-stonks v1.0.2,
// KeySheet.js. Changes: only the keys that work today are on it; search,
// removal, undo, the row moves, the ranges and the lists join it with the
// steps that bring them (roadmap steps 8 to 10). `c` switches between two
// modes here, and the README's table of every key comes in step 12, so the
// sheet has no note pointing to it yet.

// What the key sheet shows. Knows nothing of how the keys are handled.

// The key sheet behind the header's ?: the everyday keys, grouped by what
// they touch, and the mouse in a few lines, so it stays short enough to
// read at a glance.
function sheet() {
  return {
    groups: [
      { title: "Rows", rows: [
        { key: "↑ ↓", does: "Move the selection" },
        { key: "⏎", does: "Show the row's chart" },
        { key: "1–9", does: "Show that row's chart" }
      ]},
      { title: "Chart", rows: [
        { key: "← →", does: "Scrub one chart step" },
        { key: "p", does: "Replay the chart" }
      ]},
      { title: "Look", rows: [
        { key: "s", does: "Switch smooth and retro" },
        { key: "c", does: "Switch % and amount" },
        { key: "r", does: "Refresh" }
      ]}
    ],
    mouse: { title: "Mouse", rows: [
      { key: "pill", does: "Click opens this · middle-click changes form" },
      { key: "row", does: "Click shows its chart" },
      // The replay had a tooltip under the animal, which covered the line
      // naming the symbol: the sheet says it instead.
      { key: "animal", does: "Click the bull or bear to replay the chart" }
    ]},
    note: ""
  }
}
