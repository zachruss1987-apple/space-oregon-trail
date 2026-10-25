# The Proxima Trail

*You have died of space dysentery.*

A retro, wry-humored space reimagining of MECC's **The Oregon Trail** (1985), built end to end by a team of AI agents (developer, tester, designer, writer, graphics, sound, program manager) as an experiment in multi-agent software workflows.

- **Play:** https://zachruss1987-apple.github.io/space-oregon-trail/ (deploys from `main`)
- **Agent kanban board:** https://zachruss1987-apple.github.io/space-oregon-trail/kanban/ (also `kanban/index.html` in this repo)
- **Roadmap:** [docs/PLAN.md](docs/PLAN.md) · **Design:** [docs/design/README.md](docs/design/README.md) · **Agent team:** [docs/agents/README.md](docs/agents/README.md)

## The game
Year 2184. Lead a crew of five from Independence Station to the colony of New Willamette on Proxima Centauri b: 2,040 megaklicks, sixteen waypoints, five hazard crossings, one jump gate, and a great many ways to die. Pick a profession, outfit at Mattie's, set your thrust and rations, and hope the coolant pump holds.

Stack: Phaser 3, TypeScript, Vite. All graphics and audio are generated in code. Unit tests with Vitest, end-to-end tests with Playwright, CI and GitHub Pages via GitHub Actions.

## Develop
```
npm install
npm run dev          # http://localhost:5173
npm run test:all     # typecheck, lint, unit, e2e
npm run kanban:open  # open the kanban board
```
See [CLAUDE.md](CLAUDE.md) for the architecture rules agents follow.

## How it is built
The program manager (a Claude session) plans milestones, seeds the kanban, and spawns role-specific agents with narrow briefs and the cheapest model that fits the job. Agents claim cards, work, test, commit, and report in a few lines. A local Ollama model (llama3.2) is used only at development time to brainstorm raw text that a writer agent curates. Milestone reports live in `docs/reports/`.

## License
MIT. "The Oregon Trail" is a trademark of its respective owners; this is an independent homage with original content.
