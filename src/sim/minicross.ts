/** M3 crossing mini-games applied to the sim (minigames.md): Debris Threading and the Flare Belt Finale. */
import { HAZARD, MINIGAME, PART_NAMES, SPARE_CAP, SPARE_KEYS, WAYPOINTS } from '@/content';
import { isFlareBelt } from './crossing';
import { applyOutcome, logClear, outcomeFor } from './hazard';
import { damageCrew, gainCondition, isSuited, killCrew, newDayContext } from './health';
import { resultError } from './minigame';
import type { Rng } from './rng';
import { supplyLabel } from './salvage';
import { resolveText, type TextVars } from './text';
import type { CrossMethod, FlareResult, GameState, LogEntry, ThreadingResult } from './types';
import { isFlareSeason, pctLoss, presentCrew, pushLog, roll } from './util';

const TH = MINIGAME.threading;
const FL = MINIGAME.flare;

/** Why a crossing result cannot be applied (method, location, shape), or null. Call after crossBlocker. */
export function crossResultBlocker(state: GameState, method: CrossMethod, result: unknown): string | null {
  if (method !== 'thread') return 'Only Thread it is a mini-game.';
  const flare = isFlareBelt(WAYPOINTS[state.crossing!.waypoint]!);
  return resultError(result, flare ? 'flare' : 'threading');
}

/**
 * Debris Threading (mutates): replaces the incident draw. 0 hits: `threading` / `clean`, the bonus pick, `hazard` /
 * `clear`. Else `threading` / `hit`, then per hit (at most 4) a d100 severity (+5 at density ≥ 4; rolls 1–2 capped at
 * 95) and that outcome's picks. Several Scraped results cost one delay day. Sets justCrossedHazard.
 */
export function applyThreading(s: GameState, result: ThreadingResult, rng: Rng, out: LogEntry[]): void {
  const c = s.crossing!;
  s.justCrossedHazard = true;
  if (result.hits === 0) {
    pushLog(s, out, 'threading', resolveText(rng, 'events', 'threading.clean', {}, 'Clean thread. Not a scratch.'), 'clean');
    if (result.bonus === 'health') {
      for (const m of presentCrew(s)) m.health = Math.min(100, m.health + TH.bonusHealth);
    } else if (result.bonus === 'rations') {
      s.supplies.rations += TH.bonusRations;
    }
    logClear(s, rng, out);
    return;
  }
  pushLog(s, out, 'threading', resolveText(rng, 'events', 'threading.hit', { n: result.hits, hits: result.hits }, '{n} hits.'), 'hit');
  const densityBonus = c.density >= HAZARD.densitySeverityFrom ? HAZARD.densitySeverity : 0;
  const delayBefore = s.delayDays;
  const ctx = newDayContext();
  const rolls = Math.min(result.hits, TH.maxRolls);
  for (let i = 0; i < rolls; i++) {
    const cap = i < TH.cappedRolls ? TH.cap : 100;
    applyOutcome(s, outcomeFor(Math.max(1, Math.min(cap, rng.int(1, 100) + densityBonus))), rng, out, ctx);
  }
  s.delayDays = Math.min(s.delayDays, delayBefore + 1);
}

/** One Flare Belt hit (d100 + 10 in flare season, cap 100): scorch / burn / damage / radiation. */
function flareHit(s: GameState, rng: Rng, out: LogEntry[], ctx: ReturnType<typeof newDayContext>): void {
  const log = (id: string, vars: TextVars, fallback: string): void =>
    pushLog(s, out, 'flare', resolveText(rng, 'events', `flare.${id}`, vars, fallback), id);
  const d100 = Math.min(100, rng.int(1, 100) + (isFlareSeason(s.date) ? FL.seasonBonus : 0));
  if (d100 <= FL.scorchMax) {
    const keys = FL.scorchKeys.filter((k) => s.supplies[k] > 0);
    if (keys.length === 0) {
      log('scorch', { n: 0, item: 'cargo' }, 'A flare cooked the hold. {n} {item} came out looking toasted.');
      return;
    }
    const key = rng.pick(keys);
    const n = pctLoss(s.supplies[key], roll(rng, FL.scorchPct));
    s.supplies[key] -= n;
    log('scorch', { n, item: supplyLabel(key) }, 'A flare cooked the hold. {n} {item} came out looking toasted.');
    return;
  }
  const crew = presentCrew(s);
  if (d100 <= FL.burnMax) {
    if (crew.length === 0) return;
    const victim = rng.pick(crew);
    const dmg = isSuited(s, victim) ? FL.burnDamageSuited : FL.burnDamage;
    log('burn', { name: victim.name }, '{name} was singed by a flare.');
    damageCrew(s, victim, dmg, 'hazard', rng, out);
    return;
  }
  if (d100 <= FL.damageMax) {
    const part = rng.weighted(HAZARD.damageWeights);
    s.broken[part] = true;
    log('damage', { item: PART_NAMES[part] }, 'A flare hit the ship and your {item} is broken.');
    return;
  }
  const unsuited = crew.filter((m) => !isSuited(s, m));
  if (unsuited.length > 0) {
    const victim = rng.pick(unsuited);
    log('radiation', { name: victim.name }, 'A flare soaked {name} in radiation.');
    if (gainCondition(s, victim, 'radiation-sickness', rng, ctx, out)) return;
  }
  if (crew.length === 0) return;
  const victim = rng.pick(crew);
  if (unsuited.length === 0) log('radiation', { name: victim.name }, 'A flare soaked {name} in radiation.');
  damageCrew(s, victim, FL.radiationFallbackDamage, 'hazard', rng, out);
}

/** Crash (5 hits): a random present crew member dies, rations/suits/charges lose 50%, one of each spare held, hull breaks. */
function flareCrash(s: GameState, rng: Rng, out: LogEntry[]): void {
  const crew = presentCrew(s);
  const victim = crew.length > 0 ? rng.pick(crew) : null;
  for (const k of FL.crashLossKeys) s.supplies[k] -= Math.floor(s.supplies[k] / 2);
  for (const k of SPARE_KEYS) if (s.supplies[k] > 0) s.supplies[k] = Math.min(SPARE_CAP, s.supplies[k]) - 1;
  s.broken.hull = true;
  pushLog(s, out, 'flare', resolveText(rng, 'events', 'flare.crash', { name: victim?.name ?? 'nobody' }, 'Five hits. The Flare Belt took {name}.'), 'crash');
  if (victim) killCrew(s, victim, 'hazard', rng, out);
}

/**
 * Flare Belt Finale (mutates): replaces the M2 roll. 0 hits: `flare` / `clean` and `rodeTheWind = true`; 1–4: one
 * flareHit per hit in order; 5: crash. Sets justCrossedHazard.
 */
export function applyFlare(s: GameState, result: FlareResult, rng: Rng, out: LogEntry[]): void {
  s.justCrossedHazard = true;
  if (result.hits === 0) {
    s.rodeTheWind = true;
    pushLog(s, out, 'flare', resolveText(rng, 'events', 'flare.clean', {}, 'Rode the wind. Not one arc touched you.'), 'clean');
    return;
  }
  if (result.hits >= FL.crashHits) {
    flareCrash(s, rng, out);
    return;
  }
  const ctx = newDayContext();
  for (let i = 0; i < result.hits; i++) flareHit(s, rng, out, ctx);
}
