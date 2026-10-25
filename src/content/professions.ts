/** Professions. Source: docs/design/world.md. */

/** Profession ids. */
export type ProfessionId = 'executive' | 'engineer' | 'farmer';

/** A profession and its exact rule numbers. */
export interface Profession {
  /** Id. */
  id: ProfessionId;
  /** Display name. */
  name: string;
  /** Starting credits. */
  credits: number;
  /** Score multiplier. */
  multiplier: number;
  /** Perk text. */
  perk: string;
  /** Repair success chance (0–1). */
  repairSuccess: number;
  /** Chance a spare is lost on a failed repair (0–1). */
  spareLossOnFail: number;
  /** drive_failure weight multiplier. */
  driveFailureWeight: number;
  /** Daily ration need multiplier (floored, min 1). */
  rationFactor: number;
  /** algae_bloom yield multiplier (floored). */
  algaeFactor: number;
}

/** All professions by id. */
export const PROFESSIONS: Readonly<Record<ProfessionId, Profession>> = {
  executive: {
    id: 'executive', name: 'Corporate Executive', credits: 1600, multiplier: 1,
    perk: 'None. Money solves most problems.',
    repairSuccess: 0.8, spareLossOnFail: 0.3, driveFailureWeight: 1, rationFactor: 1, algaeFactor: 1,
  },
  engineer: {
    id: 'engineer', name: 'Ship Engineer', credits: 800, multiplier: 2,
    perk: 'Repairs succeed more often and consume fewer parts; drive failures are rarer.',
    repairSuccess: 0.95, spareLossOnFail: 0.1, driveFailureWeight: 0.5, rationFactor: 1, algaeFactor: 1,
  },
  farmer: {
    id: 'farmer', name: 'Hydroponics Farmer', credits: 400, multiplier: 3,
    perk: 'Rations go 15% further; "found algae bloom" events yield more.',
    repairSuccess: 0.8, spareLossOnFail: 0.3, driveFailureWeight: 1, rationFactor: 0.85, algaeFactor: 1.5,
  },
};

/** Setup menu order. */
export const PROFESSION_ORDER: readonly ProfessionId[] = ['executive', 'engineer', 'farmer'];
