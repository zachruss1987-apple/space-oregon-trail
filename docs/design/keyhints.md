# Key hints bar (post-1.0, T-069)

A one-line strip under the game view that always shows the keys that work *right now*, named the way the player's
platform names them. It never covers anything: it lives in its own 16 px band below the 640×400 view.

## Placement
- The logical canvas grows from 640×400 to 640×**416** (`CANVAS_HEIGHT = GAME_HEIGHT + HINT_BAR_H`, `HINT_BAR_H = 16`
  in `src/config.ts`). `GAME_WIDTH`/`GAME_HEIGHT` stay 640×400 and every scene keeps drawing in 0..640 × 0..400.
- `fitCamera` centres the main camera on the full 640×416 world (`centerOn(320, 208)` at `RENDER_SCALE`), so the band
  rows 400..415 are visible below each scene and nothing a scene draws (modal blockers, mini-game backgrounds) reaches them.
- A per-scene band component (`src/ui/KeyHintsBand.ts`) draws the band inside each scene's own camera:
  `BaseScene.begin()` creates it right after `fitCamera`; it subscribes to the `keyHints.ts` store and unsubscribes on
  the scene's `shutdown`. It draws at y 400..415, depth 500 (above modal blockers 100 and the `?` overlay 200): fill
  `COLORS.bg`, a 1 px `COLORS.borderDim` rule on row 400, text baseline row 404 (8 px glyphs, `retro8` x1). Boot,
  GfxPreview and SoundTest have no band.
