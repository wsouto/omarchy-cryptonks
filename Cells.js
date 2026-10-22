.pragma library
// Copied from Stonks by Gaurav Chande (MIT), omarchy-stonks v1.0.2, Cells.js.
// Changes: only what the pill draws is kept, the bull, the bear and the thin
// rule; the block digits, the mark, the remove cross and the closing eyes
// come back with the screens that need them. `spriteFor` takes no lids.
//
// The cell drawings. Knows no data.

// The thin rules. 2 px is the thinnest at which a colour reads.
var RULE_THICKNESS = 2

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
