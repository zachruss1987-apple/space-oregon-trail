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
buy(state, item, packs): StepResult                                  // Independence store (status 'store'); road stations: `buy` intent
maxBuyable(state, item) / buyBlocker(state, item, packs) / priceAt(item, waypointIndex) / storeWarnings(state)
depart(state, rng): StepResult                                       // needs >= 1 drive; status -> 'traveling'
applyAction(state, intent, rng): StepResult                          // the Travel menu (below)
tick(state, rng, dayKind?): StepResult                               // one raw day; applyAction wraps it
computeScore(state): ScoreBreakdown                                  // lines[], subtotal, multiplier, total, rating
toJSON(state): string / fromJSON(json): GameState                    // versioned (STATE_VERSION 2; v1 saves migrate), throws on bad input
```
`StepResult = { state, entries: LogEntry[], error?: string }`. On refusal `error` is set, `state` is the
input unchanged and no day passes (show `error` as the dimmed-item message, e.g. "No spare.").

## Intents (applyAction)
| Intent | Day? | Notes |
|--------|------|-------|
| `{ type: 'continue' }` | 1 | Travel one day. Departs the current waypoint if parked (`arrivedAt` -> null, `station` -> null). Refused while `crossing` is pending ("Choose how to cross first.") and at a station with 0 drives. |
| `{ type: 'rest', days: 1..9 }` | n | Stops early on a death or game over. Station bonus (+6) while parked at a station. Allowed while a crossing is pending (+3). |
| `{ type: 'setThrust', thrust: 'cruise' \| 'hard' \| 'overburn' }` | 0 | |
| `{ type: 'setRations', rations: 'full' \| 'half' \| 'paste' }` | 0 | |
| `{ type: 'repair', part: 'hull' \| 'pump' \| 'gyro' }` | 1 | Needs a broken part and its spare. |
| `{ type: 'scan' }` | 1 | Needs 5 charges; M1 auto-resolve. |
| `{ type: 'cross', method: 'thread' \| 'shields' \| 'tug' \| 'pilot' }` | 0 / pilot n | Resolves the pending crossing (hazards.md). Pilot: first call pays 10 cr and runs the wait days as ticks (stops early on a death; call again to resume, no second fee), then resolves. |
| `{ type: 'route', via: 'oort' \| 'direct' }` | 0 | Only while parked at Titan Refinery (10); changeable until departing. |
| `{ type: 'buy', item, packs }` | 0 | Road stations only (Independence keeps `buy()`). Limits/caps on holdings; never partial; credits never negative. |
| `{ type: 'sell', item, packs }` | 0 | Road stations only; only items the station sells; never the last drive. |
| `{ type: 'trade', offer: index }` | 0 | Accept `state.station.offers[index]` (accept-once; re-checks holdings, caps, last drive). Declining is UI-only. |

Use `intentBlocker(state, intent)` to grey out menu items before dispatching.

## Advancing and reading what happened
```ts
let r = applyAction(state, { type: 'continue' }, rng);
for (const e of r.entries) log.add(e.text);          // also appended to r.state.log
if (r.state.arrivedAt !== null) showWaypoint(WAYPOINTS[r.state.arrivedAt]);
if (r.state.status !== 'traveling') gotoEnding(r.state.status);   // 'arrived' | 'dead' | 'adrift'
```
`LogEntry = { day, kind, text, id? }`. Kinds: `depart store travel weather help starving suit condition
recover death rejoin event quiet arrival hazard rest repair scan setting gameover info crossing route trade`. `id` carries the
specific key: event id (`pirates`), condition id (`space-dysentery`), death cause, waypoint id,
crossing outcome (`clear scraped cargo damage injury lost pump-strain`), crossing method, persona, route,
item, part, or ending (`arrived dead adrift`).
"Travel until something happens": loop `continue` while `entries` has no `event`, `condition`, `death`,
`arrival`, `hazard` or `gameover` kind (and stop when `state.crossing` is set).

## Status-panel helpers
`generalHealth(state)` (Good/Fair/Poor/Very poor), `healthLabel(n)`, `daysOfRations(state, setting?)`,
`rationNeed(state)`, `remainingInSegment(state)`, `dailyDistance(state)`, `workingDrives(state)`,
`brokenParts(state)`, `sparesFor(state, part)`, `repairChance(state)`, `canScan(state)`, `isSuited(state, c)`.
Display distances with `Math.floor`; the sim keeps fractions.

## State essentials
`segment` = index of the **next** waypoint (1–16). `arrivedAt` = waypoint the ship is parked at
(set on the arrival tick; a hazard leaves `crossing` pending, a road station creates `station`).
`route` = `'oort' | 'direct'`. `crew[i].alive / cause / awayDays / conditions`.
`deaths` counts drift losses. `date` is ISO `YYYY-MM-DD`.

## Auto-play
`runPolicy(seed, { profession?, window? }): RunSummary` plays the travel.md reference policy plus the hazards.md
crossing policy (`policyCross`); route always via Oort; no station shopping or trading (a 0-drive station stop buys a
drive if affordable, else rests). `policyShop(state)` and `policyIntent(state)` are exposed for the balance harness and e2e seed finders.

## Hazard crossings (hazards.md)
`state.crossing = { waypoint, density, pilotDaysLeft } | null` is set on the hazard arrival tick (one density draw;
the Flare Belt is always 5, no draw). **While `state.crossing !== null` the UI must show the Hazard scene**; `continue`
is refused. Readout helpers: `crossingOptions(state)` -> `[{ method, blocker, chance, risk, price?, waitDays? }]` in menu
order (show `blocker` dimmed instead of a risk word; never show `chance`), `riskWord(pct)` / `riskLabel(pct)`,
`densityTrend(crossing)` (`thinner|usual|thicker` -> `hazard.density.*`), `crossChance`, `tugPrice`, `crossBlocker`,
`shipModifier`, `baseIncident`, `isFlareBelt`. A crossing logs `crossing` (id `thread|shields|tug|pilot`; the pilot also
logs `pilot-wait` per wait day and `pilot-arrives`), then `hazard` (outcome id), then `hazard` `pump-strain` (shields,
15%). After resolution `crossing = null`, `justCrossedHazard = true`, the ship stays parked; Continue departs.
UI: Waypoint -> "Approach the crossing" -> `Hazard` scene (options 1-4, 5 Rest, 6 travel menu); Travel's refused Continue also routes there.

## Stations (economy.md)
`state.station = { waypoint, offers: TradeOffer[] } | null` is created on arrival at a road station (offers drawn with
the main Rng in the arrival tick) and cleared on departure. **`stationOpen(state)` (station set and parked there) means
the Station scene is available.** Prices: `localPrice(item, wp)` (null = not sold), `priceAt` (throws if not sold),
`sellPrice(item, wp)` per pack (null at Independence / not sold), `storeIndex(state)`, `maxBuyable(state, item)`,
`maxSellable(state, item)`, `roadBuyBlocker`, `sellBlocker`. Trade: `TradeOffer = { persona, give: { item | 'credits',
qty }, get: { item, qty }, fairness, taken }` (qty in units; charges are single charges); `tradeLine(textRng, offer,
'offer' | 'accept' | 'decline')` fills `{give}`/`{get}`/`{n}`, `offerVars`, `personaName`, `itemPhrase(item, qty)`,
`formatCr`. Talk: `shuffledTalk(stationId, textRng)` (show in order, reshuffle when exhausted), `stationTalk`,
`stationKeeper`, `stationGreeting(textRng, state, wp)`. Log kinds: `store` (id = item), `trade` (id = persona).

## Route (hazards.md "Route branch")
`state.route` (`'oort'` default). Direct skips waypoint 12 (next after 11 is 13; total 1,926 Mk; Heliopause +10).
Map data: `routeWaypoints(route)` returns the active waypoint list with route-correct `cumulative`; also `totalMk(route)`,
`cumulativeAt`, `nextWaypoint`, `isSkipped`, `routeBlocker`. Log kind `route` (id = via).

## Beacons (beacons.md; pure helpers, storage stays in the UI)
`BeaconRecord = { segment, captain, name, text, date }` (**gains `captain`** vs M1). `makeBeacon(state, name, text)`
(segment = `beaconSegment(state)` = `arrivedAt ?? segment`, captain = `crew[0].name`), `isValidEpitaph`,
`parseBeacons(raw)` (defensive; missing captain -> ""), `appendBeacon(list, b)` (keeps 200), `cannedBeacons()`,
`beaconsForSegment(playerList, segment, textRng)` (<= 3; player first; canned fill), `formatBeacon(b)`; `BEACONS.key`.

## UI contract
For e2e tests (src/game/contract.ts); keep stable.
- `?seed=<text|digits>`: digits are used as the number, other text is hashed with `seedFromString`. No param = random 6-char seed, shown on the title.
- `window.__PROXIMA__ = { game, version, seed, state }`; `state` is a getter for the live `GameState` (null on the title/setup).
- `body[data-scene]`: `Title Setup Store Travel Supplies Map Waypoint Hazard Station Death Arrival`, set in each scene's create().
- `body[data-modal="1"]` while a modal or number prompt is open; `body[data-busy="1"]` while a Travel day is animating (input ignored).
- In the store, `state` updates live as quantities change (status stays `store` until "Leave the store" confirms `depart`).
- Keys are read from `window` (no canvas focus needed). Keys pressed during a scene change can be lost: wait for `data-scene` first.
- Beacon epitaphs: `localStorage['proxima.beacons']` = `[{ segment, captain, name, text, date }]` (beacons.md; read with `parseBeacons`).
