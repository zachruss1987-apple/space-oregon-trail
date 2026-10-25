/** Difficulty levels (M5 "Difficulty select"). Multipliers on existing rule numbers; spacer is the baseline (all 1). */

/** Difficulty ids. */
export type DifficultyId = 'greenhorn' | 'spacer' | 'pathfinder';

/** One difficulty's multipliers. 1 = unchanged. */
export interface DifficultySpec {
  /** Id (also the Options value). */
  id: DifficultyId;
  /** Display name. */
  name: string;
  /** Daily event chance (EVENT_CHANCE and EVENT_CHANCE_REST). */
  eventChance: number;
  /** Weights of loss-category events (events.ts table). */
  lossWeight: number;
  /** Buy prices per pack at every store (sell-back prices, tug fees and trade asks are unchanged). */
  prices: number;
  /** Starting credits (rounded to whole credits). */
  credits: number;
  /** Daily death chance from conditions (illness, radiation, punctures). */
  illnessDeath: number;
  /** Final score (applied after the profession multiplier as the "Difficulty" line). */
  score: number;
}

/** The difficulty table. */
export const DIFFICULTIES: Readonly<Record<DifficultyId, DifficultySpec>> = {
  greenhorn: { id: 'greenhorn', name: 'Greenhorn', eventChance: 0.75, lossWeight: 0.75, prices: 0.9, credits: 1.15, illnessDeath: 0.5, score: 0.75 },
  spacer: { id: 'spacer', name: 'Spacer', eventChance: 1, lossWeight: 1, prices: 1, credits: 1, illnessDeath: 1, score: 1 },
  pathfinder: { id: 'pathfinder', name: 'Pathfinder', eventChance: 1.25, lossWeight: 1.25, prices: 1.15, credits: 0.9, illnessDeath: 1.5, score: 1.25 },
};

/** Options menu order. */
export const DIFFICULTY_ORDER: readonly DifficultyId[] = ['greenhorn', 'spacer', 'pathfinder'];

/** Default for new games and for saves/high scores that predate difficulty. */
export const DEFAULT_DIFFICULTY: DifficultyId = 'spacer';
