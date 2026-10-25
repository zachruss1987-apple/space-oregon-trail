/** M5 save slots: makeSave / parseSave (validation + migration), describeSave, export/import with checksum. */
import { describe, expect, it } from 'vitest';
import { WAYPOINTS } from '@/content';
import { applyAction } from '@/sim/actions';
import { createRng } from '@/sim/rng';
import {
  AUTOSAVE_KEY, EXPORT_PREFIX, describeSave, exportSave, fromBase64, importSave, makeSave, parseSave, resumeSeed, toBase64, type SaveSlot,
} from '@/sim/saves';
import { toJSON } from '@/sim/serialize';
import { STATE_VERSION, type GameState } from '@/sim/types';
import { travelingState } from './helpers';

const NOW = Date.UTC(2026, 9, 25, 12, 0, 0);
const ceres = WAYPOINTS.findIndex((w) => w.name === 'Ceres Depot');

function ship(over: Parameters<typeof travelingState>[0] = {}): GameState {
  const s = travelingState({ day: 42, segment: 5, ...over }, 'engineer');
  s.crew[0]!.name = 'Ezra';
  return s;
}

const ok = (r: ReturnType<typeof parseSave>): { slot: SaveSlot; state: GameState } => {
  if (!r.ok) throw new Error(r.error);
  return r;
};

describe('makeSave / parseSave', () => {
  it('documents the autosave key', () => {
    expect(AUTOSAVE_KEY).toBe('proxima.autosave');
  });

  it('builds the slot metadata from the state', () => {
    const s = ship({ difficulty: 'pathfinder', seed: 'DYSENTERY' });
    const slot = makeSave(s, 'DYSENTERY', NOW);
    expect(slot).toMatchObject({
      version: STATE_VERSION, savedAt: '2026-10-25T12:00:00.000Z', seed: 'DYSENTERY', day: 42, segment: 5,
      profession: 'engineer', difficulty: 'pathfinder', captain: 'Ezra',
    });
    expect(slot.state).toBe(toJSON(s));
    expect(makeSave(ship({ arrivedAt: 4 }), 'X', NOW).segment).toBe(4);
  });

  it('round-trips a mid-crossing state that can still be resolved', () => {
    const s = ship({ crossing: { waypoint: 7, density: 4, pilotDaysLeft: null }, arrivedAt: 7, segment: 8 });
    const r = ok(parseSave(JSON.stringify(makeSave(s, 'S', NOW))));
    expect(r.state).toEqual(s);
    expect(r.slot.savedAt).toBe('2026-10-25T12:00:00.000Z');
    const next = applyAction(r.state, { type: 'cross', method: 'shields' }, createRng(3));
    expect(next.error).toBeUndefined();
  });

  it('migrates an old (v3) slot to v4 spacer', () => {
    const file = JSON.parse(toJSON(ship())) as { version: number; state: Record<string, unknown> };
    file.version = 3;
    file.state['version'] = 3;
    delete file.state['difficulty'];
    const old = { version: 3, savedAt: 'then', seed: 'OLD', day: 42, segment: 5, profession: 'engineer', state: JSON.stringify(file) };
    const r = ok(parseSave(JSON.stringify(old)));
    expect(r.state.difficulty).toBe('spacer');
    expect(r.slot).toMatchObject({ version: 4, difficulty: 'spacer', seed: 'OLD', savedAt: 'then', captain: 'Ezra' });
  });

  it('rejects missing, malformed or invalid saves with a message', () => {
    const bad = [
      null, '', '{nope', '[]', '42', JSON.stringify({ seed: 'x' }), JSON.stringify({ state: '{}' }),
      JSON.stringify({ state: JSON.stringify({ version: 99, state: {} }) }),
      JSON.stringify({ state: toJSON({ ...ship(), profession: 'pirate' } as unknown as GameState) }),
    ];
    for (const b of bad) {
      const r = parseSave(b);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.length).toBeGreaterThan(0);
    }
  });

  it('falls back to the state seed and an empty savedAt when the slot lacks them', () => {
    const r = ok(parseSave(JSON.stringify({ state: toJSON(ship({ seed: 'FROMSTATE' })) })));
    expect(r.slot.seed).toBe('FROMSTATE');
    expect(r.slot.savedAt).toBe('');
  });
});

