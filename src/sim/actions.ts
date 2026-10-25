/** Player intents → state changes (Travel, Hazard and Station menus). Refusals return `error` and consume no day. */
import { CROSSING, FINAL_WAYPOINT, PART_NAMES, RATIONS, REST, THRUST, WAYPOINTS } from '@/content';
import { blockedText, crossBlocker, finishCrossing } from './crossing';
import { roadBuy, roadBuyBlocker, sell, sellBlocker } from './market';
import { repairBlocker } from './repair';
import type { Rng } from './rng';
import { chooseRoute, routeBlocker } from './route';
import { canScan } from './salvage';
import { resolveText, textLine } from './text';
import { gameOverCheck, tickInPlace } from './tick';
import { acceptTrade, tradeBlocker } from './trade';
import type { GameState, Intent, LogEntry, StepResult } from './types';
import { cloneState, pushLog } from './util';

function refuse(state: GameState, error: string): StepResult {
  return { state, entries: [], error };
}

/** Continue is refused while a crossing is pending, and at a station with no drive. */
function continueBlocker(state: GameState): string | null {
  if (state.crossing) return blockedText('chooseFirst');
  const parked = state.arrivedAt !== null ? WAYPOINTS[state.arrivedAt] : undefined;
  if (parked?.type === 'station' && state.supplies.drives < 1) {
    return textLine('ui', 'station.leave.noDrive', 'You need at least one ion drive to leave.');
  }
  return null;
}

/** Why an intent cannot run now, or null. */
export function intentBlocker(state: GameState, intent: Intent): string | null {
  if (state.status !== 'traveling') return 'The journey is over.';
  switch (intent.type) {
    case 'continue':
      return continueBlocker(state);
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
    case 'cross':
      return crossBlocker(state, intent.method);
    case 'route':
      return routeBlocker(state);
    case 'buy':
      return roadBuyBlocker(state, intent.item, intent.packs);
    case 'sell':
      return sellBlocker(state, intent.item, intent.packs);
    case 'trade':
      return tradeBlocker(state, intent.offer);
  }
}

/** `cross pilot`: pay once, run the wait days as ticks (stop on a death), then resolve when the wait is over. */
function crossWithPilot(s: GameState, rng: Rng, out: LogEntry[]): void {
  const c = s.crossing!;
  if (c.pilotDaysLeft === null) {
    const wait = WAYPOINTS[c.waypoint]!.hazard!.pilotWait!;
    s.credits = Math.max(0, Math.round((s.credits - CROSSING.pilot.fee) * 100) / 100);
    c.pilotDaysLeft = wait;
    pushLog(s, out, 'crossing', resolveText(rng, 'ui', 'hazard.pilotHire', { n: wait }, 'You send for a Belter pilot. {n} days.'), 'pilot');
  }
  while ((s.crossing?.pilotDaysLeft ?? 0) > 0) {
    const deathsBefore = s.deaths;
    tickInPlace(s, rng, { kind: 'wait' }, out);
    if (s.deaths > deathsBefore || s.status !== 'traveling') return;
  }
  finishCrossing(s, 'pilot', rng, out);
}

/** Apply a player intent. Day-consuming intents run ordinary ticks (rest and pilot waits stop early on a death). */
export function applyAction(state: GameState, intent: Intent, rng: Rng): StepResult {
  const error = intentBlocker(state, intent);
  if (error) return refuse(state, error);
  switch (intent.type) {
    case 'route': return chooseRoute(state, intent.via, rng);
    case 'buy': return roadBuy(state, intent.item, intent.packs);
    case 'sell': return sell(state, intent.item, intent.packs);
    case 'trade': return acceptTrade(state, intent.offer, rng);
    default: break;
  }
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
    case 'cross':
      if (intent.method === 'pilot') crossWithPilot(s, rng, out);
      else finishCrossing(s, intent.method, rng, out);
      if (s.crossing === null && s.status === 'traveling') gameOverCheck(s, rng, out);
      break;
  }
  return { state: s, entries: out };
}
