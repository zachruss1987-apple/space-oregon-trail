# Asset list (M4)

Flat checklist of every generated asset. Specs: `art.md`, `audio.md`. Tick a box in the same commit that adds the asset.

## Graphics (owner: graphics)
### Systems
- [x] palette.standard (16 + phosphor, phosphorHi, panel)
- [x] palette.cb
- [x] font.proxima (95 glyphs, 6×8)
- [x] crt pipeline (+ Canvas skip)
- [x] atlas builder / sprite parser

### Sprites
- [x] ship.hauler
- [x] ship.flare.cruise
- [x] ship.flare.burn
- [x] ship.flare.over
- [x] ship.mini
- [x] ship.dock
- [x] tug
- [x] skiff
- [x] drone
- [x] grapple.hook
- [x] debris.crate
- [x] debris.pallet
- [x] debris.galley
- [x] debris.plate
- [x] debris.pump
- [x] debris.gyro
- [x] debris.scrap.s
- [x] debris.scrap.m
- [x] debris.scrap.l
- [x] debris.tumbler
- [x] debris.hot
- [x] debris.blip
- [x] rock.16
- [x] rock.24
- [x] rock.32
- [x] rock.48
- [x] rock.shard
- [x] station.independence
- [x] station.mars
- [x] station.ceres
- [x] station.europa
- [x] station.titan
- [x] station.oort
- [x] station.terminus
- [x] landmark.spire
- [x] landmark.eye
- [x] landmark.gate
- [x] landmark.oort
- [x] landmark.proxima
- [x] planet.earth
- [x] planet.luna
- [x] planet.mars
- [x] planet.saturn
- [x] planet.titan
- [x] planet.europa
- [x] star.proxima
- [x] far.station
- [x] far.planet
- [x] far.ring
- [x] far.hazard
- [x] beacon
- [x] overlay.static
- [x] overlay.fog
- [x] overlay.streak
- [x] portrait.1
- [x] portrait.2
- [x] portrait.3
- [x] portrait.4
- [x] portrait.5
- [x] ui.panel
- [x] ui.cursor
- [x] ui.scroll
- [x] ui.toggle
- [x] ui.icon.hp
- [x] ui.icon.charge
- [x] ui.icon.haul
- [x] ui.icon.hit
- [x] ui.icon.pause
- [x] ui.icon.sound
- [x] ui.icon.mute

### Drawn compositions (Graphics, no grid)
- [ ] gfx.grapple-line
- [ ] gfx.flare-arc
- [x] gfx.overlay-glow
- [x] gfx.starfield (3 layers)
- [x] gfx.phase-tint
- [ ] gfx.hazard.lunar-ring
- [ ] gfx.hazard.shoals
- [ ] gfx.hazard.belt
- [ ] gfx.hazard.saturn
- [ ] gfx.hazard.shock
- [ ] gfx.hazard.flare-belt
- [x] gfx.title-hero

## Music (owner: sound)
- [x] title
- [x] travel
- [x] station
- [x] danger
- [x] hazard
- [x] dirge
- [x] fanfare
- [x] mg.salvage
- [x] mg.thread
- [x] mg.flare
- [x] jingle.clean

## SFX (owner: sound)
- [x] ui.move
- [x] ui.select
- [x] ui.back
- [x] ui.deny
- [x] text.tick
- [x] store.buy
- [x] store.sell
- [x] trade.accept
- [x] drive.hum
- [x] alarm
- [x] hull.hit
- [x] grapple.fire
- [x] grapple.attach
- [x] grapple.reel
- [x] grapple.snap
- [x] grapple.empty
- [x] collision
- [x] flare.warn
- [x] flare.hit
- [x] crash
- [x] beacon.chime
- [x] death.toll
- [x] arrival.bell
- [x] countdown.beep
- [x] pause
- [x] event.ding

## Audio systems (owner: sound)
- [ ] synth voices (p12, p25, p50, tri, saw, nzl, nzs)
- [ ] ADSR presets (11)
- [ ] tracker parser + validator
- [ ] AudioManager (unlock, buses, duck, crossfade, persistence)
- [ ] sound test menu (`~`)

## Wiring (owner: developer)
- [ ] Options screen (`ui.md`) + `proxima.settings` store
- [ ] Scene music map (`audio.md` Songs "Where")
- [ ] Replace every `add.text` with bitmap text (`art.md` checklist)
