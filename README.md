# Crypto Stonks

A crypto futures watchlist for your [Omarchy](https://omarchy.org) bar: a small
pill with a coin's move today, and a popup with its chart and your lists.

> **Status: early.** Today the pill shows how far BTCUSDT has moved on Bybit
> since 00:00 UTC, refreshed once a minute: as the day's line, an arrow,
> text with the price, or a bull or a bear. Middle-click it to change the
> form. There is no popup and no list yet. See [docs/ROADMAP.md](docs/ROADMAP.md) for what
> comes next and [docs/HOWTO.md](docs/HOWTO.md) to run it.

## Plan

- Prices from a crypto exchange's public API, with no API key. The first
  exchange is Bybit (USDT perpetual futures). More exchanges can follow
  because each one lives in its own adapter: [docs/ADAPTERS.md](docs/ADAPTERS.md).
- The day's change runs from 00:00 UTC, since crypto never closes.
- No portfolio and no API keys in the first versions.

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
