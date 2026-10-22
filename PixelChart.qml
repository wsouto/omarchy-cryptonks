// Adapted from Stonks by Gaurav Chande (MIT), omarchy-stonks v1.0.2,
// PixelChart.qml. Changes: the day is the UTC day, so the extended hours,
// the bell and the night's edges, and a day's breaks are gone; the baseline
// row is the day's open, and the lit cap sits on the newest candle.
pragma ComponentBehavior: Bound

import QtQuick
import qs.Commons as Commons
import "Tones.js" as Tones
// The retro chart, one rule for the day and every range: pixel columns fill
// from the baseline row, the day's open, in the up colour above it and the
// down colour below, and the newest candle lit.
// The grid and the lit columns are painted when the data changes; the
// draw-in widens a clip over the columns a whole column at a time, and the
// scrub is cells laid over them.
Item {
  id: root

  property var geometry: null
  property color upColor: Commons.Color.foreground
  property color downColor: Commons.Color.urgent
  property color baselineColor: Tones.dimmer(Commons.Color.foreground, Commons.Color.background)
  property var up: true
  // Light the newest candle's cap white. Off for small copies.
  property bool glow: false
  // Twinkle that cap while refreshes land: white, colour, white, in
  // steps, the way a sprite blinks; four blinks, about 6 s, as a new price
  // arrives (`newestPrice`, the newest print's) or the surface opens, as the
  // smooth dot ripples, then it rests, shown and still.
  property bool live: false
  property string newestPrice: ""
  property bool surfaceOpen: true
  // A closing surface: the live mark stops where it is, as the rest of the
  // surface does; it blinks again as the surface opens.
  property bool still: false
  property color hairlineColor: Commons.Color.foreground
  // The unlit cells of the display, the way an LCD shows every segment
  // faintly. Transparent draws none.
  property color ghostColor: "transparent"
  property int pixel: 5
  property int gap: 1
  // 0..1 along the axis, or -1 when not scrubbing.
  property real scrubX: -1
  // How much of the ink has been drawn, 0..1. The grid and baseline are
  // always there; the lit columns fill in from the left edge to the newest
  // drawn print's, and at 1 the whole chart shows.
  property real reveal: 1
  // A replay's place along the plot, 0..1, or -1 without one: the columns
  // fill in behind it, whole columns of the plot.
  property real replayX: -1
  // The surface under the chart, which the stems are seen against.
  property color ground: Commons.Color.background

  // The grid the day is drawn on, shared by the paint and the cap overlay.
  readonly property var grid: layout()
  readonly property bool directionKnown: typeof up === "boolean"
  readonly property color aboveColor: directionKnown ? upColor : baselineColor
  readonly property color belowColor: directionKnown ? downColor : baselineColor
  // One print draws: the first print after midnight is a cell on its day.
  readonly property bool drawable: !!geometry && !!geometry.points && geometry.points.length >= 1
  // The baseline draws whenever there is a geometry.
  readonly property bool hasBaseline: !!geometry && typeof geometry.baselineY === "number" && isFinite(geometry.baselineY)
  // The columns the ink reaches, through the newest drawn print's. The
  // draw-in sweeps across these, a whole column at a time.
  readonly property int inkColumns: drawable
    ? Math.min(grid.columns, Math.floor(geometry.points[geometry.points.length - 1].x * grid.columns) + 1) : 0
  readonly property int scrubColumn: scrubX >= 0 ? Math.min(grid.columns - 1, Math.floor(scrubX * grid.columns)) : -1
  // The stems are retro's wash: the up colour's at 35%, and each side at
  // the alpha that adds the same lightness over the ground
  // (`Tones.washAlpha`), never more than half the ink of the cap above it. A
  // cap is the line, one share of its own colour on both sides.
  readonly property real aboveStem: Tones.washAlpha(aboveColor, upColor, ground, 0.35, 1)
  readonly property real belowStem: Tones.washAlpha(belowColor, upColor, ground, 0.35, 1)

  onGridChanged: { base.requestPaint(); ink.requestPaint() }
  onBaselineColorChanged: base.requestPaint()
  onGhostColorChanged: base.requestPaint()
  onAboveColorChanged: ink.requestPaint()
  onBelowColorChanged: ink.requestPaint()
  onAboveStemChanged: ink.requestPaint()
  onBelowStemChanged: ink.requestPaint()

  // Bucket the points by column; the last point in a bucket wins, which is
  // the price at the end of that stretch of the axis. A column no candle
  // falls in, between two the line joins, holds the last candle before it:
  // the price then. `last` is the newest candle's column, where the cap is.
  function layout() {
    var pitch = pixel + gap
    var g = {
      pitch: pitch,
      columns: Math.max(1, Math.floor(width / pitch)),
      rows: Math.max(1, Math.floor(height / pixel)),
      baseRow: 0,
      levels: [],
      last: -1
    }
    if (!hasBaseline) return g
    g.baseRow = Math.round(geometry.baselineY * (g.rows - 1))
    var pts = geometry.points
    for (var i = 0; i < pts.length; i++) {
      var col = Math.min(g.columns - 1, Math.floor(pts[i].x * g.columns))
      for (var held = g.last + 1; i > 0 && held < col; held++) g.levels[held] = g.levels[g.last]
      g.levels[col] = Math.round(pts[i].y * (g.rows - 1))
      g.last = col
    }
    return g
  }

  // The unlit grid and the dashed baseline row: always all there.
  Canvas {
    id: base
    anchors.fill: parent
    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      var g = root.grid
      var pixel = root.pixel
      if (root.ghostColor.a > 0) {
        ctx.fillStyle = root.ghostColor
        for (var gc = 0; gc < g.columns; gc++) {
          for (var gr = 0; gr < g.rows; gr++) ctx.fillRect(gc * g.pitch, gr * pixel, pixel, pixel - root.gap)
        }
      }
      if (!root.hasBaseline) return
      // The baseline: a dashed row of cells, every other column, so it lives
      // on the same grid as the bars instead of a hairline drawn across them.
      ctx.fillStyle = root.baselineColor
      for (var bc = 0; bc < g.columns; bc += 2) ctx.fillRect(bc * g.pitch, g.baseRow * pixel, pixel, pixel - root.gap)
    }
  }

  // The lit columns, revealed a whole column at a time.
  Item {
    id: curtain
    objectName: "curtain"
    width: (root.replayX >= 0 ? Math.ceil(root.grid.columns * Math.min(1, root.replayX))
      : root.reveal >= 1 ? root.grid.columns : Math.ceil(root.inkColumns * Math.max(0, root.reveal))) * root.grid.pitch
    height: root.height
    clip: true

    Canvas {
      id: ink
      objectName: "ink"
      width: root.width
      height: root.height
      onPaint: {
        var ctx = getContext("2d")
        ctx.clearRect(0, 0, width, height)
        if (!root.drawable) return
        var g = root.grid
        var pixel = root.pixel
        var baseRow = g.baseRow
        var baseY = baseRow * pixel
        for (var c = 0; c < g.columns; c++) {
          if (g.levels[c] === undefined) continue
          var y = g.levels[c] * pixel
          var above = g.levels[c] <= baseRow
          var color = above ? root.aboveColor : root.belowColor
          var x = c * g.pitch
          var top = Math.min(y, baseY)
          var h = Math.abs(y - baseY)
          // The stem from each cap down to the baseline.
          if (h > 0) {
            ctx.fillStyle = Qt.rgba(color.r, color.g, color.b, above ? root.aboveStem : root.belowStem)
            ctx.fillRect(x, top, pixel, h)
          }
          ctx.fillStyle = color
          ctx.fillRect(x, y, pixel, pixel)
        }
      }
    }
  }

  // The scrub: a faint column of cells with the cap lit.
  Rectangle {
    visible: root.drawable && root.scrubColumn >= 0
    x: root.scrubColumn * root.grid.pitch
    width: root.pixel
    height: root.height
    color: Qt.rgba(root.hairlineColor.r, root.hairlineColor.g, root.hairlineColor.b, 0.3)
  }

  Rectangle {
    visible: root.drawable && root.scrubColumn >= 0 && root.grid.levels[root.scrubColumn] !== undefined
    x: root.scrubColumn * root.grid.pitch
    y: visible ? root.grid.levels[root.scrubColumn] * root.pixel : 0
    width: root.pixel
    height: root.pixel
    color: root.hairlineColor
  }

  // The newest candle: one white cell over the cap, the pixel version of
  // the smooth chart's dot. Only once the day has drawn in.
  Rectangle {
    id: cap
    objectName: "liveCap"
    visible: root.glow && root.grid.last >= 0 && root.reveal >= 1 && root.replayX < 0
    x: root.grid.last * root.grid.pitch
    y: visible ? root.grid.levels[root.grid.last] * root.pixel : 0
    width: root.pixel
    height: root.pixel
    color: root.hairlineColor
    // Hidden mid-blink by an open's draw-in, it owes them still, and blinks
    // once it shows; any other hide, a sheet over it, stops them for good.
    onVisibleChanged: {
      if (visible) root.blink()
      else {
        if (blinks.running && root.opening && root.reveal < 1) root.blinkOwed = true
        blinks.stop()
      }
    }

    SequentialAnimation {
      id: blinks
      paused: running && root.still
      loops: 4
      onRunningChanged: if (!running) { cap.opacity = 1; root.opening = false }

      PropertyAction { target: cap; property: "opacity"; value: 1 }
      PauseAnimation { duration: 700 }
      PropertyAction { target: cap; property: "opacity"; value: 0.5 }
      PauseAnimation { duration: 160 }
      PropertyAction { target: cap; property: "opacity"; value: 0 }
      PauseAnimation { duration: 480 }
      PropertyAction { target: cap; property: "opacity"; value: 0.5 }
      PauseAnimation { duration: 160 }
    }
  }

  // The price the last blinks were for, and an open's blinks owed until the
  // cap can show them (`opening`, from the open until its blinks stop): a
  // scrub's end, or refreshes landing again with the price the cap already
  // blinked for, starts nothing.
  property string blinkedPrice: ""
  property bool blinkOwed: false
  property bool opening: false
  function blink() {
    if (!root.live || !cap.visible || root.still) return
    if (!root.blinkOwed && root.newestPrice === root.blinkedPrice) return
    // The restart's stop of a paused burst would end `opening`: an open's
    // blinks keep it, whichever of the open's changes starts them.
    var opening = root.opening
    root.blinkOwed = false
    root.blinkedPrice = root.newestPrice
    blinks.restart()
    root.opening = opening
  }
  onNewestPriceChanged: blink()
  onSurfaceOpenChanged: if (surfaceOpen) { blinkOwed = true; opening = true; blink() }
  onLiveChanged: if (live) blink(); else blinks.stop()
  onStillChanged: if (!still) blink()
}
