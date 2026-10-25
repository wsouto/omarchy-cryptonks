# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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

- Switching exchanges is faster: each exchange's prices, candles and charts are
  kept for the session, so switching back asks only for what is due, and the
  last saved prices of the exchange show at once. The saved quotes file
  (`~/.cache/wsouto.cryptonks/quotes.json`) is now version 2, one map per
  exchange; a version 1 file is still read.

## [0.1.0]

First release. A port of Stonks for Bybit USDT perpetuals: the pill, the
popup and window with a chart to scrub, ranges, and lists. See
docs/DIFFERENCES.md for where it departs from the original.
