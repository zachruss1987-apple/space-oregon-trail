/** serialize.ts migrations: hand-stripped v1/v2/v3 save fixtures (tests/unit/sim/fixtures/save-v*.json) load as v4. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fromJSON, toJSON } from '@/sim';
import { STATE_VERSION } from '@/sim/types';

const fixture = (v: number): string => readFileSync(new URL(`./fixtures/save-v${v}.json`, import.meta.url), 'utf8');

describe('save fixtures migrate to the current version', () => {
  it.each([1, 2, 3])('v%i fixture loads as v4 with every later default filled in', (v) => {
    const raw = JSON.parse(fixture(v)) as { version: number; state: Record<string, unknown> };
    expect(raw.version).toBe(v);
    const s = fromJSON(fixture(v));
    expect(STATE_VERSION).toBe(4);
    expect(s.version).toBe(4);
    expect(s.difficulty).toBe('spacer');
    expect(s.crossing).toBeNull();
    expect(s.route).toBe('oort');
    expect(s.station).toBeNull();
    expect(s.seed).toBe(v === 3 ? 'FIX' : '');
    expect(s.rodeTheWind).toBe(false);
    expect(s.crew).toHaveLength(5);
  });

  it('a migrated v1 save re-serializes at v4 and round-trips unchanged', () => {
    const s = fromJSON(fixture(1));
    expect(JSON.parse(toJSON(s)).version).toBe(4);
    expect(fromJSON(toJSON(s))).toEqual(s);
  });

  it('a v1 fixture really lacks the later fields (the fixture is not accidentally current)', () => {
    const raw = JSON.parse(fixture(1)) as { state: Record<string, unknown> };
    for (const k of ['crossing', 'route', 'station', 'difficulty', 'rodeTheWind']) expect(raw.state).not.toHaveProperty(k);
  });
});
