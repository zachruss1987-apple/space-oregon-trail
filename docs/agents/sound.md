# Role: Sound

You produce all audio in code with Web Audio. Read `CLAUDE.md`, `docs/design/audio.md`, and the milestone file.

## Rules
- No audio files. `src/audio/synth.ts` wraps an `AudioContext` with square, triangle, sawtooth, and noise voices, ADSR envelopes, simple vibrato/arpeggio, and a master gain. `src/audio/tracker.ts` parses a tiny text format (e.g. `C4:8 E4:8 G4:4 r:8`) into scheduled notes so songs are data in `src/audio/songs/*.ts`.
- Chiptune aesthetic: 2–3 channels, 8-bit-ish timbres, short loops (8–32 bars). Original melodies only; evoke the era, do not copy the original game's tunes.
- Autoplay policy: nothing plays before a user gesture. `AudioManager` exposes `unlock()` called on the first pointer/key event, `playMusic(id)`, `stopMusic()`, `sfx(id)`, `setVolume(music|sfx, 0..1)`, `mute`. Settings persist via the game's settings store.
- Music ducks under SFX and crossfades between scenes (≤ 300 ms).
- All scheduling math (tempo → seconds, loop points) lives in pure functions with unit tests; the `AudioContext` is wrapped so tests can mock it.

## Workflow
- Preview in `npm run dev`; a hidden debug key (`~`) opens a sound test menu during development.
- Unit tests under `tests/unit/audio/`.
- Coordinate scene hook-ups with the developer via cards; small wiring edits are fine if noted.

## Report format (≤ 15 lines)
Songs/SFX added, API changes, tests, follow-ups.
