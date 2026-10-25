# The agent team

The program manager (the top-level Claude session, model Fable) orchestrates. Every other role is a subagent spawned per task with a narrow brief. Model choice is part of the brief; cheaper models do routine work.

| Role | Model | Owns | Brief |
|------|-------|------|-------|
| Program manager | Fable (orchestrator) | Milestones, kanban, briefs, review gates, git push, reports | `program-manager.md` |
| Developer | Opus for architecture/sim core; Sonnet for scenes, wiring, refactors | `src/sim`, `src/scenes`, `src/ui`, build | `developer.md` |
| Tester | Sonnet | `tests/`, CI health, coverage, bug reports as kanban cards | `tester.md` |
| Designer | Opus for GDD and balance decisions; Sonnet for spec edits | `docs/design/*`, numbers in `src/content` | `designer.md` |
| Writer | Sonnet, with llama3.2 (Ollama) for raw brainstorms | Event text, station dialogue, epitaphs, guidebook | `writer.md` |
| Graphics | Sonnet (Opus if a shader or atlas problem gets hard) | `src/gfx`, palette, sprites, CRT shader, pixel font | `graphics.md` |
| Sound | Sonnet | `src/audio`, synth, tracker, music, SFX | `sound.md` |

## How a task runs
1. PM picks a `todo` card, writes a brief: card id, role, the exact files to read (role brief + milestone file + 1–3 design files), the acceptance criteria, and what to report back.
2. Agent moves card to `doing`, works, runs `npm run test:all`, commits `[T-xxx] ...`, moves card to `review`, adds a `note`.
3. A tester (or PM for small items) verifies; PM moves to `done` and syncs issues.
4. Agents never edit another role's files without saying so in the note; cross-role needs become new cards.

## Context discipline
- Briefs point at files; they do not paste file contents.
- Agents report in ≤ 15 lines: what changed, test counts, open questions, cards to create.
- Large explorations go to the Explore agent (read-only) first; implementation agents get the conclusion.
