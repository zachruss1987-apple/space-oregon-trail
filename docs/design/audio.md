# Audio (M4)

All sound is synthesized with Web Audio (`src/audio/`). No audio files. Chiptune: at most 3 tonal channels plus noise, short seamless loops, original melodies that evoke a 1985 home computer without copying any tune.

## Voices (`synth.ts`)
| Voice | Id | Build | Character |
|-------|----|-------|-----------|
| Pulse 12.5% | `p12` | PeriodicWave from pulse Fourier series (32 harmonics) | Thin, nasal; counter-melodies, blips |
| Pulse 25% | `p25` | same | Classic lead |
| Pulse 50% | `p50` | same (square) | Hollow; pads, bells |
| Triangle | `tri` | native `triangle` | Bass, soft melody; no volume envelope beyond on/off feel (use `organ` / `bass`) |
| Sawtooth | `saw` | native `sawtooth`, lowpass 2.4 kHz | Brass stab, alarms, danger sting |
| Noise long | `nzl` | 1 s AudioBuffer from a 15-bit LFSR (taps 0,1; period 32,767) | Hiss: hats, snares, static, crashes |
| Noise short | `nzs` | 15-bit LFSR, short mode (taps 0,6; period 93) | Metallic buzz: clanks, alarms, grapple |

Noise pitch = playbackRate over 16 steps (`N0` lowest … `NF` highest). The LFSR is a pure function (`lfsr(seed, mode, n)`), so buffers are deterministic.

## ADSR presets
Times in ms; sustain as a fraction of the note volume. Release starts at note off.

| Preset | A | D | S | R | Use |
|--------|---|---|---|---|-----|
| `pluck` | 2 | 120 | 0.0 | 40 | Arps, plucked counter-lines |
| `lead` | 5 | 80 | 0.6 | 80 | Melodies |
| `pad` | 60 | 200 | 0.5 | 250 | Travel chords |
| `bass` | 2 | 40 | 0.8 | 30 | Triangle bass |
| `organ` | 5 | 0 | 1.0 | 20 | Station theme, sustained |
| `swell` | 250 | 0 | 1.0 | 300 | Dirge, drive hum |
| `blip` | 1 | 30 | 0.0 | 10 | UI, typewriter |
| `kick` | 1 | 60 | 0.0 | 10 | Noise kick (with pitch drop) |
| `snare` | 1 | 90 | 0.0 | 30 | Noise snare |
| `hat` | 1 | 25 | 0.0 | 5 | Noise hat |
| `toll` | 2 | 900 | 0.15 | 1200 | Bells, beacon chime, death toll |

## Tracker format (`tracker.ts`)
Songs are data in `src/audio/songs/*.ts`: `{ id, tempo, meter, channels: { p1?, p2?, tri?, noise? }, loop? }`, each channel one string.

| Token | Meaning | Example |
|-------|---------|---------|
| `<note><oct>:<dur>` | Note, octave 0–8, `#`/`b` accidentals. A4 = 440 Hz, equal temperament | `C4:8`, `F#3:4`, `Bb2:2` |
| durations | `1 2 4 8 16 32`; `.` dotted (×1.5); `t` triplet (×2/3) | `G4:4.`, `E5:8t` |
| `r:<dur>` | Rest | `r:8` |
| `-:<dur>` | Tie: extend the previous note (no re-attack) | `C4:4 -:8` |
| `v<0-15>` | Channel volume from here on (15 = full) | `v10` |
| `[n n n]:<dur>` | Arpeggio: cycles the notes every arp step for the duration | `[C4 E4 G4]:4` |
| `@<preset>` | ADSR preset from here on | `@pluck` |
| `@arp=<hz>` | Arp step rate (default 20 Hz = 50 ms) | `@arp=30` |
| `@vib=<cents>,<hz>` | Vibrato (default off); `@vib=0` turns off | `@vib=15,6` |
| `K S H C` + `:<dur>` | Noise channel drums: kick, snare, hat, crash | `K:8 H:8 S:8 H:8` |
| `N<0-F>:<dur>` | Raw noise pitch (with `nzl`; `N!` prefix for `nzs`) | `N9:16`, `N!4:8` |
| `\|:` … `:\|` | Loop region (one per channel). Song plays intro, then loops the region forever | `C4:4 \|: D4:4 ... :\|` |
| `\|` | Bar line: optional; the parser checks each bar sums to the meter | |
| `;` | Comment to end of line | |

Header `tempo` is quarter-note BPM (one tempo per song; no mid-song changes). Every channel's intro length and loop length must be equal in beats (validator error otherwise). Parse errors name the channel, token index and token text.

## Songs
Channels: P1 lead, P2 harmony, TRI bass, NOI drums. Bars in the song's meter; loop = bars of the `\|: :\|` region.

