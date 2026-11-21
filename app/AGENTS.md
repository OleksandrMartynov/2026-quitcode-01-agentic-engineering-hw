<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project rules (Tic-Tac-Toe Lab)

Each rule below exists because breaking it already cost a bug or a rewrite.

- **Ask before scaffolding.** Confirm the framework and the design system before
  the first `npm create` — a wrong guess cost a full re-scaffold (Vite → Next.js).
- **Every `localStorage` read goes through a `parse*` function in
  `lib/game/storage.ts`.** Never cast `JSON.parse` output to a type; stored data
  is untrusted, and the app writes its state back after mounting, so one bad
  value would crash every reload.
- **Move rules live in two places**: `engine.ts#applyMove` (source of truth) and
  `search.ts` (fast mirror for the AI). Change both; `search.test.ts` must stay green.
- **A game keeps its id across rewinds.** Anything keyed by game id must treat a
  re-finished game as a replacement, not a new entry (see `stats.ts#recordMatch`).
- **Do not promise in the UI what the code does not do** — e.g. the hard-AI label
  is derived from `ModeConfig.exhaustiveSearch`, not hard-coded.
- Before committing: `npm run check` (lint, typecheck, tests, build).
