/** Crew health: daily delta, deaths, condition triggers and progression (docs/design/health.md). */
import {
  CONDITIONS, CONDITION_LIST, DEATH_MULTIPLIERS, EXHAUSTION_AFTER_DAYS, RADIATION_CHANCE, RATIONS, REST,
  STARVING_HEALTH, THRUST, WEATHER, type ConditionId, type DeathCause,
} from '@/content';
import type { Rng } from './rng';
import { resolveText } from './text';
import type { Crew, GameState, LogEntry } from './types';
import { difficultySpec, hasRoom, isPresent, pushLog, roll } from './util';

/** Per-tick facts the health step needs. */
export interface DayContext {
  /** Day spent resting. */
  rest: boolean;
  /** Ship covered distance > 0. */
  moving: boolean;
  /** Ration shortfall today. */
  starving: boolean;
  /** Moving day at Overburn. */
  overburnDay: boolean;
  /** Parked at a station (rest bonus). */
  atStation: boolean;
  /** Crew indices that gained a condition today (max one per day). */
  newToday: Set<number>;
  /** Condition objects gained today (they do not progress until tomorrow). */
  gained: Set<object>;
}

/** A fresh context for one tick. */
export function newDayContext(partial: Partial<DayContext> = {}): DayContext {
  return { rest: false, moving: false, starving: false, overburnDay: false, atStation: false, newToday: new Set(), gained: new Set(), ...partial };
}

/** Is present crew member `c` suited? First `suits` present crew in roster order are. */
export function isSuited(state: GameState, c: Crew): boolean {
  const present = state.crew.filter(isPresent);
  const idx = present.indexOf(c);
  return idx >= 0 && idx < state.supplies.suits;
}

/** Death-chance multiplier for a health value. */
export function deathMultiplier(health: number): number {
  return (DEATH_MULTIPLIERS.find((m) => health >= m.minHealth) ?? DEATH_MULTIPLIERS[DEATH_MULTIPLIERS.length - 1]!).mult;
}

/** Cause when health reaches 0: worst condition (ties: table order), else starvation, else exhaustion. */
export function causeAtZero(c: Crew, starving: boolean): DeathCause {
  let worst: ConditionId | null = null;
  for (const def of CONDITION_LIST) {
    if (!c.conditions.some((x) => x.id === def.id)) continue;
    if (worst === null || def.dailyHealth < CONDITIONS[worst].dailyHealth) worst = def.id;
  }
  return worst ?? (starving ? 'starvation' : 'exhaustion');
}

/** Mark a crew member dead and log it. */
export function killCrew(state: GameState, c: Crew, cause: DeathCause, rng: Rng, out: LogEntry[]): void {
  if (!c.alive) return;
  c.alive = false;
  c.health = 0;
  c.cause = cause;
  c.diedOnDay = state.day;
  c.awayDays = 0;
  c.conditions = [];
  state.deaths += 1;
  const label = cause in CONDITIONS ? CONDITIONS[cause as ConditionId].name : cause.replace('_', ' ');
  pushLog(state, out, 'death', resolveText(rng, 'deaths', cause, { name: c.name }, `{name} has died of ${label}.`), cause);
}

/** Lower health by `amount`; at 0 the crew member dies of `cause` (or the health.md rule if null). */
export function damageCrew(state: GameState, c: Crew, amount: number, cause: DeathCause | null, rng: Rng, out: LogEntry[]): void {
  c.health = Math.max(0, Math.min(100, c.health - amount));
  if (c.health === 0) killCrew(state, c, cause ?? causeAtZero(c, false), rng, out);
}

/** Give a condition if there is room and nothing new today. Returns true if gained. */
export function gainCondition(state: GameState, c: Crew, id: ConditionId, rng: Rng, ctx: DayContext, out: LogEntry[]): boolean {
  const i = state.crew.indexOf(c);
  if (!isPresent(c) || ctx.newToday.has(i) || !hasRoom(c, id)) return false;
  const cond = { id, remaining: roll(rng, CONDITIONS[id].duration), daysActive: 0 };
  c.conditions.push(cond);
  ctx.newToday.add(i);
  ctx.gained.add(cond);
  pushLog(state, out, 'condition', resolveText(rng, 'events', `illness.${id}`, { name: c.name }, `{name} has ${CONDITIONS[id].name}.`), id);
  return true;
}