| Id | Where | Mood | Tempo | Key / meter | Bars (intro + loop) | Channels |
|----|-------|------|-------|-------------|---------------------|----------|
| `title` | Title, Options, Top Ten, Guide | Hopeful frontier homage | 116 | D major, 3/4 | 2 + 32 | P1 `p25 lead`, P2 `p12 pluck`, TRI `bass`, NOI soft |
| `travel` | Travel, Supplies, Map | Calm, rolling, a little lonely | 92 | G mixolydian, 4/4 | 0 + 16 | P1 `p50 pad v8`, TRI walking bass, NOI hat on beats ("wheel clack") |
| `station` | Station, Store, Waypoint at stations | Busy general store, ragtime lilt | 104 | F major, 2/4 | 0 + 16 | P1 `p25 lead`, P2 `p50 organ` off-beat arps, TRI oom-pah |
| `danger` | Event alarms, Hazard arrival (sting) | Startle, then hold | 140 | C diminished | 2, no loop | P1 `saw`, TRI drop, NOI crash |
| `hazard` | Hazard scene while choosing | Uneasy, ticking | 100 | E minor, 4/4 | 0 + 8 | P2 `p12 pluck` ostinato, TRI pedal, NOI hat 8ths |
| `dirge` | Death, BeaconPrompt | Wry, mournful, hymn-like | 60 | A minor, 3/4 | 4 + 8 | P1 `p50 swell`, TRI `organ`, NOI toll every 2 bars |
| `fanfare` | Arrival, Score | Bright arrival, then warm loop | 120 | C major, 4/4 | 4 + 8 | P1 `p25 lead`, P2 `p50` thirds, TRI `bass`, NOI marching |
| `mg.salvage` | Salvage Run | Bouncy, busy | 128 | E minor, 4/4 | 0 + 8 | P1 `p12 pluck` arps, TRI `bass`, NOI K/H |
| `mg.thread` | Debris Threading | Driving, tense | 150 | A minor, 4/4 | 0 + 8 | P1 `p25 lead`, TRI 8th-note bass, NOI K/S |
| `mg.flare` | Flare Belt Finale | Heat, urgency | 160 | D phrygian, 4/4 | 0 + 16 | P1 `saw` stabs, P2 `p12` arps, TRI, NOI busy |
| `jingle.clean` | Clean thread / clean ride / full haul | Smug little win | 150 | C major, 4/4 | 2, no loop | P1 `p25`, P2 `p12`, TRI |

`title` brief: open on a rising major arpeggio (1–3–5–8) like a wagon wheel starting to turn, answer with a fiddle-style turn around the 5th, and land on a held tonic with a plucked pentatonic counter-line. Pentatonic lead, simple I–IV–V–I harmony, a bridge on vi. Evoke a schoolroom-computer frontier tune; the melody must be original, and the sound agent writes it fresh rather than transcribing anything.

Stings (`danger`, `jingle.clean`) play over a ducked current song (−12 dB), then the song returns to normal level; they never replace it.

## SFX
Pitch envelope = start → end over the duration. Class `duck` makes music duck; `ui` does not.

| Id | Voice | Pitch envelope | Dur ms | Class |
|----|-------|----------------|--------|-------|
| `ui.move` | p12 blip | E6 fixed | 30 | ui |
| `ui.select` | p25 blip | C6 → G6 step at 40 ms | 80 | ui |
| `ui.back` | p25 blip | G5 → C5 step | 80 | ui |
| `ui.deny` | p50 blip | A3 fixed, 2 pulses | 120 | ui |
| `text.tick` | nzs hat | N!C fixed, vol 4 | 15 | ui (max 1 per 40 ms) |
| `store.buy` | p25 pluck | C6, E6, G6 arp | 150 | ui |
| `store.sell` | p25 pluck | G6, E6, C6 arp | 150 | ui |
| `trade.accept` | p50 + tri | C5+G5 → C6 | 250 | duck |
| `drive.hum` | tri + nzl | A1 with 3 Hz, 10-cent vibrato; noise N2 vol 2 | loop | ui (bed; Travel while a day animates) |
| `alarm` | saw | A5 ↔ E5 every 120 ms, 3 cycles | 720 | duck |
| `hull.hit` | nzl kick + saw | N6 → N1; saw C3 → G1 | 300 | duck |
| `grapple.fire` | nzs | N!8 → N!3 | 120 | duck |
| `grapple.attach` | p12 + nzs | C6 clank + N!A tick | 80 | duck |
| `grapple.reel` | p12 | C4 → C5 sweep, retrigger per 0.5 s reel | 500 loop | ui |
| `grapple.snap` | nzs | N!F → silence | 90 | duck |
| `grapple.empty` | p50 blip | C3 click | 40 | ui ("Out of charges.") |
| `collision` | nzl + p50 | N8 → N2; p50 E3 → C3 | 220 | duck |
| `flare.warn` | nzl | N3 → N6 swell, vol 5 | telegraph length | ui |
| `flare.hit` | saw + nzl | E4 → E2; noise NC → N4 | 350 | duck |
| `crash` | nzl + tri | NF → N0 over 1.2 s; tri C2 → C1 | 1200 | duck |
| `beacon.chime` | p50 toll | E6 then B5 | 900 | duck |
| `death.toll` | tri + p50 toll | A2 + A3, single strike | 1800 | duck |
| `arrival.bell` | p50 toll | C6, G5, C6, E6 | 1400 | duck |
| `countdown.beep` | p25 blip | 3, 2, 1: A4 120 ms; GO: A5 250 ms | 120/250 | ui |
| `pause` | p50 blip | C5 → G4 | 100 | ui (music also drops to −12 dB while paused) |
| `event.ding` | p12 pluck | G5 fixed | 120 | ui (new log event line) |

