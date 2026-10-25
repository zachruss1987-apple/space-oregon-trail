/** Arrival scoring (docs/design/scoring.md), plus the difficulty adjustment (M5). */
import { FLARE_SEASON_START, PROFESSIONS, SCORE, SPARE_CAP, SPARE_KEYS } from '@/content';
import type { GameState } from './types';
import { difficultySpec } from './util';

/** One scoring line. */
export interface ScoreLine {
  /** Stable key for UI labels. */
  key:
    | 'crew' | 'ship' | 'drives' | 'spares' | 'suits' | 'charges' | 'rations' | 'credits' | 'flareBonus' | 'noDeathsBonus' | 'rodeTheWind'
    | 'difficulty';
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
  /**
   * Final line after the multiplier: key `difficulty`, points = floor(subtotal × multiplier × difficulty score) −
   * subtotal × multiplier (negative on greenhorn, positive on pathfinder, 0 on spacer: hide it when 0).
   */
  difficulty: ScoreLine;
  /** Difficulty score multiplier (0.75 / 1 / 1.25). */
  difficultyMultiplier: number;
  /** Final score (subtotal × multiplier + difficulty points). */
  total: number;
  /** Rating title (by the final score). */
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
  const difficultyMultiplier = difficultySpec(state.difficulty).score;
  if (living.length === 0) {
    return { lines: [], subtotal: 0, multiplier, difficulty: { key: 'difficulty', points: 0 }, difficultyMultiplier, total: 0, rating: ratingFor(0) };
  }
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
    { key: 'rodeTheWind', points: state.rodeTheWind ? SCORE.rodeTheWindBonus : 0 },
  ];
  const subtotal = lines.reduce((sum, l) => sum + l.points, 0);
  const base = subtotal * multiplier;
  const total = Math.floor(base * difficultyMultiplier);
  return { lines, subtotal, multiplier, difficulty: { key: 'difficulty', points: total - base }, difficultyMultiplier, total, rating: ratingFor(total) };
}
