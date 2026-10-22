// Copied from Stonks by Gaurav Chande (MIT), omarchy-stonks v1.0.2, Sparkline.qml.
// Changes: only what the pill draws is kept, one colour; the split up and
// down colours, the draw-in, the scrub's dot and the breaks in a day come
// back with the rows, if they need them.
import QtQuick

// A small day line. Value-in: hand it the normalized geometry from
// Chart.dayGeometry and the colours, it draws, over a dashed baseline.
Item {
  id: root

  property var geometry: null
  property color lineColor
  property color baselineColor
  property real lineWidth: 1.25
  readonly property real pad: 1.5
  // One print draws, as a dot: a day with one candle is no empty cell.
  readonly property bool drawable: !!geometry && !!geometry.points && geometry.points.length >= 1

  onGeometryChanged: ink.requestPaint()
  onLineColorChanged: ink.requestPaint()
  onBaselineColorChanged: ink.requestPaint()
  onLineWidthChanged: ink.requestPaint()

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
      ctx.strokeStyle = root.lineColor
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
        ctx.fillStyle = root.lineColor
        ctx.beginPath()
        ctx.arc(pad + pts[0].x * w, pad + pts[0].y * h, root.lineWidth * 1.5, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
}