/** Daily health delta for one present crew member. */
export function dailyDelta(state: GameState, c: Crew, ctx: DayContext): number {
  let delta = ctx.starving ? STARVING_HEALTH : RATIONS[state.rations].health;
  if (ctx.moving) delta += THRUST[state.thrust].health;
  const w = WEATHER[state.weather];
  delta += isSuited(state, c) ? w.healthSuited : w.healthUnsuited;
  for (const cond of c.conditions) delta += CONDITIONS[cond.id].dailyHealth;
  if (ctx.rest) delta += ctx.atStation ? REST.healthStation : REST.health;
  return delta;
}

/** Daily death chance from one condition (base × health multiplier × difficulty). Exported for tests. */
export function deathChanceToday(state: GameState, c: Crew, cond: Crew['conditions'][number]): number {
  const def = CONDITIONS[cond.id];
  let p = def.deathChance;
  if (def.deathDays !== undefined) {
    if (cond.daysActive >= def.deathDays) return 0;
    if (def.deathChanceSuited !== undefined && isSuited(state, c)) p = def.deathChanceSuited;
  }
  return p * deathMultiplier(c.health) * difficultySpec(state.difficulty).illnessDeath;
}

function progress(state: GameState, c: Crew, ctx: DayContext, rng: Rng, out: LogEntry[]): void {
  const kept: Crew['conditions'] = [];
  for (const cond of c.conditions) {
    if (ctx.gained.has(cond)) {
      kept.push(cond);
      continue;
    }
    const def = CONDITIONS[cond.id];
    if (def.untilOffOverburn) cond.remaining = ctx.overburnDay ? def.duration[1] : cond.remaining - 1;
    else cond.remaining -= ctx.rest ? REST.conditionTick : 1;
    if (def.fullRationsCap !== undefined && state.rations === 'full') cond.remaining = Math.min(cond.remaining, def.fullRationsCap);
    cond.daysActive += 1;
    if (cond.remaining > 0) kept.push(cond);
    else pushLog(state, out, 'recover', resolveText(rng, 'events', `recover.${cond.id}`, { name: c.name }, `{name} has recovered from ${def.name}.`), cond.id);
  }
  c.conditions = kept;
}

/** Travel step 7 for every present crew member. */
export function healthStep(state: GameState, rng: Rng, ctx: DayContext, out: LogEntry[]): void {
  state.crew.forEach((c) => {
    if (!isPresent(c)) return;
    c.health = Math.max(0, Math.min(100, c.health + dailyDelta(state, c, ctx)));
    if (c.health === 0) {
      killCrew(state, c, causeAtZero(c, ctx.starving), rng, out);
      return;
    }
    for (const cond of c.conditions) {
      const p = deathChanceToday(state, c, cond);
      if (p > 0 && rng.chance(p)) {
        killCrew(state, c, cond.id, rng, out);
        return;
      }
    }
    if (WEATHER[state.weather].radiation && !isSuited(state, c) && rng.chance(RADIATION_CHANCE)) {
      gainCondition(state, c, 'radiation-sickness', rng, ctx, out);
    }
    if (ctx.overburnDay && state.consecutiveOverburn >= EXHAUSTION_AFTER_DAYS) {
      gainCondition(state, c, 'exhaustion', rng, ctx, out);
    }
    progress(state, c, ctx, rng, out);
  });
}

/** Travel step 8: drifting crew count down and rejoin at 0. */
export function missingStep(state: GameState, rng: Rng, out: LogEntry[]): void {
  for (const c of state.crew) {
    if (!c.alive || c.awayDays === 0) continue;
    c.awayDays -= 1;
    if (c.awayDays === 0) pushLog(state, out, 'rejoin', resolveText(rng, 'events', 'rejoin', { name: c.name }, '{name} drifted back aboard.'), c.name);
  }
}
