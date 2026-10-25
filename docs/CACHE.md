# What the plugin keeps, and what it asks again

Cryptonks asks each exchange only for what it doesn't already have, or what
is due again. It keeps data in three places: the feed's memory for the
session, a saved quotes file, and one instrument list file per exchange.
Candles are never written to disk, because the price and today's candles
have to be asked again after a restart anyway, so a candle file would save
bytes but no requests.

## What one symbol asks for

`Refresh.plan` builds one symbol's URLs. `Refresh.planRun` sends every
symbol in one curl, the featured symbol first.

| Role | Asked when | Featured symbol | A row |
| --- | --- | --- | --- |
| `quotes` | every run | yes | yes |
| `funding` | every run, on an exchange with `fundingUrl` (Binance, OKX) | yes | yes |
| `year`, then `daily` | candles due: a year once, then the days since the newest kept | yes | **never** |
| `day` | candles due: today's 5-minute candles from the newest kept | yes | yes |
| `history:<range>` | a chart range other than 1D is open and `History.due` (15 min for 1W and 1M, an hour for longer) | the hero's symbol only | no |
| `instrument` | none is kept and the instrument list doesn't hold it | rarely | rarely |

Candles are due (`Refresh.candlesDue`) when none are kept, at a new UTC day,
and then every minute for the featured symbol and every 5 minutes for a row.
A run in between asks for the price alone and builds the quote on the
candles kept.

A row asks for no daily candles. `Refresh.dayCandle` folds today's 5-minute
candles into today's daily candle: the first one's open, the last one's
close, the high and low over all of them, and the summed volume and
turnover. These match the exchange's own daily candle. Only the featured
symbol needs daily candles, for a year's 52-week high and low. When the
quote is built, the folded candle always replaces today's daily candle, so a
row that used to be featured never shows its day as it was then.

On a first fetch, a row asks 2 requests on Bybit and 3 on Binance and OKX,
where it used to ask 4 and 5. With 6 symbols, measured on 2026-10-25:

| Exchange | Before | After |
| --- | --- | --- |
| Bybit | 24 | 13 |
| Binance | 30 | 19 |
| OKX | 31 | 20 |

## In memory: the feed (`PriceFeed.qml`)

For the current exchange, by symbol:

- `kept`: what `Refresh.read` keeps between runs. That is the instrument,
  the daily candles (up to a year, featured symbol only), today's 5-minute
  candles, when the candles came, and each chart range's candles with when
  they came. It belongs to one symbol and is dropped whole if another
  symbol's turns up.
- `quotes`: the record of [QUOTE-RECORD.md](QUOTE-RECORD.md) on show.
- `histories`: the chart lines built, by `"SYMBOL|RANGE"`.
- `problems` and `fresh`: why the last refresh failed, and whether a quote
  is this session's own answer (only then is it live, not "As of").

**Switching exchanges.** `onAdapterChanged` puts `{ kept, quotes,
histories }` aside in `stash`, under the exchange left, and brings back the
new exchange's stash, or nothing on a first visit. It fills any quote still
missing from the saved quotes file (`seed`), clears `problems` and `fresh`,
and asks every symbol again. Because the stash comes back, that run asks
only what is due: within 5 minutes, a row asks for its price alone. A run
still in flight from the exchange left is finished and its answers are
thrown away (`discard`).

The stash lasts until the shell restarts. With 20 rows it is about 1 MB per
exchange, mostly 5-minute candles (an estimate, not a measurement).

## On disk: the saved quotes (`~/.cache/wsouto.cryptonks/quotes.json`)

```json
{ "version": 2, "quotes": { "Bybit": { "BTCUSDT": { ... } }, "OKX": { ... } } }
```

- Written by `Service.flushQuotes`: at once on the first answer, then at
  most every 10 minutes, and always just before `e` or the exchange pill
  switches, so the quotes of the exchange you leave are not lost. Changing
  `exchange` by hand in the data file skips that last save.
- Read once at start (`SavedQuotes.byExchange`). A version 1 file, one
  `{ symbol: quote }` map, is read by grouping its quotes by their
  `exchange` field.
- Each quote shows "As of" its time until the feed's first answer for it.
- Only quotes, so after a restart the feed still asks for candles.

The rules are in `SavedQuotes.js` and the tests in `test/saved-quotes.test.js`.

## On disk: the instrument list (`~/.cache/wsouto.cryptonks/instruments-<exchange>.json`)

```json
{ "version": 2, "exchange": "Bybit", "time": 1792900000000, "instruments": [ ... ] }
```

`SymbolList.qml` keeps every contract the exchange lists, as
`adapter.parseInstruments` reads them: symbol, name, currency, price
digits, first trade date and funding interval. Search reads the symbol and
name, and the feed reads the whole record through `bySymbol`.

- **Fetched** at start, on a switch, and when search opens, but only when
  the list is missing or more than a day old: one request (850 KB, 98 KB
  compressed, on Bybit). The feed's run waits while the list is loading
  (`PriceFeed.listing`), so the first run never asks for instruments one by
  one. If the list fails to come, the run goes ahead and asks for each.
- **Used** by `Refresh.withListed`. Before each run, a symbol with no kept
  instrument takes it from the list. A symbol the list doesn't hold, such
  as a new listing, still asks for its own instrument, and that answer says
  if it is not a perpetual on this exchange.
- **One file per exchange, which names its exchange.** When a path has no
  file yet, Quickshell 0.3.1's `FileView.text()` keeps returning the
  previous file's text. A file that names another exchange is not read, so
  one exchange's list never passes for another's. The file is also read
  only after `FileView` has the new path (`Qt.callLater`).
- A version 1 file held only symbol and name. It is not read, so the list
  is fetched again once. `instruments.json`, with no exchange in its name,
  is from before step 15. Nothing reads it, and you can delete it.
- **Known limit.** If the exchange changes while a list is loading, that
  list is dropped and the new exchange's list waits for the next start,
  switch or search. Until then its rows ask for their instruments one by
  one (the `shortcut:` in `SymbolList.qml`).

## What is not cached, and why

- **Candles on disk:** see the top of this page. After a restart, a row
  asks the same 2 or 3 requests whatever is kept.
- **All prices in one request:** the exchanges can answer every price at
  once, but Bybit's answer is 680 KB every minute (about 100 KB
  compressed, an estimate), against about 20 KB for 20 single ones. Not
  done.

## To start over

```sh
rm -r ~/.cache/wsouto.cryptonks
omarchy restart shell
```

The lists and settings in `~/.config/omarchy/wsouto.cryptonks.json` are not
touched. The first run then asks every exchange for its list again.
