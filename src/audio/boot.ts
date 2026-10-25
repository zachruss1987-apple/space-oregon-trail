/** Audio boot hook for main.ts: gesture unlock, `__PROXIMA__.audio` debug getter, optional SoundTest scene. */
import { audio } from './AudioManager';
import { SoundTestScene } from './soundTestScene';

declare module '../game/contract' {
  interface ProximaDebug {
    /** Audio debug surface (getter only): context state (`locked` before the first gesture) and the playing song id. */
    readonly audio?: {
      readonly state: string;
      readonly playing: string | null;
      readonly unlockAttempts: number;
      /** Bus volumes 0..1 and mute, as applied (Options writes music / sfx). */
      readonly volumes: { master: number; music: number; sfx: number; muted: boolean };
    };
  }
}

/** Call once from main.ts with the scene list; returns it with the SoundTest scene appended (Boot opens it for `?scene=soundtest`). */
export function audioBoot<T>(scenes: T[]): (T | typeof SoundTestScene)[] {
  const a = audio();
  a.attachGestureListeners();
  // window.__PROXIMA__ is assigned right after the game is created; attach on the next task.
  setTimeout(() => {
    const p = window.__PROXIMA__;
    if (!p) return;
    Object.defineProperty(p, 'audio', {
      enumerable: true,
      configurable: true,
      get: () => ({ state: a.state, playing: a.playing, unlockAttempts: a.unlockAttempts, volumes: a.volumes }),
    });
  }, 0);
  return [...scenes, SoundTestScene];
}
