/** Versioned save format: toJSON/fromJSON round-trip, with migrations from older versions. */
import { STATE_VERSION, type GameState } from './types';

/** Envelope written to storage. */
export interface SaveFile {
  /** Format version. */
  version: number;
  /** The state. */
  state: GameState;
}

const REQUIRED: readonly (keyof GameState)[] = [
  'profession', 'window', 'crew', 'credits', 'supplies', 'broken', 'offlineDrives', 'date', 'day', 'segment',
  'distanceInSegment', 'distanceTotal', 'thrust', 'rations', 'weather', 'log', 'status',
];

/** Serialize a state to a JSON string. */
export function toJSON(state: GameState): string {
  const file: SaveFile = { version: STATE_VERSION, state };
  return JSON.stringify(file);
}

/** v1 (M1) → v2 (M2): no pending crossing, route via Oort, no station visit. */
function migrateV1(state: Record<string, unknown>): void {
  state['crossing'] ??= null;
  state['route'] ??= 'oort';
  state['station'] ??= null;
  state['version'] = 2;
}

/** v2 (M2) → v3 (M3): empty seed label (mini-game RNGs still deterministic), no Flare Belt bonus. */
function migrateV2(state: Record<string, unknown>): void {
  state['seed'] ??= '';
  state['rodeTheWind'] ??= false;
  state['version'] = 3;
}

/** v3 (M3/M4) → v4 (M5): difficulty did not exist, so the run was spacer (the baseline numbers). */
function migrateV3(state: Record<string, unknown>): void {
  state['difficulty'] ??= 'spacer';
  state['version'] = 4;
}

const MIGRATIONS: Readonly<Record<number, (s: Record<string, unknown>) => void>> = { 1: migrateV1, 2: migrateV2, 3: migrateV3 };

/** Parse a save string. Migrates older versions; throws on bad JSON, unknown version, or missing fields. */
export function fromJSON(json: string): GameState {
  const file = JSON.parse(json) as Partial<SaveFile> | null;
  if (!file || typeof file !== 'object') throw new Error('Save is not an object');
  let version = file.version;
  if (typeof version !== 'number' || version < 1 || version > STATE_VERSION) {
    throw new Error(`Unsupported save version: ${String(file.version)}`);
  }
  const state = file.state;
  if (!state || typeof state !== 'object') throw new Error('Save has no state');
  for (const key of REQUIRED) {
    if (!(key in state)) throw new Error(`Save is missing field: ${key}`);
  }
  if (!Array.isArray(state.crew) || state.crew.length === 0) throw new Error('Save has no crew');
  while (version < STATE_VERSION) {
    MIGRATIONS[version]!(state as unknown as Record<string, unknown>);
    version++;
  }
  state.version = STATE_VERSION;
  return state;
}
