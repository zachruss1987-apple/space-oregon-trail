/** Salvage Run tables applied to a run: difficulty by trail phase and weather, and the 100-unit tow (minigames.md). */
import { DEBRIS, DEBRIS_ORDER, MINIGAME, SALVAGE_RUN, type DebrisId, type WeatherId } from '@/content';
import type { SalvageResult } from '@/sim';

const SV = MINIGAME.salvage;

/** Rations and parts gathered so far. */
export interface Haul { rations: number; plates: number; pumps: number; gyros: number }

/** Difficulty for one run. `weights` are rescaled to sum to 100; `blipRange` is set in ion fog. */
export interface SalvageParams {
  population: number;
  drift: number;
  weights: { item: DebrisId; weight: number }[];
  blipRange: number | null;
}

/** Target population, drift and spawn weights for the next waypoint `segment` and today's weather. */
export function salvageParams(segment: number, weather: WeatherId): SalvageParams {
  const phase = SALVAGE_RUN.phases.find((p) => segment <= p.maxSegment) ?? SALVAGE_RUN.phases[SALVAGE_RUN.phases.length - 1]!;
  const w = SALVAGE_RUN.weather[weather] ?? {};
  const raw = DEBRIS_ORDER.map((item) => {
    const spec = DEBRIS[item];
    let weight = spec.weight;
    if (spec.part) weight *= phase.partWeight;
    if (item === 'tumbler') weight *= w.tumbler ?? 1;
    if (item === 'hot') weight *= w.hot ?? 1;
    return { item, weight };
  });
  const total = raw.reduce((s, r) => s + r.weight, 0);
  return {
    population: phase.population,
    drift: phase.drift * (w.drift ?? 1),
    weights: raw.map((r) => ({ item: r.item, weight: (r.weight * 100) / total })),
    blipRange: w.blipRange ?? null,
  };
}

/**
 * The tow back: if the haul weighs more than the carry limit, keep gyros, then pumps, then plates (each while it fits),
 * then fill the rest with rations. Returns what was kept and the rations left behind.
 */
export function towHaul(haul: Haul): { kept: Haul; dropped: number } {
  let room = SV.carryLimit;
  const kept: Haul = { rations: 0, plates: 0, pumps: 0, gyros: 0 };
  for (const k of ['gyros', 'pumps', 'plates'] as const) {
    for (let i = 0; i < haul[k] && room >= SV.partUnits; i++) {
      kept[k] += 1;
      room -= SV.partUnits;
    }
  }
  kept.rations = Math.min(haul.rations, room);
  return { kept, dropped: haul.rations - kept.rations };
}

/** Build the SalvageResult: halve everything on a wreck (floor), then the carry clamp. `overweight` = rations dropped. */
export function finishHaul(haul: Haul, run: { wrecked: boolean; chargesUsed: number; crewHurt: number }): { result: SalvageResult; overweight: number } {
  const h = run.wrecked
    ? { rations: Math.floor(haul.rations / 2), plates: Math.floor(haul.plates / 2), pumps: Math.floor(haul.pumps / 2), gyros: Math.floor(haul.gyros / 2) }
    : haul;
  const { kept, dropped } = towHaul(h);
  const result: SalvageResult = {
    kind: 'salvage',
    ...kept,
    chargesUsed: Math.min(run.chargesUsed, SV.maxCharges),
    crewHurt: Math.min(run.crewHurt, SV.maxCrewHurt),
  };
  if (run.wrecked) result.droneWrecked = true;
  return { result, overweight: dropped };
}
