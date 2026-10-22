.pragma library
// Copied from Stonks by Gaurav Chande (MIT), omarchy-stonks v1.0.2, Cells.js.
// Changes: only what the pill and the popup draw is kept, the block digits,
// the mark, the bull, the bear, the thin rule and the remove cross; the
// closing eyes are gone, since a perpetual never
// rests. `spriteFor` takes no lids.
//
// The cell drawings. Knows no data.

// The thin rules. 2 px is the thinnest at which a colour reads.
var RULE_THICKNESS = 2

// 3x5 bitmap digits, drawn in square cells the way Omarchy draws its own
// logo in blocks. Rows 0–4 stand on the baseline; row 5 is below it, where
// only the comma's tail goes, so "1,096.16" never reads as "1.096.16".
var BLOCK_GLYPHS = {
  "0": ["111", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"],
  "3": ["111", "001", "111", "001", "111"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"],
  "7": ["111", "001", "001", "001", "001"],
  "8": ["111", "101", "111", "101", "111"],
  "9": ["111", "101", "111", "001", "111"],
  ".": ["0", "0", "0", "0", "1"],
  ",": ["0", "0", "0", "0", "1", "1"],
  // The unavailable price, money(null), and the minus both draw as a bar,
  // and the price on its way draws as three dots rather than nothing.
  "—": ["000", "000", "111", "000", "000"],
  "\u2212": ["000", "000", "111", "000", "000"],
  "…": ["00000", "00000", "00000", "00000", "10101"]
}

// Stonks' mark: a small chart that climbs, as points left to right, 0 at the
// top. The look icon draws it as a curve and in cells.
function markPoints() {
  return [{ x: 0, y: 0.9 }, { x: 0.25, y: 0.45 }, { x: 0.5, y: 0.75 }, { x: 0.75, y: 0.25 }, { x: 1, y: 0.05 }]
}

// The mark in cells, the way the retro chart draws: each column's cap row,
// of `rows`, 0 at the top, its stem running down to the floor.
function markLevels(rows) {
  return markPoints().map(function(p) { return Math.round(p.y * (rows - 1)) })
}

// The price as cells on a five-row grid: every digit's full 3x5 slot, the
// way an LCD shows its unlit segments faintly, with the glyph's cells lit.
// Punctuation has no slot. One blank column between characters.
function blockCells(text) {
  var cells = []
  var x = 0
  var chars = String(text || "").split("")
  for (var c = 0; c < chars.length; c++) {
    var glyph = BLOCK_GLYPHS[chars[c]]
    if (!glyph) continue
    var slot = glyph[0].length === 3
    for (var r = 0; r < glyph.length; r++) {
      for (var b = 0; b < glyph[r].length; b++) {
        var lit = glyph[r].charAt(b) === "1"
        if (lit || slot) cells.push({ x: x + b, y: r, lit: lit })
      }
    }
    x += glyph[0].length + 1
  }
  return { columns: Math.max(0, x - 1), cells: cells }
}

// The bull for an up day, the bear for a down day: the header's animal in
// both looks, and the pill's icon form. 20 wide, 14 tall; "#" is a lit
// pixel. Two faces, front on. The bull reads by its long horns and its
// nostrils. The bear reads by round ears that stand out from its head,
// with a notch under each, and cheeks wider than its ears: earlier faces
// whose outline ran straight up into the ears read as cats.
var BULL_SPRITE = [
  "....................",
  "#..................#",
  "##................##",
  ".###............###.",
  "...######..######...",
  ".....##########.....",
  "...###.######.###...",
  ".....#.######.#.....",
  ".....##########.....",
  ".....##########.....",
  "....############....",
  "....##.######.##....",
  "....############....",
  ".....##########....."
]

var BEAR_SPRITE = [
  "....................",
  "..###..........###..",
  ".#####........#####.",
  ".##################.",
  ".##################.",
  "..################..",
  ".#####.######.#####.",
  "####################",
  ".#######....#######.",
  ".########..########.",
  ".########..########.",
  "..################..",
  "...##############...",
  ".....##########....."
]

// A row's remove button in retro: an × in the rows' 2 px cells, one cell
// thick and the height of the symbol's capitals beside it.
var REMOVE_SPRITE = [
  "#...#",
  ".#.#.",
  "..#..",
  ".#.#.",
  "#...#"
]

// Flattened lit pixels for a Repeater: [{x, y}, ...].
function spritePixels(rows) {
  var out = []
  for (var y = 0; y < rows.length; y++) {
    for (var x = 0; x < rows[y].length; x++) {
      if (rows[y].charAt(x) === "#") out.push({ x: x, y: y })
    }
  }
  return out
}

// The animal for an up day or a down one.
function spriteFor(up) {
  return spritePixels(up ? BULL_SPRITE : BEAR_SPRITE)
}
