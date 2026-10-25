/** Health conditions. Source: docs/design/health.md ("Conditions"). Table order matters (death-cause ties). */

/** Condition ids, in table order. */
export type ConditionId =
  | 'space-dysentery'
  | 'hull-mold-fever'
  | 'cryo-fever'
  | 'scurvy'
  | 'micrometeorite-puncture'
  | 'radiation-sickness'
  | 'exhaustion'
  | 'decompression-injury';

/** How a condition is acquired. */
export type ConditionTrigger = 'illness' | 'radiation' | 'overburn' | 'hazard';

/** One condition's rule numbers. */
export interface ConditionDef {
  /** Id (also the deaths.json key). */
  id: ConditionId;
  /** Display name. */
  name: string;
  /** Original-game homage. */
  homage: string;
  /** Acquisition route. */
  trigger: ConditionTrigger;
  /** Duration range in days, inclusive. Exhaustion: days off Overburn needed. */
  duration: readonly [number, number];
  /** Daily health while active. */
  dailyHealth: number;
  /** Death chance per day (0–1) before the health multiplier. */
  deathChance: number;
  /** Puncture: the death chance applies only on the first N days (0 = always). */
  deathDays?: number;
  /** Puncture: death chance while suited. */
  deathChanceSuited?: number;
  /** Scurvy: remaining days capped at this while on Full rations. */
  fullRationsCap?: number;
  /** Exhaustion: duration counts consecutive non-Overburn ticks, reset by Overburn. */
  untilOffOverburn?: boolean;
  /** While any present crew has it, repair success −points. */
  repairPenalty?: number;
}

/** Conditions in table order. */
export const CONDITION_LIST: readonly ConditionDef[] = [
  { id: 'space-dysentery', name: 'space dysentery', homage: 'Dysentery', trigger: 'illness', duration: [5, 10], dailyHealth: -4, deathChance: 0.01 },
  { id: 'hull-mold-fever', name: 'hull mold fever', homage: 'Cholera', trigger: 'illness', duration: [4, 8], dailyHealth: -6, deathChance: 0.03 },
  { id: 'cryo-fever', name: 'cryo-fever', homage: 'Typhoid', trigger: 'illness', duration: [7, 14], dailyHealth: -3, deathChance: 0.02 },
  { id: 'scurvy', name: 'scurvy', homage: 'Measles', trigger: 'illness', duration: [6, 12], dailyHealth: -2, deathChance: 0.005, fullRationsCap: 3 },
  { id: 'micrometeorite-puncture', name: 'a micrometeorite puncture', homage: 'Snakebite', trigger: 'illness', duration: [3, 6], dailyHealth: -6, deathChance: 0.04, deathDays: 2, deathChanceSuited: 0.01 },
  { id: 'radiation-sickness', name: 'radiation sickness', homage: '—', trigger: 'radiation', duration: [5, 9], dailyHealth: -5, deathChance: 0.02 },
  { id: 'exhaustion', name: 'exhaustion', homage: 'Exhaustion', trigger: 'overburn', duration: [2, 2], dailyHealth: -3, deathChance: 0, untilOffOverburn: true },
  { id: 'decompression-injury', name: 'a decompression injury', homage: 'Broken arm/leg', trigger: 'hazard', duration: [10, 20], dailyHealth: -1, deathChance: 0, repairPenalty: 10 },
];

/** Conditions by id. */
export const CONDITIONS: Readonly<Record<ConditionId, ConditionDef>> = Object.fromEntries(
  CONDITION_LIST.map((c) => [c.id, c]),
) as Record<ConditionId, ConditionDef>;

/** Max active conditions per crew member. */
export const MAX_CONDITIONS = 2;
/** Radiation sickness chance per unsuited present crew on a storm/flare day. */
export const RADIATION_CHANCE = 0.15;
/** Consecutive Overburn moving days that trigger exhaustion. */
export const EXHAUSTION_AFTER_DAYS = 5;
/** Hazard injury with no room for a condition: health loss instead. */
export const INJURY_NO_ROOM_DAMAGE = 15;

/** Death-chance multiplier by victim health (health.md). Checked top-down. */
export const DEATH_MULTIPLIERS: readonly { minHealth: number; mult: number }[] = [
  { minHealth: 75, mult: 0.5 },
  { minHealth: 50, mult: 1 },
  { minHealth: 25, mult: 1.5 },
  { minHealth: 0, mult: 2 },
];

/** Health label bands (average of living crew, or one crew member). */
export type HealthLabel = 'Good' | 'Fair' | 'Poor' | 'Very poor';
export const HEALTH_BANDS: readonly { min: number; label: HealthLabel }[] = [
  { min: 75, label: 'Good' },
  { min: 50, label: 'Fair' },
  { min: 25, label: 'Poor' },
  { min: 0, label: 'Very poor' },
];

/** Non-condition death causes (deaths.json keys). */
export type OtherCause = 'starvation' | 'exhaustion' | 'hazard' | 'drift' | 'hull_fire';
/** Any death cause. */
export type DeathCause = ConditionId | OtherCause;
