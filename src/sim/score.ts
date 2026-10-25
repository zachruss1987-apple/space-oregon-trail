/** Arrival scoring (docs/design/scoring.md). */
import { FLARE_SEASON_START, PROFESSIONS, SCORE, SPARE_CAP, SPARE_KEYS } from '@/content';
import type { GameState } from './types';

/** One scoring line. */
export interface ScoreLine {
  /** Stable key for UI labels. */
  key: 'crew' | 'ship' | 'drives' | 'spares' | 'suits' | 'charges' | 'rations' | 'credits' | 'flareBonus' | 'noDeathsBonus';
  /** Floored points. */
  points: number;
}

/** Full breakdown. */
export interface ScoreBreakdown {
  /** Lines before the multiplier. */
  lines: ScoreLine[];
  /** Sum of lines (subtotal + bonuses). */
  subtotal: number;
  /** Profession multiplier. */
  multiplier: number;
  /** Final score. */
  total: number;
  /** Rating title. */
  rating: string;
}

/** Points for one surviving crew member by final health. */
export function crewPoints(health: number): number {
  return (SCORE.crewByHealth.find((b) => health >= b.min) ?? SCORE.crewByHealth[SCORE.crewByHealth.length - 1]!).points;
}

/** Rating title for a score. */
export function ratingFor(score: number): string {
  return (SCORE.ratings.find((r) => score >= r.min) ?? SCORE.ratings[SCORE.ratings.length - 1]!).title;
}

/** Score an arrived state (missing crew count as rejoined). Zero lines if nobody survived. */
export function computeScore(state: GameState): ScoreBreakdown {
  const living = state.crew.filter((c) => c.alive);
  const s = state.supplies;
  const multiplier = PROFESSIONS[state.profession].multiplier;
  if (living.length === 0) return { lines: [], subtotal: 0, multiplier, total: 0, rating: ratingFor(0) };
  const lines: ScoreLine[] = [
    { key: 'crew', points: living.reduce((sum, c) => sum + crewPoints(c.health), 0) },
    { key: 'ship', points: SCORE.ship },
    { key: 'drives', points: s.drives * SCORE.perDrive },
    { key: 'spares', points: SPARE_KEYS.reduce((sum, k) => sum + Math.min(SPARE_CAP, s[k]), 0) * SCORE.perSpare },
    { key: 'suits', points: s.suits * SCORE.perSuit },
    { key: 'charges', points: Math.floor(s.charges / SCORE.chargesPerPoint) },
    { key: 'rations', points: Math.floor(s.rations / SCORE.rationsPerPoint) },
    { key: 'credits', points: Math.floor(state.credits / SCORE.creditsPerPoint) },
    { key: 'flareBonus', points: state.date < FLARE_SEASON_START ? SCORE.flareBonus : 0 },
    { key: 'noDeathsBonus', points: state.deaths === 0 ? SCORE.noDeathsBonus : 0 },
  ];
  const subtotal = lines.reduce((sum, l) => sum + l.points, 0);
  const total = subtotal * multiplier;
  return { lines, subtotal, multiplier, total, rating: ratingFor(total) };
}
