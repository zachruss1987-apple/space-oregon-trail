# UI

Logical canvas 640×400, integer-scaled when the window allows ×2 or more, otherwise fit with nearest-neighbour (`art.md` Scaling). All text in the pixel font (M4; monospace before; sizes in `art.md`). Phosphor green on black is the default text theme; panels use the 16-color palette.

## Screen flow
Title → (Travel the Trail) Setup: profession → crew names → launch window → Store → Travel loop { status, action menu, events, waypoint scenes, hazards, station, mini-games } → Death or Arrival → Score → Title.
Side screens from Title: Learn about the Trail (M5 guidebook), Top Ten (M5), Options (M4/M5), Continue journey (M5 save).

## Travel screen layout
```
+--------------------------------------------------------------+
|  [landmark art / starfield band, 640x140]                     |
+--------------------------------------------------------------+
| Date: May 12, 2184        Weather: Fair     Health: Good      |
| Thrust: Cruise            Rations: Full     Credits: 1,012    |
| Next: Mars Relay in 87 Mk            Traveled: 217 Mk         |
+--------------------------------------------------------------+
| > Continue on the Lane        | log line 1                    |
|   Check supplies              | log line 2                    |
|   Look at the map             | log line 3                    |
|   Change thrust               | log line 4                    |
|   Change rations              |                               |
|   Rest                        |                               |
|   Attempt repair              |                               |
|   Scan for salvage            |                               |
+--------------------------------------------------------------+
```
"Continue" advances one day at a time with a short animation; holding Enter (or a "Travel until something happens" toggle) auto-advances until an event, waypoint, or state change, like the original's wagon rolling.

