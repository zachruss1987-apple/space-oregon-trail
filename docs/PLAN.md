# Roadmap

Six milestones. Each ends with a playable build on GitHub Pages, all tests green, the kanban updated, and a short report in `docs/reports/M<n>.md`. The program manager runs milestones back to back and reports to the owner at the end (owner's choice; the kanban is the live window into progress).

| # | Milestone | Playable outcome | Primary roles |
|---|-----------|------------------|---------------|
| M0 | Foundation | Toolchain, CI, Pages deploy, kanban, design docs, reference research. Boot screen renders. | PM, developer, designer, tester |
| M1 | Core loop | Title → crew setup → outfitting → travel → events → waypoints → death or arrival → score. Text-first UI. Headless sim fully unit-tested. | developer, designer, writer, tester |
| M2 | Stations and hazards | Trading posts with buy/sell and NPC trade offers, hazard crossings with four choices, talk-to-crew flavor text, memorial beacons, repairs. Bulk content pass with llama3.2 brainstorms. | developer, writer, designer, tester |
| M3 | Mini-games | Salvage Run (hunting replacement), Debris Field threading (hazard "thread it" option), Flare Belt finale. Keyboard and touch. | developer, designer, tester |
| M4 | Audiovisual polish | Procedural pixel art (ship, stations, planets, crew portraits), animated travel scene with parallax starfield, chiptune music and SFX via Web Audio, CRT shader toggle, pixel font, UI theme. | graphics, sound, developer, tester |
| M5 | Balance and release | Monte Carlo balance harness, difficulty tuning, high scores, save/load, settings, accessibility pass, README, v1.0.0 tag and Pages release, final report. | PM, developer, tester, designer |

Details per milestone: `docs/milestones/M0.md` … `M5.md`. Design: `docs/design/README.md`.

## Principles
- A milestone is done when its acceptance checklist is green, not when its tasks are closed.
- Each milestone leaves the game *more* playable, never broken. `main` always deploys.
- Design before code: the designer and writer land content/spec tasks before developer tasks in the same milestone.
- Testers write tests from the milestone spec independently of the developer's implementation, then reconcile.
- Prefer fewer, larger agent tasks with clear briefs over many tiny ones; every spawned agent costs context.
