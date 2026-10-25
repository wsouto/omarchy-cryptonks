# Feature map: Stonks to Cryptonks

The goal is fidelity: Cryptonks should look and behave as the author's
Stonks does, so a person who knows one knows the other. This page walks the
original, feature by feature, and says what happens to each one here.

Written on 2026-10-21 from the original's README, its CONTRIBUTING.md
product rules, and its source (omarchy-stonks v1.0.2). Review it, and change
anything you disagree with. Each step of the roadmap then follows this map.

| Mark | Meaning |
| --- | --- |
| **Keep** | Same behaviour. Usually the original file is copied, with a line saying what changed. |
| **Adapt** | Same feature, different data or words, because crypto futures differ. |
| **Drop** | Does not exist here, and why. |
| **Later** | Wanted, but not in this round. |
| **Done** | Already in the repo. |

## What crypto futures change

Almost everything in the original that is not fidelity comes from one fact:
a stock market opens and closes, and a perpetual future does not. So the
original's market sessions, pre-market, after-hours, overnight prices,
exchange calendars, "market opens in 2h" and the animal that sleeps while
the market rests have nothing to show here. 1D is the last 24 hours instead,
as the exchanges show it, and the screen says "24H". (Until 2026-10-25 it was
the UTC day from 00:00, which left the chart nearly empty after midnight.)

## The pill

| Feature | Original | Here | Why |
| --- | --- | --- | --- |
| Text form: symbol, price, change | yes | **Done** | Step 4. |
| Sparkline form, the default | the day's line, 40 x 12 | **Keep** | Needs the day's 5-minute candles (`candlesUrl`, not written yet). |
| Arrow form | tilt is the size of the move, 45 degrees at 5% | **Keep** | |
| Icon form: the day's bull or bear | steps between the two as the price crosses | **Keep** | The animal is the product's character. |
| The animal sleeping while the market rests | yes | **Drop** | A perpetual never rests. |
| Middle-click cycles the form | yes | **Keep** | |
| Scroll walks the list, left click popup, right click window | yes | **Keep** | |
| Side bar: icon, or symbol over change ("stacked") | yes | **Keep** | |
| "!" when a quote is late or a refresh failed, with the reason on hover | yes | **Done** (the "!" and the hover) | Wording and thresholds: see the questions below. |
| Up and down in the theme's green and red, or Stonks' own pair | yes | **Done** | `TrendColors.qml` and `Tones.js` are copied. |
| Pill form saved on the bar entry | yes | **Keep** | The `barStyle` settings in the manifest. |

## The popup and the hero

| Feature | Original | Here | Why |
| --- | --- | --- | --- |
| Hero: symbol, listing line, price, change | yes | **Adapt** | The listing line says name, `Bybit` and `USDT` instead of a company, exchange and currency. |
| Funding rate on the listing line | no | **Add** | A perpetual pays it every few hours; sign, tone and time to settlement show at the line's right end. |
| Change shown as percent, amount, or "since the open" (`c`) | previous close is the base; "open" is the third | **Adapt** | Here the base is the price 24 hours ago. For a market that never closes, the previous day's close and today's open are nearly the same number, so the third mode would repeat the first. Recommend two modes, percent and amount. **Agree on two modes.** |
| Price in both looks (smooth, retro block digits) | yes | **Keep** | `Cells.js` comes back from Stonks when the retro look is built. |
| Scrub: hover the chart and the price, change and rows follow | yes | **Keep** | |
| Click the animal to replay the chart (`p`) | yes | **Keep** | |
| Day chart, one rule for the day and every range, dashed baseline | yes | **Keep** | The last 24 hours, from 5-minute candles (288). |
| Market status line (opens in, closes in, after hours, closed) | yes | **Drop** | No sessions. |
| Pre-market, after-hours, overnight price line under the price | Yahoo and Robinhood | **Drop** | No sessions. Robinhood is not used at all. |
| The day's named moments, such as "Power hour" | tied to US sessions | **Drop** | A crypto day has no such moments. The funding times could be a later equivalent. |
| Live dot with ripples | yes | **Keep** | Shows that refreshes are landing. |

## Ranges

The original offers 1D, 1W, 1M, 3M, 6M, YTD, 1Y, 2Y, 5Y, 10Y and All, and
remembers the choice across restarts. Bybit's kline serves every one of them
in a single request (at most 1000 candles each):

| Range | Candle | Candles | | Range | Candle | Candles |
| --- | --- | --- | --- | --- | --- | --- |
| 1D | 5 min | up to 288 | | YTD | day | up to 365 |
| 1W | 15 min | 672 | | 1Y | day | 365 |
| 1M | 1 hour | about 720 | | 2Y | day | 730 |
| 3M | day | about 90 | | 5Y | week | about 260 |
| 6M | day | about 180 | | 10Y, All | week, month | up to 520, about 80 |

**Keep** the whole row of ranges, the log scale on the long ones, and the
rule that a symbol younger than a range shows only its own life
(`firstTradeDate` is on the record for this). BTCUSDT started in March 2020,
so 10Y and All look alike for every perpetual. Recommend keeping both, as
the original does for a young stock. **It's good for me.**

