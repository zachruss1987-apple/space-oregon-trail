/** M1 hazard crossing roll (trail.md "M1 crossing roll"). */
import { HAZARD, INJURY_NO_ROOM_DAMAGE, LOSABLE_KEYS, PART_NAMES, WAYPOINTS, WINDOWS, type Waypoint } from '@/content';
import { damageCrew, gainCondition, killCrew, newDayContext, type DayContext } from './health';
import type { Rng } from './rng';
import { supplyLabel } from './salvage';
import { resolveText, type TextVars } from './text';
import type { GameState, LogEntry } from './types';
import { isFlareSeason, pctLoss, presentCrew, pushLog, roll } from './util';

/** Outcome of a crossing. */
export type CrossingOutcome = 'clear' | 'scraped' | 'cargo' | 'damage' | 'injury' | 'lost';

/** Incident chance in percent for this waypoint today. */
export function incidentChance(state: GameState, w: Waypoint): number {
  if (!w.hazard) return 0;
  let pct = w.hazard.incident;
  const win = WINDOWS[state.window];
  if (win.hazardBonusAt.includes(w.id)) pct += win.hazardBonus;
  if (w.id === HAZARD.flareBeltId && isFlareSeason(state.date)) pct += HAZARD.flareIncidentBonus;
  return pct;
}

/** Severity bonus added to the d100 roll. */
export function severityBonus(state: GameState, w: Waypoint): number {
  let bonus = 0;
  if ((w.hazard?.density ?? 0) >= HAZARD.densitySeverityFrom) bonus += HAZARD.densitySeverity;
  if (w.id === HAZARD.flareBeltId && isFlareSeason(state.date)) bonus += HAZARD.flareSeverityBonus;
  return bonus;
}

/** Map a capped severity to its outcome. */
export function outcomeFor(severity: number): Exclude<CrossingOutcome, 'clear'> {
  if (severity <= HAZARD.scrapeMax) return 'scraped';
  if (severity <= HAZARD.cargoMax) return 'cargo';
  if (severity <= HAZARD.damageMax) return 'damage';
  if (severity <= HAZARD.injuryMax) return 'injury';
  return 'lost';
}

/** Resolve the crossing at waypoint `index` (mutates). Sets justCrossedHazard. */
export function resolveCrossing(state: GameState, index: number, rng: Rng, out: LogEntry[], ctx: DayContext = newDayContext()): CrossingOutcome {
  const w = WAYPOINTS[index]!;
  state.justCrossedHazard = true;
  const log = (o: CrossingOutcome, vars: TextVars, fallback: string): void =>
    pushLog(state, out, 'hazard', resolveText(rng, 'ui', `crossing.${o}`, vars, fallback), o);
  if (!rng.chance(incidentChance(state, w) / 100)) {
    log('clear', {}, 'You made it across.');
    return 'clear';
  }
  const outcome = outcomeFor(Math.min(100, rng.int(1, 100) + severityBonus(state, w)));
  const crew = presentCrew(state);
  switch (outcome) {
    case 'scraped':
      state.delayDays += 1;
      log(outcome, {}, 'You scraped through; you lose a day.');
      break;
    case 'cargo': {
      const keys = LOSABLE_KEYS.filter((k) => state.supplies[k] > 0);
      if (keys.length === 0) {
        log('clear', {}, 'You made it across.');
        return 'clear';
      }
      const key = rng.pick(keys);
      const n = pctLoss(state.supplies[key], roll(rng, HAZARD.cargoPct));
      state.supplies[key] -= n;
      log(outcome, { n, item: supplyLabel(key) }, 'The crossing cost you {n} {item}.');
      break;
    }
    case 'damage': {
      const part = rng.weighted(HAZARD.damageWeights);
      state.broken[part] = true;
      log(outcome, { item: PART_NAMES[part] }, 'Your {item} is broken.');
      break;
    }
    case 'injury': {
      if (crew.length === 0) break;
      const victim = rng.pick(crew);
      log(outcome, { name: victim.name }, '{name} was hurt in the crossing.');
      if (!gainCondition(state, victim, 'decompression-injury', rng, ctx, out)) {
        damageCrew(state, victim, INJURY_NO_ROOM_DAMAGE, 'hazard', rng, out);
      }
      break;
    }
    case 'lost': {
      if (crew.length === 0) break;
      const victim = rng.pick(crew);
      log(outcome, { name: victim.name }, '{name} was lost in the crossing.');
      killCrew(state, victim, 'hazard', rng, out);
      break;
    }
  }
  return outcome;
}
