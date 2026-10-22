.pragma library
// Copied from Stonks by Gaurav Chande (MIT), omarchy-stonks v1.0.2, Fetch.js.
// Changes: the answer mark and user agent carry this project's name; the size
// cap is Bybit's, not Yahoo's and Robinhood's; `soleBody` is gone, unused; a
// refusal is not fixed at 429 and 503 but also takes the statuses an
// adapter's `limits` name (Bybit refuses with 403), and a refusal that sent
// no Retry-After waits as long as those `limits` say.
//
// The one curl every feed runs: one or several URLs in one run, over one
// connection, compressed, each answer capped and followed by a line that
// says what came back. Knows nothing of what it fetches.

var USER_AGENT = "Mozilla/5.0 (Omarchy Cryptonks)"

// The line curl writes after each answer: the URL's place in the run, the
// HTTP status (000 when nothing answered), curl's exit code for it, and any
// Retry-After. A JSON body never holds a newline followed by this.
var ANSWER_MARK = "@@cryptonks"

// The cap of every run, above the largest answer it asks for even
// uncompressed: a year of daily candles, about 40 KB as Bybit sent them on
// 2026-10-21. It leaves room for the most Bybit sends, 1000 candles. A feed
// that asks for the whole list of tickers (680 KB) will need a cap of its
// own.
var DAILY_CAP = 128000
// The whole list of contracts, uncompressed: 850 KB on 2026-10-22, with
// room for the list to grow.
var LIST_CAP = 4000000

// `urls` are fetched in turn; an answer over `maxBytes` is a bad answer.
// `--max-time` is per URL, so no URL holds a run more than 10 s.
// `%header{retry-after}` needs curl 7.84 or later (docs/HOWTO.md).
function curlCommand(urls, maxBytes) {
  return ["curl", "-sS", "--compressed", "--max-filesize", String(maxBytes),
    "--connect-timeout", "5", "--max-time", "10", "-A", USER_AGENT,
    "-w", "\\n" + ANSWER_MARK + " %{urlnum} %{http_code} %{exitcode} %header{retry-after}\\n"].concat(urls)
}

// What one answer means for whoever sent it:
//   ok       a whole 200 answer, for the feed to parse;
//   none     no HTTP answer at all: no network, no connection, no TLS, or a
//            timeout before the status;
//   refused  429, 503 or one of `refusedStatuses`: the host wants fewer
//            requests;
//   bad      another 5xx, an answer cut short, or one over its cap;
//   missing  another 4xx: the question is wrong, asking again won't help.
function answerKind(status, exit, refusedStatuses) {
  if (status === 0) return "none"
  if (status === 429 || status === 503) return "refused"
  if (refusedStatuses && refusedStatuses.indexOf(status) >= 0) return "refused"
  if (exit !== 0 || status >= 500) return "bad"
  if (status >= 400) return "missing"
  return status === 200 ? "ok" : "bad"
}

// A run's output as its answers, by the URL's place in the run: { index,
// status, kind, body, retryAfter } (seconds, 0 when none was sent). `index`
// counts from 0, as curl's %{urlnum} does: the first URL's answer is 0, so it
// is the place in the array of URLs given to `curlCommand`. A URL the run
// never reached, stopped first, has none.
//
// `limits` is the adapter's: its `refusedStatuses` also count as a refusal,
// and its `refusedPauseSeconds` is the wait of a refusal that sent no
// Retry-After.
function answers(text, limits) {
  var refused = limits && limits.refusedStatuses
  var pause = (limits && limits.refusedPauseSeconds) || 0
  var out = []
  var pattern = new RegExp("\\n" + ANSWER_MARK + " (\\d+) (\\d{3}) (\\d+) ?([^\\n]*)\\n", "g")
  var from = 0
  var match
  while ((match = pattern.exec(text)) !== null) {
    var status = Number(match[2])
    var exit = Number(match[3])
    var kind = answerKind(status, exit, refused)
    var retryAfter = /^\s*\d+\s*$/.test(match[4]) ? Number(match[4]) : 0
    if (kind === "refused" && retryAfter === 0) retryAfter = pause
    out.push({
      index: Number(match[1]),
      status: status,
      kind: kind,
      body: text.slice(from, match.index),
      retryAfter: retryAfter
    })
    from = pattern.lastIndex
  }
  return out
}
