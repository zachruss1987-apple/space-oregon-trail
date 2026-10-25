# Tests

Spec: `docs/process/testing.md`. Role brief: `docs/agents/tester.md`.

## Layout
```
tests/
  unit/<area>/<module>.test.ts   Vitest, node env (also src/**/*.test.ts)
  e2e/<flow>.spec.ts             Playwright, Chromium, vite preview of prod build
  e2e/helpers.ts                 gotoScene(), snap()
  e2e/seeds.ts                   known seeds (from M1)
```
Existing flat files (e.g. `unit/rng.test.ts`) move into `<area>/` as areas grow.

## Running
| Layer | Command |
|-------|---------|
| Types / lint | `npm run typecheck`, `npm run lint` |
| Unit | `npm test` (`SKIP_SLOW=1` skips statistical tests) |
| Unit + coverage | `npx vitest run --coverage` |
| E2E | `npm run test:e2e` (builds, serves on :4173) |
| Everything | `npm run test:all` |

## Determinism
- Sim code takes an `Rng` from `@/sim/rng`; tests use `createRng(<fixed seed>)`.
- Never use `Math.random` in sim or content.
- The game will read `?seed=<string|number>` from M1; e2e navigates via
  `gotoScene(page, key, seed)` so flows are reproducible. Until M1 the param is ignored.

## Scene contract (E2E)
- Each scene sets `document.body.dataset.scene` to its key in `create()`.
- `window.__PROXIMA__` exposes `{ game, version, state? }` (read-only snapshot).
- Wait on `data-scene`, never on timeouts. Prefer role/text locators; the canvas is opaque.

## Naming
- Unit: `tests/unit/<area>/<module>.test.ts`; name tests after design rules.
- E2E: `tests/e2e/<flow>.spec.ts` (e.g. `new-game.spec.ts`).
- One assertion idea per test; seed loops are fine for invariants.

## Speed budgets
Unit suite < 30 s (each test < 2 s), e2e < 3 min. Gate slow statistical tests
with `it.skipIf(process.env.SKIP_SLOW)`.

## Screenshots
```ts
import { gotoScene, snap } from './helpers';
await gotoScene(page, 'Boot');
await snap(page, 'Boot');          // -> test-results/screens/Boot.png
```
One screenshot per scene for designer review. No pixel assertions before M4 baselines.
