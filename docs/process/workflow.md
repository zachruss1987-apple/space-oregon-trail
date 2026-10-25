# Workflow

## Branches and commits
- Single `main` branch; agents commit locally, the program manager pushes. CI and Pages run on every push to `main`.
- Commit per task: `[T-012] Add daily travel tick`. Body optional. Co-author trailer is added by the PM's tooling.
- Never commit with failing `npm run test:all`. If a test is flaky, fix or quarantine it with a card, never delete it silently.

## Task lifecycle
`backlog` → `todo` (PM has written acceptance criteria) → `doing` (agent claimed) → `review` (tests green, note added) → `done` (verified) — or `blocked` with a note explaining what is needed.

## Parallelism rules
- Agents may run concurrently when their write sets do not overlap. Typical safe triples: sim developer / content writer / tester.
- Shared files (`src/sim/types.ts`, `src/content/index.ts`) are owned by the developer; others request changes via notes.
- Rebase conflicts are resolved by the PM.

## Reviews
- Tester verifies every `review` card for M1+ (PM may verify docs-only cards).
- Review checklist: tests exist and pass; acceptance criteria met; no new lint warnings; no rule logic in scenes; content numbers live in `src/content`; kanban note present.

## Reports
Each milestone ends with `docs/reports/M<n>.md`: shipped items, metrics (tests, coverage, bundle size, win-rate table when available), decisions and deviations from the milestone file, lessons for the next milestone, agent roster used (role, model, approximate task count).
