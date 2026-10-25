/** Audio settings persistence: only the audio sub-keys of localStorage `proxima.settings` (audio.md "Persistence"). */

export const SETTINGS_KEY = 'proxima.settings';

export interface AudioSettings {
  master: number;
  music: number;
  sfx: number;
  muted: boolean;
}

export const DEFAULT_SETTINGS: AudioSettings = { master: 0.8, music: 0.6, sfx: 0.8, muted: false };

export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

const clamp01 = (n: unknown, fallback: number): number => (typeof n === 'number' && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback);

/** Parse the stored JSON; garbage or missing values fall back to defaults. */
export function parseAudioSettings(raw: string | null | undefined): AudioSettings {
  let o: Record<string, unknown> = {};
  try {
    const v: unknown = raw ? JSON.parse(raw) : {};
    if (v && typeof v === 'object' && !Array.isArray(v)) o = v as Record<string, unknown>;
  } catch {
    /* defaults */
  }
  return {
    master: clamp01(o['master'], DEFAULT_SETTINGS.master),
    music: clamp01(o['music'], DEFAULT_SETTINGS.music),
    sfx: clamp01(o['sfx'], DEFAULT_SETTINGS.sfx),
    muted: typeof o['muted'] === 'boolean' ? o['muted'] : DEFAULT_SETTINGS.muted,
  };
}

export function defaultStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadAudioSettings(store: StorageLike | null): AudioSettings {
  try {
    return parseAudioSettings(store?.getItem(SETTINGS_KEY));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Merge our keys into whatever is stored; other keys are preserved untouched. */
export function saveAudioSettings(store: StorageLike | null, s: AudioSettings): void {
  if (!store) return;
  try {
    let o: Record<string, unknown> = {};
    try {
      const v: unknown = JSON.parse(store.getItem(SETTINGS_KEY) ?? '{}');
      if (v && typeof v === 'object' && !Array.isArray(v)) o = v as Record<string, unknown>;
    } catch {
      /* overwrite garbage */
    }
    store.setItem(SETTINGS_KEY, JSON.stringify({ v: 1, ...o, master: s.master, music: s.music, sfx: s.sfx, muted: s.muted }));
  } catch {
    /* storage unavailable */
  }
}
