/** M5 high scores: defaults merge, validation, insertion order, qualification, serialization. */
import { describe, expect, it } from 'vitest';
import highscoresJson from '@/content/text/highscores.json';
import {
  HIGHSCORE_MAX, HIGHSCORES_KEY, defaultHighScores, insertHighScore, loadHighScores, qualifies, serializeHighScores, toHighScore, type HighScore,
} from '@/sim/highscores';

const row = (over: Partial<HighScore> = {}): HighScore =>
  ({ name: 'Ezra', profession: 'engineer', score: 4000, days: 150, date: '2184-09-01', difficulty: 'spacer', ...over });

describe('defaults and loading', () => {
  it('documents the storage key', () => {
    expect(HIGHSCORES_KEY).toBe('proxima.highscores');
  });

  it('seeds the writer defaults as spacer runs, sorted descending', () => {
    const d = defaultHighScores();
    expect(d).toHaveLength(Math.min(HIGHSCORE_MAX, highscoresJson.defaults.length));
    expect(d.every((h) => h.difficulty === 'spacer')).toBe(true);
    expect(d.map((h) => h.score)).toEqual([...d.map((h) => h.score)].sort((a, b) => b - a));
    expect(loadHighScores(null)).toEqual(d);
  });

  it('ignores bad JSON, non-arrays and invalid rows', () => {
    const d = defaultHighScores();
    expect(loadHighScores('{oops')).toEqual(d);
    expect(loadHighScores('{"a":1}')).toEqual(d);
    expect(loadHighScores(JSON.stringify([null, 3, { name: '', profession: 'engineer', score: 1, days: 1, date: '2184-01-01' }]))).toEqual(d);
  });

  it('merges stored rows with defaults, deduplicated, top ten', () => {
    const mine = row({ score: 99999 });
    const stored = serializeHighScores(insertHighScore(loadHighScores(null), mine).list);
    const loaded = loadHighScores(stored);
    expect(loaded).toHaveLength(HIGHSCORE_MAX);
    expect(loaded[0]).toEqual(mine);
    expect(new Set(loaded.map((h) => JSON.stringify(h))).size).toBe(loaded.length);
    expect(loadHighScores(serializeHighScores(loaded))).toEqual(loaded);
  });

  it('validates and normalizes rows', () => {
    expect(toHighScore(row())).toEqual(row());
    expect(toHighScore({ ...row(), difficulty: undefined })?.difficulty).toBe('spacer');
    expect(toHighScore({ ...row(), difficulty: 'nightmare' })?.difficulty).toBe('spacer');
    expect(toHighScore(row({ difficulty: 'pathfinder' }))?.difficulty).toBe('pathfinder');
    expect(toHighScore({ ...row(), name: '  A very long crew name that keeps going  ' })?.name).toHaveLength(24);
    expect(toHighScore({ ...row(), score: 12.9, days: 3.7 })).toMatchObject({ score: 12, days: 3 });
    for (const bad of [
      null, 'x', { ...row(), name: 3 }, { ...row(), profession: 'pirate' }, { ...row(), score: -1 }, { ...row(), score: Infinity },
      { ...row(), days: '1' }, { ...row(), days: -2 }, { ...row(), date: '1 Sept' }, { ...row(), date: 20 },
    ]) {
      expect(toHighScore(bad)).toBeNull();
    }
  });
});

describe('insertHighScore', () => {
  it('inserts in descending order and returns the index; never mutates', () => {
    const list = loadHighScores(null);
    const copy = structuredClone(list);
    const r = insertHighScore(list, row({ score: list[2]!.score + 1 }));
    expect(r.index).toBe(2);
    expect(r.list).toHaveLength(HIGHSCORE_MAX);
    expect(r.list[2]!.score).toBe(list[2]!.score + 1);
    expect(r.list[HIGHSCORE_MAX - 1]).toEqual(list[HIGHSCORE_MAX - 2]);
    expect(list).toEqual(copy);
  });

  it('breaks ties by earlier date, then keeps the existing row first', () => {
    const base = [row({ name: 'A', score: 500, date: '2184-09-10' })];
    expect(insertHighScore(base, row({ name: 'B', score: 500, date: '2184-09-01' })).index).toBe(0);
    expect(insertHighScore(base, row({ name: 'C', score: 500, date: '2184-09-20' })).index).toBe(1);
    expect(insertHighScore(base, row({ name: 'D', score: 500, date: '2184-09-10' })).index).toBe(1);
  });

  it('returns -1 when the row misses the table or is invalid', () => {
    const list = loadHighScores(null);
    const low = insertHighScore(list, row({ score: 1 }));
    expect(low.index).toBe(-1);
    expect(low.list).toEqual(list);
    expect(insertHighScore(list, { ...row(), profession: 'pirate' } as unknown as HighScore).index).toBe(-1);
  });

  it('grows a short table up to ten', () => {
    let list: HighScore[] = [];
    for (let i = 0; i < 12; i++) list = insertHighScore(list, row({ name: `N${i}`, score: 100 + i })).list;
    expect(list).toHaveLength(HIGHSCORE_MAX);
    expect(list[0]!.score).toBe(111);
    expect(list[9]!.score).toBe(102);
  });
});

describe('qualifies', () => {
  it('needs a positive score that beats the last row (ties by date)', () => {
    const list = loadHighScores(null);
    const last = list[HIGHSCORE_MAX - 1]!;
    expect(qualifies(list, 0)).toBe(false);
    expect(qualifies([], 0)).toBe(false);
    expect(qualifies([], 1)).toBe(true);
    expect(qualifies(list, last.score + 1)).toBe(true);
    expect(qualifies(list, last.score)).toBe(false);
    expect(qualifies(list, last.score, '2000-01-01')).toBe(true);
    expect(qualifies(list, last.score - 1)).toBe(false);
  });
});

describe('serializeHighScores', () => {
  it('writes only the HighScore fields', () => {
    const json = serializeHighScores([{ ...row(), extra: 1 } as HighScore]);
    expect(JSON.parse(json)).toEqual([row()]);
  });
});
