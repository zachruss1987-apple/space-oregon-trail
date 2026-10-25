import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readAutosave, readHighScores, resumeScene, storeAutosave, syncAutosave, writeHighScores } from '@/game/saveStore';
import { AUTOSAVE_KEY, createGame, createRng, depart, HIGHSCORES_KEY, insertHighScore, makeSave, policyShop, type GameState } from '@/sim';

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

function traveling(): GameState {
  const rng = createRng(7);
  return depart(policyShop(createGame({ profession: 'engineer', window: 1, crewNames: ['Ezra'] }, rng)), rng).state;
}

describe('resumeScene (T-040)', () => {
  it('opens Hazard with a pending crossing, Station when a station is open, else Travel', () => {
    const s = traveling();
    expect(resumeScene(s)).toBe('Travel');
    expect(resumeScene({ ...s, crossing: { waypoint: 3, density: 2, pilotDaysLeft: null } } as unknown as GameState)).toBe('Hazard');
    expect(resumeScene({ ...s, arrivedAt: 2, station: { waypoint: 2, offers: [] } })).toBe('Station');
    expect(resumeScene({ ...s, arrivedAt: null, station: { waypoint: 2, offers: [] } })).toBe('Travel');
  });
});

describe('autosave storage glue (T-040)', () => {
  let store: Storage;
  beforeEach(() => {
    store = memoryStorage();
    vi.stubGlobal('localStorage', store);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('writes while traveling, keeps it through the store phase, clears it on any ending', () => {
    const s = traveling();
    syncAutosave(s, 'SEED', 0);
    const saved = readAutosave();
    expect(saved.ok && saved.slot.seed).toBe('SEED');
    expect(saved.ok && saved.state.day).toBe(s.day);
    syncAutosave({ ...s, status: 'store' }, 'SEED', 0);
    expect(store.getItem(AUTOSAVE_KEY)).not.toBeNull();
    syncAutosave(null, 'SEED', 0);
    expect(store.getItem(AUTOSAVE_KEY)).not.toBeNull();
    for (const status of ['arrived', 'dead', 'adrift'] as const) {
      syncAutosave(s, 'SEED', 0);
      syncAutosave({ ...s, status }, 'SEED', 0);
      expect(store.getItem(AUTOSAVE_KEY), status).toBeNull();
    }
  });

  it('readAutosave refuses garbage and finished journeys', () => {
    expect(readAutosave().ok).toBe(false);
    storeAutosave('{nope');
    expect(readAutosave().ok).toBe(false);
    storeAutosave(JSON.stringify(makeSave({ ...traveling(), status: 'dead' }, 'X', 0)));
    expect(readAutosave().ok).toBe(false);
  });

  it('survives a throwing storage', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('full'); }, removeItem: () => { throw new Error('x'); } });
    expect(() => syncAutosave(traveling(), 'S', 0)).not.toThrow();
    expect(readAutosave().ok).toBe(false);
    expect(readHighScores()).toHaveLength(10);
  });

  it('high scores: defaults when empty, an inserted row persists', () => {
    const list = readHighScores();
    expect(list).toHaveLength(10);
    const { list: next, index } = insertHighScore(list, { name: 'Zed', profession: 'farmer', score: 99999, days: 120, date: '2184-07-01', difficulty: 'pathfinder' });
    expect(index).toBe(0);
    writeHighScores(next);
    expect(store.getItem(HIGHSCORES_KEY)).toContain('Zed');
    expect(readHighScores()[0]).toMatchObject({ name: 'Zed', difficulty: 'pathfinder' });
  });
});
