/**
 * The current run: GameState + its Rng + UI settings. Scenes read from here, dispatch intents
 * through the sim, and write the new state back. No rules live here.
 */
import { DEFAULT_CREW_NAMES, type ProfessionId, type WindowId } from '@/content';
import { createRng, seedFromString, type GameState, type Rng } from '@/sim';

/** Player-adjustable UI settings. */
export interface Settings {
  /** Typewriter effect for prose boxes. */
  typewriter: boolean;
  /** Milliseconds per character when typewriter is on. */
  textSpeedMs: number;
  /** Delay between days when continuing/auto-traveling, ms. */
  dayDelayMs: number;
}

/** Choices made in SetupScene before createGame. */
export interface SetupDraft {
  profession: ProfessionId;
  names: string[];
  window: WindowId;
}

/** Seed from a `?seed=` value: all-digit strings are used as numbers, anything else is hashed. */
export function parseSeed(raw: string): number {
  return /^\d+$/.test(raw) ? Number(raw) >>> 0 : seedFromString(raw);
}

/** A shareable random seed label (UI-only randomness). */
function randomSeedLabel(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

class Session {
  /** Seed as shown and shared (the `?seed=` value). */
  seedLabel = 'OREGON';
  /** Run rng: every sim call uses this one. */
  rng: Rng = createRng(0);
  /** Cosmetic rng for text variants and bulletins. */
  uiRng: Rng = createRng(1);
  /** Current run, or null on the title screen. */
  state: GameState | null = null;
  /** Setup choices. */
  draft: SetupDraft = { profession: 'executive', names: [...DEFAULT_CREW_NAMES], window: 1 };
  /** Waypoint index whose scene was already shown (so returning to Travel does not re-open it). */
  shownWaypoint: number | null = null;
  /** Set by the Station scene's Continue: Travel runs one Continue day as soon as it opens. */
  departOnTravel = false;
  settings: Settings = { typewriter: true, textSpeedMs: 12, dayDelayMs: 220 };

  /** Read `?seed=` (or pick a random one) and reset everything. */
  init(search: string): void {
    const raw = new URLSearchParams(search).get('seed');
    this.seedLabel = raw && raw.trim() ? raw.trim() : randomSeedLabel();
    this.reset();
  }

  /** Fresh rngs from the seed and no state (same seed + same inputs = same run). */
  reset(): void {
    const seed = parseSeed(this.seedLabel);
    this.rng = createRng(seed);
    this.uiRng = createRng((seed ^ 0x9e3779b9) >>> 0);
    this.state = null;
    this.shownWaypoint = null;
    this.departOnTravel = false;
    this.draft = { profession: 'executive', names: [...DEFAULT_CREW_NAMES], window: 1 };
  }
}

/** The one session for this page. */
export const session = new Session();
