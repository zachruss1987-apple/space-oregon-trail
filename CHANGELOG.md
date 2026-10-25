# Changelog

## 1.1.0 — 2026-10-25
- Key hints bar: a 16 px band under the game view (canvas 640×416) that always lists the keys that work right now, with
  platform-aware names (Return/Delete on a Mac), hidden on touch devices, and an Options row Key hints (Auto / On / Off).
  Options grows to 13 rows (Shift+3 picks row 13). Spec: `docs/design/keyhints.md`. 80 new unit tests, 9 e2e tests, baselines regenerated.

## 1.0.0 — 2026-10-25
First release. Built in six milestones by an AI agent team over two days; see `docs/reports/` for each.

### Game
- Full journey: Independence Station → New Willamette (2,040 Mk, 16 waypoints, 5 hazards, 1 gate), three professions, five launch windows with flare season, three difficulty levels.
- Daily simulation: thrust, rations, weather Markov chains, health and 8 illnesses, 25+ events with a cadence guard, repairs, salvage, scoring and ratings.
- Six stations with per-item markups, buy-back, NPC trades (22 personas), talk pools, rest; route branch at Titan Refinery.
- Hazard crossings with Thread it / Shields up / Hire a tug / Belter pilot and a readout.
- Three real-time mini-games (Salvage Run, Debris Threading, Flare Belt) with touch controls, pause, skip-with-penalty and an auto-resolve option.
- Memorial beacons (per-crew epitaphs persisted locally, 45 canned), autosave with Continue journey, export/import, Top Ten, in-fiction guidebook.
- Code-generated pixel art (94 sprites, 8×8 and 6×8 bitmap fonts, CRT shader) and chiptune audio (11 songs, 27 SFX, stings, ducking).
- Accessibility: keyboard-only play, screen-reader live regions, `?` controls overlay, reduced motion, colorblind palette, global mute.

### Engineering
- Headless `src/sim` with a single seeded RNG; `?seed=` reproducibility; versioned saves with migrations (v1→v4).
- 1,500+ unit tests (about half derived from the design docs by independent tester agents), 60+ Playwright e2e tests, visual baselines, balance harness with CI bands.
- Kanban CLI with generated board and GitHub Issues mirror; per-milestone reports; decision log.
