// Copied from Stonks by Gaurav Chande (MIT), omarchy-stonks v1.0.2, Sparkline.qml.
// Changes: a day has no breaks, so the pen never lifts and only a day of
// one candle draws a dot; the draw-in comes back with adding a symbol
// (roadmap step 8).
import QtQuick
import qs.Commons as Commons
import "Chart.js" as Chart
import "Tones.js" as Tones
// A small day line for a watchlist row and the pill. Value-in: hand it the
// normalized geometry from Chart.dayGeometry and the colors, it draws.
// Given a known direction it takes the hero's rule: the up colour above the
// dashed baseline and the down colour below it. Without one (the pill, a
// row still loading) it is one colour. The scrub's dot is its own layer, so
// a scrub never repaints the line.
Item {
  id: root

  property var geometry: null
  property color lineColor: Tones.dim(Commons.Color.foreground, Commons.Color.background)
  property var up: null
  property color upColor: Commons.Color.foreground
  property color downColor: Commons.Color.urgent
  readonly property bool split: typeof up === "boolean"
  property color baselineColor: Tones.dimmer(Commons.Color.foreground, Commons.Color.background)
  property real lineWidth: 1.25
  // 0..1 along the session, or -1 for none. Drawn as a small dot on the line.
  property real cursorX: -1
  readonly property real pad: 1.5
  // One print draws, as a dot, as the hero's does: a day with one bar is no
  // empty cell.
  readonly property bool drawable: !!geometry && !!geometry.points && geometry.points.length >= 1

  onGeometryChanged: { ink.requestPaint(); marks.requestPaint() }
  onLineColorChanged: { ink.requestPaint(); marks.requestPaint() }
  onSplitChanged: { ink.requestPaint(); marks.requestPaint() }
  onUpColorChanged: { ink.requestPaint(); marks.requestPaint() }
  onDownColorChanged: { ink.requestPaint(); marks.requestPaint() }
  onBaselineColorChanged: ink.requestPaint()
  onLineWidthChanged: ink.requestPaint()
  onCursorXChanged: marks.requestPaint()

  Canvas {
    id: ink
    anchors.fill: parent
    onWidthChanged: requestPaint()
    onHeightChanged: requestPaint()
    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      if (!root.drawable) return

      var pts = root.geometry.points
      var pad = root.pad
      var w = width - pad * 2
      var h = height - pad * 2

      ctx.strokeStyle = root.baselineColor
      ctx.lineWidth = 1
      // Round ends on every paint: the context keeps the last paint's cap,
      // so without this a first paint drew square dashes and repaints round.
      ctx.lineCap = "round"
      ctx.setLineDash([2, 3])
      ctx.beginPath()
      var by = pad + root.geometry.baselineY * h
      ctx.moveTo(pad, by)
      ctx.lineTo(pad + w, by)
      ctx.stroke()
      ctx.setLineDash([])

      ctx.lineWidth = root.lineWidth
      ctx.lineJoin = "round"
      ctx.lineCap = "round"
      // Split, the up colour over the baseline and the down colour under
      // it, in one stroke; two stops at one offset merge, so the second sits
      // a hair below.
      if (root.split) {
        var stop = Math.max(0, Math.min(1, by / height))
        var g = ctx.createLinearGradient(0, 0, 0, height)
        g.addColorStop(stop, root.upColor)
        g.addColorStop(Math.min(1, stop + 0.0001), root.downColor)
        ctx.strokeStyle = g
      } else ctx.strokeStyle = root.lineColor
      ctx.beginPath()
      for (var i = 0; i < pts.length; i++) {
        var x = pad + pts[i].x * w
        var y = pad + pts[i].y * h
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      // A day's only candle is a dot three line widths across.
      if (pts.length === 1) {
        var dy = pad + pts[0].y * h
        ctx.fillStyle = !root.split ? root.lineColor : dy <= by ? root.upColor : root.downColor
        ctx.beginPath()
        ctx.arc(pad + pts[0].x * w, dy, root.lineWidth * 1.5, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  Canvas {
    id: marks
    objectName: "scrubMarks"
    anchors.fill: parent
    onWidthChanged: requestPaint()
    onHeightChanged: requestPaint()
    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      if (!root.drawable || root.cursorX < 0) return
      var pts = root.geometry.points
      var pad = root.pad
      var w = width - pad * 2
      var h = height - pad * 2
      var by = pad + root.geometry.baselineY * h
      var cy = Chart.yAt(pts, root.cursorX)
      if (cy !== null) {
        ctx.fillStyle = !root.split ? root.lineColor : pad + cy * h <= by ? root.upColor : root.downColor
        ctx.beginPath()
        ctx.arc(pad + root.cursorX * w, pad + cy * h, 2.5, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
}
