/**
 * Balance harness driver (a utility, not a spec). Skipped unless BALANCE is set; run it with `node scripts/balance.mjs`
 * (plain Node cannot resolve the `@/` alias, so it runs under vitest, like find-seed). Reads BALANCE_ARGS (JSON), writes the
 * Markdown to BALANCE_OUT and the raw cells to BALANCE_JSON.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { describe, it } from 'vitest';
import { formatMarkdown, runMatrix } from '@/sim/balance';

const write = (file: string | undefined, text: string): void => {
  if (!file) return;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
};

describe.skipIf(!process.env.BALANCE)('balance harness', () => {
  it('runs the matrix', () => {
    const a = JSON.parse(process.env.BALANCE_ARGS ?? '{}');
    const cells = runMatrix(a);
    write(process.env.BALANCE_OUT, formatMarkdown(cells, { seeds: a.seeds, difficulty: a.difficulty }) + '\n');
    write(process.env.BALANCE_JSON, JSON.stringify(cells, null, 2));
  }, 3_600_000);
});