## The info block under the chart

| Feature | Original | Here | Why |
| --- | --- | --- | --- |
| Day range rule (low to high, price between) | yes | **Keep** | The exchange's 24-hour figures (`low24h`, `high24h`). |
| 52-week rule | yes | **Keep** | From 365 daily candles (`low52w`, `high52w`). |
| Open and volume, or a range's low and high dates | yes | **Keep** | `open24h`, `volume24h`. |
| Market cap and P/E | Yahoo | **Drop** | A perpetual has neither. |
| What takes their place | | **Later** | Funding rate, open interest and turnover are on Bybit's ticker. You said no extras this round, so the slot stays empty or shows the turnover we already hold. |

## Rows

| Feature | Original | Here | Why |
| --- | --- | --- | --- |
| Row: symbol over name, day line, price over change | yes | **Keep** | |
| Cursor bar, number keys 1 to 9, Enter or Space shows the chart | yes | **Keep** | |
| Remove with the x, right click, or `x`; undo in the footer (`u`) | yes | **Keep** | |
| Reorder by drag or Shift+J/K; sort by symbol, name or change | yes | **Keep** | |
| Rows stay on the day's move whatever the range | yes | **Keep** | |
| Row name | company name | **Adapt** | The instrument list has `fullName` ("Bitcoin") as well as `baseCoin` ("BTC"). The quote record uses `baseCoin` today. Recommend `fullName`, falling back to `baseCoin`, so rows read like the original. **Agree.**|

**A cost the original did not have.** Yahoo returns the day line of 20
symbols in one request. Bybit has no batch kline: a row's day line is one
request per symbol. For a 150-symbol list refreshed every minute that is 150
requests a minute, far below the limit of 600 every 5 seconds, but it is
the heaviest thing here. The 5-minute candles of the UTC day also give the
row its open, high, low and volume, so one request per row covers it.
Recommend: the rows' lines refresh every 5 minutes, and the price every
minute from the single all-tickers request. (Verified on 2026-10-22: that kline
accepts a `start` at 00:00 UTC.). **Fine**.

Changed in step 7b: each symbol asks for its own price, under 1 KB, since
the all-tickers answer is 680 KB, about 1 GB a day at one a minute. Agreed
on 2026-10-21.

## Lists

