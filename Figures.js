.pragma library
// Adapted from Stonks by Gaurav Chande (MIT), omarchy-stonks v1.0.2,
// Figures.js. Changes: only the pill's two rules are kept, and the animal
// reads the move's sign as drawn rather than the original's row model.
//
// What the pill's arrow and icon forms make of the day's move.

// The 23-degrees idea: the arrow's tilt is the size of today's move, flat at
// zero and pinned at 45 degrees past a five percent day.
function arrowAngle(pctChange) {
  if (typeof pctChange !== "number" || !isFinite(pctChange)) return 0
  return Math.max(-1, Math.min(1, pctChange / 5)) * 45
}

// The day's animal by the move's sign as drawn: the bull up, the bear down,
// and none for a flat day.
function animalKind(sign) {
  return sign > 0 ? "bull" : sign < 0 ? "bear" : ""
}
