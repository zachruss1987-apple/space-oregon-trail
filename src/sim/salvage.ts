/** Scan for salvage, M1 auto-resolve (travel.md), plus spare-find helpers. */
import { ITEMS, PART_NAMES, SALVAGE, SPARE_CAP, SPARE_KEYS, type SupplyKey } from '@/content';
import type { Rng } from './rng';
import { resolveText } from './text';
import type { GameState, LogEntry } from './types';
import { pushLog, roll } from './util';

const SPARE_PART = { plates: 'hull', pumps: 'pump', gyros: 'gyro' } as const;

/** Display name for {item}: "rations", "EVA suits", "drone charges", ... */
export function supplyLabel(key: SupplyKey): string {
  const name = ITEMS[key].name;
  return name.startsWith('EVA') ? name : name.charAt(0).toLowerCase() + name.slice(1);
}

/** Add one random spare type; returns the part name, or null if that type is at its cap. */
export function randomSpareFind(state: GameState, rng: Rng): string | null {
  const key = rng.pick(SPARE_KEYS);
  if (state.supplies[key] >= SPARE_CAP) return null;
  state.supplies[key] += 1;
  return PART_NAMES[SPARE_PART[key]];
}

/** Can the ship scan today? */
export function canScan(state: GameState): boolean {
  return state.status === 'traveling' && state.supplies.charges >= SALVAGE.charges;
}

/**
 * Resolve one scan (consumes 5 charges). Returns rations gained. `penalty` > 0 is a skipped mini-game (minigames.md):
 * logs `info/skipped` first, rolls d100 - penalty (min 1), and with fewer than 5 charges spends them all and finds nothing.
 */
export function resolveScan(state: GameState, rng: Rng, out: LogEntry[], penalty = 0): number {
  if (penalty > 0) {
    pushLog(state, out, 'info', resolveText(rng, 'events', 'info.skipped', {}, 'The run was abandoned. It cost extra.'), 'skipped');
  }
  const short = state.supplies.charges < SALVAGE.charges;
  state.supplies.charges = Math.max(0, state.supplies.charges - SALVAGE.charges);
  state.scansThisSegment += 1;
  if (penalty > 0 && short) {
    pushLog(state, out, 'scan', resolveText(rng, 'events', 'scan.nothing', {}, 'The drones found nothing worth hauling.'), 'nothing');
    return 0;
  }
  const halve = state.scansThisSegment >= SALVAGE.halveFromScan;
  const d100 = Math.max(1, rng.int(1, 100) - penalty);
  let rations = 0;
  if (d100 <= SALVAGE.nothingMax) {
    pushLog(state, out, 'scan', resolveText(rng, 'events', 'scan.nothing', {}, 'The drones found nothing worth hauling.'), 'nothing');
    return 0;
  }
  if (d100 > SALVAGE.largeMax) {
    const part = randomSpareFind(state, rng);
    if (part) {
      pushLog(state, out, 'scan', resolveText(rng, 'events', 'scan.part', { item: part }, 'The drones hauled in a spare {item}.'), 'part');
      return 0;
    }
  }
  rations = roll(rng, d100 <= SALVAGE.smallMax ? SALVAGE.smallRange : SALVAGE.largeRange);
  if (halve) rations = Math.floor(rations / 2);
  state.supplies.rations += rations;
  pushLog(state, out, 'scan', resolveText(rng, 'events', 'scan.rations', { n: rations }, 'The drones salvaged {n} rations.'), 'rations');
  return rations;
}
