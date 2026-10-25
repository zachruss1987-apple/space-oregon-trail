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
createGame({ profession, crewNames?, window, seed?, difficulty? }, rng): GameState // status 'store', day 0; seed label -> state.seed ('' default); difficulty 'spacer' default
buy(state, item, packs): StepResult                                  // Independence store (status 'store'); road stations: `buy` intent
maxBuyable(state, item) / buyBlocker(state, item, packs) / priceAt(item, waypointIndex) / storeWarnings(state)
depart(state, rng): StepResult                                       // needs >= 1 drive; status -> 'traveling'
applyAction(state, intent, rng): StepResult                          // the Travel menu (below)
tick(state, rng, dayKind?): StepResult                               // one raw day; applyAction wraps it
computeScore(state): ScoreBreakdown                                  // lines[], subtotal, multiplier, difficulty (line), difficultyMultiplier, total, rating
toJSON(state): string / fromJSON(json): GameState                    // versioned (STATE_VERSION 4; v1-v3 saves migrate, v3 -> difficulty 'spacer'), throws on bad input
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
| `{ type: 'salvage', result?, skipped? }` | 1 | Salvage Run. No `result` = exactly `scan` (auto-resolve). With a `SalvageResult`: needs >= 1 charge, see "Mini-games". `skipped: true` (needs >= 1 charge) = the skip penalty: logs `info/skipped`, then scan with d100 - 10 (min 1); under 5 charges it spends them all and finds nothing. |
| `{ type: 'cross', method: 'thread' \| 'shields' \| 'tug' \| 'pilot', result?, skipped? }` | 0 / pilot n | Resolves the pending crossing (hazards.md). Pilot: first call pays 10 cr and runs the wait days as ticks (stops early on a death; call again to resume, no second fee), then resolves. `result` (thread only): a `ThreadingResult` at the five hazards, a `FlareResult` at the Flare Belt ("Ride the solar wind" keeps method `thread`); without it the M2 statistical roll runs unchanged. `skipped: true` (thread only, no `result`) = the skip penalty: logs `info/skipped`, then the statistical thread with incident `min(95, T + 10)` (Flare Belt: M1 roll, incident + 10, severity unchanged). |
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
`runPolicy(seed, { profession?, window?, policy?, difficulty? }): RunSummary` plays the travel.md reference policy plus the hazards.md
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
- Skip with penalty (`MINIGAME_SCENE.skipPenalty`): `{ type: 'salvage', skipped: true }` (scan d100 - 10) and
  `{ type: 'cross', method: 'thread', skipped: true }` (incident + 10, capped 95 at the five hazards); both log `info/skipped`
  first. Non-skipped paths draw exactly as before. `src/minigames/outcome.ts` maps a scene's Skip to these.

## Route (hazards.md "Route branch")
`state.route` (`'oort'` default). Direct skips waypoint 12 (next after 11 is 13; total 1,926 Mk; Heliopause +10).
Map data: `routeWaypoints(route)` returns the active waypoint list with route-correct `cumulative`; also `totalMk(route)`,
`cumulativeAt`, `nextWaypoint`, `isSkipped`, `routeBlocker`. Log kind `route` (id = via).

## Beacons (beacons.md; pure helpers, storage stays in the UI)
`BeaconRecord = { segment, captain, name, text, date }` (**gains `captain`** vs M1). `makeBeacon(state, name, text)`
(segment = `beaconSegment(state)` = `arrivedAt ?? segment`, captain = `crew[0].name`), `isValidEpitaph`,
`parseBeacons(raw)` (defensive; missing captain -> ""), `appendBeacon(list, b)` (keeps 200), `cannedBeacons()`,
`beaconsForSegment(playerList, segment, textRng)` (<= 3; player first; canned fill), `formatBeacon(b)`; `BEACONS.key`.

## Difficulty (M5)
`state.difficulty: 'greenhorn' | 'spacer' | 'pathfinder'` (type `Difficulty`; content `DIFFICULTIES`, `DIFFICULTY_ORDER`,
`DEFAULT_DIFFICULTY`; `difficultySpec(d)` returns the multipliers, unknown = spacer). Spacer is today's numbers exactly
(the policy-50 snapshot is unchanged; no new RNG draws on any level). Multipliers apply only to:
| | greenhorn | pathfinder | where |
|---|---|---|---|
| Daily event chance (travel and rest) | x0.75 | x1.25 | `eventStep` |
| Loss-category event weights | x0.75 | x1.25 | `eventWeight` |
| Buy prices per pack, every store | x0.9 | x1.15 | `localPrice/priceAt/costOf(item, wp, difficulty?)`; state-aware helpers (`buy`, `maxBuyable`, `buyBlocker`, road `buy`) use `state.difficulty` |
| Starting credits (rounded) | x1.15 | x0.9 | `createGame` |
| Condition death chance | x0.5 | x1.5 | `deathChanceToday` |
| Final score | x0.75 | x1.25 | `computeScore().difficulty` line |

