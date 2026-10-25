/**
 * The current run: GameState + its Rng + UI settings. Scenes read from here, dispatch intents
 * through the sim, and write the new state back. No rules live here.
 */
import { DEFAULT_CREW_NAMES, type ProfessionId, type WindowId } from '@/content';
import { createRng, seedFromString, type GameState, type LogEntry, type Rng } from '@/sim';

/** Player-adjustable UI settings. */
export interface Settings {
  /** Typewriter effect for prose boxes. */
  typewriter: boolean;
  /** Milliseconds per character when typewriter is on. */
  textSpeedMs: number;
  /** Delay between days when continuing/auto-traveling, ms. */
  dayDelayMs: number;
  /** Mini-games resolve statistically (no scene, no penalty). Persisted in `localStorage['proxima.options']`. */
  autoResolveMiniGames: boolean;
  /** Show on-screen mini-game buttons even without a touch screen. Persisted. */
  touchControls: boolean;
}

/** Settings persisted under `localStorage['proxima.options']`. */
export type PersistedOption = 'autoResolveMiniGames' | 'touchControls';
export const OPTIONS_KEY = 'proxima.options';

/** What a mini-game scene hands back to the scene it returns to: the day's log entries and new deaths. */
export interface PendingDay {
  entries: LogEntry[];
  dead: string[];
}

/** Read persisted options defensively (bad JSON or no storage = defaults). */
function loadOptions(): Partial<Pick<Settings, PersistedOption>> {
  try {
    const raw: unknown = JSON.parse(globalThis.localStorage?.getItem(OPTIONS_KEY) ?? '{}');
    if (!raw || typeof raw !== 'object') return {};
    const o = raw as Record<string, unknown>;
    const out: Partial<Pick<Settings, PersistedOption>> = {};
    for (const k of ['autoResolveMiniGames', 'touchControls'] as const) if (typeof o[k] === 'boolean') out[k] = o[k];
    return out;
  } catch {
    return {};
  }
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
  settings: Settings = { typewriter: true, textSpeedMs: 12, dayDelayMs: 220, autoResolveMiniGames: false, touchControls: false };
  /** `?minigames=auto`: auto-resolve forced on for this page load (not persisted). */
  forceAutoMiniGames = false;
  /** `?debug=1` (or a dev build): enables `__PROXIMA__.minigame.finishWith`. */
  debug = false;
  /** Set by a mini-game scene after it dispatched its intent; the scene it returns to shows it, then clears it. */
  pendingDay: PendingDay | null = null;

  /** Mini-games auto-resolve (persisted option or the URL override). */
  get autoResolveMiniGames(): boolean {
    return this.forceAutoMiniGames || this.settings.autoResolveMiniGames;
  }

  /** Change a persisted option and save it (storage errors are ignored). */
  setOption(key: PersistedOption, value: boolean): void {
    this.settings[key] = value;
    try {
      const { autoResolveMiniGames, touchControls } = this.settings;
      globalThis.localStorage?.setItem(OPTIONS_KEY, JSON.stringify({ autoResolveMiniGames, touchControls }));
    } catch {
      // private mode / storage full: the option still applies for this session
    }
  }

  /** Read `?seed=` (or pick a random one), `?minigames=auto`, `?debug=1` and saved options, then reset everything. */
  init(search: string): void {
    const params = new URLSearchParams(search);
    this.forceAutoMiniGames = params.get('minigames') === 'auto';
    this.debug = params.get('debug') === '1' || import.meta.env.DEV;
    Object.assign(this.settings, loadOptions());
    const raw = params.get('seed');
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
    this.pendingDay = null;
    this.draft = { profession: 'executive', names: [...DEFAULT_CREW_NAMES], window: 1 };
  }
}

/** The one session for this page. */
export const session = new Session();
