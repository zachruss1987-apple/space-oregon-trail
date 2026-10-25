/** Random event engine: eligibility, weights, cadence guard, effects (docs/design/events.md). */
import {
  CARGO_SHIFT_KEYS, EVENT_CHANCE, EVENT_CHANCE_REST, EVENT_LIST, EVENT_MODS, EVENTS, ILLNESS_MODS, ILLNESS_POOL,
  ILLNESS_WEIGHT_BY_HEALTH, LOSABLE_KEYS, LOSS_COOLDOWN_DAYS, PROFESSIONS, QUIET_DAY_CHANCE,
  type ConditionId, type EventId, type EventSpec, type SupplyKey,
} from '@/content';
import { damageCrew, gainCondition, killCrew, type DayContext } from './health';
import type { Rng } from './rng';
import { randomSpareFind, supplyLabel } from './salvage';
import { resolveText, type TextVars } from './text';
import type { GameState, LogEntry } from './types';
import { difficultySpec, generalHealth, hasRoom, pctLoss, presentCrew, pushLog, roll, workingDrives } from './util';

function anyQty(state: GameState, keys: readonly SupplyKey[]): boolean {
  return keys.some((k) => state.supplies[k] > 0);
}

function roomFor(state: GameState, ctx: DayContext, id?: ConditionId): boolean {
  return presentCrew(state).some((c) => !ctx.newToday.has(state.crew.indexOf(c)) && hasRoom(c, id));
}

function meetsRequirement(spec: EventSpec, state: GameState, ctx: DayContext): boolean {
  switch (spec.requires) {
    case undefined: return true;
    case 'room': return roomFor(state, ctx);
    case 'lossable': return anyQty(state, LOSABLE_KEYS);
    case 'drive': return state.supplies.drives >= 1;
    case 'workingDrive': return workingDrives(state) >= 1;
    case 'hullOk': return !state.broken.hull;
    case 'pumpOk': return !state.broken.pump;
    case 'gyroOk': return !state.broken.gyro;
    case 'twoPresent': return presentCrew(state).length >= 2;
    case 'justCrossed': return state.justCrossedHazard && state.arrivedAt === null && anyQty(state, CARGO_SHIFT_KEYS);
  }
}

/** Effective weight of an event today (0 = not eligible). */
export function eventWeight(spec: EventSpec, state: GameState, ctx: DayContext): number {
  if (spec.minSegment !== undefined && state.segment < spec.minSegment) return 0;
  if (spec.maxSegment !== undefined && state.segment > spec.maxSegment) return 0;
  if (!meetsRequirement(spec, state, ctx)) return 0;
  if (spec.category === 'loss' && state.day < state.eventCooldownUntilDay && state.thrust !== 'overburn' && state.rations !== 'paste') return 0;
  let w = spec.id === 'illness' ? ILLNESS_WEIGHT_BY_HEALTH[generalHealth(state)] : spec.weight;
  if (spec.category === 'loss') w *= difficultySpec(state.difficulty).lossWeight;
  w *= spec.weatherMult?.[state.weather] ?? 1;
  if (spec.id === 'lost_lane' && state.broken.gyro) w *= EVENT_MODS.lostLaneGyroBroken;
  if (spec.id === 'drive_failure') {
    if (state.thrust === 'overburn') w *= EVENT_MODS.driveFailureOverburn;
    w *= PROFESSIONS[state.profession].driveFailureWeight;
  }
  return w;
}

/** Illness pool weight for a condition today. */
export function illnessWeight(id: ConditionId, base: number, state: GameState): number {
  let w = base;
  if (id === 'space-dysentery') {
    if (state.rations === 'paste') w *= ILLNESS_MODS.dysenteryPaste;
    if (state.day <= state.badRecyclerUntilDay) w *= EVENT_MODS.badRecyclerDysenteryMult;
  }
  if (id === 'hull-mold-fever' && state.segment >= ILLNESS_MODS.moldFeverFromSegment) w *= ILLNESS_MODS.moldFeverMult;
  if (id === 'cryo-fever' && ['Poor', 'Very poor'].includes(generalHealth(state))) w *= ILLNESS_MODS.cryoPoorMult;
  if (id === 'scurvy' && state.consecutiveLowRations < ILLNESS_MODS.scurvyMinLowRationDays) w = 0;
  if (id === 'micrometeorite-puncture' && !ILLNESS_MODS.punctureWeather.includes(state.weather)) w = 0;
  return w;
}

function logEvent(state: GameState, rng: Rng, out: LogEntry[], key: string, vars: TextVars, id: string = key): void {
  pushLog(state, out, 'event', resolveText(rng, 'events', key, vars), id);
}

function quiet(state: GameState, rng: Rng, out: LogEntry[]): void {
  pushLog(state, out, 'quiet', resolveText(rng, 'events', 'quiet_day'), 'quiet_day');
}

function loseSome(state: GameState, rng: Rng, keys: readonly SupplyKey[], pct: readonly [number, number]): { key: SupplyKey; n: number } {
  const key = rng.pick(keys.filter((k) => state.supplies[k] > 0));
  const n = pctLoss(state.supplies[key], roll(rng, pct));
  state.supplies[key] -= n;
  return { key, n };
}

