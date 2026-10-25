/** M3 mini-game results (minigames.md): validation, the derived mini-game seed, and Salvage Run application. */
import { MINIGAME, PART_NAMES, SALVAGE, SPARE_CAP, SPARE_KEYS, type SpareKey } from '@/content';
import { damageCrew } from './health';
import { itemPhrase } from './market';
import { seedFromString, type Rng } from './rng';
import { resolveText } from './text';
import type { GameState, LogEntry, MiniGameKind, SalvageResult } from './types';
import { presentCrew, pushLog } from './util';

const SPARE_PART = { plates: 'hull', pumps: 'pump', gyros: 'gyro' } as const;
const SV = MINIGAME.salvage;

/** Seed for a mini-game scene's own Rng: `seedFromString(`${seed}:${kind}:${day}`)`. Never touches the main Rng. */
export function minigameSeed(state: Pick<GameState, 'seed' | 'day'>, kind: MiniGameKind): number {
  return seedFromString(`${state.seed ?? ''}:${kind}:${state.day}`);
}

const KEYS: Readonly<Record<MiniGameKind, { required: readonly string[]; optional: readonly string[] }>> = {
  salvage: { required: ['kind', 'rations', 'plates', 'pumps', 'gyros', 'chargesUsed', 'crewHurt'], optional: ['droneWrecked'] },
  threading: { required: ['kind', 'hits', 'bonus'], optional: [] },
  flare: { required: ['kind', 'hits'], optional: [] },
};

function intIn(v: unknown, max: number): boolean {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max;
}

/** Carry weight of a salvage haul in units. */
export function haulUnits(r: Pick<SalvageResult, 'rations' | 'plates' | 'pumps' | 'gyros'>): number {
  return r.rations + SV.partUnits * (r.plates + r.pumps + r.gyros);
}

/**
 * Shape check against the minigames.md JSON schemas plus the cross-field rules (carry limit, bonus only when clean).
 * Returns a refusal message or null. State-dependent limits (charges held) are checked by the intent blockers.
 */
export function resultError(result: unknown, kind: MiniGameKind): string | null {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return 'Invalid mini-game result.';
  const r = result as Record<string, unknown>;
  if (r['kind'] !== kind) return 'Wrong mini-game result.';
  const { required, optional } = KEYS[kind];
  if (required.some((k) => !(k in r)) || Object.keys(r).some((k) => !required.includes(k) && !optional.includes(k))) {
    return 'Invalid mini-game result.';
  }
  switch (kind) {
    case 'salvage': {
      const ok = intIn(r['rations'], SV.carryLimit) && SPARE_KEYS.every((k) => intIn(r[k], SPARE_CAP))
        && intIn(r['chargesUsed'], SV.maxCharges) && intIn(r['crewHurt'], SV.maxCrewHurt)
        && (r['droneWrecked'] === undefined || typeof r['droneWrecked'] === 'boolean');
      if (!ok) return 'Invalid mini-game result.';
      return haulUnits(r as unknown as SalvageResult) > SV.carryLimit ? 'Over the carry limit.' : null;
    }
    case 'threading':
      if (!intIn(r['hits'], MINIGAME.threading.maxHits) || ![null, 'health', 'rations'].includes(r['bonus'] as string | null)) {
        return 'Invalid mini-game result.';
      }
      return r['bonus'] !== null && r['hits'] !== 0 ? 'A bonus needs a clean run.' : null;
    case 'flare':
      return intIn(r['hits'], MINIGAME.flare.crashHits) ? null : 'Invalid mini-game result.';
  }
}

/** Why a salvage result cannot be applied now (shape, then charges), or null. */
export function salvageResultBlocker(state: GameState, result: unknown): string | null {
  const err = resultError(result, 'salvage');
  if (err) return err;
  if (state.supplies.charges < 1) return 'No drone charges.';
  const used = (result as SalvageResult).chargesUsed;
  return used > Math.min(state.supplies.charges, SV.maxCharges) ? 'More charges used than the hold had.' : null;
}

/** Prose list of found spares: "a hull plate and 2 nav gyros" ('' when none). */
export function partsPhrase(found: Record<SpareKey, number>): string {
  const items = SPARE_KEYS.filter((k) => found[k] > 0)
    .map((k) => (found[k] === 1 ? `a ${PART_NAMES[SPARE_PART[k]]}` : itemPhrase(k, found[k])));
  return items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * Apply a validated Salvage Run result in tick step 4 (mutates): spend charges, count the scan (3rd+ in a segment
 * halves rations), clamp parts to the hold cap, add the haul, then one main-Rng victim draw per hot chunk (−5 health).
 * Logs `salvage` (`wrecked` prefix, then `haul` / `nothing`, then `hot` per hurt crew). Returns rations gained.
 */
export function applySalvage(state: GameState, result: SalvageResult, rng: Rng, out: LogEntry[]): number {
  const s = state.supplies;
  s.charges -= Math.min(result.chargesUsed, s.charges, SV.maxCharges);
  state.scansThisSegment += 1;
  let rations = result.rations;
  if (state.scansThisSegment >= SALVAGE.halveFromScan) rations = Math.floor(rations / 2);
  const found = { plates: 0, pumps: 0, gyros: 0 } as Record<SpareKey, number>;
  for (const k of SPARE_KEYS) {
    found[k] = Math.max(0, Math.min(result[k], SPARE_CAP - s[k]));
    s[k] += found[k];
  }
  s.rations += rations;
  if (result.droneWrecked) {
    pushLog(state, out, 'salvage', resolveText(rng, 'events', 'salvage.wrecked', {}, 'The drone was wrecked out there.'), 'wrecked');
  }
  const parts = partsPhrase(found);
  if (rations === 0 && parts === '') {
    pushLog(state, out, 'salvage', resolveText(rng, 'events', 'salvage.nothing', {}, 'Nothing worth towing.'), 'nothing');
  } else {
    const key = parts === '' ? 'salvage.haulRations' : rations === 0 ? 'salvage.haulParts' : 'salvage.haul';
    const fallback = parts === '' ? 'The drone towed in {n} rations.' : rations === 0 ? 'The drone towed in {parts}.' : 'The drone towed in {n} rations and {parts}.';
    pushLog(state, out, 'salvage', resolveText(rng, 'events', key, { n: rations, parts }, fallback), 'haul');
  }
  for (let i = 0; i < Math.min(result.crewHurt, SV.maxCrewHurt); i++) {
    const crew = presentCrew(state);
    if (crew.length === 0) break;
    const victim = rng.pick(crew);
    pushLog(state, out, 'salvage', resolveText(rng, 'events', 'salvage.hot', { name: victim.name }, '{name} handled something warm.'), 'hot');
    damageCrew(state, victim, SV.hotDamage, null, rng, out);
  }
  return rations;
}
