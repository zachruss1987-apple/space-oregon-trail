# Art (M4)

Everything is drawn in code: sprite string grids in `src/gfx/sprites/*.ts`, rasterized once at boot into one texture atlas; scenes compose them with Phaser Graphics. No binary assets, no web fonts. Target: a 1985 Apple II / early-EGA disk, drawn cleanly. 1-px outlines in black, no anti-aliasing, dithering only as 50% checkerboards. Animations are 2–4 frames.

## Palette (`src/gfx/palette.ts`)
One char per index in sprite grids (`0`–`9`, `A`–`F`); `.` is transparent.

| Key | Char | Hex | Intended use |
|-----|------|-----|--------------|
| black | 0 | #000000 | Space, outlines, letterbox |
| navy | 1 | #1c2860 | Deep-space wash, hull shadow, portrait backdrop |
| blue | 2 | #3a6ee0 | Ion drive core, ice, Earth oceans, cold light |
| cyan | 3 | #7ad8f0 | Shields, glass, Kuiper Gate shimmer, ion fog |
| plum | 4 | #6d2b79 | Nebula, Jupiter banding shadow, mid-Lane tint |
| brown | 5 | #8a4a24 | Rock, rust, Ceres, dark skin tone, hair |
| red | 6 | #d83a2a | Alarm, damage, Mars, Proxima star, warning text |
| orange | 7 | #f08a24 | Drive flare, flare arcs, Titan haze |
| amber | 8 | #ffd75c | Highlights, title logo, beacons, buoy lights, warn text |
| peach | 9 | #f0b890 | Light skin tone, Jupiter bands, sand |
| lime | A | #a8e040 | Hot chunks, sick tint, radiation |
| forest | B | #2e8a2e | Dim text, panel borders, disabled items |
| grey | C | #6e7080 | Hull mid-tone, scrap, rocks, dead portraits |
| silver | D | #b8bcc8 | Hull light, grapple cable, mid stars |
| white | E | #ffffff | Star cores, specular glints, flare core |
| magenta | F | #c04fa0 | Nebula accents, title sky, Belter skiff trim |

Text theme (outside the 16; text and UI chrome only, never in world sprites):

| Key | Char | Hex | Use |
|-----|------|-----|-----|
| phosphor | P | #5cff5c | Default text, focused panel border |
| phosphorHi | H | #c8ffc8 | Selected menu item, headings |
| panel | — | #001a00 | Panel fill (Graphics only) |
| phosphorDim | — | #38a838 | Hints, disabled rows (T-041: forest is 4.2:1 on the panel fill; every text color is ≥ 4.5:1 on black and panel in both palettes, `tests/unit/ui/contrast.test.ts`) |

### Colorblind-safe variant (same keys)
Swaps red/green/orange/lime pairs toward Okabe–Ito hues. Meaning is never color-only anyway: damage adds smoke pixels, sick adds a sweat drop, hot chunks pulse a ring, telegraphed arcs are dashed.

| Key | Hex | Key | Hex |
|-----|-----|-----|-----|
| black | #000000 | amber | #f0e442 |
| navy | #1c2860 | peach | #f0b890 |
| blue | #0072b2 | lime | #cc79a7 |
| cyan | #56b4e9 | forest | #009e73 |
| plum | #5a3a8a | grey | #6e7080 |
| brown | #8c5a3c | silver | #b8bcc8 |
| red | #d55e00 | white | #ffffff |
| orange | #e69f00 | magenta | #f5b0d8 |
| phosphor | #5cff5c | phosphorHi | #c8ffc8 |

Switching palettes re-rasterizes the atlas (≤ 100 ms at boot cost) and re-tints Graphics; no restart.

