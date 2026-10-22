// Adapted from Stonks by Gaurav Chande (MIT), omarchy-stonks v1.0.2,
// SymbolSearch.qml. Changes: the results come from the instrument list
// already fetched (`SymbolList.qml`, `Search.js`), at once and with no
// request, so there is no typing pause, no answer still out, no stale
// answer and no note on what was left out; every result is a Bybit USDT
// perpetual, so there is no exchange column; what fails is the list, said
// as "The symbol list didn't load" with RETRY.
pragma ComponentBehavior: Bound

import QtQuick
import qs.Commons
import qs.Commons as Commons
import qs.Ui
import "Search.js" as Search
import "Tones.js" as Tones

// Search field and results. The popup turns it on and off (`active`) and
// handles picked / chose / cancelled, and gives it the room of
// desiredHeight as it opens. The field sits at the top and the results fill
// down under it, whole rows only. The keyboard owns the choice: it starts
// on the top result, the arrows move it and keep it in view, Enter takes
// it, and every change of it is told (`chose`), so the hero can show it
// before it is added. The pointer tints the row under it, and a click takes
// that row as Enter does: chosen, then added, or shown when it is already
// in the list. So a pointer resting over the list never changes what Enter
// adds. A FocusScope so that hiding it takes the keyboard away from the
// field; otherwise the hidden field keeps every later key the popup's own
// key handler should see.
FocusScope {
  id: root

  property bool retro: false
  property color foreground: Commons.Color.foreground
  property color dim: Tones.dim(foreground, Commons.Color.background)
  property string fontFamily: Style.font.family
  property int rowHeight: Style.space(30)
  readonly property int maxResults: Search.MAX_RESULTS
  readonly property int rowGap: Style.space(2)
  readonly property int rowPitch: rowHeight + rowGap
  readonly property int resultsGap: Style.space(4)
  readonly property int desiredHeight: fieldBar.height + resultsGap + rowPitch * maxResults - rowGap
  // The results' room under the field, in whole rows: a row is never cut.
  readonly property int resultsHeight: {
    var rows = Math.floor((Math.max(0, height - fieldBar.height - resultsGap) + rowGap) / rowPitch)
    return rows > 0 ? rows * rowPitch - rowGap : 0
  }

  // The list to search, `SymbolList`'s, and its status: "loading",
  // "failed", or "".
  property var instruments: []
  property string listStatus: ""
  // The quote coin every symbol ends in, so "eth" ranks ETHUSDT first.
  property string quoteCoin: ""
  property string searchText: ""
  property string placeholder: "Type a coin or a name: eth, bitcoin"
  readonly property var results: Search.find(instruments, searchText, quoteCoin, maxResults)
  readonly property bool typed: searchText.trim() !== ""
  property int resultIndex: 0
  // The list on screen's members: a result already in it is shown, not
  // added, and its label says so.
  property var members: []
  function actionFor(symbol) { return members.indexOf(symbol) >= 0 ? "SHOW" : "ADD" }
  // ADD and SHOW share one slot on every row, the wider word's, in the
  // caption's spaced capitals, as every other button in the views says its
  // word.
  readonly property font buttonFont: Qt.font({ family: fontFamily, pixelSize: Style.font.caption, bold: true, letterSpacing: 1 })
  readonly property int buttonWidth: Math.ceil(Math.max(addMetrics.advanceWidth, showMetrics.advanceWidth)) + Style.space(12)
  TextMetrics { id: addMetrics; font: root.buttonFont; text: "ADD" }
  TextMetrics { id: showMetrics; font: root.buttonFont; text: "SHOW" }
  readonly property int rowPadding: Style.space(10)
  readonly property int columnGap: Style.space(10)
  // The symbol is what you match on, so the name gives way to it: one
  // column for every row, as wide as the answer's widest symbol, until the
  // name is down to half the room the two share.
  readonly property int sharedWidth: width - rowPadding * 2 - columnGap * 2 - buttonWidth
  readonly property int symbolWidth: {
    var font = symbolMetrics.font // read, so a look's new font measures again
    var widest = Style.space(80)
    for (var i = 0; i < results.length; i++)
      widest = Math.max(widest, Math.ceil(symbolMetrics.advanceWidth(results[i].symbol)))
    return Math.min(widest, Math.floor(sharedWidth / 2))
  }
  FontMetrics { id: symbolMetrics; font.family: root.fontFamily; font.pixelSize: Style.font.body; font.bold: true }

  signal picked(string symbol)
  // The choice is now this result, or none ("").
  signal chose(string symbol)
  signal cancelled()
  // The list failed and RETRY, or Enter, asked for it again.
  signal retryRequested()

  // True while search is open on an open popup. Turned on, it starts fresh
  // before its first frame and takes the keys a turn later if it is still
  // on; turned off, it gives the keys up and keeps what it shows for the
  // close fade.
  property bool active: false
  enabled: active
  onActiveChanged: {
    if (active) {
      reset()
      Qt.callLater(function() { if (root.active) searchField.forceActiveFocus() })
    } else {
      searchField.focus = false
      root.focus = false
    }
  }
  // A new answer, as you type or as the list lands, starts on its top
  // result.
  onResultsChanged: choose(0)
  Keys.onPressed: function(event) { root.handleKey(event) }

  function reset() {
    searchText = ""
    searchField.text = ""
    resultsScroll.contentY = 0
    choose(0)
  }

  function cancel() { cancelled() }

  function handleKey(event) {
    if (event.key === Qt.Key_Escape) {
      root.cancel()
      event.accepted = true
    } else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) {
      root.accept(root.resultIndex)
      event.accepted = true
    } else if (event.key === Qt.Key_Down) {
      root.showResult(Math.min(root.results.length - 1, root.resultIndex + 1))
      event.accepted = true
    } else if (event.key === Qt.Key_Up) {
      root.showResult(Math.max(0, root.resultIndex - 1))
      event.accepted = true
    }
  }

  // Every way of taking a result comes through here. With no list there is
  // none to take: Enter asks for it again.
  function accept(index) {
    if (listStatus === "failed" && instruments.length === 0) retryRequested()
    else if (index >= 0 && index < results.length) picked(results[index].symbol)
  }

  // A click on a result is Enter on it: chosen, so the hero is on it as an
  // add or a show expects, then taken.
  function take(index) {
    showResult(index)
    accept(index)
  }

  // The choice, told: a result, or none when there are no results.
  function choose(index) {
    resultIndex = index
    chose(index >= 0 && index < results.length ? results[index].symbol : "")
  }

  function showResult(index) {
    if (index < 0 || index >= results.length) return
    root.choose(index)
    var top = index * rowPitch
    var bottom = top + rowHeight
    if (top < resultsScroll.contentY) resultsScroll.contentY = top
    else if (bottom > resultsScroll.contentY + resultsScroll.height)
      resultsScroll.contentY = Math.max(0, bottom - resultsScroll.height)
  }

  Flickable {
    id: resultsScroll
    objectName: "searchResults"
    anchors.left: parent.left
    anchors.right: parent.right
    anchors.top: fieldBar.bottom
    anchors.topMargin: root.resultsGap
    height: root.resultsHeight
    visible: root.results.length > 0
    contentWidth: width
    contentHeight: resultsColumn.implicitHeight
    clip: true
    boundsBehavior: Flickable.StopAtBounds
    interactive: contentHeight > height

    Column {
      id: resultsColumn
      width: resultsScroll.width
      spacing: root.rowGap

      Repeater {
        model: root.results
        Rectangle {
          id: resultRow
          objectName: "searchResult"
          required property var modelData
          required property int index
          readonly property bool chosen: index === root.resultIndex
          width: parent.width
          height: root.rowHeight
          radius: root.retro ? 0 : Style.cornerRadius
          color: rowMouse.pressed ? Style.pressedFillFor(root.foreground, Commons.Color.accent)
            : chosen ? Style.hoverFillFor(root.foreground, Commons.Color.accent)
            : rowMouse.containsMouse ? Style.normalFillFor(root.foreground, Commons.Color.accent) : "transparent"

          MouseArea {
            id: rowMouse
            anchors.fill: parent
            hoverEnabled: true
            cursorShape: Qt.PointingHandCursor
            onClicked: root.take(resultRow.index)
          }

          Row {
            anchors.fill: parent
            anchors.leftMargin: root.rowPadding
            anchors.rightMargin: root.rowPadding
            spacing: root.columnGap
            Text {
              width: root.symbolWidth
              anchors.verticalCenter: parent.verticalCenter
              textFormat: Text.PlainText
              text: resultRow.modelData.symbol
              color: root.foreground
              font.family: root.fontFamily
              font.pixelSize: Style.font.body
              font.bold: true
              elide: Text.ElideRight
            }
            Text {
              objectName: "searchName"
              width: root.sharedWidth - root.symbolWidth
              anchors.verticalCenter: parent.verticalCenter
              textFormat: Text.PlainText
              text: resultRow.modelData.name
              color: root.dim
              font.family: root.fontFamily
              font.pixelSize: Style.font.bodySmall
              elide: Text.ElideRight
            }
            // What Enter, or a click, does to the chosen result, marked as the
            // shell marks the button Enter takes: on the chosen result only,
            // the one the hero shows. Other rows keep its slot, unseen.
            Rectangle {
              objectName: "searchAdd"
              opacity: resultRow.chosen ? 1 : 0
              anchors.verticalCenter: parent.verticalCenter
              width: root.buttonWidth
              height: addLabel.implicitHeight + Style.space(4)
              radius: root.retro ? 0 : Style.cornerRadius
              color: Style.selectedFillFor(root.foreground, Commons.Color.accent)
              Text {
                id: addLabel
                anchors.centerIn: parent
                textFormat: Text.PlainText
                text: root.actionFor(resultRow.modelData.symbol)
                color: Style.selectedStateColor(root.foreground, Commons.Color.accent)
                font: root.buttonFont
              }
            }
          }
        }
      }
    }
  }

  // No matches, a list on its way, or one that didn't load, said where the
  // results would be; a failed list offers RETRY after its words. A list
  // saved from before is searched while a newer one is on its way, and kept
  // when that one fails, so only a search with no list says either.
  Text {
    id: searchMessage
    objectName: "searchMessage"
    readonly property bool noList: root.instruments.length === 0
    visible: noList ? root.listStatus !== "" : root.typed && root.results.length === 0
    anchors.left: parent.left
    anchors.top: fieldBar.bottom
    anchors.topMargin: root.resultsGap
    width: Math.min(implicitWidth, parent.width - (retrySearch.visible ? retrySearch.implicitWidth + Style.space(16) + root.rowPadding : 0))
    height: root.rowHeight
    leftPadding: root.rowPadding
    verticalAlignment: Text.AlignVCenter
    textFormat: Text.PlainText
    text: !noList ? "No matches for “" + root.searchText.trim() + "”"
      : root.listStatus === "failed" ? "The symbol list didn’t load"
      : "Loading the symbol list…"
    color: root.dim
    font.family: root.fontFamily
    font.pixelSize: Style.font.bodySmall
    elide: Text.ElideRight
  }

  ListAction {
    id: retrySearch
    objectName: "searchRetry"
    view: root
    visible: searchMessage.visible && searchMessage.noList && root.listStatus === "failed"
    anchors.left: searchMessage.right
    anchors.leftMargin: Style.space(16)
    anchors.verticalCenter: searchMessage.verticalCenter
    text: "RETRY"
    onActivated: root.retryRequested()
  }

  // The field, at the top, where the list's rows were.
  Item {
    id: fieldBar
    anchors.left: parent.left
    anchors.right: parent.right
    anchors.top: parent.top
    height: root.rowHeight + Style.space(6)

    TextField {
      id: searchField
      objectName: "searchField"
      anchors.left: parent.left
      anchors.right: cancelButton.left
      anchors.rightMargin: Style.space(10)
      anchors.verticalCenter: parent.verticalCenter
      foreground: root.foreground
      placeholderText: root.placeholder
      onTextChanged: root.searchText = text
      onAccepted: root.accept(root.resultIndex)
      Keys.onPressed: function(event) { root.handleKey(event) }
    }

    // Escape, as a button.
    ListAction {
      id: cancelButton
      objectName: "searchCancel"
      view: root
      anchors.right: parent.right
      anchors.rightMargin: root.rowPadding
      anchors.verticalCenter: parent.verticalCenter
      text: "CANCEL"
      onActivated: root.cancel()
    }
  }
}
