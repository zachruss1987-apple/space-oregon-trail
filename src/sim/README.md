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
createGame({ profession, crewNames?, window, seed? }, rng): GameState // status 'store', day 0; seed label -> state.seed ('' default)
buy(state, item, packs): StepResult                                  // Independence store (status 'store'); road stations: `buy` intent
maxBuyable(state, item) / buyBlocker(state, item, packs) / priceAt(item, waypointIndex) / storeWarnings(state)
depart(state, rng): StepResult                                       // needs >= 1 drive; status -> 'traveling'
applyAction(state, intent, rng): StepResult                          // the Travel menu (below)
tick(state, rng, dayKind?): StepResult                               // one raw day; applyAction wraps it
computeScore(state): ScoreBreakdown                                  // lines[], subtotal, multiplier, total, rating
toJSON(state): string / fromJSON(json): GameState                    // versioned (STATE_VERSION 3; v1/v2 saves migrate), throws on bad input
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
| `{ type: 'salvage', result? }` | 1 | Salvage Run. No `result` = exactly `scan` (auto-resolve). With a `SalvageResult`: needs >= 1 charge, see "Mini-games". |
| `{ type: 'cross', method: 'thread' \| 'shields' \| 'tug' \| 'pilot', result? }` | 0 / pilot n | Resolves the pending crossing (hazards.md). Pilot: first call pays 10 cr and runs the wait days as ticks (stops early on a death; call again to resume, no second fee), then resolves. `result` (thread only): a `ThreadingResult` at the five hazards, a `FlareResult` at the Flare Belt ("Ride the solar wind" keeps method `thread`); without it the M2 statistical roll runs unchanged. |
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
recover death rejoin event quiet arrival hazard rest repair scan setting gameover info crossing route trade salvage threading flare`. `id` carries the
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

## Mini-games (minigames.md)
Scenes play with their own Rng, `createRng(minigameSeed(state, kind))` = `seedFromString(`${state.seed}:${kind}:${state.day}`)`
(`kind` = `salvage | threading | flare`, `day` at launch); the main Rng is only used when the result is applied.
Result objects (all integers >= 0, no extra keys; `resultError(result, kind)` checks the schema):
```ts
SalvageResult   = { kind: 'salvage', rations: 0..100, plates/pumps/gyros: 0..3, chargesUsed: 0..20, crewHurt: 0..3, droneWrecked? }
ThreadingResult = { kind: 'threading', hits: 0..99, bonus: 'health' | 'rations' | null }   // bonus only when hits === 0
FlareResult     = { kind: 'flare', hits: 0..5 }                                              // 5 = crash
```
Dispatch: `applyAction(s, { type: 'salvage', result })` / `{ type: 'cross', method: 'thread', result }`, or the wrappers
`applySalvageResult`, `applyThreadingResult`, `applyFlareResult`. Refused with `error` (no day, state unchanged): bad
shape, `rations + 10 x parts > 100` (`haulUnits`), a bonus with hits, `chargesUsed > min(charges, 20)`, 0 charges, a
result on a method other than thread, or the wrong kind for the place (`salvageResultBlocker`, `crossResultBlocker`).
- **Salvage** (1 tick, day kind `salvage`): charges -= chargesUsed; `scansThisSegment += 1` (shared with scan; 3rd+ halves
  rations, floor); parts clamped to the hold cap of 3; one victim draw per `crewHurt` (-5 health). Logs `salvage`:
  `wrecked` (first, when droneWrecked), `haul` (text `salvage.haul` / `haulRations` / `haulParts`, `{n}` `{parts}` via
  `partsPhrase`) or `nothing`, then `hot` per hurt crew.
- **Threading** (no day): replaces the incident draw. Logs `crossing/thread`, `threading/clean` (bonus: +2 health all
  present crew or +10 rations; then `hazard/clear`) or `threading/hit` (`{hits}`), then per hit (max 4) a severity d100
  (+5 at density >= 4; rolls 1-2 capped at 95) and its `hazard/<outcome>` picks. Several Scraped = one delay day.
- **Flare Belt** (no day): logs `crossing/thread` then `flare/clean` (`rodeTheWind = true`, score line `rodeTheWind`
  +200 before the multiplier), per hit (1-4) a d100 (+10 flare season) -> `scorch` (1-35) / `burn` (36-65) /
  `damage` (66-85) / `radiation` (86-100), or `crash` (5: a present crew dies, cause `hazard`; rations/suits/charges
  lose floor(50%); one of each spare held; hull breaks).
- `runPolicy` never sends a result, so its outputs are unchanged (pinned by a 50-seed fixture in `minigames.test.ts`).
- Not in the sim yet: skip-with-penalty variants (scan d100 - 10, thread `T + 10`, Flare incident +10) and the
  `info/skipped` log line; scenes need them before Skip ships.

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
- M3 (minigames.md; **scene developer implements**, not the sim): `createGame` must receive `seed: __PROXIMA__.seed`
  so `state.seed` is set; `body[data-scene]` adds `Salvage Threading Flare`; `body[data-paused="1"]` while paused;
  `window.__PROXIMA__.minigame` is `null` outside the scenes, else `{ kind, elapsed, result? }` (`elapsed` = fixed-step play
  seconds excluding countdown/pause; `result` set when the run ends, before the panel closes); while a run is live
  `finishNow()` ends it as if time ran out, and `finishWith(result)` (test builds / `?debug=1` only) ends it with that
  result. Both go through `resultError` and the same intent as normal play. Options flag `autoResolveMiniGames`
  (`localStorage['proxima.options']`, `?minigames=auto`) dispatches the intents without a result.
- Beacon epitaphs: `localStorage['proxima.beacons']` = `[{ segment, captain, name, text, date }]` (beacons.md; read with `parseBeacons`).