## Mixing
| Rule | Value |
|------|-------|
| Buses | master → { music, sfx }. Defaults master 0.8, music 0.6, sfx 0.8 (linear) |
| Options steps | 0–10 per bus → gain `step/10`; 0 = silent |
| Duck | On a `duck` SFX: music bus −6 dB (×0.501) with 20 ms attack; release 250 ms after the last ducking SFX ends |
| Stings | Music −12 dB while a sting plays |
| Crossfade | Scene music change: 300 ms equal-power crossfade; same id = no restart |
| Polyphony | ≤ 8 SFX voices; oldest of the same id is stolen first |
| Mute | `M` key toggles mute everywhere; mute ramps master to 0 over 30 ms |
| Persistence | localStorage `proxima.settings` (JSON, `v: 1`): `master`, `music`, `sfx`, `muted` alongside the other Options keys (`ui.md`). Bad or missing values fall back to defaults |

## Autoplay unlock
1. No `AudioContext` exists until the first `pointerdown`, `keydown` or `touchend` anywhere; `AudioManager.unlock()` then creates it and calls `resume()`.
2. `playMusic(id)` before unlock records it as pending; it starts (no crossfade) on unlock. `sfx()` before unlock is dropped, never queued.
3. On `visibilitychange` back to visible, call `resume()` if suspended. A hidden tab lets music keep its schedule but schedules nothing new.
4. Title shows `ui.icon.mute` in a corner until unlocked; the e2e test asserts `audioContext.state === 'running'` after one click (exposed as `window.__PROXIMA__.audioState`).

## Sound test (`~`, dev builds or `?debug=1`)
Keyboard menu over the current scene: Songs (play / stop, jump to loop start, show tempo, bar and seconds); SFX (fire each id); Voices (each voice at A4 for 1 s; noise at N0–NF); ADSR (audition each preset on p25); Duck test (loop music, fire `alarm`); Buses (master/music/sfx gains, mute); Context (state, sample rate, current time, scheduled voices); Stop all. Esc closes.

## Scheduling and tests (`tests/unit/audio/`)
Look-ahead scheduler: a 25 ms timer schedules every event that starts within the next 100 ms at `ctx.currentTime` precision. All math is pure:

| Function | Expectation |
|----------|-------------|
| `noteToFreq('A4')` | 440; `C4` 261.63 (±0.01); `C#4` = `Db4`; bad note throws |
| `durToSec(tempo, dur)` | 120 BPM: `4` 0.5, `8` 0.25, `4.` 0.75, `8t` 0.1667, `1` 2.0 |
| `parseChannel(text)` | Tokens → `{ t, dur, freq / arp / drum, vol, preset }`; ties merge; errors carry index and token |
| Bar check | `\|` bars that do not sum to the meter fail with the bar number |
| Loop points | `loopStartSec`, `loopLenSec` equal across channels; mismatch is a validation error |
| `eventsBetween(song, t0, t1)` | Exactly the notes starting in `[t0, t1)`, unrolling loops; no gaps or doubles at the loop seam |
| Arp | `[C4 E4 G4]:4` at 120 BPM, 20 Hz → 10 steps, cycling C E G |
| `adsrAt(preset, t, noteLen)` | Values at the A, D, S and R boundaries |
| `dbToGain(-6)` | 0.501 (±0.001); duck envelope reaches target in 20 ms, releases in 250 ms |
| Crossfade | Equal-power curves: `a² + b² = 1` (±0.001) across 300 ms |
| `lfsr` | Deterministic; long period 32,767, short period 93 |
| Settings | Parse/clamp `proxima.settings`; garbage → defaults |
| Songs | Every song in `songs/` parses, passes bar and loop checks, and stays within 4 channels |
