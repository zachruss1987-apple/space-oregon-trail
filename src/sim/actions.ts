/** Player intents → state changes (Travel menu). Refusals return `error` and consume no day. */
import { FINAL_WAYPOINT, PART_NAMES, RATIONS, REST, THRUST } from '@/content';
import { repairBlocker } from './repair';
import type { Rng } from './rng';
import { canScan } from './salvage';
import { tickInPlace } from './tick';
import type { GameState, Intent, LogEntry, StepResult } from './types';
import { cloneState, pushLog } from './util';

function refuse(state: GameState, error: string): StepResult {
  return { state, entries: [], error };
}

/** Why an intent cannot run now, or null. */
export function intentBlocker(state: GameState, intent: Intent): string | null {
  if (state.status !== 'traveling') return 'The journey is over.';
  switch (intent.type) {
    case 'continue':
    case 'setThrust':
    case 'setRations':
      return null;
    case 'rest':
      return Number.isInteger(intent.days) && intent.days >= REST.minDays && intent.days <= REST.maxDays
        ? null
        : `Rest for ${REST.minDays} to ${REST.maxDays} days.`;
    case 'repair':
      return repairBlocker(state, intent.part);
    case 'scan':
      if (state.arrivedAt === FINAL_WAYPOINT) return 'Nothing left to salvage.';
      return canScan(state) ? null : 'No drone charges.';
  }
}

/** Apply a player intent. Day-consuming intents run ordinary ticks (rest stops early on a death). */
export function applyAction(state: GameState, intent: Intent, rng: Rng): StepResult {
  const error = intentBlocker(state, intent);
  if (error) return refuse(state, error);
  const s = cloneState(state);
  const out: LogEntry[] = [];
  switch (intent.type) {
    case 'continue':
      tickInPlace(s, rng, { kind: 'travel' }, out);
      break;
    case 'rest':
      for (let i = 0; i < intent.days; i++) {
        const deathsBefore = s.deaths;
        tickInPlace(s, rng, { kind: 'rest' }, out);
        if (s.deaths > deathsBefore || s.status !== 'traveling') break;
      }
      break;
    case 'setThrust':
      s.thrust = intent.thrust;
      pushLog(s, out, 'setting', `Thrust set to ${THRUST[intent.thrust].name}.`, intent.thrust);
      break;
    case 'setRations':
      s.rations = intent.rations;
      pushLog(s, out, 'setting', `Rations set to ${RATIONS[intent.rations].name}.`, intent.rations);
      break;
    case 'repair':
      pushLog(s, out, 'repair', `You set to work on the ${PART_NAMES[intent.part]}.`, intent.part);
      tickInPlace(s, rng, { kind: 'repair', part: intent.part }, out);
      break;
    case 'scan':
      tickInPlace(s, rng, { kind: 'scan' }, out);
      break;
  }
  return { state: s, entries: out };
}
