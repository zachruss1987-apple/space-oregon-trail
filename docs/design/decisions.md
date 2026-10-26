# Design decisions

Append-only. One line per decision: what was decided, then why. Newest at the bottom. Change a rule in its topic file first, then log it here.

## 2026-10-24 (T-008, M1 readiness review)
- Thrust base raised to 20/25/30 Mk/day (was 12/16/20): the old values gave 180–220-day runs; these give ~135–190 with the original's +25%/+50% steps.
- Ration health shifted to Full +2 / Half 0 / Paste −2 (was +1/−1/−3): with no baseline recovery, Half was fatal over 150 days; Half now means "holding steady," as Meager did.
- Thrust health penalties kept at −2/−5 and applied on moving days only: Hard burn stays a real trade; a halted ship should not tire the crew.
- Ration price 0.30 cr (was 0.20) and start buy limit 3,000 (was 2,000): M1 has no resupply, so the limit must cover a Full trip, and only the Executive should afford one (a lean Engineer kit leaves ~2,100 rations vs 2,250 needed).
- Farmer ration perk is `floor(need × 0.85)`, min 1: rations stay integers; flooring slightly favors the profession that needs it most.
- Event chance 15% per tick, 7.5% resting (was 25%/12.5%): 25% produced ~37 events a run, mostly breakdowns, which buried choices under dice.
- drive_failure weight 5 → 4: adrift endings for well-supplied Executives were ~5%, which reads as unfair.
- Condition death chance scales with the victim's health (×0.5 Good to ×2 below 25): makes deaths traceable to rations, pace and rest rather than pure dice.
- Illness weight scales with general health (20/30/40): the same lesson, applied to catching things rather than dying of them.
- Illness pool defined (dysentery 6, mold 3, cryo 4, scurvy 4, puncture 3); radiation, exhaustion, decompression are trigger-only: resolves events.md vs health.md overlap.
- Radiation sickness: 15% per unsuited crew per storm/flare day: suits need a concrete payoff.
- Suit wear: 20% chance to lose one suit per Solar storm or Flare day (replaces "per crew lacking a spare on unsettled days"): the old rule was ambiguous and contradicted the weather table.
- Suits are assigned in roster order, captain first: deterministic and explainable.
- Weather is a sticky Markov chain (persistence 0.6) over phase rows (early by window, mid shared, late by flare season): one concrete table, window identity lives where the player feels it.
- Flare season starts 15 Sept 2184: with ~140-day runs it makes Windows 1–2 safe, 3 a race, 4–5 certain, matching world.md's risk column.
- Distance overflow on arrival day is lost: keeps arrival handling simple; costs ~8 days a run and is already in the numbers.
- Day-consuming actions (rest, scan, repair, lost/delay days) are ordinary ticks with distance 0: one code path, every rule still applies.
- Attempt repair takes 1 day and fixes one part; ion drives are never repaired: drives already have their own failure/stall pair.
- Passing help (10%/day) fixes a broken part without a spare or gives a stranded ship 1 drive; adrift ending after 15 stranded days: homage to the helpful passerby with a real deadline.
- Drive buy limit 1–9, at least 1 to depart (was "2–9"): the drive factor table already defines 1 drive; Mattie's advice carries the warning.
- Spare parts capped at 3 per type in inventory, including finds: matches store limit and scoring.
- Scan for salvage (M1): 1 day, 5 charges, d100 table with EV ≈ 27 rations, halved after 2 scans per segment: the Farmer's lifeline, but not a substitute for buying food.
- M1 hazard = one incident roll then a d100 severity table (delay / cargo / damage / injury / death): reuses the existing hazard parameters; tug and pilot columns wait for M2.
- Window 1/2 hazard bonus (+10/+5) applies only at the first two hazards: world.md's "slower transit through the Lunar Debris Ring" made concrete.
- Missing (drifting) crew are not present: no food, no health change, not victims; they rejoin at once if everyone aboard dies: avoids an empty ship with a living crew.
- Health is shown as labels only, per crew in Check supplies: imperfect information, but every crew member's state is visible.
- Default crew names Ezra, Temperance, Amos, Lucinda, Hollis plus a 20-name pool: period-flavored, all ≤ 12 characters.
- Score bonuses are added before the multiplier; drift losses count as deaths for the +300: as written, now unambiguous.
- M1 always routes via Oort Beacon: the Titan branch is an M2 choice.

