# Tic-Tac-Toe Lab

Four game modes and a minimax opponent, built on the
[Porsche Design System](https://designsystem.porsche.com/) — the app for
Workshop 1 of the QuitCode "Modern Development with Agentic AI" course.

```bash
npm install
npm run dev     # http://localhost:3000
npm run build
npm run lint
```

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
  beats a slower one) and centre-out move ordering. On 3x3 the search is
  exhaustive, which makes it unbeatable; on the larger boards and in Vanishing —
  where the board never fills and the tree has no natural end — the depth is
  capped and non-terminal positions get a heuristic score based on open lines.

## Structure

```
app/          Next.js App Router entry (server components, PDS provider)
components/   UI, built from PDS components
lib/game/     rules, engine, AI, localStorage — framework-free and pure
lib/useGame.ts  the single hook wiring the engine to React
```

`lib/game/engine.ts` holds the only implementation of the move rules; the UI and
the AI both call `applyMove`, so no mode rule exists in two places.

## Notes on the setup

- PDS components are imported from `@porsche-design-system/components-react/ssr`,
  the entry point required by server-rendering frameworks.
- The global PDS stylesheet must be imported by its explicit path
  (`.../components-react/index.css`); the bare package specifier does not
  resolve through the Next CSS pipeline.
- `next.config.ts` keeps Lightning CSS from downlevelling `light-dark()`, which
  is what makes the PDS palette follow the system light/dark setting.
