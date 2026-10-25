/**
 * Save slots (M5 "Save/load"): pure helpers. Storage stays in the UI:
 * `localStorage[AUTOSAVE_KEY]` holds `JSON.stringify(makeSave(state, seed, Date.now()))`, written after every applied
 * action while `state.status === 'traveling'` and removed on any ending. Export/import is a checksummed base64 string.
 */
import { DIFFICULTIES, PROFESSIONS, WAYPOINTS } from '@/content';
import { seedFromString } from './rng';
import { fromJSON, toJSON } from './serialize';
import { textLine } from './text';
import { STATE_VERSION, type Difficulty, type GameState, type ProfessionId } from './types';

/** localStorage key for the single autosave slot (a JSON SaveSlot). */
export const AUTOSAVE_KEY = 'proxima.autosave';
/** Prefix of an exported save string. */
export const EXPORT_PREFIX = 'PROXIMA1';

/** One save slot: menu metadata plus the full state (a `toJSON` string). */
export interface SaveSlot {
  /** State format version (STATE_VERSION when written). */
  version: number;
  /** Real-world save time, ISO (from the `now` the UI passes). */
  savedAt: string;
  /** Run seed label (the `?seed=` value). */
  seed: string;
  /** Day of the run. */
  day: number;
  /** Waypoint index the ship is parked at, or heading for. */
  segment: number;
  /** Profession. */
  profession: ProfessionId;
  /** Difficulty. */
  difficulty: Difficulty;
  /** Captain's name (crew[0]) for the menu line. */
  captain: string;
  /** The state, as `toJSON(state)`. */
  state: string;
}

/** parseSave / importSave result. */
export type ParsedSave = { ok: true; slot: SaveSlot; state: GameState } | { ok: false; error: string };

/** Build a slot. `now` is epoch ms (the UI passes Date.now(); the sim never reads the clock). */
export function makeSave(state: GameState, seed: string, now: number): SaveSlot {
  return {
    version: STATE_VERSION,
    savedAt: new Date(now).toISOString(),
    seed,
    day: state.day,
    segment: state.arrivedAt ?? state.segment,
    profession: state.profession,
    difficulty: state.difficulty,
    captain: state.crew[0]?.name ?? '',
    state: toJSON(state),
  };
}

/** Validate a slot JSON string and migrate its state (fromJSON); metadata is rebuilt from the migrated state. */
export function parseSave(json: string | null): ParsedSave {
  if (json === null || json === '') return { ok: false, error: 'No save.' };
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: 'Save is not valid JSON.' };
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'Save is not an object.' };
  const r = raw as Record<string, unknown>;
  if (typeof r['state'] !== 'string') return { ok: false, error: 'Save has no state.' };
  let state: GameState;
  try {
    state = fromJSON(r['state']);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Save is unreadable.' };
  }
  if (!(state.profession in PROFESSIONS) || !(state.difficulty in DIFFICULTIES)) return { ok: false, error: 'Save is unreadable.' };
  const seed = typeof r['seed'] === 'string' ? r['seed'] : state.seed;
  const slot = makeSave(state, seed, 0);
  slot.savedAt = typeof r['savedAt'] === 'string' ? r['savedAt'] : '';
  return { ok: true, slot, state };
}

/** Last word of the profession name ("Ship Engineer" → "Engineer"). */
function professionShort(id: ProfessionId): string {
  const name = PROFESSIONS[id]?.name ?? String(id);
  return name.split(' ').pop() ?? name;
}

/** One line for the "Continue journey" menu: "Ezra's crew, day 42, near Ceres Depot, Engineer". */
export function describeSave(slot: SaveSlot): string {
  const place = WAYPOINTS[slot.segment]?.name ?? WAYPOINTS[0]!.name;
  return textLine('ui', 'saves.describe', '{owner} crew, day {day}, near {place}, {profession}', {
    owner: slot.captain ? `${slot.captain}'s` : 'Your', captain: slot.captain, day: slot.day, place, profession: professionShort(slot.profession),
  });
}

/** Main Rng seed for a resumed run (the Rng position is not saved, so a resumed run re-seeds deterministically). */
export function resumeSeed(slot: SaveSlot): number {
  return seedFromString(`${slot.seed}:resume:${slot.day}`);
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** UTF-8 bytes → base64 (no padding issues across browsers/Node; no btoa/Buffer). */
export function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const [a, b, c] = [bytes[i]!, bytes[i + 1], bytes[i + 2]];
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]! + (b === undefined ? '=' : B64[(n >> 6) & 63]!) + (c === undefined ? '=' : B64[n & 63]!);
  }
  return out;
}

/** base64 → UTF-8 text; null on any invalid character, length or encoding. */
export function fromBase64(b64: string): string | null {
  if (b64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(b64)) return null;
  const bytes: number[] = [];
  for (let i = 0; i < b64.length; i += 4) {
    const q = b64.slice(i, i + 4);
    const n = [...q].reduce((acc, ch) => (acc << 6) | (ch === '=' ? 0 : B64.indexOf(ch)), 0);
    bytes.push((n >> 16) & 255);
    if (q[2] !== '=') bytes.push((n >> 8) & 255);
    if (q[3] !== '=') bytes.push(n & 255);
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes));
  } catch {
    return null;
  }
}

const checksum = (payload: string): string => seedFromString(`${EXPORT_PREFIX}:${payload}`).toString(16).padStart(8, '0');

/** Export a slot as `PROXIMA1.<base64 slot JSON>.<8-hex checksum>` (copy/paste safe). */
export function exportSave(slot: SaveSlot): string {
  const payload = toBase64(JSON.stringify(slot));
  return `${EXPORT_PREFIX}.${payload}.${checksum(payload)}`;
}

/** Import an exported string (whitespace ignored). Rejects a wrong prefix, bad base64, a checksum mismatch or a bad save. */
export function importSave(text: string): ParsedSave {
  const parts = text.replace(/\s+/g, '').split('.');
  if (parts.length !== 3 || parts[0] !== EXPORT_PREFIX) return { ok: false, error: 'Not a Proxima Trail save.' };
  const [, payload, sum] = parts as [string, string, string];
  if (checksum(payload) !== sum.toLowerCase()) return { ok: false, error: 'Save checksum does not match.' };
  const json = fromBase64(payload);
  if (json === null) return { ok: false, error: 'Save is corrupted.' };
  return parseSave(json);
}
