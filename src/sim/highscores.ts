/**
 * High-score table (scoring.md "High scores"): pure helpers. Storage stays in the UI:
 * `localStorage[HIGHSCORES_KEY]` holds `serializeHighScores(list)`; read it back with `loadHighScores(raw)`.
 */
import { DEFAULT_DIFFICULTY, DIFFICULTIES, HIGHSCORE_TEXT, PROFESSIONS, type DifficultyId, type ProfessionId } from '@/content';

/** localStorage key for the table (a JSON array of HighScore). */
export const HIGHSCORES_KEY = 'proxima.highscores';
/** Table size. */
export const HIGHSCORE_MAX = 10;
/** Longest stored name (longer names are trimmed to this). */
export const HIGHSCORE_NAME_MAX = 24;

/** One table row. `date` is the in-game arrival date (ISO YYYY-MM-DD). */
export interface HighScore {
  /** Captain or crew name. */
  name: string;
  /** Profession. */
  profession: ProfessionId;
  /** Final score (computeScore().total). */
  score: number;
  /** Days taken. */
  days: number;
  /** In-game arrival date, ISO. */
  date: string;
  /** Difficulty the run was played on. */
  difficulty: DifficultyId;
}

/** Result of an insertion: the new table and the new row's index (−1 if it did not make the table). */
export interface Insertion {
  list: HighScore[];
  index: number;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** A valid HighScore built from unknown input, or null. Missing difficulty = spacer. */
export function toHighScore(raw: unknown): HighScore | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const name = typeof r['name'] === 'string' ? r['name'].trim().slice(0, HIGHSCORE_NAME_MAX) : '';
  const { profession, score, days, date } = r;
  if (!name || typeof profession !== 'string' || !(profession in PROFESSIONS)) return null;
  if (typeof score !== 'number' || !Number.isFinite(score) || score < 0) return null;
  if (typeof days !== 'number' || !Number.isFinite(days) || days < 0) return null;
  if (typeof date !== 'string' || !ISO.test(date)) return null;
  const d = r['difficulty'];
  const difficulty = typeof d === 'string' && d in DIFFICULTIES ? (d as DifficultyId) : DEFAULT_DIFFICULTY;
  return { name, profession: profession as ProfessionId, score: Math.floor(score), days: Math.floor(days), date, difficulty };
}

/** Ordering: higher score first; ties by earlier date; otherwise keep the existing order (stable sort). */
function compare(a: HighScore, b: HighScore): number {
  if (a.score !== b.score) return b.score - a.score;
  return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
}

const keyOf = (h: HighScore): string => [h.name, h.profession, h.score, h.days, h.date, h.difficulty].join('|');

/** The writer's seeded rows (src/content/text/highscores.json), as spacer runs. */
export function defaultHighScores(): HighScore[] {
  const raw = HIGHSCORE_TEXT['defaults'];
  const rows = Array.isArray(raw) ? raw.map(toHighScore).filter((h): h is HighScore => h !== null) : [];
  return rows.sort(compare).slice(0, HIGHSCORE_MAX);
}

/**
 * The table to show: stored rows (bad JSON or bad rows are ignored) merged with the writer defaults, deduplicated,
 * sorted, top ten. Pass `null` when nothing is stored.
 */
export function loadHighScores(json: string | null): HighScore[] {
  let stored: unknown = [];
  if (json !== null) {
    try {
      stored = JSON.parse(json);
    } catch {
      stored = [];
    }
  }
  const rows = Array.isArray(stored) ? stored.map(toHighScore).filter((h): h is HighScore => h !== null) : [];
  const seen = new Set<string>();
  const merged: HighScore[] = [];
  for (const h of [...rows, ...defaultHighScores()]) {
    const k = keyOf(h);
    if (seen.has(k)) continue;
    seen.add(k);
    merged.push(h);
  }
  return merged.sort(compare).slice(0, HIGHSCORE_MAX);
}

/** Insert a row: returns the new list (max ten, sorted) and its index, or −1 if it did not place. Never mutates. */
export function insertHighScore(list: readonly HighScore[], entry: HighScore): Insertion {
  const row = toHighScore(entry);
  if (!row) return { list: [...list], index: -1 };
  const sorted = [...list].sort(compare);
  let at = sorted.findIndex((h) => compare(row, h) < 0);
  if (at === -1) at = sorted.length;
  sorted.splice(at, 0, row);
  const next = sorted.slice(0, HIGHSCORE_MAX);
  return { list: next, index: at < HIGHSCORE_MAX ? at : -1 };
}

/** Would a run with this score (arriving on `date`; default: after every row) make the table? Zero never qualifies. */
export function qualifies(list: readonly HighScore[], score: number, date = '9999-12-31'): boolean {
  if (!(score > 0)) return false;
  if (list.length < HIGHSCORE_MAX) return true;
  const probe: HighScore = { name: '?', profession: 'executive', score, days: 0, date, difficulty: DEFAULT_DIFFICULTY };
  return insertHighScore(list, probe).index !== -1;
}

/** JSON for `localStorage[HIGHSCORES_KEY]`. */
export function serializeHighScores(list: readonly HighScore[]): string {
  return JSON.stringify(list.map((h) => ({ name: h.name, profession: h.profession, score: h.score, days: h.days, date: h.date, difficulty: h.difficulty })));
}