## 2026-10-24 (sim implementation, developer, logged by PM)
- Station price markups: superseded by the per-item markup table in `economy.md` (T-022/T-046, 2026-10-24); the flat 1.25 + 0.25/station placeholder is retired.
- Auto-play policy also repairs whenever a broken part has a spare; "days left" is counted at Half rations.
- Exhaustion counter builds only on Overburn days with movement and decays 1 per tick off Overburn (rest days included).
- Scans and repairs resolve at tick step 4 (distance step) as zero-distance days.
- A stalled drive stays offline for the rolled days, counted after that day's distance.
- Zero-health deaths without an active condition take the dominant cause per health.md (bad_recycler / hazard hits included).
- Hazard injury falls back to −15 health if the victim already gained a condition that day; cargo loss with an empty hold counts as clear; damage to an already-broken part has no extra effect.
- Credits keep cents (rations cost 0.30 cr).
- Playthrough (200 seeds): 49.5% win overall, Executive 66%, Engineer 72%, Farmer 5%, mean 177 days. Accepted for M1; M5 balances Farmer and Executive mass penalty.

## 2026-10-24 (tester)
- A condition caught today (radiation sickness, illness, injury) does not tick down on the day it is caught, so its first full duration is the rolled 5–9 / table range: health.md steps 4–5 were ambiguous; the code's reading is reasonable and now asserted by `tests/unit/spec/health.spec.test.ts`.
- Scurvy becomes eligible on the 10th consecutive Half/Paste day (the counter is compared after that day's increment): events.md "after 10+ consecutive days" was ambiguous; asserted in `events.spec.test.ts`.
- Policy-run finding (not a rule change): in 1,000 seeds (SEED-0..999) no reference-policy run dies before day 40 (earliest Executive death is day 111), so e2e "early death" seeds are the earliest deaths, not under-40 ones; see `tests/e2e/seeds.ts`.

## 2026-10-24 (T-022 / T-046, M2 economy and hazards spec)
- Markups are per station per item (not one number per station), all in 1.0–2.5: scarcity becomes thematic (Mars food 1.0, Ceres charges 1.0, Titan pumps 1.25, Oort gyros 1.5 and no drives, Lane Terminus food 2.0) while the overall +0.25/station trend matches the original.
- Ration markups limited to 1.0/1.5/2.0/2.5 so ration prices are whole cents (avoids float rounding of 0.375/0.675).
- Buy-back = min(50% local, 90% base), stations buy only what they sell: plain 50% let players buy at Independence/Mars and sell farther out at a profit (e.g. rations 0.30 → 0.375 at Titan); with the cap, buy-then-sell always loses ≥ 10%.
- No per-visit stock limits on the road; the start buy limits and caps apply to holdings: fewer state fields, and caps already bound the useful amounts.
- Cannot sell the last drive, trades cannot take it, and Continue needs ≥ 1 drive; arriving with 0 drives is resolved by buying, trading, or resting (passing help / adrift), so no soft-lock.
- NPC offers: 2–3 per road-station visit, generated in the arrival tick with the main Rng (reproducible regardless of UI path), valued at base prices with a hidden fairness roll (1.6 / 1.25 / 1.0 / 0.75); credit asks floored at 1.0 so a trader is never a cheaper source than the cheapest store.
- Trades value at base prices, not local: trading is how a broke traveler beats the markup; the Farmer's lever (30 rations for one spare at fair, vs 20 from selling it) beats the store 1.5–2×.
- Rations trade lot 30–150 so a single spare can buy food at fair terms.
- `trades.json` uses `{give}`/`{get}` as full phrases with counts; `{n}` is optional (the get quantity): two quantities made a lone `{n}` ambiguous.
- Talk pool ≥ 10 per road station (brief said ≥ 8): 6 × 10 meets M2's ≥ 60 lines; Talk is UI-only with the text Rng and no state.
- stations.json drops `name`, `blurb`, `markup` from the old writing.md schema: names live in waypoints.ts, blurbs in bulletins.json, markups are rules (content TS), not text.
- Hazards: crossing becomes a pending decision on arrival; resolution costs no day (as in M1), and rest/repair/scan stay available while pending so blocked options cannot soft-lock.
- Today's density rolled on arrival (±1 around nominal, 25/50/25) and scales Thread risk ×0.8/1.0/1.2: gives the readout real information and makes "baseline × density factor" concrete.
- Ship state adds +10 each for broken hull, broken gyro, ≤ 1 working drive: ties hazard risk to earlier repair and drive choices.
- Shields halve risk and apply −10 severity (no Lost possible) at a 15% pump-break cost: a clear "spend a part to protect people" trade.
- Belter pilot only at the Belt Crossing and Saturn Ring Plane (trail.md had waits for all hazards): matches the Belters' lore; pilot is 3% flat with −20 severity (no injury/death); wait days are ordinary ticks (food, events), not rest.
- Tug ×1.5 in flare season applies by date at any hazard (only the last two meet it in practice).
- The Flare Belt in M2 offers only Thread (exactly the M1 roll) and a tug; shields/pilot dimmed. M3 replaces both with the finale.
- Risk words: None 0, Low 1–9, Moderate 10–24, High 25–44, Severe ≥ 45; percentages hidden (imperfect information).
- Route: direct skips waypoint 12; segment 13 stays 160 Mk from the Gate (total 1,926); Heliopause +10. Route can be changed until leaving Titan; default via Oort.
- Beacons: one optional epitaph per crew death (not only the last), segment = `arrivedAt ?? segment`, last 200 kept; up to 3 shown per waypoint, player beacons first, canned fill at most 2 slots (1 once the player has ≥ 10 beacons) so canned ones fade as real ones accumulate.
- Reference auto-play crossing policy: pilot > tug if credits ≥ 2× price > shields if a spare pump > thread; route always via Oort.

## 2026-10-24 (M2 sim implementation, developer, logged by PM)
- Pilot log entries: `crossing/pilot` on hire, `crossing/pilot-wait` per day with {n} days left (counting today), `crossing/pilot-arrives`.
- Shields pump-strain uses exactly one RNG draw; an already-broken pump cannot break again. Tugs make no incident draw.
- Trade generation: fairness is drawn on each retry of the "get" item; a dropped slot still consumes its persona. Credit asks are whole cr; quantities are units (charges, not boxes).
- Refusals: "They don't buy that here.", "You don't have that many.", "No such offer." Continue with 0 drives is refused only while parked at a station.
- Reference policy does not shop or trade on the road; at a station with 0 drives it buys one if affordable, else rests.
- Playthrough after M2 (1,000 seeds): 43.3% win, mean 182 days; Executive 62%, Engineer 64%, Farmer 3%. Top deaths: radiation, starvation, cryo-fever. M5 target bands unchanged.

## 2026-10-24 (tester, M2)
- `trades.json` personas name the pitch lines `offer` (economy.md schema says `pitch`); `tradeLine` reads `offer` and falls back to `pitch`, so the code is fine. `trades.spec.test.ts` accepts either key; the doc schema should be updated to `offer` when the writer next touches it.
- Trade offers are drawn after the rest of the arrival tick, so an event earlier that day (drive_failure, pirates) can lower a holding before the cap/holdings checks; spec tests of "never offers a get item at cap" therefore only count arrivals where the holdings were unchanged.

## 2026-10-24 (T-027, M3 mini-games spec)
- Every mini-game hands the sim a counts-only result (`SalvageResult`, `ThreadingResult`, `FlareResult`) through an intent; the sim picks victims and rolls with the main Rng, so results stay small, validatable and scriptable, and runs without a result (policy, auto-resolve) are exactly M1/M2.
- Mini-game RNG `seedFromString(seed + ':' + kind + ':' + day)` never touches the main Rng; a fixed 60 Hz step makes play frame-rate independent. Needs `state.seed` (STATE_VERSION 3) so loaded saves replay the same fields.
- Salvage: 40 s, 1 charge per shot, max 20 charges per run, 100-unit tow (rations 1, parts 10), parts kept first in the clamp; diminishing returns shared with `scan` via `scansThisSegment`. Average target ~40 rations (~1.5× the 27-ration auto scan per day, ~1× per charge): skill pays in days, not in a broken economy. Needs only 1 charge (auto still 5).
- Hot chunks hurt one random crew −5 each (max 3); a wrecked drone halves the haul instead of costing anything else, since drones are abstract.
- Threading: rock count `R = round(T/3)` with an assumed 3% average hit rate makes expected severity rolls equal the statistical `T/100`. Hits 1–2 can never kill (cap 95); the 3rd–4th rolls are uncapped; max 4 rolls. Deaths therefore come from repeated hits (skill), not one unlucky roll. Ship state enters only via `T`.
- Clean threading bonus: player picks +2 health all or +10 rations (worth ~7 rations per average crossing).
- Flare Belt: two options, "Ride the solar wind" (intent method stays `thread` so `policyCross` is unchanged) and "Pay the tug" (kept, overriding trail.md/hazards.md's "M3 removes it"). Without a cheap way out, Farmers would have no choice at all at the finale; the tug is the Barlow Road.
- Flare hits use their own crew/supply table (scorch, burn, damage, radiation) instead of severity bands; only a crash (5 hits) kills. Arc counts tuned so an average player's crash rate (~1.9% / 12%) sits near the statistical death rate (4.5% / 12%).
- "Rode the wind" +200 only from a clean mini-game (a skill line, like the original's hunting); auto-resolve never earns it (open question for accessibility parity).
- Skip = auto-resolve with a penalty (+10 incident, or −10 on the salvage d100); the Options auto-resolve has no penalty.

## 2026-10-24 (M3 design, PM rulings)
- "Pay the tug" remains available at the Flare Belt in M3 (consistent with the M2 build); riding the solar wind is the mini-game alternative.
- Auto-resolve players cannot earn the "Rode the wind" +200 bonus; it rewards the real-time run only.
- Average-player hit rates (3%/5%/7%) are provisional until M5 playtests.

## 2026-10-24 (M3 sim results, developer, logged by PM)
- Result validation refuses (rather than clamps) chargesUsed above min(charges, 20) and hauls above the 100-unit carry limit; the scene enforces limits and shows `salvage.overweight` itself. Parts above the hold cap of 3 are clamped.
- The Flare Belt mini-game uses method `thread` with a flare-kind result; there is no separate `ride` method.
- Hot-chunk deaths take the health.md dominant cause; flare burn/radiation deaths are cause `hazard`; scorch with empty cargo logs n = 0; radiation on a crew member with no condition room gives a second random crew −10.
- Crash: cargo halves rounded down; one of each held spare is lost deterministically (no draw); threading health bonus caps at 100.

## 2026-10-24 (T-032, M4 art and audio spec)
- Palette: 16 colors (black, navy, blue, cyan, plum, brown, red, orange, amber, peach, lime, forest, grey, silver, white, magenta) plus a 2-color phosphor text ramp (#5cff5c, #c8ffc8) and the #001a00 panel fill, which keeps the existing M1–M3 look. Peach and brown double as skin tones, so no skin ramp is needed; existing #ffd75c (amber), #2e8a2e (forest) and #6d2b79 (plum) are kept as indices.
- Colorblind table swaps toward Okabe–Ito hues (red→vermillion, lime→reddish purple, forest→bluish green); every color-coded meaning also carries a shape cue so the table is a comfort, not a crutch.
- Sprite grids are hex chars per palette index, frames as `string[][]`, optional `mirrorX` and `recolor` to cut grid typing; `P`/`H` text colors only in `ui` sprites.
- Hauler damage state derives from the sim: intact / damaged (1 problem) / critical (hull broken or ≥ 2 problems); 3 separate plume sprites by thrust instead of scaling one, since sprite scale is integer-only.
- Landmark approach grows in tiers (blip 120 Mk, far icon 60 Mk, full art 20 Mk) instead of scaling, keeping pixels square; 4 generic far icons rather than one per waypoint.
- Hazards get compositions of shared parts (rocks, planets, overlays), not unique sprites: 6 hazard looks for ~0 new grids.
- Stations: 7 exteriors (all seven stations, M4.md said 6); every waypoint has art.
- Font: 6×8 cell, sizes ×1 small (tables, log, HUD) and ×2 body (menus, prose, status). Body at ×2 gives a 53-column screen, close to the era's 40-column feel; dense tables keep ×1 so Supplies and the Map still fit.
- Scaling: integer only when ×2 or more is available (computed in device pixels); below that, fractional nearest-neighbour, because ×1 on a 720p window would be tiny.
- CRT: on by default on desktop WebGL, off on touch, Canvas or reduced motion; flicker exists only in the sound/debug tools.
- Audio: 3 tonal channels + noise; two LFSR noise modes for hiss vs metallic; one tempo per song; tie written `-:dur`; loops via `|: :|` with equal loop lengths per channel enforced by the validator.
- Added a `hazard` loop (uneasy ostinato on the Hazard scene) and `event.ding`, `ui.deny`, `grapple.snap`, `grapple.empty`, `flare.warn` SFX beyond the M4 list, because those scenes already exist and would otherwise be silent.
- Ducking applies only to `duck`-class SFX (−6 dB); UI blips and the typewriter do not duck, to avoid constant pumping. Stings duck to −12 dB.
- One settings store, localStorage `proxima.settings` v1, for audio and every Options row; master volume is not a row (mute on `M`).
- Title theme brief is described by shape (rising arpeggio, fiddle turn, pentatonic lead), never by reference to the original game's tune.

## 2026-10-24 (M4 design, PM rulings)
- Pixel font is 8×8 at ×1 (80 columns) for body text; 6×8 only for HUD. Rationale: avoid relaying out every scene; period-correct 80-column look.
- Fractional nearest-neighbour scaling below ×2 is acceptable.
- Art scope: 7 station exteriors, portraits with healthy/sick/dead frames, 11 songs (adds a hazard loop), 26 SFX.

## 2026-10-25 (M3 scenes, developer, logged by PM)
- E2E helpers default to `?minigames=auto` with an opt-out, so statistical flows stay deterministic; mini-game specs opt in.
- The threading clean-run bonus is chosen in a modal before the result is dispatched (`finalize()` hook); `finishWith` skips the pick.
- The Flare Belt hazard menu shows only Ride the solar wind and Pay the tug.
- `__PROXIMA__.loadState(json)` exists only with `?debug=1` or in dev builds, for tests that must start mid-trail.
- Skip-with-penalty for crossings: incident `min(95, T+10)`; rock gap rule enforced by redraw (≤ 12 tries).
- Playwright runs with 4 workers locally (2 in CI); more caused cold-boot timeouts on a 32-core machine.

## 2026-10-25 (M5 sim features, developer, logged by PM)
- Difficulty multipliers live in `src/content/difficulty.ts`; spacer is byte-identical to the pre-difficulty game. Not scaled: sell-back, tug/pilot fees, trade asks, crossing odds.
- Difficulty score line: greenhorn ×0.75, pathfinder ×1.25, shown after the profession multiplier when non-zero.
- Saves (v4) do not store the RNG position; a resumed run is re-seeded from seed + day, so it will not replay the original run exactly. Accepted for v1.0.
- Balance by difficulty (balanced policy): greenhorn 62% win, spacer 42%, pathfinder 20%. Farmer remains the M5 tuning target.

## 2026-10-25 (T-039, M5 balance tuning, developer with designer authority)
Measured with `npm run balance` (balanced policy, 300 seeds × 5 windows per profession); before/after in `docs/reports/balance-tuned.md`. Losses were decided on the last three segments: suits gone, Flare days, crew health run to zero. Starvation sank the Farmer (633 rations for ~1,300 needed) and runs took 176–203 days because ~40 of them were rest days.
- Thrust base 20/25/30 → 22/27/33 Mk/day: real runs averaged 183 days (the M1 sketch ignored ~40 rest days); 22 brings the pooled mean to ~170 and keeps Hard burn at about +25% and Overburn at +50%.
- Suit wear 20% → 25% per Solar storm or Flare day: faster trips made everyone safer; suits running out before the Flare Belt is the game's main late risk, so this dial gives back the difficulty without adding days.
- Engineer starting credits 800 → 650: the Engineer (65% win) beat the Executive (60%); repairs stay its identity, and 1,300 rations after the reference kit means Paste and scans near the end.
- Farmer ration need `floor(need × 0.85)` → `floor(need × 0.65)` (Half for five crew: 8 → 6 a day); perk text "Rations go half again as far": the Farmer won 4%; the fix belongs to its own perk, so 400 cr (the original's homage) stays.
- Scan for salvage (auto-resolve) yields 15–40 / 40–80 → 25–60 / 60–120 rations (EV ≈ 27 → ≈ 42): the Farmer's lifeline was worth less than the day it cost. The mini-game calibration table now compares against ≈ 42.
- Reference policy buys 8 EVA suits for the Farmer (was 5): with five crew and five suits the first ruined suit exposed someone, and radiation was 31% of deaths; 8 brings it under 30% and teaches a habit the Guide can mention.
- Not changed: mass penalty, event chance, condition death chances, difficulty multipliers. Tested and rejected: event chance 15% → 20% (adds ~13 days), higher illness death chances (little effect on wins: runs end on health, not on rolls), Executive credits 1,600 → 1,200 (no effect; the 3,000-ration cap binds), a steeper mass penalty (9 days for 5 points).
- Result (spacer): Executive 63.3%, Engineer 51.1%, Farmer 31.7%, mean 170.5 days, top cause radiation sickness 29.8%. Greenhorn 78.3% (+29.6), Pathfinder 21.2% (−27.5).

## 2026-10-25 (T-069 key hints, developer)
- `CRT_LOGICAL.h` 400 → 416 (the shader reads `uLogical` for the glow offset); `crtRowScale(832)` stays 2.
- CRT fragment output is now `vec4(col * base.a, base.a)` instead of opaque: the KeyHints scene's camera gets the CRT post-pipeline too, and an opaque output would have blacked out the scene beneath it. Scene cameras fill their background (alpha 1), so their output is unchanged; the band is warped and scanlined with the same tube geometry as the view.
- Handlers forward hints: Menu exposes `hintSet` (`menuBack` with `onBack`, else `menu`) and `hints`; Hazard, Station and Waypoint wrappers use `hints: () => menu.hintSet`. Modal's handler picks `modal` / `modalChoice` by button count. Mini-game phases call `router.refreshHints()` on countdown, end and skip; Travel on every auto-travel toggle; Options after any change (Key hints row).
- Extra set `hints.nameEntry` (A-Z Type · Backspace Erase · Enter OK) for NameInputs without Tab (beacon prompt, Death / Top Ten name): the spec's single `name` set promised a Tab that does nothing there. Setup names keep `name`.
- `title` set label is `M|Auto-resolve`: the spec's "Mini-games auto" breaks its own 12-character label limit; "Auto-resolve" matches the Options value word.
- `[?] Help` is also left off for the `help` set (the overlay is already open) and `none`; the mini-game pause "Controls" panel shows `help` (any key closes it); the Options save boxes show `none`.
- `detectPlatform` matches `uaPlatform` case-insensitively: Chrome's `userAgentData.platform` is "macOS", which the literal "contains Mac" rule misses.
- KeyHints also sets `body[data-platform]` (the detected platform) for tests; nothing new on `window`.
- Options rows are 20 px apart (was 22) so 13 x2 rows, the reason line and the hint still fit above the band. `help.lines` gains a line: "Rows 10-13: 0, Shift+1, Shift+2, Shift+3." plus the disabled-row note on its own line (both did not fit the 60-column limit on one).
- Later the same day (PM follow-up): the persistent KeyHints scene is replaced by a per-scene `KeyHintsBand` created in `BaseScene.begin()`, and the shader output is back to opaque `vec4(col, 1.0)`. The overlay scene's camera added a second full-screen CRT pass every frame, which slowed CI's software-WebGL e2e from 13 to 20-27 minutes. One camera means one post pass. The alpha passthrough noted above is gone.

## 2026-10-26 (T-071 touch keys, developer)
- `touchButtons(set, id)` takes the set id as a second argument: the `<` `>` and `-10 -1 +1 +10` buttons depend on the set (`guide`, `number`), not on the key alone. The `guide` set's key is `Arrows` (the spec table names `Left/Right`); both map to `<` `>` in `guide` only, so `options`' `Left/Right Change` stays omitted.
- A label already on the band is not repeated: `table` (Enter Back · Esc Back) shows one `[ Back ]` (Enter).
- Buttons are a framed box with one glyph of padding each side (width = (label + 2) × 8); the spec's `[ Label ]` is read as the frame, not literal brackets.
- `hintBarH()` / `canvasHeight()` in `src/config.ts` replace the T-069 constants: main.ts sets the height from `hintBarHeight(browserPlatform())` before `new Phaser.Game`. `CRT_LOGICAL` keeps h 416 for `crtRowScale`; the shader's `uLogical` reads `canvasHeight()` (424 on touch).
- A band tap dispatches its keydown/keyup on the next task (`setTimeout 0`) so the key cannot repaint or end the scene inside the button's own pointer event.
- The pointer guard (`inHintBand`, `worldY >= 400`) also covers the mini-game pause menu's "Controls" panel: its tap-to-close would otherwise close the panel and leave the band's Close key (Escape) to resume the game.
