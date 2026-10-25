# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- The chart says "Loading <exchange>…" until the feed first answers for the
  symbol, such as after stepping to another exchange.
- The exchange's name on the hero is a pill: click it, or press `e`, to step
  to the next exchange.
- OKX USDT perpetual swaps as a third exchange, `"exchange": "OKX"` in the data
  file. OKX answers 300 candles at a time, so a year and the long ranges are
  read in several pages.
- Binance USDT perpetuals as a second exchange, picked by the `exchange` key of
  the data file (`"Bybit"` or `"Binance"`; Bybit stays the default). Each
  exchange keeps its own symbol list.
- The hero's listing line shows the perpetual's funding rate for the next
  settlement, signed and toned by its sign (green positive, red negative),
  with the time left to it, such as `FUNDING ▲0.0073% 3h22m`.

### Changed

- VOL is on the 1D line, in place of 24H OPEN, so it shows only on 1D, as in
  the original; it was on the 52-week line, where it read the same 24 hours on
  every range. The 24-hour open is no longer shown.
- VOL's value sits next to its label again, as in the original, instead of
  starting under 24H OPEN's.
- VOL shows the 24 hours' turnover in the quote coin, such as `4.2B`, as
  Bybit's ticker does, instead of `51K BTC ($4.2B)`.
- The info lines write prices from 1,000 without decimals (`116,380`), and
  the range lines size their dates without the year, so HIGH shows on the
  ranges again next to large coin prices.
- The info lines' facts sit together against the right edge, a space apart,
  instead of each in its own column.
- 1D is the last 24 hours, as on the exchanges, instead of the UTC day from
  00:00: the chart always fills, and the change, high, low and volume are the
  exchange's own 24-hour figures, so they match its app. Labels say "24H"
  ("TODAY", "SINCE 00:00 UTC" and "OPEN 00:00 UTC" are gone). On OKX the
  24 hours' worth in USDT is the coin volume at the last price. The quote
  record's day fields are renamed `open24h`, `high24h`, `low24h`,
  `volume24h` and `turnover24h`.
- Switching exchanges is faster: each exchange's prices, candles and charts are
  kept for the session, so switching back asks only for what is due, and the
  last saved prices of the exchange show at once. The saved quotes file
  (`~/.cache/wsouto.cryptonks/quotes.json`) is now version 3, one map per
  exchange, holding the 24-hour record; an older file is not read, so the
  saved prices are gone once until the first refresh.
- Fewer requests per symbol: the exchange's instrument list (one request, kept
  a day) is read at start and on a switch, so no symbol asks for its own
  instrument; and a row takes its 24 hours' open, high, low and volume from
  its price answer, so only the featured symbol asks for daily candles. The
  instrument list file is now version 2 and names its exchange.

### Fixed

- After a switch to an exchange with no saved instrument list, search showed
  the previous exchange's list.

## [0.1.0]

First release. A port of Stonks for Bybit USDT perpetuals: the pill, the
popup and window with a chart to scrub, ranges, and lists. See
docs/DIFFERENCES.md for where it departs from the original.
