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
| **Blitz** | 3x3 against a per-move clock (5/10/20 s). Running out of time loses the game. |

The opponent is an independent setting and works in every mode: two players on
one screen, or the computer at one of three levels.

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
  stats.ts          match records and the scoreboard
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

A game keeps its id when you rewind it. Finishing a rewound game therefore
*replaces* its record (`stats.ts#recordMatch`) — the scoreboard moves the old
result out and the new one in, so each game counts exactly once.

## Tests

`npm test` runs 95 tests in about 2.3 s:

| File | What it pins down |
|---|---|
| `rules.test.ts` | line generation for every board, no wrap-around diagonals |
| `engine.test.ts` | moves, draws, vanishing order, timeouts, rewind |
| `search.test.ts` | the AI's rule mirror agrees with the engine (differential) |
| `storage.test.ts` | corrupted / legacy localStorage payloads |
| `stats.test.ts` | records and scoreboard, replayed games counted once |
| `useGame.test.ts` | the hook end to end: storage healing, rewind, AI and blitz timers |
| `__checks__/ai-strength.test.ts` | 690 seeded games: hard never loses on 3x3, hard vs hard always draws, Vanishing never draws, ≤ 250 ms per move on 5x5 |

All random games are seeded, so a failure replays exactly.

## Deployment

GitHub Pages is configured as *Deploy from a branch* on `main` / root, so a
release is the static export copied into the repository root of `main`.

The CI workflow (`.github/workflows/ci.yml`) runs lint, typecheck, tests and the
build on every push and PR, then builds that exact export and uploads it as the
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
