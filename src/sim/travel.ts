/** Distance and ration formulas (travel.md "Distance", "Rations"). */
import { DAMAGE_FACTOR, DRIVE_FACTOR, MASS, PROFESSIONS, RATIONS, THRUST, WAYPOINTS, WEATHER, type RationId } from '@/content';
import type { GameState } from './types';
import { presentCrew, workingDrives } from './util';

/** driveFactor for a count of working drives. */
export function driveFactor(working: number): number {
  return DRIVE_FACTOR[Math.min(Math.max(0, working), DRIVE_FACTOR.length - 1)]!;
}

/** massFactor from rations carried (continuous, capped at −15%). */
export function massFactor(rations: number): number {
  return 1 - Math.min(MASS.cap, (MASS.perThousand * Math.max(0, rations - MASS.threshold)) / 1000);
}

/** damageFactor from broken installed parts. */
export function damageFactor(state: GameState): number {
  if (state.broken.pump) return DAMAGE_FACTOR.pump;
  if (state.broken.hull) return DAMAGE_FACTOR.hull;
  return 1;
}

/** Mk the ship would cover on a moving day today, unclamped. */
export function dailyDistance(state: GameState): number {
  return (
    THRUST[state.thrust].mkPerDay *
    driveFactor(workingDrives(state)) *
    WEATHER[state.weather].speed *
    massFactor(state.supplies.rations) *
    damageFactor(state)
  );
}

/** Mk left in the current segment. */
export function remainingInSegment(state: GameState): number {
  return Math.max(0, WAYPOINTS[state.segment]!.mk - state.distanceInSegment);
}

/** Daily ration need for present crew at a setting (Farmer: floor × rationFactor, min 1). */
export function rationNeed(state: GameState, setting: RationId = state.rations): number {
  const present = presentCrew(state).length;
  if (present === 0) return 0;
  const need = present * RATIONS[setting].perCrew;
  const factor = PROFESSIONS[state.profession].rationFactor;
  return factor === 1 ? need : Math.max(1, Math.floor(need * factor));
}

/** floor(rations / need) at a setting; Infinity when nobody eats. */
export function daysOfRations(state: GameState, setting: RationId = state.rations): number {
  const need = rationNeed(state, setting);
  return need === 0 ? Infinity : Math.floor(state.supplies.rations / need);
}
