# The Proxima Trail

A retro, wry-humored space reimagining of *The Oregon Trail* (MECC, 1985), built by a team of AI agents as a multi-agent workflow experiment. Browser game: Phaser 3 + TypeScript + Vite.

## Read only what your role needs
Context is a budget. Start with this file, then the one role brief and the one milestone file you are working on. Open other docs only when a task points to them.

| Need | Read |
|------|------|
| Your role, model, and definition of done | `docs/agents/<role>.md` |
| What the current milestone must deliver | `docs/milestones/M<n>.md` |
| How work flows (kanban, branches, commits, review) | `docs/process/workflow.md` |
| Testing rules | `docs/process/testing.md` |
| Game design (split by topic) | `docs/design/README.md` → topic files |
| Original game mechanics reference | `docs/reference/oregon-trail-mechanics.md` |
| Milestone roadmap | `docs/PLAN.md` |

## Commands
```
npm run dev          # Vite dev server on :5173
npm run test:all     # typecheck + lint + unit (vitest) + e2e (playwright)
npm test             # unit tests only (fast)
npm run test:e2e     # playwright against production build on :4173
npm run kanban -- <cmd>   # see docs/process/kanban.md
npm run brainstorm -- --prompt "..."   # local llama3.2 idea generation (dev-time only)
```

## Architecture rules (non-negotiable)
- `src/sim/` is pure TypeScript with **no Phaser imports** and all randomness from `src/sim/rng.ts`. It must run headless under Vitest and in balance simulations.
- `src/content/` holds data (JSON/TS tables): waypoints, events, items, text. No logic.
- `src/scenes/` and `src/ui/` are Phaser presentation only; they call the sim, never duplicate its rules.
- `src/audio/` and `src/gfx/` generate all assets in code (Web Audio synthesis, procedural pixel art). No binary assets are committed.
- Every behavior change ships with tests. Sim code aims for >90% coverage; scenes get Playwright coverage.
- Keep files under ~300 lines; split by concern instead of growing.

## Kanban etiquette
Before starting a task: `npm run kanban -- move T-xxx doing --by <role>`. When finished and tests pass: `move T-xxx review` and add a `note` summarizing what changed and test counts. Never edit `kanban/index.html` by hand; it is generated.

## Commits
One task per commit where practical. Message: `[T-xxx] <imperative summary>`. Run `npm run test:all` before committing. Do not push; the program manager pushes.