- Why per scene, not a persistent overlay scene: the CRT is a full-screen post pass per camera, so an overlay scene
  doubled the shader cost every frame (CI's software WebGL went from 13 to 20+ minutes for e2e). With the band in the
  scene's camera there is one post pass per frame and the band sits in the same tube. `CRT_LOGICAL.h` is 416 (the
  shader's glow reads `uLogical`); `crtRowScale` stays 2 at 1280×832.
- Scaling text in `art.md` ("Scaling") now computes `s` from 416 rows; the 16:10 note becomes 40:26.

## Content and layout
A hint set is an ordered list of `{ key, label }` pairs. Rendered as `[Key] Label` groups separated by two spaces,
left-aligned from x = 8: the bracketed key in `COLORS.bright`, the label in `COLORS.dim`. The right end always shows
`[?] Help` (and nothing else) unless a typing field has focus. If a set does not fit in 624 px, drop pairs from the end
of the set (never the `[?] Help` group) until it does. Everything uses the bitmap font: no DOM, no CSS fonts.

Key names are written canonically in `ui.json` and translated per platform by `keyLabel(name, platform)`:

| Canonical | windows / linux | mac |
|-----------|-----------------|-----|
| `Enter` | Enter | Return |
| `Backspace` | Backspace | Delete |
| `Esc`, `Space`, `Tab`, `Shift+1`, `Arrows`, `A-Z`, digits, `?` | unchanged | unchanged |

`[Arrows]` means the arrow keys; WASD is deliberately not listed (the `?` overlay has it).

## Platform detection (`detectPlatform`, pure)
Input: `{ userAgent, uaPlatform (navigator.userAgentData?.platform or ''), coarsePointer }`. Output: `'touch' | 'mac' | 'windows' | 'linux'`.
1. `coarsePointer` or `/Android|iPhone|iPad|iPod|Mobile/i` in the UA → `touch`.
2. `uaPlatform` or UA contains `Mac` (incl. `Macintosh`) → `mac`.
3. `Windows` → `windows`; otherwise `linux`.
A `?platform=mac|windows|linux|touch` query parameter overrides detection (debug and tests only).

## Visibility
Options row **Key hints**: `On / Off` (`keyHints`, default `on`, persisted like the others; a stored legacy `auto` reads as `on`).
- `on`: desktop platforms show key names; the `touch` platform shows tappable on-screen keys (next section).
- `off`: band stays, empty except the rule. The band is always present so the layout never jumps.

The row goes right after **Touch controls** (row 6); every later row shifts down one. Options therefore has 13 rows, so
`numberRow` gains Shift+3 → row 13 (`Digit3`), and the `?` overlay line becomes "Rows 10-13: 0, Shift+1, Shift+2, Shift+3."
Update `ui.md` ("Controls" and the Options table) and `help.lines` accordingly.

## Touch platform: on-screen keys (T-071)
A phone has no keyboard, so on the `touch` platform the band is a row of **tappable keys** built from the same hint set.
`body[data-hintmode]` is `keys` (desktop names) or `touch` (buttons); `data-hints` still carries the set id in both modes.
- Band height: `HINT_BAR_H` is 16 on desktop and **24 on touch** (`hintBarHeight(platform)`, decided once at boot before
  `new Phaser.Game`; `CANVAS_HEIGHT` and `CRT_LOGICAL.h` follow it). Buttons are 20 px tall, text centred, so a tap target
  is ≥ 40 device px at ×2. Visual baselines are desktop-only and unchanged.
- Each button is `[ Label ]` on a `COLORS.panel` fill with a `COLORS.borderDim` 1 px frame, label in `COLORS.bright`,
  8 px gaps, left-aligned from x = 8; `[ Help ]` sits at the right as before. Overflow drops from the end as on desktop.
- A tap dispatches the key to the game exactly as a keyboard would: `window.dispatchEvent(new KeyboardEvent('keydown', { key, code, bubbles: true }))`
  followed by the matching `keyup`, so every `KeyRouter` handler works untouched. Nothing new is added to `window`.
- Mapping from the set (`touchButtons(set)` in `keyHints.ts`, pure). Pairs not listed are omitted on touch:

| Canonical key | Button label | Dispatches |
|---------------|--------------|------------|
| `Enter` | the pair's label (OK, Choose, Start, Continue, Next, Change) | `Enter` |
| `Esc` | the pair's label (Back, Cancel, Pause) | `Escape` |
| `T` | Travel on | `t` |
| `M` | the pair's label (Mute, Auto-resolve) | `m` |
| `Tab` | Random | `Tab` |
| `Any key` | the pair's label (Stop, Close) | `Escape` |
| `?` | Help | `?` |
| `Left/Right` (guide) | two buttons `<` and `>` | `ArrowLeft` / `ArrowRight` |
| `Arrows` in `number` | four buttons `-10` `-1` `+1` `+10` | `ArrowLeft` `ArrowDown` `ArrowUp` `ArrowRight` |
| `Arrows`, `Up/Down`, `Space`, digits, `A-Z`, `Backspace`, `Shift+…` | omitted (rows are tappable; mini-games have their own touch controls; no soft keyboard exists) | — |

- The `name` set on touch therefore shows `[ Random ] [ OK ]`: a crew name that is left empty commits the placeholder, as today.
- Taps in the band must not reach the scene: the mini-game `TouchLayer`, `GuideScene` page tap, `TopTenScene` and
  `HelpOverlay` ignore pointers with `worldY >= GAME_HEIGHT`. The band's buttons are the only interactive objects below y 400.
- `index.html`: `#game` uses `height: 100dvh` (with the `100vh` fallback first) so iOS Safari's toolbar never hides the band,
  and the canvas gets `touch-action: manipulation` so a tap is not delayed or zoomed.
- `?platform=touch` still forces the platform for tests; the tester runs the touch suite in Playwright WebKit with an
  iPhone device profile (`hasTouch`), where `pointer: coarse` is real.

## Which hints show (the context)
The `KeyRouter` decides: the top `KeyHandler` may expose `hints?: string | (() => string | null)` naming a set in
`ui.json` under `hints.*`. The router publishes the current set id whenever its stack changes, help opens/closes, a
scene starts, or a handler calls `router.refreshHints()` (Travel toggling auto-travel, a mini-game changing phase).
No handler → set `none` (bar empty). `document.body.dataset.hints` mirrors the shown set id (`menu`, `travel`, …) for
tests, and is absent while hidden by the option or platform.

| Set id | Shown by | Pairs (in order) |
|--------|----------|------------------|
| `menu` | `Menu` without `onBack` | Arrows Move · Enter Choose · 1-9 Pick |
| `menuBack` | `Menu` with `onBack` | Arrows Move · Enter Choose · 1-9 Pick · Esc Back |
| `modal` | `Modal` with one button | Enter OK |
| `modalChoice` | `Modal` with 2+ buttons | Arrows Move · Enter Choose · Esc Cancel |
| `number` | `NumberInput` | 0-9 Type · Arrows Adjust · Enter OK · Esc Cancel |
| `name` | `NameInput` | A-Z Type · Backspace Erase · Tab Random · Enter OK |
| `title` | Title scene handler | Arrows Move · Enter Choose · 1-9 Pick · M Mini-games auto |
| `travel` | Travel handler, not auto-travelling | Arrows Move · Enter Choose · T Travel on · M Mute |
| `travelAuto` | Travel handler while auto-travelling | Any key Stop |
| `table` | Supplies, Map, Top Ten (view-only screens) | Enter Back · Esc Back |
| `guide` | Guide | Arrows Page · Enter Next · Esc Back |
| `options` | Options handler | Arrows Move · Arrows Change · Enter Change · Esc Back |
| `minigameIntro` | mini-game `intro` phase | Enter Start · Esc Pause |
| `minigamePlay` | mini-game `countdown`/`play`, no `actionKey` | Arrows Steer · Esc Pause |
| `minigameFire` | mini-game `countdown`/`play` with `actionKey` | Arrows Steer · Space Fire · Esc Pause |
| `minigameDone` | mini-game `done` phase | Enter Continue |
| `help` | `?` overlay open | Any key Close |
| `none` | nothing on the stack / a DOM save box has focus | (empty) |

Label text for `Arrows Change` in `options` is `Left/Right Change` and the first pair is dropped (`Arrows Move` is implied):
`options` = Up/Down Move · Left/Right Change · Enter Change · Esc Back. Labels are capitalised words, no full stops.
Scene-level handlers that only forward to a Menu (Store, Station, Hazard, Waypoint, Setup profession menu) need no
`hints` of their own: the Menu beneath them is not the top of the stack, so they must forward `hints` from that menu
(`hints: () => menu.hintSet`) or the router falls back to `none`. Rule: **every scene must show a non-empty set at
every stopping point** (a tester walks every scene and asserts `data-hints`).

## ui.json
`hints.<id>` is an array of `"Key|Label"` strings, e.g. `"hints.menuBack": ["Arrows|Move", "Enter|Choose", "1-9|Pick", "Esc|Back"]`;
`hints.help` is `["Any key|Close"]`, `hints.none` is `[]`. `hints.helpKey` is `"?|Help"`. Content test: every set id in
the table exists, every entry has exactly one `|`, labels ≤ 12 chars, keys from the canonical list.

## Out of scope (follow-ups)
Gamepad labels; a soft keyboard for typing names on touch (placeholders and Random cover it).
