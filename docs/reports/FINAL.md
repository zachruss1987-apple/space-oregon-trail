# Final report — The Proxima Trail v1.0.0 (2026-10-25)

## What shipped
A complete, playable reimagining of The Oregon Trail in space, live at https://zachruss1987-apple.github.io/space-oregon-trail/, built in six milestones over 24–25 October 2026 by a program-manager session orchestrating role agents. See `CHANGELOG.md` for the feature list and `docs/reports/M0.md` … `M4.md` for each milestone.

## Metrics (at tag v1.0.0)
| Metric | Value |
|--------|-------|
| Unit tests | see `npm test` output recorded in M5 close-out: 1,570+ passing, ~15–20 s |
| E2E tests | 60+ Playwright specs (functional) + 14 visual baselines, ~3 min at 4 workers |
| Sim + content coverage | ≥ 95% statements |
| Bundle | ~443 KB gzip (124 app + 318 Phaser); loads in < 1 s locally |
| Balance (balanced policy, 300 seeds × 5 windows, Spacer) | Executive 63%, Engineer 51%, Farmer 32%; mean 170 days; top death cause 30% |
| Content | 28 event families, 13 death causes, 17 waypoints with bulletins, 84 talk lines, 22 trade personas, 45 beacons, 10 guide pages, ~600 UI strings |
| Art / audio | 94 sprites, 2 bitmap fonts, CRT pipeline; 11 songs, 27 SFX |
| Kanban | 66 cards, all mirrored to GitHub Issues |
| Commits | ~90 on `main`, every one green in CI |

## Roster
| Role | Model | Tasks | Notes |
|------|-------|-------|-------|
| Program manager | Fable 5.1 | all milestones | planning, briefs, review, commits, pushes, reports |
| Designer | Opus | 5 | M0 review, economy/hazards, minigames, art/audio specs; wrote `decisions.md` entries |
| Developer (sim) | Opus | 5 | sim core, stations/hazards, mini-game results, difficulty/saves, tuning |
| Developer (scenes) | Opus | 5 | scenes M1/M2, mini-game base, Threading/Flare, M4 wiring, M5 features, accessibility |
| Developer (small) | Sonnet | 5 | polish, log keys, harness, follow-ups |
| Tester | Sonnet | 8 | spec-driven suites per milestone, e2e, seeds, baselines, audit |
| Writer | Sonnet | 11 | all player text, guide, high scores, copy-key migrations |
| Graphics | Sonnet | 2 | palette, sprites, fonts, travel art, CRT |
| Sound | Sonnet | 3 | synth, tracker, songs, SFX, stings |
| Researcher | Sonnet | 1 | original-game mechanics reference |

## What worked
- **Spec-first, split by file ownership.** Designer docs became the contract; developers implemented, writers filled JSON, testers derived tests from the docs rather than the code. Three or four agents routinely worked the same feature concurrently in one tree with no merge conflicts, because each owned a directory or a file family.
- **Spec-driven testing by an independent agent** produced roughly half of all unit tests and pinned every number in the design docs. It found no logic bugs (the Opus developers were careful), but it made the tuning pass safe: every number change had a test that had to be consciously updated with a citation.
- **Debug hooks designed into the spec** (`?seed=`, `data-scene`, `__PROXIMA__.state`, `finishNow`, `loadState`) made a canvas game with real-time mini-games testable in seconds.
- **Short reports and a decisions log** kept the PM's context small: each agent returned ≤ 15 lines; judgment calls were appended to `decisions.md` rather than re-litigated.
- **Model tiering** held: Opus for sim core, design, and the large scene integrations; Sonnet for everything with a clear spec. Sonnet agents handled art, music, and writing well when given a checklist and a preview scene.

## What did not
- **Local LLM brainstorming (llama3.2)** yielded under 10% usable lines; writers retired it after two tries. It stays as a dev tool, not a content source.
- **Shared infrastructure contention.** Concurrent Playwright runs collided on `dist/`, port 4173 and `test-results/`; a 32-core machine spawned 16 Chromium workers and cold boots timed out, which looked like flakiness for a while. Fixes: `PW_OUT` per card, workers capped at 4, "run e2e once at the end" rule.
- **Temporary copy tables** (`FALLBACK`, `PENDING`, `UNWRITTEN`, `OPTIONS_PENDING`) kept multiplying because developers could not edit `ui.json` while a writer had it. The content test that forbids unresolved keys kept them honest, but one shared mechanism should have been designed in M1.
- **Long multi-file shell heredocs** were truncated by the tool; large files must go through the file tool.
- **Stale knowledge in briefs.** The PM sometimes briefed from memory of an earlier state (e.g. "6 stations", "data-scene=MiniGame"); agents correctly followed the docs and flagged the mismatch. Briefs should point at files, not restate them.

## Open items (post-1.0)
- Linux visual baselines so the visual suite runs in CI.
- Reference policy that buys rations at stations (Engineer cautious policy wins only 19%).
- Greenhorn radiation share above 35% (cap is enforced only on Spacer).
- Gamepad support; export box does not follow the CRT look.

## Cost snapshot
Subagent token usage reported by the harness summed to roughly 6–7 million tokens across ~45 agent runs; the PM session used a fraction of its 15 M budget. Opus runs were the largest (150–335 K each); Sonnet runs averaged 50–100 K.
