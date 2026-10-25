/** Versioned save format: toJSON/fromJSON round-trip. */
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

/** Parse a save string. Throws on bad JSON, wrong version, or missing fields. */
export function fromJSON(json: string): GameState {
  const file = JSON.parse(json) as Partial<SaveFile> | null;
  if (!file || typeof file !== 'object') throw new Error('Save is not an object');
  if (file.version !== STATE_VERSION) throw new Error(`Unsupported save version: ${String(file.version)}`);
  const state = file.state;
  if (!state || typeof state !== 'object') throw new Error('Save has no state');
  for (const key of REQUIRED) {
    if (!(key in state)) throw new Error(`Save is missing field: ${key}`);
  }
  if (!Array.isArray(state.crew) || state.crew.length === 0) throw new Error('Save has no crew');
  return state;
}
