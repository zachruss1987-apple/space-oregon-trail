#!/usr/bin/env node
/**
 * Dev-time content brainstorming with a local Ollama model (default llama3.2).
 * Agents use this to generate bulk raw ideas, then curate them by hand into
 * src/content/*.json. Output is written to scratch/ (git-ignored) and echoed.
 *
 *   node scripts/brainstorm.mjs --prompt "List 40 wry one-line epitaphs for colonists who died en route to Proxima b"
 *   node scripts/brainstorm.mjs --file prompts/events.txt --model llama3.2 --out scratch/events.txt --n 2
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const flag = (k, d) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};
const model = flag('model', 'llama3.2');
const host = flag('host', process.env.OLLAMA_HOST ?? 'http://localhost:11434');
const n = Number(flag('n', '1'));
const promptText = flag('file') ? readFileSync(flag('file'), 'utf8') : flag('prompt');
if (!promptText) {
  console.error('usage: brainstorm.mjs --prompt "..." | --file path [--model llama3.2] [--out file] [--n 1]');
  process.exit(2);
}
const out = flag('out', `scratch/brainstorm-${Date.now()}.txt`);

const system =
  'You are a witty game writer for THE PROXIMA TRAIL, a retro space reimagining of The Oregon Trail (1985). ' +
  'Tone: dry, deadpan, PG humor in the spirit of "You have died of dysentery." Keep every item short and concrete. ' +
  'Output plain text, one item per line, no numbering, no preamble.';

let all = '';
for (let i = 0; i < n; i++) {
  const res = await fetch(`${host}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      system,
      prompt: promptText,
      stream: false,
      options: { temperature: 0.9, seed: Date.now() + i },
    }),
  });
  if (!res.ok) {
    console.error(`Ollama error ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  const data = await res.json();
  all += data.response.trim() + '\n';
}
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, all);
process.stdout.write(all);
console.error(`\n[saved to ${out}]`);
