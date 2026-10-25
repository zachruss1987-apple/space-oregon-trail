/** Travel, repair, salvage, hazard and scoring numbers. Sources: travel.md, trail.md, health.md, scoring.md. */

/** Thrust settings. */
export type ThrustId = 'cruise' | 'hard' | 'overburn';
/** Ration settings. */
export type RationId = 'full' | 'half' | 'paste';

/** Thrust table (travel.md). Health applies on moving days only. */
export const THRUST: Readonly<Record<ThrustId, { name: string; mkPerDay: number; health: number }>> = {
  cruise: { name: 'Cruise', mkPerDay: 20, health: 0 },
  hard: { name: 'Hard burn', mkPerDay: 25, health: -2 },
  overburn: { name: 'Overburn', mkPerDay: 30, health: -5 },
};

/** Ration table (travel.md): per present crew per day, health per day. */
export const RATIONS: Readonly<Record<RationId, { name: string; perCrew: number; health: number }>> = {
  full: { name: 'Full', perCrew: 3, health: 2 },
  half: { name: 'Half', perCrew: 2, health: 0 },
  paste: { name: 'Paste', perCrew: 1, health: -2 },
};

/** Health on a starving day, replacing the ration effect. */
export const STARVING_HEALTH = -10;

/** driveFactor by working drives (index = drives, last entry applies to 4+). */
export const DRIVE_FACTOR: readonly number[] = [0, 0.6, 0.85, 1.0, 1.1];

/** massFactor = 1 − min(cap, perThousand × max(0, rations − threshold) / 1000). */
export const MASS = { threshold: 1000, perThousand: 0.05, cap: 0.15 } as const;

/** damageFactor: pump broken → 0, else hull broken → 0.5, else 1. */
export const DAMAGE_FACTOR = { pump: 0, hull: 0.5 } as const;

/** Resting (travel.md). */
export const REST = { minDays: 1, maxDays: 9, health: 3, healthStation: 6, conditionTick: 2 } as const;

/** Passing help (travel.md step 3) and the adrift ending (health.md). */
export const PASSING_HELP = { chance: 0.1, adriftDays: 15 } as const;
/** Installed parts, in passing-help priority order. */
export type PartId = 'pump' | 'hull' | 'gyro';
export const PART_PRIORITY: readonly PartId[] = ['pump', 'hull', 'gyro'];
/** Spare supply key per installed part. */
export const PART_SPARE = { hull: 'plates', pump: 'pumps', gyro: 'gyros' } as const;
/** Display names per installed part. */
export const PART_NAMES: Readonly<Record<PartId, string>> = { hull: 'hull plate', pump: 'coolant pump', gyro: 'nav gyro' };

/** Suit wear on storm/flare days. */
export const SUIT_WEAR_CHANCE = 0.2;

/** Scan for salvage (M1 auto-resolve). d100 bands are upper bounds, inclusive. */
export const SALVAGE = {
  charges: 5,
  nothingMax: 25,
  smallMax: 70,
  smallRange: [15, 40] as const,
  largeMax: 95,
  largeRange: [40, 80] as const,
  /** 96–100: one random spare (at cap → largeRange rations). */
  halveFromScan: 3,
} as const;

/** M1 hazard crossing (trail.md). */
export const HAZARD = {
  densitySeverityFrom: 4,
  densitySeverity: 5,
  flareBeltId: 'the-flare-belt',
  flareIncidentBonus: 15,
  flareSeverityBonus: 10,
  /** Severity upper bounds (inclusive) for each outcome. */
  scrapeMax: 40,
  cargoMax: 70,
  damageMax: 85,
  injuryMax: 95,
  cargoPct: [10, 25] as const,
  /** Damage split: hull 50, pump 25, gyro 25. */
  damageWeights: [
    { item: 'hull' as PartId, weight: 50 },
    { item: 'pump' as PartId, weight: 25 },
    { item: 'gyro' as PartId, weight: 25 },
  ],
} as const;

/** Scoring (scoring.md). */
export const SCORE = {
  crewByHealth: [
    { min: 75, points: 500 },
    { min: 50, points: 400 },
    { min: 25, points: 300 },
    { min: 0, points: 200 },
  ],
  ship: 50,
  perDrive: 4,
  perSpare: 2,
  perSuit: 2,
  chargesPerPoint: 50,
  rationsPerPoint: 25,
  creditsPerPoint: 5,
  flareBonus: 200,
  noDeathsBonus: 300,
  /** "Rode the wind": clean Flare Belt mini-game (minigames.md). */
  rodeTheWindBonus: 200,
  ratings: [
    { min: 6000, title: 'Pathfinder' },
    { min: 3000, title: 'Spacer' },
    { min: 0, title: 'Groundling' },
  ],
} as const;

/** M2 crossing choices (hazards.md). Percentages are whole points; bands are inclusive upper bounds. */
export const CROSSING = {
  /** Today's density d100: ≤ thinnerMax → nominal − 1, ≤ usualMax → nominal, else nominal + 1; clamp 1–5. */
  densityRoll: { thinnerMax: 25, usualMax: 75 },
  densityMin: 1,
  densityMax: 5,
  /** densityFactor = 1 + densityStep × (density − nominal). */
  densityStep: 0.2,
  /** +10 each: hull broken, gyro broken, working drives ≤ shipDrivesAtMost. */
  shipPenalty: 10,
  shipDrivesAtMost: 1,
  /** Thread incident cap. */
  maxIncident: 95,
  shields: { factor: 0.5, severity: -10, pumpStrain: 0.15 },
  pilot: { incident: 3, severity: -20, fee: 10 },
  /** Tug price × this in flare season (round half up). */
  tugFlareFactor: 1.5,
  /** Risk word by incident chance: first band with chance ≤ max. */
  risk: [
    { max: 0, id: 'none' },
    { max: 9, id: 'low' },
    { max: 24, id: 'moderate' },
    { max: 44, id: 'high' },
    { max: 100, id: 'severe' },
  ],
} as const;

/** M3 mini-game result application (minigames.md). The scenes' own tuning stays in the scenes. */
export const MINIGAME = {
  salvage: {
    /** Charges a run may spend at most (and the schema maximum). */
    maxCharges: 20,
    /** Carry limit in units: 1 per ration, `partUnits` per plate / pump / gyro. */
    carryLimit: 100,
    partUnits: 10,
    /** Health lost per hot chunk (random present crew, one draw each). */
    hotDamage: 5,
    maxCrewHurt: 3,
  },
  threading: {
    /** Severity rolls at most (hits beyond this have no extra effect). */
    maxRolls: 4,
    /** The first `cappedRolls` rolls are capped at `cap` (never Lost). */
    cappedRolls: 2,
    cap: 95,
    maxHits: 99,
    /** Clean-run bonus picks. */
    bonusHealth: 2,
    bonusRations: 10,
  },
  flare: {
    /** Hits that make a crash. */
    crashHits: 5,
    /** d100 + this per hit in flare season (cap 100). */
    seasonBonus: 10,
    /** Hit table upper bounds (inclusive). */
    scorchMax: 35,
    burnMax: 65,
    damageMax: 85,
    scorchPct: [10, 25] as const,
    burnDamage: 10,
    burnDamageSuited: 5,
    radiationFallbackDamage: 10,
    /** Crash: these lose 50% (floor of the loss). */
    crashLossKeys: ['rations', 'suits', 'charges'] as const,
    /** Scorch candidates (qty > 0). */
    scorchKeys: ['rations', 'suits', 'charges'] as const,
  },
} as const;