Not scaled: sell-back prices, tug fees, pilot fee, trade asks, crossing odds, mini-games. Balance:
`npm run balance -- --difficulty greenhorn` (`MatrixSpec.difficulty`, `runCell(..., difficulty)`).

## High scores (M5; pure, storage in the UI)
`HighScore = { name, profession, score, days, date, difficulty }` (`date` = in-game arrival date). Storage key
**`HIGHSCORES_KEY` = `'proxima.highscores'`** (a JSON array). `loadHighScores(raw | null)` = stored rows + the writer's
defaults (`highscores.json`, as spacer), deduplicated, sorted (score desc, ties by earlier date, then existing first), top
ten; bad JSON/rows are ignored. `insertHighScore(list, entry) -> { list, index }` (index -1 = did not place; never
mutates), `qualifies(list, score, date?)` (0 never qualifies), `serializeHighScores(list)`, `toHighScore(raw)`.

## Saves (M5; pure, storage in the UI)
`SaveSlot = { version, savedAt, seed, day, segment, profession, difficulty, captain, state }` (`state` = `toJSON` string;
`segment` = waypoint parked at or heading for; `captain` = crew[0] name). `makeSave(state, seed, nowMs)`,
`parseSave(json | null) -> { ok: true, slot, state } | { ok: false, error }` (validates, migrates through `fromJSON`,
rebuilds metadata from the migrated state), `describeSave(slot)` -> `"Ezra's crew, day 42, near Ceres Depot, Engineer"`
(writer key `ui.saves.describe` with `{owner} {captain} {day} {place} {profession}` overrides the fallback),
`resumeSeed(slot)` (the Rng position is not saved: seed the resumed run's main Rng with `createRng(resumeSeed(slot))`),
`exportSave(slot)` -> `PROXIMA1.<base64 slot JSON>.<8-hex checksum>`, `importSave(text)` (whitespace ignored; rejects a
wrong prefix, checksum mismatch, bad base64 or bad save, with an `error` message).

## UI contract
For e2e tests (src/game/contract.ts); keep stable.
- `?seed=<text|digits>`: digits are used as the number, other text is hashed with `seedFromString`. No param = random 6-char seed, shown on the title.
- `window.__PROXIMA__ = { game, version, seed, state }`; `state` is a getter for the live `GameState` (null on the title/setup).
- `body[data-scene]`: `Title Setup Store Travel Supplies Map Waypoint Hazard Station Death Arrival Salvage Threading Flare Options TopTen Guide`, set in each scene's create().
- `body[data-modal="1"]` while a modal or number prompt is open; `body[data-busy="1"]` while a Travel day is animating (input ignored).
- In the store, `state` updates live as quantities change (status stays `store` until "Leave the store" confirms `depart`).
- Keys are read from `window` (no canvas focus needed). Keys pressed during a scene change can be lost: wait for `data-scene` first.
- Mini-games (src/minigames: Salvage, Threading, Flare): SetupScene passes `seed: __PROXIMA__.seed` to `createGame`
  (`state.seed`). While a mini-game scene runs: `body[data-scene]` = its key and `body[data-minigame]` = its kind
  (`salvage | threading | flare`); `body[data-paused="1"]` while the pause menu or the skip confirm is open. `window.__PROXIMA__.minigame` is
  `null` outside the scenes, else `{ kind, elapsed, result?, skipped?, finishNow(), finishWith(result) }`: `elapsed` =
  fixed-step play seconds (excludes the instruction screen, countdown and pause); `result` is set when the run ends (the
  intent is already applied while the result panel shows, so `state.day` has advanced); `finishNow()` runs the remaining
  steps instantly with no input (works from the instruction screen too); `finishWith(result)` (`?debug=1` or dev builds)
  checks `resultError`, then ends with that result; it returns the refusal string or null. Both dispatch through the
  same intent as play. Flow: instruction screen (Space / Enter / tap) -> 1.5 s countdown -> play -> result panel
  (Enter / Space / tap, ignored for 0.4 s) -> back to Travel, which routes the day's entries like any other day.
  Esc (or the `II` icon) pauses: Resume / Skip (penalty) / Controls; Skip asks to confirm (1 Keep playing, 2 Skip it),
  then dispatches the skip intent (`salvage` / `cross thread` with `skipped: true`) and returns to Travel / Hazard.
- Threading / Flare: the Hazard scene's option 1 (Thread it; at the Flare Belt the rows are **1 Ride the solar wind,
  2 Pay the tug**, then Rest and the travel menu; shields and pilot are not listed) opens `Threading` / `Flare` with
  `returnTo: 'Hazard'` unless auto-resolve is on (then the statistical `cross thread` runs in place, no scene, no
  penalty). Back in Hazard, `session.pendingDay` is replayed: the entries play in the log, the outcome modal shows
  (`body[data-modal="1"]`), then Travel / ending. Threading: Up/Down or W/S (touch: drag; vertical only), 25 s, HUD
  `HITS n`; rocks = `clamp(round(T / 3), 4, 32)` with `T = crossChance(state, 'thread')`. A clean run (0 hits) opens
  the bonus pick before anything is dispatched (`body[data-modal="1"]`; 1 = +2 health, 2 = +10 rations; Enter picks the
  highlighted row), so `minigame.result` is set only after the pick; `finishWith` skips the pick (its result carries the
  bonus). Flare: arrows / WASD (touch: drag), 45 s, HUD `HITS n/5`; arcs from the scene Rng (~30, ~37 in flare season
  via `isFlareSeason`); 5 hits ends the run at once (crash). Both have no action button (no FIRE).
