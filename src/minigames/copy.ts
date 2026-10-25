/**
 * Mini-game copy. Reads ui.json `minigame.*` through `t`; UNWRITTEN holds the keys ui.json does not have yet
 * (writer follow-up: add them under the same dotted keys, then delete them here).
 */
import { session } from '@/game/session';
import { resolveText } from '@/sim';
import { list, t } from '@/ui/copy';

export const UNWRITTEN: Readonly<Record<string, string>> = {
  'minigame.common.fire': 'FIRE',
  'minigame.common.pauseIcon': 'II',
  'minigame.common.countdownN': '{n}',
  'minigame.salvage.resultRations': 'Haul: {n} rations.',
  'minigame.salvage.resultParts': 'Haul: {parts}.',
  'minigame.salvage.scrap': 'Scrap. Lovely.',
  'minigame.salvage.snap': 'Tumbler. The cable snapped.',
  'minigame.salvage.hit': 'Tumbler hit!',
  'minigame.salvage.hot': 'Something warm in the hold.',
  'minigame.salvage.blip': '?',
  'minigame.threading.hit': 'Rock! The hull rang like a bell.',
  'minigame.flare.hit': 'Flare hit! That took the paint off.',
  'minigame.flare.resultHits': 'Flare strikes: {hits} of 5.',
  'hazard.option.ride': 'Ride the solar wind',
  'hazard.option.payTug': 'Pay the tug',
  'hazard.desc.ride': 'Fly the flares yourself. Five hits and the Belt wins.',
  'title.miniAuto': 'Mini-games: Auto-resolve. (M to switch)',
  'title.miniPlay': 'Mini-games: Play. (M to switch)',
};

/** One line of mini-game copy (ui.json first, then UNWRITTEN). */
export function mt(key: string, vars: Readonly<Record<string, string | number>> = {}): string {
  const fallback = UNWRITTEN[key];
  return fallback === undefined ? t(key, vars) : resolveText(session.uiRng, 'ui', key, vars, fallback);
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
