# The Proxima Trail

*You have died of space dysentery.*

A retro, wry-humored space reimagining of MECC's **The Oregon Trail** (1985), built end to end by a team of AI agents (developer, tester, designer, writer, graphics, sound, program manager) as an experiment in multi-agent software workflows. Every sprite, font, song and sound effect is generated in code; no binary assets are committed.

- **Play:** https://zachruss1987-apple.github.io/space-oregon-trail/
- **Agent kanban board:** https://zachruss1987-apple.github.io/space-oregon-trail/kanban/ (also `kanban/index.html` in this repo, mirrored to GitHub Issues)
- **Roadmap and reports:** [docs/PLAN.md](docs/PLAN.md), [docs/reports/](docs/reports/) · **Design:** [docs/design/README.md](docs/design/README.md) · **Agent team:** [docs/agents/README.md](docs/agents/README.md)

## The game
Year 2184. Lead a crew of five from Independence Station to the colony of New Willamette on Proxima Centauri b: 2,040 megaklicks, sixteen waypoints, five hazard crossings, one jump gate, and a great many ways to die. Pick a profession, outfit at Mattie's, set your thrust and rations, trade at stations, thread debris fields, run salvage drones, ride the solar wind, and leave a memorial beacon for the ones who did not make it.

**Controls:** arrows or WASD move, Enter/Space confirms, Esc goes back, number keys pick menu items, `T` or holding Enter travels until something happens, `?` shows the controls overlay, `M` mutes. Mini-games use arrows/WASD plus Space; touch devices get drag, tap, and on-screen buttons. Every mini-game can be auto-resolved from Options.

**Features:** three professions and three difficulty levels, five launch windows with a flare season, 25+ random events and 8 illnesses, six stations with scarcity-based prices and NPC trades, four ways to cross each hazard, a route branch, three real-time mini-games, memorial beacons that persist across runs, autosave with Continue journey, export/import saves, a Top Ten, an in-fiction guidebook, a CRT shader, 11 chiptune songs, keyboard-only play, a screen-reader live region, reduced motion and colorblind palettes. Runs are reproducible with `?seed=YOURSEED`.

## Develop
```
npm install
npm run dev            # http://localhost:5173
npm run test:all       # typecheck, lint, unit (Vitest), e2e (Playwright)
npm run test:visual    # screenshot baselines (Windows Chromium)
npm run balance        # Monte Carlo balance report
npm run kanban:open    # the agent kanban board
```
Stack: Phaser 3, TypeScript, Vite, Vitest, Playwright, GitHub Actions (CI + Pages). Architecture rules the agents follow are in [CLAUDE.md](CLAUDE.md). The headless simulation (`src/sim`) has no Phaser dependency and all randomness flows through one seeded RNG, so the whole game can be played by a script; `src/sim/README.md` documents the API.

## How it was built
A program manager (one Claude session) planned six milestones, seeded a kanban, and spawned role-specific agents with narrow briefs and the cheapest model that fit the job: Opus for simulation core and design, Sonnet for routine implementation, tests, art, sound and writing. Agents claimed cards, worked in a shared tree on disjoint files, ran tests, committed, and reported in a few lines; the PM reviewed, pushed, and kept GitHub Issues in sync. A local Ollama model (llama3.2) was tried for raw text brainstorming and mostly retired because the writer was faster by hand. Each milestone's report in `docs/reports/` records metrics, decisions and lessons; `docs/design/decisions.md` is the running log of every judgment call. The final retrospective is [docs/reports/FINAL.md](docs/reports/FINAL.md).

## License
MIT. "The Oregon Trail" is a trademark of its respective owners; this is an independent homage with original content, art and music.