describe('describeSave', () => {
  it('reads like the menu line', () => {
    expect(ceres).toBeGreaterThan(0);
    expect(describeSave(makeSave(ship({ segment: ceres }), 'S', NOW))).toBe("Ezra's crew, day 42, near Ceres Depot, Engineer");
    expect(describeSave(makeSave(travelingState({ day: 3, segment: 1 }, 'farmer'), 'S', NOW))).toMatch(/day 3, near Lunar Debris Ring, Farmer$/);
  });

  it('copes with odd metadata', () => {
    const slot = { ...makeSave(ship(), 'S', NOW), segment: 99, captain: '' };
    expect(describeSave(slot)).toBe("Your crew, day 42, near Independence Station, Engineer");
  });
});

describe('resumeSeed', () => {
  it('is deterministic per seed and day', () => {
    const a = makeSave(ship(), 'S', NOW);
    expect(resumeSeed(a)).toBe(resumeSeed({ ...a }));
    expect(resumeSeed(a)).not.toBe(resumeSeed({ ...a, day: 43 }));
  });
});

describe('export / import', () => {
  it('base64 handles UTF-8 and every padding length', () => {
    for (const t of ['', 'a', 'ab', 'abc', 'Mattie — “fine” ✓', JSON.stringify({ x: [1, 2] })]) expect(fromBase64(toBase64(t))).toBe(t);
    expect(toBase64('ab')).toBe('YWI=');
    expect(fromBase64('abc')).toBeNull();
    expect(fromBase64('ab!=')).toBeNull();
    expect(fromBase64('/w==')).toBeNull();
  });

  it('round-trips an exported slot (whitespace and line breaks tolerated)', () => {
    const s = ship({ difficulty: 'greenhorn' });
    s.log.push({ day: 42, kind: 'info', text: 'Mattie says — “careful.”' });
    const slot = makeSave(s, 'SEED', NOW);
    const text = exportSave(slot);
    expect(text.startsWith(`${EXPORT_PREFIX}.`)).toBe(true);
    const wrapped = text.replace(/(.{60})/g, '$1\n  ');
    const r = ok(importSave(wrapped));
    expect(r.state).toEqual(s);
    expect(r.slot).toEqual(slot);
  });

  it('rejects tampered or foreign input', () => {
    const text = exportSave(makeSave(ship(), 'SEED', NOW));
    const [prefix, payload, sum] = text.split('.') as [string, string, string];
    const flip = (str: string, i: number): string => str.slice(0, i) + (str[i] === 'A' ? 'B' : 'A') + str.slice(i + 1);
    expect(importSave(`${prefix}.${flip(payload, 10)}.${sum}`)).toMatchObject({ ok: false, error: expect.stringMatching(/checksum/) });
    expect(importSave(`${prefix}.${payload}.${flip(sum, 0)}`)).toMatchObject({ ok: false });
    expect(importSave(`OTHER.${payload}.${sum}`)).toMatchObject({ ok: false, error: expect.stringMatching(/Not a Proxima/) });
    expect(importSave('hello')).toMatchObject({ ok: false });
    // A forged payload with a matching checksum still has to be valid base64 and a valid save.
    const forge = (p: string): string => `${prefix}.${p}.${exportSaveSum(p)}`;
    expect(importSave(forge('@@@@'))).toMatchObject({ ok: false, error: expect.stringMatching(/corrupted/) });
    expect(importSave(forge(toBase64('{"state":"nope"}')))).toMatchObject({ ok: false });
  });
});

/** Recompute the checksum the way exportSave does (FNV-1a of "PROXIMA1:<payload>"). */
function exportSaveSum(payload: string): string {
  let h = 2166136261;
  const t = `${EXPORT_PREFIX}:${payload}`;
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