function illness(state: GameState, rng: Rng, ctx: DayContext, out: LogEntry[]): void {
  const pool = ILLNESS_POOL.map((e) => ({ item: e.condition, weight: illnessWeight(e.condition, e.weight, state) }));
  if (pool.every((e) => e.weight <= 0)) return quiet(state, rng, out);
  const id = rng.weighted(pool);
  const victims = presentCrew(state).filter((c) => !ctx.newToday.has(state.crew.indexOf(c)) && hasRoom(c, id));
  if (victims.length === 0) return quiet(state, rng, out);
  gainCondition(state, rng.pick(victims), id, rng, ctx, out);
}

/** Apply one event's effect. Exported for tests. */
export function applyEvent(id: EventId, state: GameState, rng: Rng, ctx: DayContext, out: LogEntry[]): void {
  const spec = EVENTS[id];
  const s = state.supplies;
  switch (id) {
    case 'illness': return illness(state, rng, ctx, out);
    case 'pirates':
    case 'cargo_shift': {
      const { key, n } = loseSome(state, rng, id === 'pirates' ? LOSABLE_KEYS : CARGO_SHIFT_KEYS, spec.range!);
      return logEvent(state, rng, out, id, { n, item: supplyLabel(key) });
    }
    case 'lost_lane':
    case 'drive_stall': {
      const n = roll(rng, spec.range!);
      if (id === 'lost_lane') state.delayDays += n;
      else state.offlineDrives.push(n);
      return logEvent(state, rng, out, id, { n });
    }
    case 'drive_failure':
      if (workingDrives(state) === 0) state.offlineDrives.pop();
      s.drives -= 1;
      return logEvent(state, rng, out, id, { n: s.drives });
    case 'hull_puncture': state.broken.hull = true; return logEvent(state, rng, out, id, {});
    case 'pump_failure': state.broken.pump = true; return logEvent(state, rng, out, id, {});
    case 'gyro_failure': state.broken.gyro = true; return logEvent(state, rng, out, id, {});
    case 'hull_fire': {
      const n = pctLoss(s.rations, roll(rng, spec.range!));
      s.rations -= n;
      s.suits = Math.max(0, s.suits - EVENT_MODS.hullFireSuits);
      const victim = rng.pick(presentCrew(state));
      logEvent(state, rng, out, id, { n, name: victim.name, item: supplyLabel('rations') });
      return damageCrew(state, victim, EVENT_MODS.hullFireDamage, 'hull_fire', rng, out);
    }
    case 'crew_eva_drift': {
      const victim = rng.pick(presentCrew(state));
      if (rng.chance(EVENT_MODS.driftNeverReturn)) return killCrew(state, victim, 'drift', rng, out);
      victim.awayDays = roll(rng, spec.range!);
      return logEvent(state, rng, out, id, { n: victim.awayDays, name: victim.name });
    }
    case 'bad_recycler':
      state.badRecyclerUntilDay = state.day + EVENT_MODS.badRecyclerDays;
      logEvent(state, rng, out, id, {});
      for (const c of presentCrew(state)) damageCrew(state, c, EVENT_MODS.badRecyclerDamage, null, rng, out);
      return;
    case 'derelict': return derelict(state, rng, out);
    case 'algae_bloom':
    case 'belter_help': {
      const factor = id === 'algae_bloom' ? PROFESSIONS[state.profession].algaeFactor : 1;
      const n = Math.floor(roll(rng, spec.range!) * factor);
      s.rations += n;
      return logEvent(state, rng, out, id, { n, item: supplyLabel('rations') });
    }
  }
}

function derelict(state: GameState, rng: Rng, out: LogEntry[]): void {
  const m = EVENT_MODS;
  if (rng.chance(m.derelictNothing)) return logEvent(state, rng, out, 'derelict_nothing', {}, 'derelict');
  const kind = rng.weighted([
    { item: 'rations', weight: m.derelictRations },
    { item: 'spare', weight: m.derelictSpare },
    { item: 'suits', weight: m.derelictSuits },
  ] as const);
  if (kind === 'suits') {
    const n = roll(rng, m.derelictSuitRange);
    state.supplies.suits += n;
    return logEvent(state, rng, out, 'derelict_suits', { n, item: supplyLabel('suits') }, 'derelict');
  }
  if (kind === 'spare') {
    const part = randomSpareFind(state, rng);
    if (part) return logEvent(state, rng, out, 'derelict_part', { n: 1, item: part }, 'derelict');
  }
  const n = roll(rng, m.derelictRationRange);
  state.supplies.rations += n;
  logEvent(state, rng, out, 'derelict_rations', { n, item: supplyLabel('rations') }, 'derelict');
}

/** Travel step 9: at most one event; loss events start the cooldown; else maybe a quiet line. */
export function eventStep(state: GameState, rng: Rng, ctx: DayContext, out: LogEntry[]): EventId | null {
  if (presentCrew(state).length === 0) return null;
  if (!rng.chance((ctx.rest ? EVENT_CHANCE_REST : EVENT_CHANCE) * difficultySpec(state.difficulty).eventChance)) {
    if (rng.chance(QUIET_DAY_CHANCE)) quiet(state, rng, out);
    return null;
  }
  const candidates = EVENT_LIST.map((spec) => ({ item: spec.id, weight: eventWeight(spec, state, ctx) })).filter((c) => c.weight > 0);
  if (candidates.length === 0) return null;
  const id = rng.weighted(candidates);
  if (EVENTS[id].category === 'loss') state.eventCooldownUntilDay = state.day + LOSS_COOLDOWN_DAYS;
  applyEvent(id, state, rng, ctx, out);
  return id;
}
