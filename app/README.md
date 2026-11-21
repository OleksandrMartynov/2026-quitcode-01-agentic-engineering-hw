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

Node 22+ is required.

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

Two open tabs share one history: each tab listens for the `storage` event and
adopts the other's changes before writing its own, and identical writes are
skipped so the tabs do not echo each other. *Clear history* also bumps a
dedicated `ttt-lab:cleared-at` key — an explicit clear signal — and only that
signal makes the other tabs forget what their current game added to the score.
A clear is never inferred from the history's content: corrupted data repaired
to `[]` looks exactly like a cleared history. The cleared stats are written
before the signal, so a tab reacting to it can only read the cleared state. Known limit: if two tabs finish a
game within the few milliseconds it takes the event to arrive, the later write
wins and one game is lost from the shared history. Closing that window needs a
cross-tab lock around read–modify–write (e.g. the Web Locks API), which is more
machinery than a local game history justifies.

A game keeps its id when you rewind it. Finishing a rewound game therefore
*replaces* its record (`stats.ts#recordMatch`) — the scoreboard moves the old
result out and the new one in, so each game counts exactly once.

## Tests

`npm test` runs 164 tests in about 3 s; `npm run test:coverage` adds a coverage
report and fails if `lib/game/*` drops below 95 % of lines.

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
| `__checks__/ai-strength.test.ts` | 690 seeded games: hard never loses on 3x3, hard vs hard always draws, Vanishing never draws, ≤ 250 ms per move on 5x5 |

All random games are seeded, so a failure replays exactly.

## Deployment

GitHub Pages is configured as *Deploy from a branch* on `main` / root, so a
release is the static export copied into the repository root of `main`.

The CI workflow (`.github/workflows/ci.yml`) runs lint, typecheck, tests and the
build on every pull request, on pushes to `ws01/**` branches and on demand, then builds that exact export and uploads it as the
`pages-export` artifact — the deployment can be reproduced from the PR's code
without a local machine. Publishing is unzipping the artifact into the root of
`main`. Locally the same build is:

```bash
GITHUB_PAGES=true PAGES_BASE_PATH=/2026-quitcode-01-agentic-engineering-hw npm run build
touch out/.nojekyll
```

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
