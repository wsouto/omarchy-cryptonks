// Adapted from Stonks by Gaurav Chande (MIT), omarchy-stonks v1.0.2,
// ChartMotion.qml. Changes: the chart is the last 24 hours of the quote on show,
// or a range's history (`History.js`), so there is no held chart dimming
// while the next one loads; the retro look's five-minute
// grain is the candles' own.
import QtQuick
import "Chart.js" as Chart
import "History.js" as History

// The chart a surface presents, its moment, and how it arrives: which
// moment it shows (the scrub, and the replay that drives it), and the one
// motion, a draw-in from the left, for every change of the chart on screen.
// It draws nothing itself.
Item {
  id: root

  // The quote on show, value in, and the range: the day, drawn from the
  // quote, or another, from its `history` (null until it comes).
  property var quote: null
  property string range: "1D"
  property var history: null
  property bool surfaceOpen: false

  readonly property bool onDay: range === "1D"
  readonly property var geometry: onDay ? Chart.dayGeometry(quote) : History.geometry(history)
  // Scrubbing and replay keep to the candles: from the first to the last.
  readonly property bool scrubbable: !!geometry
  readonly property int scrubStart: !scrubbable ? 0 : onDay ? quote.points[0].t : history.bars[0].t
  readonly property int scrubEnd: !scrubbable ? 0 : onDay ? quote.points[quote.points.length - 1].t : history.bars[history.bars.length - 1].t

  // The moment shown: 0 for now, otherwise a time on the chart.
  property int scrubT: 0
  // Where the moment shown sits on the chart, 0..1, or -1.
  function fractionOf(t) { return onDay ? Chart.fractionAtTime(quote, t) : History.fractionAtTime(history, t) }
  readonly property real scrubX: scrubbable && scrubT ? fractionOf(scrubT) : -1
  // How much of the chart's ink the draw-in has drawn, 0..1: the painters
  // sweep it from the left edge to the newest drawn candle, so a day partly
  // gone takes its whole time too.
  property real reveal: 1
  // Where a replay has reached, 0..1 along the chart.
  property real replayPosition: 0
  readonly property bool replayRunning: replayAnim.running
  // Where a replay's scrub has reached along the plot, 0..1, or -1 with no
  // replay running: the painters draw it in behind that.
  readonly property real replayX: replayRunning && scrubX >= 0 ? scrubX : -1

  // Another symbol or range on show draws in; new data for the same one is
  // taken as it is, and a scrub stays while the chart still holds its
  // moment. A chart that comes after the one asked for draws in as it comes.
  property string shownChart: ""
  property bool drawOnArrival: false
  onQuoteChanged: follow()
  onRangeChanged: follow()
  onHistoryChanged: follow()
  function follow() {
    var chart = (quote ? quote.symbol : "") + "|" + range
    var moved = chart !== shownChart
    shownChart = chart
    if (moved || (scrubT && (!scrubbable || fractionOf(scrubT) < 0))) clearScrub()
    if (moved && surfaceOpen && geometry) drawIn()
  }
  onGeometryChanged: {
    if (!geometry) drawOnArrival = true
    else if (drawOnArrival) {
      drawOnArrival = false
      if (surfaceOpen) drawIn()
    }
  }

  // A closing surface takes no scrub and no replay.
  function scrubTo(fraction) {
    if (!surfaceOpen || !scrubbable) return
    var t = onDay ? Chart.timeAtFraction(quote, fraction) : History.timeAtFraction(history, fraction)
    scrubT = Math.max(scrubStart, Math.min(t, scrubEnd))
  }

  function nudgeScrub(steps) {
    if (!scrubbable) return
    var t = scrubT || scrubEnd
    scrubT = onDay ? Chart.stepTime(quote, t, steps) : History.stepTime(history, t, steps)
  }

  // Back to now: the replay stops and the scrub with it.
  function clearScrub() {
    replayAnim.stop()
    scrubT = 0
  }

  // The one motion: the chart draws in from the left, in 320 ms.
  function drawIn() {
    drawInAnim.restart()
  }

  // An opening surface draws the chart on screen in.
  function revealChart() {
    drawInAnim.stop()
    reveal = 1
    if (geometry) drawIn()
  }

  // A replay is a scrub that drives itself, with the chart drawing in behind
  // it, so the header, the price, and the bull or bear follow it.
  function replay() {
    clearScrub()
    drawInAnim.stop()
    reveal = 1
    if (!scrubbable) return
    replayAnim.from = fractionOf(scrubStart)
    replayAnim.to = fractionOf(scrubEnd)
    // On its first moment at once, before the animation's first step.
    scrubTo(replayAnim.from)
    replayAnim.start()
  }

  // A closing surface stops what moves where it is: a replay keeps what it
  // had drawn, a draw-in what it had revealed. Only what runs can pause.
  function freeze() {
    if (replayAnim.running) replayAnim.pause()
    drawInAnim.stop()
  }

  // At rest before an open's first frame: now, and whole.
  function reset() {
    clearScrub()
    reveal = 1
  }

  NumberAnimation {
    id: drawInAnim
    target: root
    property: "reveal"
    from: 0
    to: 1
    duration: 320
    easing.type: Easing.OutCubic
  }

  NumberAnimation {
    id: replayAnim
    target: root
    property: "replayPosition"
    duration: 2000
    easing.type: Easing.InOutSine
    onFinished: root.scrubT = 0
  }
  onReplayPositionChanged: if (replayAnim.running) scrubTo(replayPosition)
}
