/** Load budget (M4 acceptance, "loads in < 3 s"): main + phaser chunks stay under 1.8 MB gzip. Skipped when dist/ is absent. */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

const ASSETS = join(process.cwd(), 'dist', 'assets');
const BUDGET = 1.8 * 1024 * 1024;

describe('production bundle size', () => {
  it.skipIf(!existsSync(ASSETS))('JS chunks total under 1.8 MB gzip', () => {
    const js = readdirSync(ASSETS).filter((f) => f.endsWith('.js'));
    expect(js.length).toBeGreaterThan(0);
    const sizes = js.map((f) => ({ f, gz: gzipSync(readFileSync(join(ASSETS, f))).length }));
    const total = sizes.reduce((n, s) => n + s.gz, 0);
    console.log('bundle gzip bytes:', JSON.stringify(sizes), 'total', total);
    expect(total).toBeLessThan(BUDGET);
  });
});
