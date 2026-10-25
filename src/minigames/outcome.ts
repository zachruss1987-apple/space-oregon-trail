/**
 * How a mini-game ends up as a sim intent (minigames.md "Reference policy" table). One place for the three paths:
 * played (`result`), skipped from the pause menu (auto-resolve with the penalty), or auto-resolve (no scene, no penalty).
 */
import { session } from '@/game/session';
import { applyAction, newlyDead, type Intent, type MiniGameKind, type MiniGameResult } from '@/sim';

/** What a run produced. */
export type MiniGameOutcome = { result: MiniGameResult } | { skipped: true } | { auto: true };

/**
 * The intent for an outcome. Salvage: `salvage` with result / `skipped` (scan d100 - 10) / bare (the 5-charge scan).
 * Threading and Flare dispatch `cross thread` (with `result`, or bare for auto-resolve); their skip variants need sim
 * support first (T-029/T-031: add `skipped` to the cross intent, then map it here).
 */
export function outcomeIntent(kind: MiniGameKind, outcome: MiniGameOutcome): Intent {
  if (kind === 'salvage') {
    if ('result' in outcome) return { type: 'salvage', result: outcome.result as Extract<MiniGameResult, { kind: 'salvage' }> };
    return 'skipped' in outcome ? { type: 'salvage', skipped: true } : { type: 'salvage' };
  }
  if ('result' in outcome) {
    return { type: 'cross', method: 'thread', result: outcome.result as Extract<MiniGameResult, { kind: 'threading' | 'flare' }> };
  }
  if ('skipped' in outcome) throw new Error(`Skip for ${kind} needs the sim's skip variant (minigames.md).`);
  return { type: 'cross', method: 'thread' };
}

/** Scene key for each mini-game (`body[data-scene]`). */
export const MINIGAME_SCENES = { salvage: 'Salvage', threading: 'Threading', flare: 'Flare' } as const satisfies Record<MiniGameKind, string>;

/** Apply an outcome to the live run (session); the scene returned to shows `session.pendingDay`. Returns a refusal or null. */
export function dispatchOutcome(kind: MiniGameKind, outcome: MiniGameOutcome): string | null {
  const before = session.state;
  if (!before) return 'No run in progress.';
  const r = applyAction(before, outcomeIntent(kind, outcome), session.rng);
  if (r.error) return r.error;
  session.state = r.state;
  session.pendingDay = { entries: r.entries, dead: newlyDead(before, r.state) };
  return null;
}
