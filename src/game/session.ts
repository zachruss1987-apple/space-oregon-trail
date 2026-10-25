/**
 * The current run: GameState + its Rng + UI settings. Scenes read from here, dispatch intents
 * through the sim, and write the new state back. No rules live here.
 */
import { DEFAULT_CREW_NAMES, type ProfessionId, type WindowId } from '@/content';
import { createRng, resumeSeed, seedFromString, type GameState, type LogEntry, type Rng, type SaveSlot } from '@/sim';
import {
  DEFAULT_OPTIONS, OPTIONS_KEY, parseOptions, reducedMotionOn, serializeOptions, TEXT_SPEED_MS, touchUiOn, type Options,
} from './options';
import { announce } from './a11y';
import { syncAutosave } from './saveStore';

/** Player-adjustable UI settings (derived from the persisted Options plus fixed timings). */
export interface Settings {
  /** Typewriter effect for prose boxes (off at Instant text speed or with reduced motion). */
  typewriter: boolean;
  /** Milliseconds per character when typewriter is on. */
  textSpeedMs: number;
  /** Delay between days when continuing/auto-traveling, ms. */
  dayDelayMs: number;
  /** Mini-games resolve statistically (no scene, no penalty). Persisted in `localStorage['proxima.options']`. */
  autoResolveMiniGames: boolean;
  /** Show on-screen mini-game buttons (Options "Touch controls" On, or Auto on a touch screen). */
  touchControls: boolean;
  /** Reduced motion in effect (no parallax, bob, typewriter, cursor blink; overlays frozen; CRT off). */
  reducedMotion: boolean;
}

export { OPTIONS_KEY };

/** What a mini-game scene hands back to the scene it returns to: the day's log entries and new deaths. */
export interface PendingDay {
  entries: LogEntry[];
  dead: string[];
}

/** Read persisted options defensively (bad JSON or no storage = defaults). */
function loadOptions(): Options {
  try {
    return parseOptions(globalThis.localStorage?.getItem(OPTIONS_KEY));
  } catch {
    return { ...DEFAULT_OPTIONS };
  }
}

const media = (q: string): boolean => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(q).matches;
const touchScreen = (): boolean => typeof window !== 'undefined' && ('ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0);

/** New log lines read out per state write at most (a debug load can jump far). */
const MAX_ANNOUNCED = 12;

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
  private current: GameState | null = null;
  /**
   * Current run, or null on the title screen. Setting it keeps `localStorage['proxima.autosave']` in step (saveStore)
   * and reads the new log lines into the screen-reader live region (a11y.ts; a first or resumed state reads none).
   */
  get state(): GameState | null {
    return this.current;
  }
  set state(s: GameState | null) {
    const prev = this.current;
    this.current = s;
    syncAutosave(s, this.seedLabel, Date.now());
    if (prev && s && s.log.length > prev.log.length) {
      for (const e of s.log.slice(Math.max(prev.log.length, s.log.length - MAX_ANNOUNCED))) announce(e.text);
    }
  }
  /** Setup choices. */
  draft: SetupDraft = { profession: 'executive', names: [...DEFAULT_CREW_NAMES], window: 1 };
  /** Waypoint index whose scene was already shown (so returning to Travel does not re-open it). */
  shownWaypoint: number | null = null;
  /** Set by the Station scene's Continue: Travel runs one Continue day as soon as it opens. */
  departOnTravel = false;
  settings: Settings = { typewriter: true, textSpeedMs: 12, dayDelayMs: 220, autoResolveMiniGames: false, touchControls: false, reducedMotion: false };
  /** The persisted Options (`proxima.options`); `settings` is derived from it. */
  options: Options = { ...DEFAULT_OPTIONS };
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

  /** Change a persisted option and save it (storage errors are ignored); derived settings update at once. */
  setOption<K extends keyof Options>(key: K, value: Options[K]): void {
    this.options[key] = value;
    this.derive();
    try {
      globalThis.localStorage?.setItem(OPTIONS_KEY, serializeOptions(this.options));
    } catch {
      // private mode / storage full: the option still applies for this session
    }
  }

  /** Recompute `settings` from `options` and the environment. */
  derive(): void {
    const o = this.options;
    const reduced = reducedMotionOn(o, media('(prefers-reduced-motion: reduce)'));
    Object.assign(this.settings, {
      reducedMotion: reduced,
      typewriter: o.textSpeed !== 'instant' && !reduced,
      textSpeedMs: TEXT_SPEED_MS[o.textSpeed] || 12,
      autoResolveMiniGames: o.autoResolveMiniGames,
      touchControls: touchUiOn(o, touchScreen()),
    });
  }

  /** Read `?seed=` (or pick a random one), `?minigames=auto`, `?debug=1` and saved options, then reset everything. */
  init(search: string): void {
    const params = new URLSearchParams(search);
    this.forceAutoMiniGames = params.get('minigames') === 'auto';
    this.debug = params.get('debug') === '1' || import.meta.env.DEV;
    this.options = loadOptions();
    this.derive();
    const raw = params.get('seed');
    this.seedLabel = raw && raw.trim() ? raw.trim() : randomSeedLabel();
    this.reset();
  }

  /**
   * Continue a saved journey: the slot's seed label, a main Rng re-seeded with `resumeSeed` (the Rng position is not
   * saved), the waypoint already shown (no repeat Waypoint scene). The caller opens `resumeScene(state)`.
   */
  resume(slot: SaveSlot, state: GameState): void {
    this.reset();
    if (slot.seed) this.seedLabel = slot.seed;
    this.rng = createRng(resumeSeed(slot));
    this.state = state;
    this.shownWaypoint = state.arrivedAt;
  }

  /** Fresh rngs from the seed and no state (same seed + same inputs = same run). */
  reset(): void {
    const seed = parseSeed(this.seedLabel);
    this.rng = createRng(seed);
    this.uiRng = createRng((seed ^ 0x9e3779b9) >>> 0);
    this.current = null;
    this.shownWaypoint = null;
    this.departOnTravel = false;
    this.pendingDay = null;
    this.draft = { profession: 'executive', names: [...DEFAULT_CREW_NAMES], window: 1 };
  }
}

/** The one session for this page. */
export const session = new Session();
