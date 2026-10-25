# UI

Logical canvas 640×400, integer-scaled to fit. All text in the pixel font (M4; monospace before). Phosphor green on black is the default text theme; panels use the 16-color palette.

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

Menu labels above are canonical (M1.md's "Set thrust/rations" and "Look at map" mean these items). All eight items are in M1; "Scan for salvage" is the auto-resolve in `travel.md` until M3. Disabled items stay visible, dimmed, and explain why when chosen ("No drone charges." / "Nothing is broken.").

| Item | Opens | Result |
|------|-------|--------|
| Change thrust | Menu: Cruise / Hard burn / Overburn, each with "(Mk/day, health cost)" hint | Sets thrust; no day passes |
| Change rations | Menu: Full / Half / Paste with "N days left at this setting" | Sets rations; no day passes |
| Rest | NumberInput 1–9 | Runs that many ticks; log shows each day |
| Attempt repair | Menu of broken parts + spare count | One tick; log shows success/failure |
| Scan for salvage | Confirm "Spend 5 charges and a day?" | One tick; log shows yield |

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

## Controls
- Keyboard: arrows/WASD move selection, Enter/Space confirm, Esc back, number keys select menu items, `?` shows controls. Typing fields accept printable ASCII up to 12 chars.
- Mouse/touch: click or tap any menu item; mini-games have on-screen controls on touch devices.
- Every input path must be reachable by keyboard alone (tested in M5).

## Components (src/ui)
`Menu` (vertical list with cursor), `TextBox` (word-wrapped, optional typewriter), `StatusBar`, `Modal` (event/choice), `NumberInput` (store quantities), `NameInput`, `Table` (supplies/score).

## Accessibility (M5)
Hidden `aria-live="polite"` region mirrors new log lines and the current menu's items/selection. Reduced-motion disables parallax, CRT, typewriter. Colorblind-safe palette toggle.
