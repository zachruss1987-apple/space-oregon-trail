/** Public sim API (see README.md). */
export * from './types';
export { createRng, seedFromString, type Rng } from './rng';
export { createGame, isValidName, normalizeCrewNames, randomCrewNames } from './game';
export { tick } from './tick';
export { applyAction, intentBlocker } from './actions';
export {
  CROSS_METHODS, baseIncident, blockedText, crossBlocker, crossChance, crossingOptions, densityFactor, densityTrend,
  isFlareBelt, riskLabel, riskWord, shipModifier, tugPrice, type CrossOption, type DensityTrend, type RiskId,
} from './crossing';
export { atRoadStation, formatCr, itemPhrase, maxSellable, roadBuyBlocker, sellBlocker } from './market';
export { acceptTrade, offerVars, personaIds, personaName, tradeBlocker, tradeLine } from './trade';
export { shuffledTalk, stationGreeting, stationKeeper, stationOpen, stationTalk } from './station';
export { cumulativeAt, isSkipped, nextWaypoint, routeBlocker, routeWaypoints, totalMk } from './route';
export {
  BEACONS, appendBeacon, beaconSegment, beaconsForSegment, cannedBeacons, formatBeacon, isValidEpitaph, makeBeacon,
  parseBeacons, type BeaconRecord,
} from './beacons';
export { buy, buyBlocker, costOf, depart, localPrice, maxBuyable, priceAt, sellPrice, storeIndex, storeWarnings } from './store';
export { brokenParts, repairBlocker, repairChance, sparesFor } from './repair';
export { canScan } from './salvage';
export { computeScore, ratingFor, type ScoreBreakdown, type ScoreLine } from './score';
export { fromJSON, toJSON } from './serialize';
export { dailyDistance, daysOfRations, rationNeed, remainingInSegment } from './travel';
export { averageHealth, generalHealth, healthLabel, isFlareSeason, presentCrew, workingDrives } from './util';
export { isSuited } from './health';
export { policyCross, policyIntent, policyShop, runPolicy, type RunSummary } from './policy';
export { resolveText, textLine } from './text';