## Sprite grid format
```ts
export const drone: SpriteDef = {
  name: 'drone', w: 12, h: 12, frames: 2, anchor: [6, 6], fps: 4,
  grid: [[ /* frame 0: h strings of w chars */ ], [ /* frame 1 */ ]],
};
```
| Field | Rule |
|-------|------|
| `name` | Dotted id, unique, lowercase: `ship.hauler`, `debris.crate`, `portrait.3` |
| `w`, `h` | Pixels per frame. `grid[f].length === h`, every row `.length === w` (or `ceil(w/2)` with `mirrorX`) |
| `frames` | `grid.length === frames`, 1–6 (hauler is the only 6) |
| `anchor` | `[x, y]` in frame pixels; integer; used as the origin |
| `fps` | 0 = static / frame chosen by code; else loop rate |
| `loop` | default true; false = play once, hold last frame |
| `mirrorX` | optional: rows hold the left half; the rasterizer mirrors (odd `w` shares the centre column) |
| `ui` | optional: allows chars `P`/`H`; world sprites may not use them |
| Chars | Only `.` `0–9` `A–F` (+ `P H` with `ui`). Anything else is a test failure naming sprite, frame, row, col |

Recolors (`recolor: { '9': '5' }`) produce variants at boot without new grids (skin tones, damage tint).

## Sprite list
Sizes are frame size; F = frames. Owner: graphics.

### Ships and craft
| Id | Size | F | fps | Notes |
|----|------|---|-----|-------|
| ship.hauler | 64×32 | 6 | 8 | Frames = state × 2 + flareFrame. States: 0 intact (nothing broken, no offline drive), 1 damaged (one broken part or ≥ 1 offline drive: missing plating, a dark nozzle), 2 critical (hull broken or ≥ 2 problems: holes, smoke pixels, sparking). Three nozzles on the left, boxy cargo spine, cab on the right. Halted: frame 0 of its state, no flare. |
| ship.flare.cruise | 12×8 | 2 | 8 | Ion plume behind each working nozzle: white core, blue body, cyan tip |
| ship.flare.burn | 20×10 | 2 | 10 | Hard burn: longer, orange fringe |
| ship.flare.over | 28×12 | 2 | 12 | Overburn: orange/amber body, flickering white core |
| ship.mini | 24×12 | 2 | 8 | The hauler in miniature for Threading and Flare (hitboxes 20×10 / r 7) |
| ship.dock | 40×120 | 1 | 0 | Salvage: hauler's open bay at the left edge, side cutaway |
| tug | 48×24 | 2 | 2 | Blunt yellow-and-grey pusher with a tow clamp; amber beacon blinks |
| skiff | 32×16 | 2 | 4 | Belter pilot skiff: lopsided ore-scow, magenta trim, patched cockpit |
| drone | 12×12 | 2 | 4 | Round body, grapple barrel, red/amber light swaps; blinks (alpha) when invulnerable |
| grapple.hook | 6×6 | 2 | 0 | 0 open (flying), 1 closed (attached) |

**Grapple line rule** (Graphics): 1-px line from drone to hook. Flying: silver, every 4th pixel black (dashed). Attached and reeling: solid silver, with one amber pixel travelling toward the drone at reel speed. Snap: line splits at the midpoint, both halves fade over 150 ms.

### Debris and rocks (`minigames.md`)
| Id | Size | F | fps | Look |
|----|------|---|-----|------|
| debris.crate | 12×12 | 1 | 0 | Small brown box, amber stencil dot |
| debris.pallet | 20×20 | 1 | 0 | Three stacked crates, strapping in silver |
| debris.galley | 28×28 | 2 | 2 | Round module with a lit porthole (amber blink) |
| debris.plate | 20×20 | 1 | 0 | Flat grey slab seen at an angle, rivet row |
| debris.pump | 14×14 | 1 | 0 | Silver cylinder with blue coolant band |
| debris.gyro | 12×12 | 2 | 6 | Sphere inside a tilted ring; ring swaps sides |
| debris.scrap.s / .m / .l | 10 / 16 / 24 sq | 1 | 0 | Jagged grey bits; size picked by rolled radius |
| debris.tumbler | 24×24 | 4 | 8 | Spinning dark chunk, 90° per frame, red edge glints |
| debris.hot | 16×16 | 2 | 4 | Lime-glowing chunk; frame 1 adds a pulse ring (shape cue) |
| debris.blip | 4×4 | 1 | 0 | Grey blip for items beyond 150 px in ion fog |
| rock.16 / .24 / .32 / .48 | n×n | 1 | 0 | Threading rocks: brown/grey, lit from the right; pick largest ≤ 2r |
| rock.shard | 6×6 | 3 | 12 | Shatter puff, `loop: false` |

