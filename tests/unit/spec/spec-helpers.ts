/**
 * Shared helpers for the spec-driven tests. Everything here is built on the public sim API (`@/sim`);
 * expected values in the tests are typed from docs/design, never read back from src/content.
 */
import { expect } from 'vitest';
import {
  applyAction, createGame, createRng,
  type GameState, type Intent, type LogEntry, type LogKind, type ProfessionId, type StepResult, type Supplies, type WindowId,
} from '@/sim';

export type WeatherName = 'calm' | 'fair' | 'unsettled' | 'storm' | 'fog' | 'flare';

/** travel.md weather table: speed factor, health unsuited / suited. */
export const WEATHER_SPEC: Record<WeatherName, { speed: number; unsuited: number; suited: number }> = {
  calm: { speed: 1.0, unsuited: 0, suited: 0 },
  fair: { speed: 1.0, unsuited: 0, suited: 0 },
  unsettled: { speed: 0.9, unsuited: -1, suited: -1 },
  storm: { speed: 0.6, unsuited: -3, suited: -1 },
  fog: { speed: 0.7, unsuited: 0, suited: 0 },
  flare: { speed: 0.5, unsuited: -5, suited: -2 },
};

export const THRUST_SPEC = { cruise: { mk: 20, health: 0 }, hard: { mk: 25, health: -2 }, overburn: { mk: 30, health: -5 } } as const;
export const RATION_SPEC = { full: { per: 3, health: 2 }, half: { per: 2, health: 0 }, paste: { per: 1, health: -2 } } as const;
export const DRIVE_SPEC = [0, 0.6, 0.85, 1.0, 1.1];

export const CONTINUE: Intent = { type: 'continue' };

type Over = Partial<Omit<GameState, 'supplies'>> & { supplies?: Partial<Supplies> };

/** A traveling ship in segment 4 (250 Mk to go, so one day never arrives), 3 drives, 10 suits, 1500 rations. */
export function ship(over: Over = {}, profession: ProfessionId = 'executive', window: WindowId = 3): GameState {
  const base = createGame({ profession, window }, createRng(1));
  const { supplies, ...rest } = over;
  return {
    ...base,
    status: 'traveling',
    segment: 4,
    distanceTotal: 304,
    supplies: { drives: 3, rations: 1500, suits: 10, charges: 100, plates: 1, pumps: 1, gyros: 1, ...supplies },
    ...rest,
  };
}

/** Copy of a ship with one crew member replaced. */
export function withCrew(s: GameState, i: number, patch: Partial<GameState['crew'][number]>): GameState {
  return { ...s, crew: s.crew.map((c, k) => (k === i ? { ...c, ...patch } : c)) };
}

/** Set every crew member's health. */
export function allHealth(s: GameState, health: number): GameState {
  return { ...s, crew: s.crew.map((c) => ({ ...c, health })) };
}

const NOISY = new Set<LogKind>(['event', 'condition', 'death', 'hazard', 'arrival', 'help', 'suit', 'rejoin', 'recover', 'gameover']);

/** True if the entries hold nothing random beyond weather (no event, new condition, death, arrival, help, suit loss). */
export function isQuiet(entries: readonly LogEntry[], allow: readonly LogKind[] = []): boolean {
  return !entries.some((e) => NOISY.has(e.kind) && !allow.includes(e.kind));
}

export interface Trial { r: StepResult; seed: number }

/** Run `intent` from `s` with seeds 1..n; keep trials passing `keep` (default: quiet). */
export function runTrials(s: GameState, intent: Intent, n: number, keep: (t: Trial) => boolean = (t) => isQuiet(t.r.entries)): Trial[] {
  const out: Trial[] = [];
  for (let seed = 1; seed <= n; seed++) {
    const r = applyAction(s, intent, createRng(seed));
    const t = { r, seed };
    if (keep(t)) out.push(t);
  }
  return out;
}

/** First quiet trial, or throw. */
export function quietTick(s: GameState, intent: Intent = CONTINUE, keep?: (t: Trial) => boolean): Trial {
  const t = runTrials(s, intent, 400, keep)[0];
  if (!t) throw new Error('no quiet seed found in 400 tries');
  return t;
}

/** Assert an observed rate is within `sigmas` binomial standard deviations (+0.3 pt slack) of p. */
export function expectRate(count: number, n: number, p: number, sigmas = 4, label = 'rate'): void {
  const tol = sigmas * Math.sqrt((p * (1 - p)) / n) + 0.003;
  const got = count / n;
  expect(Math.abs(got - p), `${label}: got ${got.toFixed(4)} want ${p} +/- ${tol.toFixed(4)} (n=${n})`).toBeLessThanOrEqual(tol);
}

/** Days between two ISO dates. */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export const slow = Boolean(process.env.SKIP_SLOW);
