# Tic-Tac-Toe Lab

Four game modes and a minimax opponent, built on the
[Porsche Design System](https://designsystem.porsche.com/) — the app for
Workshop 1 of the QuitCode "Modern Development with Agentic AI" course.

```bash
npm ci
npm run dev        # http://localhost:3000
npm run build
npm run lint
npm run typecheck  # next typegen + tsc --noEmit
npm test           # vitest: unit, regression and AI verification checks
npm run check      # all of the above, in the order CI runs them
```

Node `^22.22.2 || ^24.15.0 || >=26.0.0` is required — the range `jsdom` (tests) supports; `package.json#engines` declares the same.

## Modes

| Mode | Rules |
|---|---|
| **Classic** | 3x3, three in a row. |
| **Vanishing** | Each player keeps at most three marks; placing a fourth removes the oldest one — *before* the win check, so a vanishing mark can never complete a line. A draw is impossible. |
| **Grand** | 4x4 or 5x5 with a selectable win length (4 or 5 in a row). |
| **Blitz** | 3x3 against a per-move clock (5/10/20 s). Running out of time loses the game. The clock starts after the first move (so reloading the page never costs a game), and moves cannot be rewound — that would reset the clock. |

The opponent is an independent setting and works in every mode: two players on
one screen, or the computer at one of three levels.

## Features

- **Time travel** — every move in the *Moves* panel is a point you can rewind to
  (in every mode except Blitz).
- **Hints** — *Show a hint* asks the hard AI for the best move for whoever is on
  turn; the cell pulses until the position changes (a move, a rewind, a restart).
- **Match history** — the last 25 finished games, with the player names as they
  were at the time.
- **Replay** — any stored game can be stepped through move by move or played
  back automatically, vanished marks included. Positions are rebuilt by the
  engine from the stored move list, never stored as pictures.
- **Statistics** — results per mode, your win rate per computer level, average
  game length and your best winning streak, derived from the stored history.
  Each record notes whether a move was taken back or a hint was shown; such
  games are listed as played *with help* and are left out of the win rate and
  the streak, so both measure the player's own play.

## The computer opponent

`lib/game/ai.ts` is pure TypeScript — no API calls, no cost, no network.

- **Easy** — a uniformly random empty cell.
- **Medium** — win now, else block the immediate threat, else centre, corner, random.
- **Hard** — minimax with alpha-beta pruning, depth-aware scoring (a faster win
  beats a slower one) and centre-out move ordering. In Classic and Blitz the
  search is exhaustive, which makes it unbeatable. In Grand (depth 4–5) and in
  Vanishing (depth 6 — the board never fills, so the tree has no natural end)
  the depth is capped and non-terminal positions get a heuristic score based on
  open lines: strong, but not perfect. The difficulty picker says which of the
  two you get (`ModeConfig.exhaustiveSearch`).

## Structure

```
app/                Next.js App Router entry (server components, PDS provider)
components/         UI, built from PDS components
lib/game/           framework-free, pure TypeScript
  types.ts          settings, mode table, normalization
  rules.ts          line generation and win detection
  engine.ts         applyMove / rewindTo / applyTimeout — the source of truth
  search.ts         a fast mutable mirror of the move rules for the AI search
  ai.ts             easy / medium / hard move choice
  stats.ts          match records, the scoreboard and the statistics summary
  replay.ts         rebuilds a stored match move by move; validates move lists
  notation.ts       cell names (A1, B2, …)
  storage.ts        localStorage with validation of everything it reads
  __checks__/       AI verification games and shared test helpers
lib/useGame.ts      the single hook wiring the engine, timers and storage to React
```

### Where the move rules live

`lib/game/engine.ts#applyMove` is the authoritative implementation; the UI and
the medium AI go through it. The hard AI cannot afford to clone a `GameState`
for every node of the search, so `lib/game/search.ts` re-implements the same
place → vanish → check order with do/undo on a typed array. **When you change a
rule, change both.** `search.test.ts` plays 1 200 random games across every
mode and board and fails on the first position where the two disagree.

### Stored data

History, scoreboard and settings live in `localStorage`, which is untrusted
input: `storage.ts` parses every value field by field, drops invalid or
duplicate records and replaces bad counts or settings with defaults, so a
corrupted entry can never crash a render. The hook only writes back after it
has read, which also heals the stored data.

Every record must also describe a game that can exist: a line win has the right
parity for its winner and at least `2 × winLength − 1` moves, a draw needs a full
board (so never in Vanishing), and a timeout only happens in a timed mode, lost
by the player on turn (`storage.ts#isPlausibleOutcome`).

A stored move list is validated **by simulation**: `replay.ts` plays it through
the engine, and the record is kept only if every move is legal and the final
position reproduces the stored result (winner, draw, or the player who ran out
of time). A record that contradicts its own moves is dropped.

Two open tabs share one history. Three rules keep it consistent:

1. **One atomic value.** History, score and a *clear generation* live in one
   key, `ttt-lab:stats`, so a single `setItem` stores all of them or none —
   there is no half-written state to count twice. Data from earlier versions,
   kept in two keys, is read once and migrated on the next save.
2. **Changes, not snapshots.** Every change a tab makes — recording a game,
   clearing — is a read–modify–write applied to the stats **as they are in
   storage at that moment** (`storage.ts#updateStoredStats`), never to the
   tab's own copy, under one Web Lock (`navigator.locks`, name `ttt-lab:stats`)
   shared by all tabs. Browsers without the Locks API run it synchronously in a
   single task. Stats received through the `storage` event only refresh the
   view; they are never written back and decide nothing.
3. **Generations, not events.** *Clear history* writes the empty stats with a
   new generation. A change this tab could not store (quota, blocked) is kept
   with the generation it was made in and re-applied on later updates only
   while that generation is still in storage; the same holds for the result a
   rewound game takes back from the score. Because the generation is read under
   the lock from the same atomic value, a clear in another tab is honoured even
   if its storage event arrives late or never — cleared games never come back,
   and games played after the clear are kept.

A game keeps its id when you rewind it. Finishing a rewound game therefore
*replaces* its record (`stats.ts#recordMatch`) — the scoreboard moves the old
result out and the new one in, so each game counts exactly once.

## Tests

`npm test` runs 181 tests in about 3 s; `npm run test:coverage` adds a coverage
report and fails if `lib/game/*` drops below its thresholds (95 % of lines). CI
runs the coverage variant, so the threshold is enforced on every push. The AI
speed budget (`__checks__/ai-speed.test.ts`, ≤ 250 ms per hard move on 5x5) is a
wall-clock check, so it runs separately as `npm run test:speed` — coverage
instrumentation slows the search several times and would make it meaningless.

| File | What it pins down |
|---|---|
| `rules.test.ts` | line generation for every board, no wrap-around diagonals |
| `engine.test.ts` | moves, draws, vanishing order, timeouts, rewind |
| `search.test.ts` | the AI's rule mirror agrees with the engine (differential, 1 200 games) |
| `ai.test.ts` | legal moves at every level, hints win and block |
| `replay.test.ts` | replays rebuild every position; 400 random games re-validate |
| `storage.test.ts` | corrupted, legacy and tampered localStorage payloads |
| `stats.test.ts` | records, scoreboard, replayed games counted once, statistics |
| `useGame.test.ts` | the hook end to end: storage healing, rewind, hints, AI and blitz timers, two tabs |
| `components/*.test.tsx` | the whole screen and the replay viewer, clicked through in jsdom, incl. screen-reader announcements |
| `__checks__/ai-strength.test.ts` | 690 seeded games: hard never loses on 3x3, hard vs hard always draws, Vanishing never draws |
| `__checks__/ai-speed.test.ts` | every hard move on 4x4 and 5x5 stays under 250 ms (run without coverage) |

All random games are seeded, so a failure replays exactly.

## Deployment

GitHub Pages is configured as *Deploy from a branch* on `main` / root: the live
demo is the static export committed to the root of `main`.

The CI workflow (`.github/workflows/ci.yml`) runs lint, typecheck, the tests
with the coverage threshold and the build on every pull request, on pushes to
`ws01/**` branches and on demand. Its second job builds the Pages export and
uploads it as the `pages-export` artifact, so the deployment can be reproduced
from the PR's code. Publishing is replacing the root of `main` with that
export. Locally the same build is:

```bash
export NEXT_PUBLIC_BUILD_SHA=$(git rev-parse --short HEAD)
GITHUB_PAGES=true PAGES_BASE_PATH=/2026-quitcode-01-agentic-engineering-hw npm run build
touch out/.nojekyll
```

**Which code is live?** The page header shows `Build <commit>` — the commit the
export was built from (`dev` for local builds without the variable). Compare it
with the branch head to know whether the demo is current.

The Pages settings are opt-in through the environment, so plain `npm run build` and
local development stay an ordinary Next.js build. Two details matter for the
branch-based Pages mode:

- Pages serves the site from `/<repo>/`, hence `basePath` and `assetPrefix`.
- A `.nojekyll` file must sit next to `index.html`. Next puts its assets in
  `_next/`, and Jekyll skips every path starting with an underscore — without it
  the page loads with no CSS and no JavaScript.

## Notes on the setup

- PDS components are imported from `@porsche-design-system/components-react/ssr`,
  the entry point required by server-rendering frameworks.
- The global PDS stylesheet must be imported by its explicit path
  (`.../components-react/index.css`); the bare package specifier does not
  resolve through the Next CSS pipeline.
- `next.config.ts` keeps Lightning CSS from downlevelling `light-dark()`, which
  is what makes the PDS palette follow the system light/dark setting.