**Flare arcs** (Graphics, not sprites): quadratic Bezier, 24 px band. Telegraph: 1-px orange outline both edges, dashed 3-on/3-off, 50% alpha. Active: orange fill, amber inner 12 px, white 2-px centre line; 4-frame shimmer by shifting a 2×2 checker of amber over orange. Fade: 3 steps over 200 ms.

### Stations (96×64, 2 frames at 2 fps: running lights)
| Id | Silhouette |
|----|-----------|
| station.independence | Classic spoked wheel around a long spindle, Earth's blue limb below |
| station.mars | Squat dust-red dome on a lattice mast topped by a big dish |
| station.ceres | A hollowed brown rock with a gantry and docking arm jutting out |
| station.europa | Ice-crusted cylinder half sunk in a white plain, a steam plume rising |
| station.titan | Tall refinery towers and a flare stack in orange haze, pipes everywhere |
| station.oort | A single slim needle with a giant lamp at the top, tiny hab at the base |
| station.terminus | Long spine of stacked cargo boxes with docking arms; red Proxima behind |

### Landmarks, planets, waypoints
| Id | Size | F | Notes |
|----|------|---|-------|
| landmark.spire | 48×96 | 1 | Ceres Approach Spire: surveyor's needle on a rock, amber tip light |
| landmark.eye | 96×96 | 2 | Jupiter's Eye: banded peach/brown/plum disc, the red storm "eye" (lid blink every ~6 s) |
| landmark.gate | 96×96 | 4 | Kuiper Gate: segmented ring, cyan shimmer cycling inside |
| landmark.oort | 32×64 | 2 | Oort Beacon seen from afar: needle and a lamp that flashes |
| landmark.proxima | 96×96 | 1 | Proxima b: rust-and-blue world, thin cloud arc, red star glint |
| planet.earth | 64×64 | 1 | Blue/white limb (Independence, Lunar Debris Ring) |
| planet.luna | 24×24 | 1 | Grey cratered disc |
| planet.mars | 48×48 | 1 | Red with brown maria and a white cap |
| planet.saturn | 96×48 | 1 | Rings nearly edge-on (Saturn Ring Plane, Titan) |
| planet.titan | 32×32 | 1 | Orange haze ball |
| planet.europa | 32×32 | 1 | White with brown cracks |
| star.proxima | 32×32 | 2 | Red dwarf with a flickering corona |
| far.station / far.planet / far.ring / far.hazard | 16×16 | 1 | Distant icons used at mid range (approach rule) |
| beacon | 16×24 | 2 | Memorial beacon: small obelisk with an amber lamp (blinks 1 fps) |

Hazards reuse parts (no unique large sprite):

| Hazard | Composition in the band |
|--------|-------------------------|
| Lunar Debris Ring | planet.luna + a diagonal stream of rock.16 / scrap |
| Lagrange Shoals | Two dithered gravel bands (brown/grey checker) drifting opposite ways |
| The Belt Crossing | rock.24 / .32 / .48 field, three depth rows |
| Saturn Ring Plane | planet.saturn at left, ring line across the whole band, rock.16 glints |
| Proxima Heliopause Shock | Vertical cyan/plum dither wall that ripples (2-frame row offset) |
| The Flare Belt | star.proxima at right, two idle flare arcs, overlay.glow |

