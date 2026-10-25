# Writing

## Voice
Deadpan frontier futurism. Understatement over punchlines. Short, concrete sentences. Colonists are brave and underinformed. The narrator is not. See `docs/agents/writer.md` for rules of thumb and length limits.

Reference lines (tone targets, not to be reused verbatim):
- "Your engineer has died of radiation sickness. The manual said this would not happen."
- "Pirates boarded while you slept. They took 212 rations and left a note complimenting the coffee."
- "Mattie says: 'Two suits per crew. Space is mostly empty, but the parts that aren't are sharp.'"

## Content schemas (src/content)
```ts
// events.json
{ id: string, weight: number, condition?: string, effect: EffectSpec, text: string[] }
// deaths.json
{ condition: string, text: string[] }   // use {name}
// stations.json (M2)
{ id: string, name: string, blurb: string, talk: string[], markup: number }
// bulletins.json (landmarks)
{ waypoint: string, lines: string[] }
// epitaphs.json (seed beacons, M2)
{ name: string, text: string, segment: number }
```
Content tests enforce: every `text` ≤ 140 chars (events ≤ 2 sentences), unique strings across a file, placeholders resolvable, no words from `docs/design/forbidden.txt` (slurs, modern internet slang).

## Brainstorm recipe (llama3.2)
`npm run brainstorm -- --prompt "<topic brief + 3 example lines in voice> Write 40 more." --n 3 --out scratch/<topic>.txt`. Then curate: keep ≤ 20%, rewrite for voice and length, dedupe, and commit only the JSON.

## Glossary
In-world terms live in `glossary.md`; add every new coined term there.
