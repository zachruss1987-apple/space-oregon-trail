/** Random event table (spec). Source: docs/design/events.md. Logic lives in src/sim/events.ts. */
import type { ConditionId } from './conditions';
import type { WeatherId } from './windows';

/** Event ids from the events.md table. */
export type EventId =
  | 'illness' | 'pirates' | 'lost_lane' | 'drive_failure' | 'drive_stall' | 'hull_puncture' | 'pump_failure'
  | 'gyro_failure' | 'hull_fire' | 'crew_eva_drift' | 'bad_recycler' | 'derelict' | 'algae_bloom'
  | 'belter_help' | 'cargo_shift';

/** Loss events obey the cadence guard; illness and gains never do. */
export type EventCategory = 'illness' | 'loss' | 'gain';

/** Inclusive integer range. */
export type Range = readonly [number, number];

/** One event's data. Conditions with logic (e.g. "hull not broken") are keyed by `requires`. */
export interface EventSpec {
  /** Id (also the events.json key). */
  id: EventId;
  /** Cadence category. */
  category: EventCategory;
  /** Base weight (illness: see ILLNESS_WEIGHT_BY_HEALTH). */
  weight: number;
  /** Eligible only when state.segment ≥ this. */
  minSegment?: number;
  /** Eligible only when state.segment ≤ this. */
  maxSegment?: number;
  /** Weight multipliers by today's weather. */
  weatherMult?: Partial<Record<WeatherId, number>>;
  /** Named eligibility rule evaluated by the engine. */
  requires?: 'room' | 'lossable' | 'drive' | 'workingDrive' | 'hullOk' | 'pumpOk' | 'gyroOk' | 'twoPresent' | 'justCrossed';
  /** Primary amount range (percent for losses, units for gains, days for delays). */
  range?: Range;
}

/** The event table, in events.md order. */
export const EVENT_LIST: readonly EventSpec[] = [
  { id: 'illness', category: 'illness', weight: 20, requires: 'room' },
  { id: 'pirates', category: 'loss', weight: 6, minSegment: 3, requires: 'lossable', range: [10, 30] },
  { id: 'lost_lane', category: 'loss', weight: 6, weatherMult: { fog: 2 }, range: [1, 3] },
  { id: 'drive_failure', category: 'loss', weight: 4, requires: 'drive' },
  { id: 'drive_stall', category: 'loss', weight: 6, requires: 'workingDrive', range: [1, 3] },
  { id: 'hull_puncture', category: 'loss', weight: 6, requires: 'hullOk', weatherMult: { unsettled: 1.5, storm: 1.5, flare: 1.5 } },
  { id: 'pump_failure', category: 'loss', weight: 5, requires: 'pumpOk' },
  { id: 'gyro_failure', category: 'loss', weight: 4, requires: 'gyroOk', weatherMult: { fog: 2 } },
  { id: 'hull_fire', category: 'loss', weight: 3, range: [5, 15] },
  { id: 'crew_eva_drift', category: 'loss', weight: 3, requires: 'twoPresent', range: [1, 4] },
  { id: 'bad_recycler', category: 'loss', weight: 6 },
  { id: 'derelict', category: 'gain', weight: 4, minSegment: 2 },
  { id: 'algae_bloom', category: 'gain', weight: 5, range: [20, 60] },
  { id: 'belter_help', category: 'gain', weight: 3, minSegment: 5, maxSegment: 9, range: [40, 80] },
  { id: 'cargo_shift', category: 'loss', weight: 3, requires: 'justCrossed', range: [5, 10] },
];

/** Events by id. */
export const EVENTS: Readonly<Record<EventId, EventSpec>> = Object.fromEntries(
  EVENT_LIST.map((e) => [e.id, e]),
) as Record<EventId, EventSpec>;

/** Daily event chance; halved on rest days. */
export const EVENT_CHANCE = 0.15;
export const EVENT_CHANCE_REST = 0.075;
/** Chance of a flavor quiet_day line on a tick with no event. */
export const QUIET_DAY_CHANCE = 0.1;
/** Loss-event cooldown length in days. */
export const LOSS_COOLDOWN_DAYS = 3;
/** Illness weight by general health label. */
export const ILLNESS_WEIGHT_BY_HEALTH = { Good: 20, Fair: 30, Poor: 40, 'Very poor': 40 } as const;

/** Modifier constants used by the engine. */
export const EVENT_MODS = {
  lostLaneGyroBroken: 2,
  driveFailureOverburn: 2,
  hullFireRationPct: [5, 15] as Range,
  hullFireSuits: 1,
  hullFireDamage: 10,
  driftNeverReturn: 0.05,
  badRecyclerDamage: 5,
  badRecyclerDays: 3,
  badRecyclerDysenteryMult: 3,
  derelictNothing: 0.5,
  /** Sub-roll weights when the derelict yields something. */
  derelictRations: 0.5,
  derelictSpare: 0.25,
  derelictSuits: 0.25,
  derelictRationRange: [20, 60] as Range,
  derelictSuitRange: [1, 2] as Range,
} as const;

/** cargo_shift picks among these. */
export const CARGO_SHIFT_KEYS = ['rations', 'suits', 'charges'] as const;

/** Illness pool entry. */
export interface IllnessPoolEntry {
  /** Condition gained. */
  condition: ConditionId;
  /** Base weight. */
  weight: number;
}

/** Illness pool (events.md). Modifiers are applied by the engine using ILLNESS_MODS. */
export const ILLNESS_POOL: readonly IllnessPoolEntry[] = [
  { condition: 'space-dysentery', weight: 6 },
  { condition: 'hull-mold-fever', weight: 3 },
  { condition: 'cryo-fever', weight: 4 },
  { condition: 'scurvy', weight: 4 },
  { condition: 'micrometeorite-puncture', weight: 3 },
];

/** Illness pool modifiers. */
export const ILLNESS_MODS = {
  dysenteryPaste: 2,
  moldFeverFromSegment: 10,
  moldFeverMult: 2,
  cryoPoorMult: 2,
  scurvyMinLowRationDays: 10,
  punctureWeather: ['unsettled', 'storm', 'flare'] as readonly WeatherId[],
} as const;
