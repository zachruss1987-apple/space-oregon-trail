/**
 * Storage glue for M5 saves and high scores (the sim helpers are pure; localStorage lives here). Every access is
 * guarded: private mode or a full quota never breaks a run. See src/sim/README.md "UI contract".
 */
import {
  AUTOSAVE_KEY, HIGHSCORES_KEY, loadHighScores, makeSave, parseSave, serializeHighScores, stationOpen,
  type GameState, type HighScore, type ParsedSave,
} from '@/sim';

/** The scene a resumed (or debug-loaded) run opens in: a pending crossing shows Hazard, an open station Station. */
export type ResumeScene = 'Hazard' | 'Station' | 'Travel';

/** Pure: which scene a traveling state belongs in. */
export function resumeScene(state: GameState): ResumeScene {
  if (state.crossing) return 'Hazard';
  if (stationOpen(state)) return 'Station';
  return 'Travel';
}

const store = (): Storage | undefined => {
  try {
    return globalThis.localStorage ?? undefined;
  } catch {
    return undefined;
  }
};

function read(key: string): string | null {
  try {
    return store()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) store()?.removeItem(key);
    else store()?.setItem(key, value);
  } catch {
    // storage unavailable: the run continues unsaved
  }
}

/** Keep the autosave in step with a state: write while traveling, remove on any ending, leave it otherwise. */
export function syncAutosave(state: GameState | null, seed: string, now: number): void {
  if (!state) return;
  if (state.status === 'traveling') write(AUTOSAVE_KEY, JSON.stringify(makeSave(state, seed, now)));
  else if (state.status !== 'store') write(AUTOSAVE_KEY, null);
}

/** The stored autosave if it parses and is still a journey in progress (else `ok: false`). */
export function readAutosave(): ParsedSave {
  const parsed = parseSave(read(AUTOSAVE_KEY));
  if (parsed.ok && parsed.state.status !== 'traveling') return { ok: false, error: 'No journey in progress.' };
  return parsed;
}

/** Store a raw slot JSON (an imported save) as the autosave. */
export function storeAutosave(slotJson: string): void {
  write(AUTOSAVE_KEY, slotJson);
}

/** The Top Ten: stored rows merged with the writer's defaults. */
export function readHighScores(): HighScore[] {
  return loadHighScores(read(HIGHSCORES_KEY));
}

/** Persist the Top Ten. */
export function writeHighScores(list: readonly HighScore[]): void {
  write(HIGHSCORES_KEY, serializeHighScores(list));
}