### Weather overlays (tiling 64×64 unless noted)
| Id | F | fps | Use |
|----|---|-----|-----|
| overlay.static | 4 | 12 | Solar storm: sparse white/silver noise pixels at 25% alpha |
| overlay.fog | 2 | 2 | Ion fog: cyan/grey 25% checker, scrolls 6 px/s left |
| overlay.glow | 1 | 0 | Flare: 640×140 Graphics gradient, 3 dithered orange bands from the right edge |
| overlay.streak | 1 | 0 | Unsettled: 8×1 silver streak, 1 per 2 s crossing the band |

Reduced motion: static and fog freeze on frame 0; streaks are hidden.

### Crew portraits (32×32, F 3: healthy / sick / dead; by crew slot, not name)
| Id | Distinguishing features |
|----|-------------------------|
| portrait.1 | Captain: navy peaked cap with amber badge, short dark beard, peach skin, level gaze |
| portrait.2 | Tall brown hair bun, round silver spectacles, high collar, peach skin |
| portrait.3 | Shaved head, brown skin, big ears, thick white mustache |
| portrait.4 | Long red hair under a cyan headscarf, brown freckles, peach skin |
| portrait.5 | Older, brown skin, grey mutton-chops, flight goggles pushed up on the forehead |

Sick: lime cheek pixels, droopy lids, cyan sweat drop, frown. Dead: eyes closed, drawn only in 0/C/D/E. Backdrop navy; the 1-px frame is UI chrome. Recolors may offer more skin tones later.

### UI chrome (`ui: true`)
| Id | Size | F | Notes |
|----|------|---|-------|
| ui.panel | 24×24 | 2 | 9-slice (8-px corners): double rule in forest; frame 1 phosphor (focused) |
| ui.cursor | 8×8 | 2 | Small ship pointing right, amber; 2 Hz blink (off in reduced motion) |
| ui.scroll | 4×24 | 1 | Track (forest checker), thumb (phosphor, min 8 px), 4×4 arrows |
| ui.toggle | 16×8 | 2 | Options switch off/on |
| ui.icon.hp / charge / haul / hit / pause / sound / mute | 8×8 (pause 24×24) | 1 | Mini-game HUD, touch pause, mute indicator |

### Title hero (640×140 band, y 20–159)
Left third: ship.hauler at ×2 (128×64) heading right with ship.flare.cruise ×2. Centre: the Lane as a dotted line of amber buoy pixels converging toward the right, with 3 blinking buoys. Right: landmark.proxima half-risen behind star.proxima. Sky: black with magenta/plum dithered nebula smear upper right and the 3 star layers scrolling slowly. Logo below the band in the font at ×4, amber with a brown 1-px drop shadow; the death-joke subtitle in phosphor ×2.

## Travel scene band (640×140)
| Element | Rule |
|---------|------|
| Star layers | far: 90 × 1-px grey/navy at 4 px/s; mid: 40 × 1-px silver at 12 px/s; near: 12 × 2×2 white/cyan at 36 px/s. Positions from `uiRng`, wrap at x < 0 |
| Scroll | Only while a day is animating. Speed × thrust (Cruise 1, Hard burn 1.5, Overburn 2). Reduced motion: static |
| Ship | Anchor at (160, 80); flare(s) attach at the nozzle points; 1-px bob every 0.5 s while moving (off in reduced motion) |
| Phase tint | Background wash by segment: early (1–5) black; mid (6–11) 3-px plum dither top/bottom edges; post-gate (12–16) red 2-band dither from the right |
| Weather | Calm/Fair: none. Unsettled: streaks. Solar storm: overlay.static + amber 1-px band border flash every 2 s. Ion fog: overlay.fog, far layer hidden, mid at 50%. Flare: overlay.glow + static at 10% |

**Landmark approach** (next waypoint, by Mk remaining):

| Mk remaining | Shown | x position (anchor) |
|--------------|-------|---------------------|
| > 120 | nothing | — |
| 120–61 | 1-px amber blip (station/landmark) or red (hazard), blinking 1 fps | 600 |
| 60–21 | `far.*` icon for the waypoint type | 600 → 520 linearly |
| 20–0 | full sprite or hazard composition | 520 → 440 linearly |

