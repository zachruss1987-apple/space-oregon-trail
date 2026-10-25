/**
 * Player options (ui.md "Options screen"), persisted as JSON in `localStorage['proxima.options']`. Pure: parsing,
 * defaults and the derived values; no Phaser, no DOM beyond the optional storage passed in.
 */
import { DEFAULT_DIFFICULTY, DIFFICULTY_ORDER, type DifficultyId } from '@/content';

export type TextSpeed = 'slow' | 'normal' | 'fast' | 'instant';
export type TriState = 'auto' | 'on' | 'off';
export type PaletteId = 'standard' | 'cb';

export interface Options {
  /** CRT effect; null = not chosen yet (default by environment, art.md). */
  crt: boolean | null;
  /** Music bus volume step 0..10. */
  music: number;
  /** SFX bus volume step 0..10. */
  sfx: number;
  textSpeed: TextSpeed;
  /** On-screen mini-game controls: auto = on touch screens. */
  touch: TriState;
  autoResolveMiniGames: boolean;
  /** Auto follows `prefers-reduced-motion`. */
  reducedMotion: TriState;
  palette: PaletteId;
  /** Difficulty for new runs (a run keeps its own `state.difficulty`). */
  difficulty: DifficultyId;
}

export const OPTIONS_KEY = 'proxima.options';

export const DEFAULT_OPTIONS: Readonly<Options> = {
  crt: null, music: 6, sfx: 8, textSpeed: 'normal', touch: 'auto', autoResolveMiniGames: false, reducedMotion: 'auto', palette: 'standard', difficulty: DEFAULT_DIFFICULTY,
};

/** ms per character for each text speed (Instant = no typewriter). */
export const TEXT_SPEED_MS: Readonly<Record<TextSpeed, number>> = { slow: 24, normal: 12, fast: 6, instant: 0 };
export const TEXT_SPEEDS: readonly TextSpeed[] = ['slow', 'normal', 'fast', 'instant'];
export const TRI_STATES: readonly TriState[] = ['auto', 'on', 'off'];

const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);
const step = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(10, Math.max(0, Math.round(v))) : fallback);

/** Parse stored JSON defensively; garbage or missing keys fall back to defaults. Reads the M3 `touchControls` flag. */
export function parseOptions(raw: string | null | undefined): Options {
  let o: Record<string, unknown> = {};
  try {
    const v: unknown = raw ? JSON.parse(raw) : {};
    if (v && typeof v === 'object' && !Array.isArray(v)) o = v as Record<string, unknown>;
  } catch {
    /* defaults */
  }
  const d = DEFAULT_OPTIONS;
  const legacyTouch = o['touchControls'] === true ? 'on' : d.touch;
  return {
    crt: typeof o['crt'] === 'boolean' ? o['crt'] : null,
    music: step(o['music'], d.music),
    sfx: step(o['sfx'], d.sfx),
    textSpeed: pick(o['textSpeed'], TEXT_SPEEDS, d.textSpeed),
    touch: pick(o['touch'], TRI_STATES, legacyTouch),
    autoResolveMiniGames: typeof o['autoResolveMiniGames'] === 'boolean' ? o['autoResolveMiniGames'] : d.autoResolveMiniGames,
    reducedMotion: pick(o['reducedMotion'], TRI_STATES, d.reducedMotion),
    palette: pick(o['palette'], ['standard', 'cb'] as const, d.palette),
    difficulty: pick(o['difficulty'], DIFFICULTY_ORDER, d.difficulty),
  };
}

/** JSON to store (also writes the M3 `touchControls` boolean for older readers). */
export function serializeOptions(o: Options): string {
  return JSON.stringify({ v: 1, ...o, touchControls: o.touch === 'on' });
}

/** Reduced motion in effect: On, or Auto while the OS asks for it. */
export function reducedMotionOn(o: Options, osPrefers: boolean): boolean {
  return o.reducedMotion === 'on' || (o.reducedMotion === 'auto' && osPrefers);
}

/** On-screen touch controls shown: On, or Auto on a touch screen. */
export function touchUiOn(o: Options, touchDevice: boolean): boolean {
  return o.touch === 'on' || (o.touch === 'auto' && touchDevice);
}

/** CRT wanted: the saved choice, else the environment default; reduced motion forces it off (art.md). */
export function crtWanted(o: Options, envDefault: boolean, reduced: boolean): boolean {
  return !reduced && (o.crt ?? envDefault);
}

/** Next value in a cycle (Left = -1, Right/Enter = +1). */
export function cycle<T>(values: readonly T[], cur: T, dir: number): T {
  const i = values.indexOf(cur);
  return values[(((i < 0 ? 0 : i) + dir) % values.length + values.length) % values.length] as T;
}
