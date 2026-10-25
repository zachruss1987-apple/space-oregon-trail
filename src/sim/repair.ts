/** Attempt repair (travel.md "Repairs") and passing help (step 3). */
import { CONDITIONS, PART_NAMES, PART_PRIORITY, PART_SPARE, PASSING_HELP, PROFESSIONS, type PartId } from '@/content';
import type { Rng } from './rng';
import { resolveText } from './text';
import type { GameState, LogEntry } from './types';
import { presentCrew, pushLog } from './util';

/** Broken installed parts, in priority order. */
export function brokenParts(state: GameState): PartId[] {
  return PART_PRIORITY.filter((p) => state.broken[p]);
}

/** Spares in the hold for a part. */
export function sparesFor(state: GameState, part: PartId): number {
  return state.supplies[PART_SPARE[part]];
}

/** Why a repair cannot be attempted, or null if it can. */
export function repairBlocker(state: GameState, part: PartId): string | null {
  if (!state.broken[part]) return 'Nothing is broken.';
  if (sparesFor(state, part) < 1) return 'No spare.';
  return null;
}

/** Repair success chance (0–1) including the decompression-injury penalty. */
export function repairChance(state: GameState): number {
  const base = PROFESSIONS[state.profession].repairSuccess;
  const penalty = presentCrew(state).some((c) => c.conditions.some((x) => x.id === 'decompression-injury'))
    ? (CONDITIONS['decompression-injury'].repairPenalty ?? 0) / 100
    : 0;
  return Math.max(0, base - penalty);
}

/** Resolve a repair attempt (assumes repairBlocker is null). Returns true on success. */
export function resolveRepair(state: GameState, part: PartId, rng: Rng, out: LogEntry[]): boolean {
  const spare = PART_SPARE[part];
  const item = PART_NAMES[part];
  if (rng.chance(repairChance(state))) {
    state.broken[part] = false;
    state.supplies[spare] -= 1;
    pushLog(state, out, 'repair', resolveText(rng, 'events', 'repair.success', { item }, 'You repaired the {item}.'), part);
    return true;
  }
  const lost = rng.chance(PROFESSIONS[state.profession].spareLossOnFail);
  if (lost) state.supplies[spare] -= 1;
  const key = lost ? 'repair.failLost' : 'repair.fail';
  const fallback = lost ? 'The repair failed and the spare {item} is ruined.' : 'The repair failed. The {item} is still broken.';
  pushLog(state, out, 'repair', resolveText(rng, 'events', key, { item }, fallback), part);
  return false;
}

/** Travel step 3: passing crews fix a part with no spare, or give a stranded ship a drive. */
export function passingHelp(state: GameState, rng: Rng, out: LogEntry[]): void {
  const needy = brokenParts(state).filter((p) => sparesFor(state, p) === 0);
  if (needy.length > 0 && rng.chance(PASSING_HELP.chance)) {
    const part = needy[0]!;
    state.broken[part] = false;
    pushLog(state, out, 'help', resolveText(rng, 'events', 'help.part', { item: PART_NAMES[part] }, 'A passing crew fixed your {item}.'), part);
  }
  if (state.supplies.drives === 0) {
    if (rng.chance(PASSING_HELP.chance)) {
      state.supplies.drives = 1;
      state.strandedDays = 0;
      pushLog(state, out, 'help', resolveText(rng, 'events', 'help.drive', {}, 'A passing hauler spared you an ion drive.'), 'drive');
    } else {
      state.strandedDays += 1;
    }
  }
}
