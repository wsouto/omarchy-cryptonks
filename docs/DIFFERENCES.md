# Differences from the original

What this project does differently from omarchy-stonks, and why. Every copied
file also says `Changes:` in its header; this page holds the reasons and the
ideas worth sending back. Add an entry in the commit that makes the difference.

Each entry: **what**, **why**, and a tag.

- `crypto`: the market forces it (24/7, UTC day, Bybit). Not for the original.
- `left out`: the original has it, we do not yet. Bring back on request.
- `PR?`: could be an improvement for the original too. Check it first.

## Market

- **The day is the UTC day, 00:00 to 24:00.** No sessions, extended hours or
  breaks, so `DayChart`, `PixelChart`, `Chart.js` and `Sparkline` lose that
  logic and the pen never lifts. `crypto`
- **The animal never sleeps** (`HeaderStatus`, `BarAnimal`): a perpetual market
  is never closed, so the lids are gone. `crypto`
- **"TODAY" label in `ListLine`** says the UTC day, not a session. `crypto`

## Data

- **One feed for every symbol** (`Service.qml`), with a run of its own for a
  symbol that joins (preview, add, undo, newly featured). `crypto`
- **Search reads Bybit's instrument list**, no lookup is asked of anyone
  (`Search.js`, `SymbolSearch.qml`). `crypto`
- **Rows ask 2 daily candles, only the featured symbol a year.** Keeps the
  per-minute load small. Side effect: a row with no saved quote shows
  "Loading…" about 5 s after a shell restart. `PR?` if the original has the
  same wait.

## Left out of step 8c

- **A half-typed list name or rename is lost when the popup closes**
  (original: `draft` / `keepTyped`). `left out`
- **Scroll position is not kept per list** (original: `listKeys`). `left out`
- **Dragging a row does not scroll the list**, so with more than 6 rows a row
  can only drop among the rows in sight. Not in the original; our limit.

## Ideas to send upstream

Nothing confirmed yet. When an entry above is a fix or an improvement that does
not depend on crypto, tag it `PR?`, check it against the original's current
code, and move it here with a one-line pitch.
