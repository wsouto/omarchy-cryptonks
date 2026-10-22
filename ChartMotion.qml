// Adapted from Stonks by Gaurav Chande (MIT), omarchy-stonks v1.0.2,
// ChartMotion.qml. Changes: one chart, the UTC day of the quote on show, so
// there is no range, no history, and no held chart dimming while the next
// one loads (those come with the ranges, roadmap step 9); the retro look's
// five-minute grain is the candles' own.
import QtQuick
import "Chart.js" as Chart

// The chart a surface presents, its moment, and how it arrives: which
// moment it shows (the scrub, and the replay that drives it), and the one
// motion, a draw-in from the left, for every change of the chart on screen.
// It draws nothing itself.
Item {
  id: root

  // The quote on show, value in.
  property var quote: null
  property bool surfaceOpen: false

  readonly property var geometry: Chart.dayGeometry(quote)
  // Scrubbing and replay keep to the candles: from the first to the last.
  readonly property bool scrubbable: !!geometry
  readonly property int scrubStart: scrubbable ? quote.points[0].t : 0
  readonly property int scrubEnd: scrubbable ? quote.points[quote.points.length - 1].t : 0

  // The moment shown: 0 for now, otherwise a time on the day.
  property int scrubT: 0
  // Where the moment shown sits on the chart, 0..1, or -1.
  readonly property real scrubX: scrubbable && scrubT ? Chart.fractionAtTime(quote, scrubT) : -1
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

  // Another symbol on show draws in; new data for the same one is taken as
  // it is, and a scrub stays while the day still holds its moment.
  property string shownSymbol: ""
  onQuoteChanged: {
    var symbol = quote ? quote.symbol : ""
    var moved = symbol !== shownSymbol
    shownSymbol = symbol
    if (moved || (scrubT && (!scrubbable || Chart.fractionAtTime(quote, scrubT) < 0))) clearScrub()
    if (moved && surfaceOpen) drawIn()
  }

  // A closing surface takes no scrub and no replay.
  function scrubTo(fraction) {
    if (!surfaceOpen || !scrubbable) return
    scrubT = Math.max(scrubStart, Math.min(Chart.timeAtFraction(quote, fraction), scrubEnd))
  }

  function nudgeScrub(steps) {
    if (!scrubbable) return
    scrubT = Chart.stepTime(quote, scrubT || scrubEnd, steps)
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
    replayAnim.from = Chart.fractionAtTime(quote, scrubStart)
    replayAnim.to = Chart.fractionAtTime(quote, scrubEnd)
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
