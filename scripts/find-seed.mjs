#!/usr/bin/env node
/**
 * Find "policy-run" seeds for the e2e tests: the 3 earliest Executive deaths (none die before day 40), 3 where the Executive
 * arrives with all 5 crew alive, 3 where the first waypoint is reached within 6 days (SEED-0..SEED-999).
 *
 * The sim imports use the `@/` alias, which plain Node cannot resolve, so the search lives in
 * tests/unit/spec/find-seed.util.test.ts (skipped unless FIND_SEED is set) and this script runs it under vitest.
 * Output: tests/e2e/seeds.ts (overwritten) and test-results/find-seed.json (printed below).
 *
 *   node scripts/find-seed.mjs
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const r = spawnSync('npx', ['vitest', 'run', 'tests/unit/spec/find-seed.util.test.ts'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, FIND_SEED: '1' },
});
if (existsSync('test-results/find-seed.json')) {
  const { early, full, fast } = JSON.parse(readFileSync('test-results/find-seed.json', 'utf8'));
  const show = (title, rows) => console.log(`\n${title}\n${rows.map((x) => `  ${JSON.stringify(x)}`).join('\n') || '  (none)'}`);
  show('Earliest Executive deaths (none die before day 40):', early);
  show('Executive arrives with all 5 crew alive:', full);
  show('First waypoint reached within 6 days:', fast);
  console.log('\nWrote tests/e2e/seeds.ts');
}
process.exit(r.status ?? 1);
