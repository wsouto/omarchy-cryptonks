# Crypto Stonks

A crypto futures watchlist for your [Omarchy](https://omarchy.org) bar: a small
pill with a coin's move today, and a popup with its chart and your lists.

![The popup: BTCUSDT's hero, a week of daily candles, and the watchlist](media/popup.png)

A pill in the bar shows a coin's move since 00:00 UTC (crypto never closes) as
a line, an arrow, text with the price, or a bull or a bear. Click it for a
popup with a chart you can scrub, ranges from 1D to ALL, a 52-week and volume
block, and your lists of symbols. The same view opens as a window.

- Bybit USDT perpetuals, from the public API: no account, no API key.
- Prices refresh once a minute and say so when they are stale or Bybit is
  refusing.
- Lists, order and look are saved in `~/.config/omarchy/wsouto.crypto-stonks.json`,
  which you may edit by hand.
- Not planned: a portfolio, API keys, WebSocket. More exchanges can follow:
  each one is one file, see [docs/ADAPTERS.md](docs/ADAPTERS.md).

## Install

Needs Omarchy 4 and `curl` 7.84 or later. [docs/HOWTO.md](docs/HOWTO.md) has
the steps to install, update and remove it, and the launcher entry for the
window.

## Keys

`?` in the popup shows the same list.

| Key | Does |
| --- | --- |
| `↑ ↓`, `1`–`9`, `⏎` | Move the selection, pick a row, show its chart |
| `a` / `x` / `u` | Search and add a symbol / remove the row / undo the removal |
| `J K` | Move the row (manual order) |
| `← →` | Scrub the chart |
| `[ ]` | Change the chart range |
| `p` | Replay the chart |
| `w` / `o` / `, .` | List menu / change the order / previous or next list |
| `s` | Switch smooth and retro |
| `c` | Switch the day's % and amount |
| `r` | Refresh |

Mouse: click the pill to open it, middle-click to change its form; click a row
for its chart, right-click to remove it, drag it to move it (manual order).

## Credits

The layout, the features, the keys and much of the structure come from
**[Stonks](https://github.com/gmchande/omarchy-stonks)** by
[Gaurav Chande](https://github.com/gmchande), which shows stocks from Yahoo
Finance in the Omarchy bar. This project reuses and adapts parts of its code
under the MIT licence and replaces its data layer with exchange adapters.
Thank you, Gaurav. The original is maintained at
<https://github.com/gmchande/omarchy-stonks>. If you want stocks, use that.

Files copied from Stonks keep their header comments. Both copyright lines are
in [LICENSE](LICENSE).

This project is not affiliated with Stonks, Omarchy or any exchange. It is not
investment advice.

## Licence

MIT, see [LICENSE](LICENSE).