Menu labels above are canonical (M1.md's "Set thrust/rations" and "Look at map" mean these items). All eight items are in M1; "Scan for salvage" is the auto-resolve in `travel.md` until M3; from M3 it launches the Salvage Run (`minigames.md`) unless `autoResolveMiniGames` is on. Disabled items stay visible, dimmed, and explain why when chosen ("No drone charges." / "Nothing is broken.").

| Item | Opens | Result |
|------|-------|--------|
| Change thrust | Menu: Cruise / Hard burn / Overburn, each with "(Mk/day, health cost)" hint | Sets thrust; no day passes |
| Change rations | Menu: Full / Half / Paste with "N days left at this setting" | Sets rations; no day passes |
| Rest | NumberInput 1–9 | Runs that many ticks; log shows each day |
| Attempt repair | Menu of broken parts + spare count | One tick; log shows success/failure |
| Scan for salvage | M3: confirm "Launch the drone? It takes the day." → `Salvage` scene (needs ≥ 1 charge). Auto-resolve on: confirm "Spend 5 charges and a day?" (needs 5) | One tick; log shows the haul |

## Check supplies
Full-screen `Table`, Esc/Enter returns. No day passes. Integers with thousands separators.
```
SUPPLIES                         CREW
Ion drives      3 (1 offline)    Ezra        Good
Rations     1,212 (~134 days)    Temperance  Fair  - space dysentery
EVA suits      8                 Amos        Poor  - cryo-fever, scurvy
Drone charges 85                 Lucinda     away (EVA drift)
Hull plates    1  [HULL BROKEN]  Hollis      died (hull mold fever)
Coolant pumps  1
Nav gyros      0
Credits      370 cr
```
"~N days" = `floor(rations / today's need)` at the current ration setting and present crew. Broken installed parts show a bracketed tag on their row. Crew rows show the health label only (never the number), up to 2 condition names, or `away` / `died (cause)`.

## Look at the map
Full-screen text map, Esc/Enter returns. No day passes.
```
THE LANE                        712 / 2,040 Mk
[##########>.......................]
 #  Waypoint                    Type      Mk    
 0  Independence Station        station      0  passed
 ...
 5  Ceres Depot                 station    640  passed
 6  Jupiter's Eye               landmark   830  next: 118 Mk
 7  The Belt Crossing           hazard     932
```
Progress bar: 34 cells, `#` per 1/34 of distance traveled, `>` at the ship. List shows all 17 waypoints (scroll if needed, current row centered); status column is `passed`, `next: N Mk`, or blank. Type is spelled out (no color-only meaning). Estimated date of arrival is not shown (imperfect information).

## Hazard outcome
On arriving at a hazard (M1): a `Modal` with the hazard description, then one line for the roll result (`trail.md`) naming the loss in numbers, then "Continue". M2: HazardScene with the readout and four options (`hazards.md`); StationScene menu (`economy.md`); beacons on the Waypoint scene (`beacons.md`).

## Mini-games (M3, `minigames.md`)
| Where | Change |
|-------|--------|
| Travel menu | "Scan for salvage" opens the `Salvage` scene; returns to Travel with the haul in the log. |
| Hazard scene (5 hazards) | "1 Thread it" opens the `Threading` scene; its result panel offers the clean bonus pick (+2 health all / +10 rations); then the outcome modal as M2. Shields / tug / pilot unchanged. |
| Hazard scene (The Flare Belt) | Options: `1 Ride the solar wind   Risk: Severe` → `Flare` scene; `2 Pay the tug (120 cr)`; then Rest and travel menu as before. |
| Pause (Esc in a mini-game) | Modal: Resume / Skip (auto-resolve, with penalty) / Controls. |
| Options | "Mini-games: Play / Auto-resolve" (`autoResolveMiniGames`); auto-resolve skips the scenes with no penalty. |
| Touch | Drag to steer, tap to fire (Salvage), pause icon top-right; no on-screen buttons needed. |

## Controls
- Keyboard: arrows/WASD move selection, Enter/Space confirm, Esc back, number keys select menu items (1-9; `0` picks row 10, Shift+1 / Shift+2 / Shift+3 rows 11 / 12 / 13, so Options rows 10-13 are reachable), disabled rows are dimmed and start with `x ` (also in the screen-reader listbox), `?` shows controls. The key hints bar under the view always names the keys that work right now (`keyhints.md`). Typing fields accept printable ASCII up to 12 chars.
- Mouse/touch: click or tap any menu item; mini-games have on-screen controls on touch devices.
- Every input path must be reachable by keyboard alone (tested in M5).

## Components (src/ui)
`Menu` (vertical list with cursor), `TextBox` (word-wrapped, optional typewriter), `StatusBar`, `Modal` (event/choice), `NumberInput` (store quantities), `NameInput`, `Table` (supplies/score).

## Accessibility (M5)
Hidden `aria-live="polite"` region mirrors new log lines and the current menu's items/selection. Reduced-motion disables parallax, CRT, typewriter. Colorblind-safe palette toggle.

## Options screen (M4)
From Title "4. Options". Up/Down choose a row, Left/Right (or Enter, or tap) change its value, Esc or "Back" saves and returns. Changes apply immediately and persist in localStorage `proxima.settings` (JSON, `v: 1`; garbage or missing keys fall back to defaults). Value words are spelled out; the toggle sprite is decoration, never the only cue.

| # | Row | Values | Default | Key | Effect |
|---|-----|--------|---------|-----|--------|
| 1 | CRT effect | On / Off (`n/a` on Canvas) | On desktop WebGL; Off on touch devices or with reduced motion | `crt` | Toggles the shader at runtime (`art.md`) |
| 2 | Music volume | 0–10 | 6 | `music` | Music bus gain step/10 (`audio.md`) |
| 3 | Sound effects | 0–10 | 8 | `sfx` | SFX bus gain step/10; a `ui.select` plays at the new level |
| 4 | Text speed | Slow / Normal / Fast / Instant | Normal | `textSpeed` | 24 / 12 / 6 ms per char; Instant turns the typewriter off |
| 5 | Touch controls | Auto / On / Off | Auto | `touch` | Auto = on when `pointer: coarse`; shows the pause icon and drag steering hints |
| 6 | Key hints | On / Off | On | `keyHints` | The hints band under the view (`keyhints.md`): key names on desktop, tappable keys on touch; Off leaves the band empty (a stored `auto` reads as On) |
| 7 | Mini-games | Play / Auto-resolve | Play | `autoResolveMiniGames` | As in the Mini-games section |
| 8 | Reduced motion | Auto / On / Off | Auto | `reducedMotion` | Auto follows `prefers-reduced-motion`. On: no parallax, no bob, no typewriter, no cursor blink, overlays frozen, CRT forced off |
| 9 | Colorblind palette | Off / On | Off | `palette` (`standard` / `cb`) | Swaps to the colorblind-safe table (`art.md`) |
| 10 | Difficulty | Greenhorn / Spacer / Pathfinder | Spacer | `difficulty` | Applies to new runs |
| 11 | Export save | — | — | — | Shows the autosave as a string (disabled with no journey) |
| 12 | Import save | — | — | — | Paste a save string to continue it |
| 13 | Back | — | — | — | Returns to Title |

Master volume and mute are not rows: `M` mutes anywhere (key `muted`), master stays at 0.8 (key `master`, sound test only). Layout: title ×2 "OPTIONS", rows ×2 as `CRT effect ........ On`, a one-line ×1 hint for the selected row at the bottom.