- `__PROXIMA__.loadState(json)` (`?debug=1` / dev builds only; absent otherwise): replaces the run with a `toJSON`
  state and opens Hazard (crossing pending) or Travel; returns a refusal string or null. Used by e2e to start at a
  given crossing (e.g. the Flare Belt).
- E2E: the run helpers in `tests/e2e/helpers.ts` (`startRun`, `generousRun`) add `&minigames=auto` by default, since
  their hazard choreography expects the statistical crossing; specs that play the mini-games pass `''`.
- Mini-game options (src/game/session.ts): `localStorage['proxima.options'] = { autoResolveMiniGames, touchControls }`
  (booleans, read defensively; an Options screen comes in M4/M5). `?minigames=auto` forces auto-resolve for the page load
  without saving it. Hidden key `M` on the Title toggles and saves `autoResolveMiniGames` (a confirmation line shows).
  Auto-resolve on: Travel's Scan confirms "Spend 5 charges and a day?" and dispatches `{ type: 'salvage' }` (the scan);
  no mini-game scene opens, no penalty. Off: Scan needs 1 charge and opens the scene. On-screen FIRE button (and the
  `II` pause icon, always drawn) show on touch devices or when `touchControls` is true.
- Beacon epitaphs: `localStorage['proxima.beacons']` = `[{ segment, captain, name, text, date }]` (beacons.md; read with `parseBeacons`).
- Difficulty (Options): persist the choice in the scene layer and pass it to `createGame({ ..., difficulty })`; a run keeps
  its level (`state.difficulty`). StoreScene/station views must pass `state.difficulty` to `priceAt/costOf/localPrice` for
  displayed prices (the sim's buy/limits already use it). Arrival: show `score.difficulty` as a final row after the
  profession multiplier when `points !== 0` (label `score.labels.difficulty`), and rate by `total`.
- Autosave (src/game/saveStore.ts, T-040): the `session.state` setter calls `syncAutosave`, so every state write (each
  applied action, store departure, mini-game results, `loadState`) stores `JSON.stringify(makeSave(state, seedLabel,
  Date.now()))` in `localStorage['proxima.autosave']` while `status === 'traveling'`, and removes the key on any ending
  (arrived / dead / adrift). Title: with a valid traveling autosave (`readAutosave()`) the menu is **1 Continue journey,
  2 Travel the Trail, 3 Learn about the Trail, 4 See the Top Ten, 5 Options** (else the four items as before) and the
  `describeSave(slot)` line shows under it. Continue calls `session.resume(slot, state)` (seed label from the slot, main Rng
  `createRng(resumeSeed(slot))`, `shownWaypoint = arrivedAt`) and opens `resumeScene(state)`: Hazard (crossing pending),
  Station (`stationOpen`), else Travel.
- Options rows (ui.md + T-040): 1-8 as before, **9 Difficulty** (Greenhorn / Spacer / Pathfinder from `DIFFICULTY_ORDER`,
  persisted as `difficulty` in `proxima.options`), **10 Export save** (dimmed without an autosave), **11 Import save**,
  12 Back. Export / Import open an overlay (`body[data-modal="1"]`) with a DOM `<textarea>`: `#proxima-export` (read-only,
  pre-selected `exportSave(slot)`, also offered to the clipboard) and `#proxima-import` (paste up to 200,000 chars; Enter
  runs `importSave`; failure shows "That save will not load." + the reason; success stores the slot as the autosave and
  returns to Title with Continue). Esc closes either. KeyRouter leaves typing keys to text fields.
- Difficulty: SetupScene passes `session.options.difficulty` to `createGame` and shows it on the profession step.
- Top Ten (`TopTen` scene, Title item "See the Top Ten"): `readHighScores()` = `loadHighScores(localStorage['proxima.highscores'])`
  (defaults merged), columns under `topTen.header`; Esc / Enter / click back. On arrival, after the score screen, a score
  that `qualifies` asks for a name (default `crew[0].name`, 12 chars), then `insertHighScore(..., { name, profession,
  score: total, days, date, difficulty })`, saves `serializeHighScores`, shows `topTen.yourRun` and offers the Top Ten
  with the new row highlighted (`scene.start('TopTen', { highlight: index })`). Deaths never enter the list.
- Guide (`Guide` scene, Title item "Learn about the Trail"): pages `guide.json` (`GUIDE_PAGES`), Left/Right (A/D,
  PageUp/PageDown, Enter/Space next, click halves) with `guide.pageOf`; Esc back.
- Accessibility (T-041, src/game/a11y.ts): two visually hidden (1x1 clipped) nodes on `body`, readable by assistive tech
  and Playwright role locators. `#proxima-live` (`role="log"`, `aria-live="polite"`) gets one `<p>` per line: every new
  `LogEntry.text` (the `session.state` setter diffs the log; a fresh or resumed state reads none), modal text, mini-game
  instruction / result / pause panels, menu notices (`Menu.say`), the `?` overlay and mute changes; the newest 40 lines
  stay. `#proxima-menu` (`role="listbox"`) mirrors the newest live `Menu` (a modal's covers the scene's): one
  `role="option"` per row, text `"<n>. <label>"`, the cursor row `aria-selected="true"` (also `aria-activedescendant`),
  disabled rows `aria-disabled="true"` and `" (unavailable: <reason>)"`. Cleared on every scene start.
- Keys: Menus also move with Tab / Shift+Tab. `?` (not while typing) opens the controls overlay (`help.*` copy,
  `body[data-help="1"]`); any key or click closes it. Travel stops auto-travel and a running mini-game pauses before it
  opens. `M` toggles mute anywhere except Title and while a NameInput / NumberInput / export-import box takes input
  (`bindGlobalMuteKey('m', textEntryActive, { ignore: Title })`, src/game/muteKey.ts); `__PROXIMA__.audio.volumes.muted`
  reflects it and `ui.icon.mute` shows in the corner on Title and Travel while muted.
- Display flags: `body[data-crt]` `on` / `off`, `body[data-reduced]` `1` / `0` (reduced motion in effect: no parallax,
  bob, blink or typewriter, overlays frozen, CRT off; mini-game instructions add `minigame.common.autoAvailable`), and
  `body[data-palette]` `standard` / `cb` (colorblind palette: sprites re-rasterize, scenes re-read `activePalette()`).
- Key hints (T-069, `docs/design/keyhints.md`): the canvas is 640x416; the bottom 16 px band shows the top key handler's
  hint set. `body[data-hints]` is the set id (`menu`, `modal`, `travel`, ... ; absent while hidden by the Key hints option
  or on touch platforms) and `body[data-platform]` is `windows` / `mac` / `linux` / `touch`; `?platform=` overrides detection.
- Audio cues (T-063): Travel loops `drive.hum` while a day runs (stopped when it ends, on sleep and shutdown); Salvage
  loops `grapple.reel` while reeling; `playSting('danger')` on loss events, crossing damage, deaths and hazard arrival;
  `playSting('jingle.clean')` on clean mini-game runs.