| Feature | Original | Here |
| --- | --- | --- |
| All, and named lists; the list menu; Manage lists (rename, reorder, delete) | yes | **Keep** |
| Ctrl-click a row to choose its lists (`m`); `,` and `.` for previous and next list | yes | **Keep** |
| The line beside the list's name: how many rows are up and down | yes | **Keep** |
| Data file with version-1 keys, unknown keys kept on write, an unreadable file never overwritten | `grvc.stonks.json` | **Keep**, as `wsouto.cryptonks.json` |
| Last quotes saved, so a restart shows prices marked "As of" | `~/.cache/grvc.stonks/quotes.json` | **Keep**, own path |
| Starter symbols | NVDA, AAPL, MSFT, SPY, TSLA | **Adapt**, see the questions |
| `Settings.js` | copied | Waits for this step (it needs the original's `Quote.regularClose`, which becomes "since 00:00 UTC", and `History.historyRanges`) |

## Search

| Feature | Original | Here | Why |
| --- | --- | --- | --- |
| "+ Add a symbol", type a name or symbol, top result shows in the chart, Enter or click adds | Yahoo search | **Adapt** | Local autocomplete over the cached instrument list (roadmap decision 7). No request while typing. |
| "Search didn't answer" with RETRY | yes | **Adapt** | "The symbol list didn't load", with RETRY. |
| Finds stocks, ETFs, indexes and crypto | yes | **Adapt** | USDT crypto perpetuals only; TradFi and USDC are out (decisions 2 and 7). |

## The window, commands and launcher

| Feature | Original | Here |
| --- | --- | --- |
| Tiled window with the popup's chart and rows; shares lists, range and quotes | yes | **Keep** |
| Works with the pill turned off | yes | **Keep** |
| IPC: `openWindow`, `toggleWindow`, `omarchy-shell ... toggle`, for Hyprland bindings | yes | **Keep**, own id |
| Launcher entry and icon in `share/` | the Stonks icon | **Adapt**: the same pixel bull, recoloured, so the two launcher entries differ |
| Window class `org.quickshell`, title `Stonks` for a floating rule | yes | **Adapt**: title `Cryptonks` |

## Looks, keys and character

| Feature | Original | Here |
| --- | --- | --- |
| Smooth and retro looks, in the theme's colours, light or dark | yes | **Keep** |
| Click the look icon, or `s`, to switch | yes | **Keep** |
| The key sheet (`?`) and every key in the original table | yes | **Keep** (drop only a key whose feature is dropped) |
| Stonks' own name on screen: the pill's "STONKS" with no symbol, the window title | the author's brand | **Adapt**: "CRYPTO" and `Cryptonks`; the README wordmark is only in its picture |
| Bull and bear sprites, the live dot | yes | **Keep** |
| Calm: nothing moves when look, range, list or order changes | yes | **Keep** |
| Every character drawn is one JetBrainsMono Nerd Font has | yes | **Keep** |

## Status and errors

| Feature | Original | Here |
| --- | --- | --- |
| "As of" and a time on an old price, on the row and above the price | more than 2 min behind while the market trades | **Adapt**: the market always trades, so "old" is only about our refreshes |
| "No data", "Update overdue" after 90 s without an answer | yes | **Keep** the words; thresholds in the questions |
| "No data for this symbol", "Refresh failed" | Yahoo | **Adapt**: Bybit's own `retMsg` is shown (done in `Refresh.js`) |
| The header says "schedule unavailable" | exchange calendars run out | **Drop** |
| RETRY beside a failed range or search | yes | **Keep** |
| "Can't read the data file" footer | yes | **Keep** |
| "!" on the pill with the reason on hover | yes | **Done** |
| Stray prices Yahoo drops into a chart are left out | yes | **Drop** unless Bybit shows the same. Not seen. |
| Leaves a site that refuses it alone | `Gate.qml` | **Keep**: copy and tune; Bybit's 403 pauses for 10 minutes |

## Data, trust and the rest

| Feature | Original | Here |
| --- | --- | --- |
| Only what's true: show what the source sent, `null` over a guess | yes | **Done** (CONTRIBUTING, quote record) |
| No currency conversion | yes | **Done** (one currency, USDT) |
| One curl in `Fetch.js`; request limits and size caps | yes | **Done** |
| `test/boundaries.sh`: only a few files run a command, write a file or name an endpoint | yes | **Later**, roadmap step 8 |
| Flow harnesses that drive the real shell with keys and pointer | yes | **Later**: copy the ones for features we keep |
| Version watch and the "Stonks is out, click to update" footer note | reads `main`'s manifest on GitHub | **Later**: needs the repository published (step 13) |
| Plugin marketplace listing | yes | **Not planned**: GitHub releases only (step 13) |
| Robinhood, Yahoo, fundamentals, overnight feeds and their rules (`Quote.js`, `Overnight.js`, `Market.js`, `Fundamentals.js`, `calendars.json`) | yes | **Drop**, replaced by `adapters/bybit.js` |

## Questions for you

1. **Starter symbols.** The original starts with five so the pill has
   something to show. Recommend BTCUSDT, ETHUSDT, SOLUSDT, XRPUSDT and
   DOGEUSDT.

-  **Perfect.**

2. **Row name.** `fullName` ("Bitcoin") with `baseCoin` ("BTC") as the
   fallback? It changes the quote record by one field.

- **Ok.**

3. **Change modes.** Two (percent and amount, both over the last 24 hours) or
   three, as the original?

- **The 2 modes is sufficient**

4. **The mark.** The original draws its own "STONKS" mark and wordmark. Keep
   it with the credit already in the README and LICENSE (the licence asks
   for the copyright notice, not the branding), or draw a mark of our own
   later?

- **Help me with this one, I need more info.** Answered after the review: the
  app draws "STONKS" only as the pill's text with no symbol and as the window
  title. Here they read "CRYPTO" and `Cryptonks`. The bull and bear stay;
  the launcher icon is the same bull, recoloured. **Agreed.**

5. **"Overdue" and "As of".** The original says "overdue" after 90 seconds
   with a refresh every minute or so. Keep 90 seconds?

- **Yes.**

6. **Funding.** A countdown to the next funding time (`nextFundingTime` is
   on the ticker) is the natural replacement for the market-status line.
   Later, as the notes say, or in this round?

- **Later.**

7. **Row lines.** Refresh the rows' day lines every 5 minutes and the prices
   every minute, as recommended above?

- **Yes.**

## A suggested order

The roadmap's steps 5 to 8 were drawn before this map. Following the
original's layers, they could be:

| Step | What | You see |
| --- | --- | --- |
| 5 | The day's candles (`candlesUrl`), the sparkline, arrow and icon forms, middle-click | the pill in its default sparkline form |
| 6 | The popup: hero, day chart, scrub, retro and smooth | click the pill and scrub BTCUSDT's day |
| 7 | The shared service, `Gate.qml`, the saved quotes, `Settings.js`, rows | a list of rows |
| 8 | Lists, search, order, undo, the key sheet | add a symbol by typing `eth` |
| 9 | Ranges | 1W to All |
| 10 | The window, IPC, launcher | right-click opens the window |
| 11 | Statuses, errors, retry, the look at every state | unplug the network and read it |
| 12 | Boundary check, flow tests, README | a plugin that reads as finished |
| 13 | GitHub repository, CHANGELOG, releases, install and update steps | a release page |

`ROADMAP.md` follows this order since the review on 2026-10-21.

- **If there is something to change to improve our workflow, I'm open to suggestions, otherwise we can follow it as-is.**
