# Testing

## Layers
| Layer | Tool | Location | Runs |
|-------|------|----------|------|
| Types + lint | tsc, ESLint | whole repo | `npm run typecheck`, `npm run lint` |
| Unit | Vitest (node env) | `tests/unit/**/*.test.ts` | `npm test` |
| E2E | Playwright (Chromium) against `vite preview` of the production build | `tests/e2e/**/*.spec.ts` | `npm run test:e2e` |
| Balance (M5) | Node script over the headless sim | `scripts/balance.mjs` | CI, reduced N |

## Determinism
- The sim takes an `Rng` (`src/sim/rng.ts`). Tests create it with a fixed seed. Never use `Math.random` in sim or content.
- The game reads `?seed=<string|number>` from the URL; e2e tests use it. The developer keeps a short list of "known seeds" in `tests/e2e/seeds.ts` (e.g. one that dies early, one that reaches the first station fast). Discover seeds with `node scripts/find-seed.mjs` (M1).

## Scene contract for E2E
- Every scene sets `document.body.dataset.scene` to its key on `create()`.
- `window.__PROXIMA__` exposes `{ game, version, state? }` where `state` is a read-only snapshot getter for assertions. No other globals.
- From M5 a hidden `aria-live` region mirrors the log and current menu, usable by locators.

## Coverage targets
- `src/sim` and `src/content` ≥ 90% lines (enforced in CI from M1 via `vitest --coverage` thresholds).
- Scenes are covered by e2e flows, not line coverage.

## Speed budgets
Unit suite < 30 s; e2e < 3 min; statistical tests gated by `SKIP_SLOW` env var locally.

## Writing good tests here
- Test the spec, not the implementation: name tests after rules in `docs/design`.
- One assertion idea per test; loops over seeds are fine when asserting invariants.
- E2E: wait for `data-scene`, not timeouts. Use `page.keyboard` for navigation; avoid pixel assertions before M4 baselines.

## Running e2e while other agents work
Playwright builds to `dist/`, serves on :4173 and writes `test-results/`. Two agents running e2e at once collide (ENOENT in test-results, stale builds). Rules: run `npm test` freely; run `npm run test:e2e` once at the end of your card with `PW_OUT=test-results/<card-id>` set so artifacts do not clash; if it fails with ENOENT or a build race, re-run once before investigating.
