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

## Controls
- Keyboard: arrows/WASD move selection, Enter/Space confirm, Esc back, number keys select menu items, `?` shows controls. Typing fields accept printable ASCII up to 12 chars.
- Mouse/touch: click or tap any menu item; mini-games have on-screen controls on touch devices.
- Every input path must be reachable by keyboard alone (tested in M5).

## Components (src/ui)
`Menu` (vertical list with cursor), `TextBox` (word-wrapped, optional typewriter), `StatusBar`, `Modal` (event/choice), `NumberInput` (store quantities), `NameInput`, `Table` (supplies/score).

## Accessibility (M5)
Hidden `aria-live="polite"` region mirrors new log lines and the current menu's items/selection. Reduced-motion disables parallax, CRT, typewriter. Colorblind-safe palette toggle.
