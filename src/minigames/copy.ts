/** Mini-game copy. Every key lives in ui.json (`minigame.*`, `hazard.*`, `title.*`) and resolves through `t`. */
import { session } from '@/game/session';
import { resolveText } from '@/sim';
import { list, t } from '@/ui/copy';

/** One line of mini-game copy from ui.json. */
export function mt(key: string, vars: Readonly<Record<string, string | number>> = {}): string {
  return t(key, vars);
}

/** A ui.json string list (falls back to a single `mt` line). */
export function mlist(key: string): string[] {
  const l = list(key);
  return l.length > 0 ? l : [mt(key)];
}

/** A line from events.json (e.g. `salvage.overweight`), cosmetic rng. */
export function eventLine(key: string, vars: Readonly<Record<string, string | number>>, fallback: string): string {
  return resolveText(session.uiRng, 'events', key, vars, fallback);
}
