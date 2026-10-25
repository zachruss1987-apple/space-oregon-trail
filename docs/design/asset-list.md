# Asset list (M4)

Flat checklist of every generated asset. Specs: `art.md`, `audio.md`. Tick a box in the same commit that adds the asset.

## Graphics (owner: graphics)
### Systems
- [ ] palette.standard (16 + phosphor, phosphorHi, panel)
- [ ] palette.cb
- [ ] font.proxima (95 glyphs, 6×8)
- [ ] crt pipeline (+ Canvas skip)
- [ ] atlas builder / sprite parser

### Sprites
- [ ] ship.hauler
- [ ] ship.flare.cruise
- [ ] ship.flare.burn
- [ ] ship.flare.over
- [ ] ship.mini
- [ ] ship.dock
- [ ] tug
- [ ] skiff
- [ ] drone
- [ ] grapple.hook
- [ ] debris.crate
- [ ] debris.pallet
- [ ] debris.galley
- [ ] debris.plate
- [ ] debris.pump
- [ ] debris.gyro
- [ ] debris.scrap.s
- [ ] debris.scrap.m
- [ ] debris.scrap.l
- [ ] debris.tumbler
- [ ] debris.hot
- [ ] debris.blip
- [ ] rock.16
- [ ] rock.24
- [ ] rock.32
- [ ] rock.48
- [ ] rock.shard
- [ ] station.independence
- [ ] station.mars
- [ ] station.ceres
- [ ] station.europa
- [ ] station.titan
- [ ] station.oort
- [ ] station.terminus
- [ ] landmark.spire
- [ ] landmark.eye
- [ ] landmark.gate
- [ ] landmark.oort
- [ ] landmark.proxima
- [ ] planet.earth
- [ ] planet.luna
- [ ] planet.mars
- [ ] planet.saturn
- [ ] planet.titan
- [ ] planet.europa
- [ ] star.proxima
- [ ] far.station
- [ ] far.planet
- [ ] far.ring
- [ ] far.hazard
- [ ] beacon
- [ ] overlay.static
- [ ] overlay.fog
- [ ] overlay.streak
- [ ] portrait.1
- [ ] portrait.2
- [ ] portrait.3
- [ ] portrait.4
- [ ] portrait.5
- [ ] ui.panel
- [ ] ui.cursor
- [ ] ui.scroll
- [ ] ui.toggle
- [ ] ui.icon.hp
- [ ] ui.icon.charge
- [ ] ui.icon.haul
- [ ] ui.icon.hit
- [ ] ui.icon.pause
- [ ] ui.icon.sound
- [ ] ui.icon.mute

### Drawn compositions (Graphics, no grid)
- [ ] gfx.grapple-line
- [ ] gfx.flare-arc
- [ ] gfx.overlay-glow
- [ ] gfx.starfield (3 layers)
- [ ] gfx.phase-tint
- [ ] gfx.hazard.lunar-ring
- [ ] gfx.hazard.shoals
- [ ] gfx.hazard.belt
- [ ] gfx.hazard.saturn
- [ ] gfx.hazard.shock
- [ ] gfx.hazard.flare-belt
- [ ] gfx.title-hero

## Music (owner: sound)
- [ ] title
- [ ] travel
- [ ] station
- [ ] danger
- [ ] hazard
- [ ] dirge
- [ ] fanfare
- [ ] mg.salvage
- [ ] mg.thread
- [ ] mg.flare
- [ ] jingle.clean

## SFX (owner: sound)
- [ ] ui.move
- [ ] ui.select
- [ ] ui.back
- [ ] ui.deny
- [ ] text.tick
- [ ] store.buy
- [ ] store.sell
- [ ] trade.accept
- [ ] drive.hum
- [ ] alarm
- [ ] hull.hit
- [ ] grapple.fire
- [ ] grapple.attach
- [ ] grapple.reel
- [ ] grapple.snap
- [ ] grapple.empty
- [ ] collision
- [ ] flare.warn
- [ ] flare.hit
- [ ] crash
- [ ] beacon.chime
- [ ] death.toll
- [ ] arrival.bell
- [ ] countdown.beep
- [ ] pause
- [ ] event.ding

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
