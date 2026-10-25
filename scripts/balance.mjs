#!/usr/bin/env node
/**
 * Balance harness CLI. Runs N seeded auto-played games per profession x launch window x policy and prints Markdown.
 *
 *   node scripts/balance.mjs [--seeds 200] [--out docs/reports/balance-latest.md] [--json scratch/balance.json]
 *                            [--professions all|executive,farmer] [--windows all|2,4] [--policies all|balanced,greedy]
 *                            [--difficulty greenhorn|spacer|pathfinder]
 *
 * The sim imports use the `@/` alias, which plain Node cannot resolve, so the work lives in
 * tests/unit/balance/balance.util.test.ts (skipped unless BALANCE is set) and this script runs it under vitest.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const opt = { seeds: '200', out: 'docs/reports/balance-latest.md', json: 'scratch/balance.json', professions: 'all', windows: 'all', policies: 'all', difficulty: 'spacer' };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 2) {
  const k = argv[i].replace(/^--/, '');
  if (!(k in opt) || argv[i + 1] === undefined) {
    console.error(`Unknown or incomplete option: ${argv[i]}`);
    process.exit(2);
  }
  opt[k] = argv[i + 1];
}
if (!['greenhorn', 'spacer', 'pathfinder'].includes(opt.difficulty)) {
  console.error(`Unknown difficulty: ${opt.difficulty}`);
  process.exit(2);
}
const list = (v, conv) => (v === 'all' ? undefined : v.split(',').map(conv));
const args = {
  seeds: Number(opt.seeds),
  professions: list(opt.professions, String),
  windows: list(opt.windows, Number),
  policies: list(opt.policies, String),
  difficulty: opt.difficulty,
};
const r = spawnSync('npx', ['vitest', 'run', 'tests/unit/balance/balance.util.test.ts', '--reporter=dot'], {
  stdio: ['ignore', 'ignore', 'inherit'],
  shell: true,
  env: { ...process.env, BALANCE: '1', BALANCE_ARGS: JSON.stringify(args), BALANCE_OUT: opt.out, BALANCE_JSON: opt.json },
});
if (r.status === 0) {
  console.log(readFileSync(opt.out, 'utf8'));
  console.error(`Wrote ${opt.out} and ${opt.json}`);
}
process.exit(r.status ?? 1);
