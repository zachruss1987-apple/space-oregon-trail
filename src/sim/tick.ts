/** The daily tick: travel.md "Order of operations", steps 1–11. */
import { FINAL_WAYPOINT, PASSING_HELP, SUIT_WEAR_CHANCE, WAYPOINTS, WEATHER, isStation } from '@/content';
import { rollDensity } from './crossing';
import { eventStep } from './events';
import { healthStep, missingStep, newDayContext } from './health';
import { passingHelp, repairBlocker, resolveRepair } from './repair';
import type { Rng } from './rng';
import { cumulativeAt, nextWaypoint } from './route';
import { applySalvage } from './minigame';
import { resolveScan } from './salvage';
import { resolveText } from './text';
import { generateOffers } from './trade';
import { dailyDistance, rationNeed, remainingInSegment } from './travel';
import type { DayKind, GameState, LogEntry, StepResult } from './types';
import { addDays, cloneState, livingCrew, presentCrew, pushLog } from './util';
import { nextWeather } from './weather';

const TRAVEL: DayKind = { kind: 'travel' };
const EPS = 1e-9;

/** Advance one day on a copy of `state`. No-op (empty entries) unless status is 'traveling'. */
export function tick(state: GameState, rng: Rng, day: DayKind = TRAVEL): StepResult {
  const next = cloneState(state);
  const entries: LogEntry[] = [];
  tickInPlace(next, rng, day, entries);
  return { state: next, entries };
}

/** Steps 4: spend the day (distance, scan or repair). Returns Mk covered. */
function spendDay(s: GameState, rng: Rng, day: DayKind, out: LogEntry[]): number {
  switch (day.kind) {
    case 'travel': {
      if (s.delayDays > 0) {
        s.delayDays -= 1;
        pushLog(s, out, 'travel', resolveText(rng, 'events', 'delay', {}, 'A lost day. The ship holds position.'), 'delay');
        return 0;
      }
      const d = Math.min(dailyDistance(s), remainingInSegment(s));
      if (d <= 0) pushLog(s, out, 'travel', resolveText(rng, 'events', 'stuck', {}, 'The ship cannot move today.'), 'stuck');
      return Math.max(0, d);
    }
    case 'rest':
      pushLog(s, out, 'rest', resolveText(rng, 'events', 'rest', {}, 'The crew rests.'), 'rest');
      return 0;
    case 'scan':
      resolveScan(s, rng, out);
      return 0;
    case 'salvage':
      applySalvage(s, day.result, rng, out);
      return 0;
    case 'repair':
      if (repairBlocker(s, day.part) === null) resolveRepair(s, day.part, rng, out);
      return 0;
    case 'wait': {
      const c = s.crossing;
      const left = c?.pilotDaysLeft ?? 0;
      if (c && left > 0) c.pilotDaysLeft = left - 1;
      pushLog(s, out, 'crossing', resolveText(rng, 'ui', 'hazard.pilotWait', { n: left }, 'Waiting for the pilot. {n} days left.'), 'pilot-wait');
      return 0;
    }
  }
}

/** Step 10: waypoint arrival; a hazard sets the pending crossing (density roll), a road station its trade offers. */
function arrivalCheck(s: GameState, rng: Rng, out: LogEntry[]): void {
  const target = WAYPOINTS[s.segment]!;
  if (s.distanceInSegment + EPS < target.mk) return;
  s.distanceInSegment = target.mk;
  s.distanceTotal = cumulativeAt(target.index, s.route);
  s.arrivedAt = target.index;
  s.scansThisSegment = 0;
  pushLog(s, out, 'arrival', resolveText(rng, 'ui', 'arrival.reached', { name: target.name }, 'You have reached {name}.'), target.id);
  if (target.hazard) s.crossing = { waypoint: target.index, density: rollDensity(target, rng), pilotDaysLeft: null };
  if (target.type === 'station') s.station = { waypoint: target.index, offers: generateOffers(s, target.index, rng) };
  if (target.index < FINAL_WAYPOINT) {
    s.segment = nextWaypoint(target.index, s.route);
    s.distanceInSegment = 0;
  }
}

