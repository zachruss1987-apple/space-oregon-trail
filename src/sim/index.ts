/** Public sim API (see README.md). */
export * from './types';
export { createRng, seedFromString, type Rng } from './rng';
export { createGame, isValidName, normalizeCrewNames, randomCrewNames } from './game';
export { tick } from './tick';
export { applyAction, intentBlocker } from './actions';
export { buy, buyBlocker, costOf, depart, maxBuyable, priceAt, sellPrice, storeWarnings } from './store';
export { brokenParts, repairBlocker, repairChance, sparesFor } from './repair';
export { canScan } from './salvage';
export { computeScore, ratingFor, type ScoreBreakdown, type ScoreLine } from './score';
export { fromJSON, toJSON } from './serialize';
export { dailyDistance, daysOfRations, rationNeed, remainingInSegment } from './travel';
export { averageHealth, generalHealth, healthLabel, isFlareSeason, presentCrew, workingDrives } from './util';
export { isSuited } from './health';
export { policyIntent, policyShop, runPolicy, type RunSummary } from './policy';
export { resolveText } from './text';
