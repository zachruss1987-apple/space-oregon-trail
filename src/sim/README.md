# src/sim — headless simulation API

Pure TypeScript: no Phaser, no DOM, no `Math.random`/`Date.now`. Every function that changes state
returns a **new** `GameState` (inputs are never mutated). All randomness comes from an `Rng` you pass in.
Import from `@/sim` (barrel `index.ts`); data tables live in `@/content`.

## Seeds
```ts
import { createRng, seedFromString } from '@/sim';
const rng = createRng(seedFromString(new URLSearchParams(location.search).get('seed') ?? 'OREGON'));
```
Keep **one** `Rng` per run and pass it to every call; the same seed + same intents = the same run.
Text variants also draw exactly one number per line, so writer edits never change outcomes.

## Lifecycle
```ts
createGame({ profession, crewNames?, window }, rng): GameState      // status 'store', day 0, credits by profession
buy(state, item, packs): StepResult                                  // Independence only (status 'store'); charges sold in boxes of 20
maxBuyable(state, item) / buyBlocker(state, item, packs) / priceAt(item, waypointIndex) / storeWarnings(state)
depart(state, rng): StepResult                                       // needs >= 1 drive; status -> 'traveling'
applyAction(state, intent, rng): StepResult                          // the Travel menu (below)
tick(state, rng, dayKind?): StepResult                               // one raw day; applyAction wraps it
computeScore(state): ScoreBreakdown                                  // lines[], subtotal, multiplier, total, rating
toJSON(state): string / fromJSON(json): GameState                    // versioned (STATE_VERSION), throws on bad input
```
`StepResult = { state, entries: LogEntry[], error?: string }`. On refusal `error` is set, `state` is the
input unchanged and no day passes (show `error` as the dimmed-item message, e.g. "No spare.").

## Intents (applyAction)
| Intent | Day? | Notes |
|--------|------|-------|
| `{ type: 'continue' }` | 1 | Travel one day. Departs the current waypoint if parked (`arrivedAt` -> null). |
| `{ type: 'rest', days: 1..9 }` | n | Stops early on a death or game over. Station bonus while parked at a station. |
| `{ type: 'setThrust', thrust: 'cruise' \| 'hard' \| 'overburn' }` | 0 | |
| `{ type: 'setRations', rations: 'full' \| 'half' \| 'paste' }` | 0 | |
| `{ type: 'repair', part: 'hull' \| 'pump' \| 'gyro' }` | 1 | Needs a broken part and its spare. |
| `{ type: 'scan' }` | 1 | Needs 5 charges; M1 auto-resolve. |
Use `intentBlocker(state, intent)` to grey out menu items before dispatching.

## Advancing and reading what happened
```ts
let r = applyAction(state, { type: 'continue' }, rng);
for (const e of r.entries) log.add(e.text);          // also appended to r.state.log
if (r.state.arrivedAt !== null) showWaypoint(WAYPOINTS[r.state.arrivedAt]);
if (r.state.status !== 'traveling') gotoEnding(r.state.status);   // 'arrived' | 'dead' | 'adrift'
```
`LogEntry = { day, kind, text, id? }`. Kinds: `depart store travel weather help starving suit condition
recover death rejoin event quiet arrival hazard rest repair scan setting gameover info`. `id` carries the
specific key: event id (`pirates`), condition id (`space-dysentery`), death cause, waypoint id,
crossing outcome (`clear scraped cargo damage injury lost`), part, or ending (`arrived dead adrift`).
"Travel until something happens": loop `continue` while `entries` has no `event`, `condition`, `death`,
`arrival`, `hazard` or `gameover` kind.

## Status-panel helpers
`generalHealth(state)` (Good/Fair/Poor/Very poor), `healthLabel(n)`, `daysOfRations(state, setting?)`,
`rationNeed(state)`, `remainingInSegment(state)`, `dailyDistance(state)`, `workingDrives(state)`,
`brokenParts(state)`, `sparesFor(state, part)`, `repairChance(state)`, `canScan(state)`, `isSuited(state, c)`.
Display distances with `Math.floor`; the sim keeps fractions.

## State essentials
`segment` = index of the **next** waypoint (1–16). `arrivedAt` = waypoint the ship is parked at
(set on the arrival tick; hazards are already rolled). `crew[i].alive / cause / awayDays / conditions`.
`deaths` counts drift losses. `date` is ISO `YYYY-MM-DD`.

## Auto-play
`runPolicy(seed, { profession?, window? }): RunSummary` plays the travel.md reference policy;
`policyShop(state)` and `policyIntent(state)` are exposed for the balance harness and e2e seed finders.

## UI contract
For e2e tests (src/game/contract.ts); keep stable.
- `?seed=<text|digits>`: digits are used as the number, other text is hashed with `seedFromString`. No param = random 6-char seed, shown on the title.
- `window.__PROXIMA__ = { game, version, seed, state }`; `state` is a getter for the live `GameState` (null on the title/setup).
- `body[data-scene]`: `Title Setup Store Travel Supplies Map Waypoint Death Arrival`, set in each scene's create().
- `body[data-modal="1"]` while a modal or number prompt is open; `body[data-busy="1"]` while a Travel day is animating (input ignored).
- In the store, `state` updates live as quantities change (status stays `store` until "Leave the store" confirms `depart`).
- Keys are read from `window` (no canvas focus needed). Keys pressed during a scene change can be lost: wait for `data-scene` first.
- Beacon epitaphs: `localStorage['proxima.beacons']` = `[{ segment, name, text, date }]`.