Sizes never scale (integer only); the tier change is the "growth".

## Pixel font
6×8 cell, glyph ink in columns 0–4 (column 5 is spacing). Printable ASCII 32–126 (95 glyphs) in `src/gfx/font.ts` as string grids, built into a Phaser BitmapText font `proxima` at boot.

| Rule | Value |
|------|-------|
| Caps and digits | rows 0–6 (7 tall), baseline row 6 |
| Lowercase x-height | rows 2–6 |
| Descenders (use row 7) | `g j p q y` and `, ;` and `_` |
| Line height | 10 px at ×1, 18 px at ×2 |
| Sizes | small ×1 (106 cols): tables, log, hints, HUD. body ×2 (53 cols): menus, prose, status bar, headings. title ×4: logo only |
| Extra glyphs | none; `#` and `>` double as bar fill and cursor in text |

## CRT shader (`src/gfx/crt.ts`, WebGL post-pipeline)
| Param | Default | Range | Notes |
|-------|---------|-------|-------|
| scanlines | 0.18 | 0–0.5 | Darkens the lower part of each logical pixel row |
| curvature | 0.04 | 0–0.12 | Barrel distortion k; outside the tube is black |
| vignette | 0.30 | 0–0.6 | Corner darkening |
| glowRadius | 1.0 px (logical) | 0–2 | 5-tap blur added back |
| glowStrength | 0.30 | 0–0.6 | |
| flicker | 0 (off) | 0–0.03 | Debug only; forced 0 in reduced motion |

Default On for desktop WebGL; Off when `pointer: coarse`, on Canvas, or with reduced motion. Canvas fallback: no pipeline at all, the Options row reads "CRT  n/a". Toggle applies at runtime without a scene restart.

## Scaling
Phaser `pixelArt: true`, `roundPixels: true`. Scale s computed in device pixels: `s = floor(min(W/640, H/400))`; if s ≥ 2 use it, else fit fractionally with nearest-neighbour (`image-rendering: pixelated`). Letterbox black, centred. Sprite scale is always an integer (title ship ×2, logo ×4); all positions are integers.

## "No default Phaser text remains" checklist
Global: no `this.add.text(` in `src/` (a unit grep test enforces it), no font-family strings, every color read from `palette.ts` by key, every panel drawn with `ui.panel`.

| Scene | Must use |
|-------|----------|
| Boot | Font + atlas built before the first scene; loading line in the bitmap font |
| Title | Hero band, ×4 logo, ×2 menu with ui.cursor, seed line ×1 |
| Setup / Store / Supplies / Map | Bitmap text at body/small sizes, ui.panel, ui.scroll on long lists |
| Travel | Band (stars, ship, flare, approach, weather), status bar ×2, log ×1 |
| Waypoint | Full-size waypoint art in the band, description ×2, beacon sprites for beacons |
| Station | station.* exterior panel, keeper line, menu |
| Hazard | Hazard composition band, density bar in text, menu |
| Salvage / Threading / Flare | Sprites above, HUD icons ×1 text, countdown ×4, result panel |
| Death / BeaconPrompt | portrait (dead frame), beacon, epitaph input in the font |
| Arrival / Score | landmark.proxima, portraits (healthy/sick/dead), score table |
| Options | Rows in `ui.md` with ui.toggle |

## PM amendment (2026-10-24, supersedes the font section above where they conflict)
- Body text uses an **8×8 glyph font at ×1** in the 640×400 logical canvas: 80 columns × 50 rows, the Apple IIe 80-column look, matching the current ~76-column layouts so no scene needs relaying out. The 6×8 font remains for dense HUD/mini-game overlays only. Descenders fit inside the 8×8 cell (g j p q y use rows 6–7).
- Scaling: integer ×2/×3 when the window allows; below that Phaser FIT with nearest-neighbour is acceptable.
- Seven station exteriors and the dead portrait frame are in scope (M4.md updated).