/** Step 11: endings (also run after a crossing resolves). */
export function gameOverCheck(s: GameState, rng: Rng, out: LogEntry[]): void {
  const living = livingCrew(s);
  if (living.length > 0 && presentCrew(s).length === 0) {
    for (const c of living) {
      c.awayDays = 0;
      pushLog(s, out, 'rejoin', resolveText(rng, 'events', 'rejoin', { name: c.name }, '{name} drifted back aboard.'), c.name);
    }
  }
  if (living.length === 0) {
    s.status = 'dead';
    pushLog(s, out, 'gameover', resolveText(rng, 'ui', 'death.allDead', {}, 'There is no one left aboard.'), 'dead');
  } else if (s.arrivedAt === FINAL_WAYPOINT) {
    s.status = 'arrived';
    pushLog(s, out, 'gameover', resolveText(rng, 'ui', 'arrival.final', {}, 'You have arrived at New Willamette.'), 'arrived');
  } else if (s.supplies.drives === 0 && s.strandedDays >= PASSING_HELP.adriftDays) {
    s.status = 'adrift';
    pushLog(s, out, 'gameover', resolveText(rng, 'deaths', 'adrift', {}, 'The ship drifts on, and so does the crew.'), 'adrift');
  }
}

/** Mutating tick used by tick() and applyAction(). */
export function tickInPlace(s: GameState, rng: Rng, day: DayKind, out: LogEntry[]): void {
  if (s.status !== 'traveling') return;
  if (day.kind === 'travel' && s.arrivedAt !== null) {
    s.arrivedAt = null;
    s.station = null;
  }
  const parked = s.arrivedAt !== null ? WAYPOINTS[s.arrivedAt]! : null;
  const ctx = newDayContext({ rest: day.kind === 'rest', atStation: parked !== null && isStation(parked) });

  // 1. Calendar.
  s.day += 1;
  s.date = addDays(s.date, 1);
  // 2. Weather.
  const before = s.weather;
  s.weather = nextWeather(rng, s.weather, s.window, s.segment, s.date);
  if (s.weather !== before) {
    pushLog(s, out, 'weather', resolveText(rng, 'events', `weather.${s.weather}`, {}, `Weather: ${WEATHER[s.weather].name}.`), s.weather);
  }
  // 3. Passing help.
  passingHelp(s, rng, out);
  // 4. Distance / day action, then stalled drives count down.
  const dist = spendDay(s, rng, day, out);
  s.offlineDrives = s.offlineDrives.map((d) => d - 1).filter((d) => d > 0);
  s.distanceInSegment += dist;
  s.distanceTotal += dist;
  ctx.moving = dist > 0;
  ctx.overburnDay = ctx.moving && s.thrust === 'overburn';
  s.consecutiveOverburn = ctx.overburnDay ? s.consecutiveOverburn + 1 : 0;
  // 5. Rations.
  const need = rationNeed(s);
  ctx.starving = s.supplies.rations < need;
  s.supplies.rations = Math.max(0, s.supplies.rations - need);
  s.consecutiveLowRations = s.rations === 'full' ? 0 : s.consecutiveLowRations + 1;
  if (ctx.starving) pushLog(s, out, 'starving', resolveText(rng, 'events', 'starving', {}, 'The crew is starving.'), 'starving');
  // 6. Suit wear.
  if (WEATHER[s.weather].radiation && s.supplies.suits > 0 && rng.chance(SUIT_WEAR_CHANCE)) {
    s.supplies.suits -= 1;
    pushLog(s, out, 'suit', resolveText(rng, 'events', 'suit_wear', {}, 'An EVA suit was ruined by the radiation.'), 'suit_wear');
  }
  // 7–8. Health, then drifting crew.
  healthStep(s, rng, ctx, out);
  missingStep(s, rng, out);
  // 9. Random event; the cargo_shift window closes after the first tick away from a hazard.
  eventStep(s, rng, ctx, out);
  if (s.justCrossedHazard && s.arrivedAt === null) s.justCrossedHazard = false;
  // 10–11.
  if (livingCrew(s).length > 0) arrivalCheck(s, rng, out);
  gameOverCheck(s, rng, out);
}
