/** Game-facing audio API: unlock on first gesture, music with crossfade and look-ahead looping, SFX with ducking, volumes. */
import { DUCK, crossfadeAt, duckPlan } from './dsp';
import { SFX, sfxEvents, type SfxDef } from './sfx';
import { getSong } from './songs';
import { defaultStorage, loadAudioSettings, saveAudioSettings, type AudioSettings, type StorageLike } from './settings';
import { Synth, type CtxLike, type GainLike, type Voice } from './synth';
import { eventsBetween } from './tracker';
import type { ParsedSong } from './types';

export type Bus = 'master' | 'music' | 'sfx';

export interface TimerLike {
  every(fn: () => void, ms: number): unknown;
  cancel(handle: unknown): void;
}

export interface AudioOptions {
  createContext?: () => CtxLike;
  /** `null` disables persistence. Default: localStorage. */
  storage?: StorageLike | null;
  /** Scheduler timer. Default: setInterval. Tests pass a no-op and call `tick()`. */
  timer?: TimerLike;
}

interface Track {
  id: string;
  song: ParsedSong;
  bus: GainLike;
  /** Context time of song time 0. */
  startTime: number;
  /** Song time already scheduled up to. */
  cursor: number;
  /** Context time at which a fading-out track is disposed. */
  stopAt?: number;
}

const TICK_MS = 25;
const LOOKAHEAD = 0.1;
const MAX_SFX = 8;
const FADE_STEPS = 12;
const MUTE_RAMP = 0.03;
const STOP_FADE_MS = 40;

const defaultTimer: TimerLike = {
  every: (fn, ms) => setInterval(fn, ms),
  cancel: (h) => clearInterval(h as ReturnType<typeof setInterval>),
};

function defaultContext(): CtxLike {
  const w = window as unknown as { AudioContext?: new () => CtxLike; webkitAudioContext?: new () => CtxLike };
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) throw new Error('Web Audio unavailable');
  return new Ctor();
}

export class AudioManager {
  private ctx: CtxLike | null = null;
  private synth: Synth | null = null;
  private duckNode: GainLike | null = null;
  private timerHandle: unknown = null;
  private settings: AudioSettings;
  private readonly storage: StorageLike | null;
  private readonly createContext: () => CtxLike;
  private readonly timer: TimerLike;
  private current: Track | null = null;
  private fading: Track[] = [];
  private pending: string | null = null;
  private pendingSting: string | null = null;
  private loops = new Map<string, number>();
  private duckUntil = 0;
  private sfxActive: { id: string; end: number; voices: Voice[] }[] = [];
  private lastSfx = new Map<string, number>();
  /** Number of `unlock()` calls (e2e can assert an attempt happened even if resume() is refused). */
  unlockAttempts = 0;

  constructor(opts: AudioOptions = {}) {
    this.storage = opts.storage === undefined ? defaultStorage() : opts.storage;
    this.createContext = opts.createContext ?? defaultContext;
    this.timer = opts.timer ?? defaultTimer;
    this.settings = loadAudioSettings(this.storage);
  }

  /** `'locked'` until the first gesture creates the context, then the context state (`running`, `suspended`, ...). */
  get state(): string {
    return this.ctx ? this.ctx.state : 'locked';
  }

  /** Id of the song currently playing (or pending first gesture), else null. */
  get playing(): string | null {
    if (this.current) return this.current.song.loops || (this.ctx && this.ctx.currentTime < this.current.startTime + this.current.song.lengthSec) ? this.current.id : null;
    return this.pending;
  }

  get isMuted(): boolean {
    return this.settings.muted;
  }

  get volumes(): AudioSettings {
    return { ...this.settings };
  }

  /** Create the context on first call and resume it. Safe to call repeatedly. Resolves true when running. */
  async unlock(): Promise<boolean> {
    this.unlockAttempts++;
    if (!this.ctx) {
      try {
        this.ctx = this.createContext();
      } catch {
        return false;
      }
      const synth = new Synth(this.ctx);
      this.synth = synth;
      const duck = this.ctx.createGain();
      duck.connect(synth.music);
      this.duckNode = duck;
      this.applyGains(0);
      this.timerHandle = this.timer.every(() => this.tick(), TICK_MS);
    }
    if (this.ctx.state !== 'running') {
      try {
        await this.ctx.resume();
      } catch {
        /* refused (no user activation); a later gesture retries */
      }
    }
    if (this.pending) {
      const id = this.pending;
      this.pending = null;
      this.startTrack(id, 0);
    }
    if (this.pendingSting) {
      const id = this.pendingSting;
      this.pendingSting = null;
      this.playSting(id);
    }
    return this.ctx.state === 'running';
  }

  /** Call `unlock()` on the first pointer/key/touch gesture, and resume when the tab becomes visible again. */
  attachGestureListeners(target: EventTarget = window): () => void {
    const events = ['pointerdown', 'keydown', 'touchend'];
    const onGesture = (): void => {
      void this.unlock().then((ok) => {
        if (ok) off();
      });
    };
    const onVisible = (): void => {
      if (typeof document !== 'undefined' && !document.hidden && this.ctx && this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
    };
    const off = (): void => {
      for (const e of events) target.removeEventListener(e, onGesture, true);
    };
    for (const e of events) target.addEventListener(e, onGesture, true);
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible);
    return off;
  }

  /** Start a song. Same id as the current song is a no-op. Before unlock the request is held and starts on unlock. */
  playMusic(id: string, opts: { crossfadeMs?: number } = {}): void {
    getSong(id); // throws on unknown id or parse error
    if (!this.ctx) {
      this.pending = id;
      return;
    }
    if (this.current?.id === id) return;
    this.startTrack(id, opts.crossfadeMs ?? 300);
  }

  stopMusic(fadeMs = 100): void {
    this.pending = null;
    if (this.current && this.ctx) this.retire(this.current, fadeMs / 1000);
    this.current = null;
  }

  /** Play a sound effect now. Dropped (never queued) before unlock. Returns false when dropped. */
  sfx(id: string): boolean {
    const synth = this.synth;
    const ctx = this.ctx;
    const def = SFX[id];
    if (!synth || !ctx || !def) return false;
    const now = ctx.currentTime;
    if (def.minGap && now - (this.lastSfx.get(id) ?? -1) < def.minGap / 1000) return false;
    this.lastSfx.set(id, now);
    if (def.loop) {
      if (this.loops.has(id)) return true; // already looping; callers need not retrigger
      this.loops.set(id, now + def.dur / 1000);
    }
    this.trigger(def, now);
    if (def.cls === 'duck') this.duck(now, def.dur / 1000);
    return true;
  }

  /** Stop a looping (or still-sounding) effect with a short fade (`fadeOutMs`, default 40 ms). */
  stopSfx(id: string): void {
    const ctx = this.ctx;
    this.loops.delete(id);
    if (!ctx) return;
    const now = ctx.currentTime;
    const fade = (SFX[id]?.fadeOutMs ?? STOP_FADE_MS) / 1000;
    this.sfxActive = this.sfxActive.filter((s) => {
      if (s.id !== id) return true;
      s.voices.forEach((v) => v.stop(now, fade));
      return false;
    });
  }

  /**
   * Play a one-shot song (`danger`, `jingle.clean`, `fanfare` intro) over the current music without changing `playing`.
   * Music ducks -6 dB for the sting's length. Before unlock it is held (latest wins) and plays on unlock.
   */
  playSting(id: string): void {
    const song = getSong(id); // throws on unknown id
    const synth = this.synth;
    const ctx = this.ctx;
    if (!synth || !ctx) {
      this.pendingSting = id;
      return;
    }
    const now = ctx.currentTime;
    const len = song.loops ? song.loopStart : song.lengthSec;
    for (const e of eventsBetween(song, 0, len)) synth.playNote(synth.music, { ...e, t: now + 0.02 + e.t });
    this.duck(now, len + 0.02);
  }

  private trigger(def: SfxDef, at: number): void {
    const synth = this.synth as Synth;
    this.sfxActive = this.sfxActive.filter((s) => s.end > at);
    while (this.sfxActive.length >= MAX_SFX) {
      const i = Math.max(0, this.sfxActive.findIndex((s) => s.id === def.id));
      const [victim] = this.sfxActive.splice(i, 1);
      victim?.voices.forEach((v) => v.stop(at, (def.fadeOutMs ?? 0) / 1000 || undefined));
    }
    const voices = sfxEvents(def, at).map((e) => synth.playNote(synth.sfx, e));
    this.sfxActive.push({ id: def.id, end: at + def.dur / 1000 + (def.fadeOutMs ?? 0) / 1000, voices });
  }

  setVolume(bus: Bus, v: number): void {
    this.setVolumes({ [bus]: v });
  }

  /** Set several volumes (0..1) and/or mute at once; applies immediately and persists. For the Options screen. */
  setVolumes(p: Partial<AudioSettings>): void {
    const clamp = (n: number): number => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));
    if (p.master !== undefined) this.settings.master = clamp(p.master);
    if (p.music !== undefined) this.settings.music = clamp(p.music);
    if (p.sfx !== undefined) this.settings.sfx = clamp(p.sfx);
    if (p.muted !== undefined) this.settings.muted = p.muted;
    this.applyGains(0.01);
    saveAudioSettings(this.storage, this.settings);
  }

  mute(on: boolean): void {
    this.settings.muted = on;
    this.applyGains(MUTE_RAMP);
    saveAudioSettings(this.storage, this.settings);
  }

  toggleMute(): boolean {
    this.mute(!this.settings.muted);
    return this.settings.muted;
  }

  /** Scheduler step: schedule everything starting within the look-ahead window. Called by the timer; public for tests. */
  tick(): void {
    const ctx = this.ctx;
    const synth = this.synth;
    if (!ctx || !synth || (typeof document !== 'undefined' && document.hidden)) return;
    const now = ctx.currentTime;
    for (const [id, next] of this.loops) {
      const def = SFX[id] as SfxDef;
      let n = next;
      while (n < now + LOOKAHEAD) {
        this.trigger(def, n);
        n += def.dur / 1000;
      }
      this.loops.set(id, n);
    }
    this.fading = this.fading.filter((t) => {
      if ((t.stopAt as number) < now) {
        t.bus.disconnect();
        return false;
      }
      return true;
    });
    for (const t of [this.current, ...this.fading]) {
      if (!t) continue;
      const horizon = Math.min(now + LOOKAHEAD, t.stopAt ?? Infinity) - t.startTime;
      if (horizon <= t.cursor) continue;
      for (const e of eventsBetween(t.song, t.cursor, horizon)) synth.playNote(t.bus, { ...e, t: t.startTime + e.t });
      t.cursor = horizon;
    }
  }

  /** Stop the scheduler and close the context. */
  dispose(): void {
    if (this.timerHandle !== null) this.timer.cancel(this.timerHandle);
    this.timerHandle = null;
  }

  private startTrack(id: string, fadeMs: number): void {
    const ctx = this.ctx as CtxLike;
    const now = ctx.currentTime;
    const bus = ctx.createGain();
    bus.connect(this.duckNode);
    const fade = fadeMs / 1000;
    if (fade > 0 && this.current) {
      this.ramp(bus, now, fade, (x) => crossfadeAt(x).in);
      this.retire(this.current, fade);
    } else {
      bus.gain.setValueAtTime(1, now);
      if (this.current) this.retire(this.current, 0.01);
    }
    this.current = { id, song: getSong(id), bus, startTime: now + 0.05, cursor: 0 };
    this.tick();
  }

  /** Fade a track out over `fade` seconds (equal power) and schedule its disposal. */
  private retire(t: Track, fade: number): void {
    const now = (this.ctx as CtxLike).currentTime;
    this.ramp(t.bus, now, fade, (x) => crossfadeAt(x).out);
    t.stopAt = now + fade + 0.05;
    this.fading.push(t);
  }

  private ramp(bus: GainLike, t0: number, dur: number, curve: (x: number) => number): void {
    bus.gain.cancelScheduledValues(t0);
    bus.gain.setValueAtTime(curve(0), t0);
    for (let i = 1; i <= FADE_STEPS; i++) bus.gain.linearRampToValueAtTime(curve(i / FADE_STEPS), t0 + (dur * i) / FADE_STEPS);
  }

  private duck(now: number, dur: number): void {
    const g = (this.duckNode as GainLike).gain;
    const already = now < this.duckUntil + DUCK.release;
    this.duckUntil = Math.max(this.duckUntil, now + dur);
    g.cancelScheduledValues(now);
    for (const [t, v, kind] of duckPlan(now, this.duckUntil - now, already)) {
      if (kind === 'set') g.setValueAtTime(v, t);
      else g.linearRampToValueAtTime(v, t);
    }
  }

  private applyGains(ramp: number): void {
    const s = this.synth;
    if (!s) return;
    const now = s.now;
    const set = (p: GainLike, v: number): void => {
      p.gain.cancelScheduledValues(now);
      p.gain.setValueAtTime(p.gain.value, now);
      p.gain.linearRampToValueAtTime(v, now + ramp);
    };
    set(s.master, this.settings.muted ? 0 : this.settings.master);
    set(s.music, this.settings.music);
    set(s.sfx, this.settings.sfx);
  }
}

let instance: AudioManager | null = null;

/** The shared AudioManager. */
export function audio(): AudioManager {
  instance ??= new AudioManager();
  return instance;
}

/** Replace (or clear) the shared instance; tests only. */
export function setAudioForTests(m: AudioManager | null): void {
  instance = m;
}

/**
 * Install a window keydown listener that toggles global mute. `key` is a single key (`'m'`, `'0'`) or `'ctrl+m'`.
 * Skipped while `isTextFieldActive()` is true or `opts.ignore?.()` is true. Returns an unbind function.
 *
 * CONFLICT: Title's auto-resolve hotkey is `M`. With the default key, pass an `ignore` that is true while
 * Title is the active scene, or bind `'ctrl+m'` / `'0'` instead.
 */
export function bindGlobalMuteKey(
  key = 'm',
  isTextFieldActive: () => boolean = () => false,
  opts: { target?: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>; ignore?: () => boolean; manager?: () => AudioManager } = {},
): () => void {
  const target = opts.target ?? window;
  const want = key.toLowerCase();
  const ctrl = want.startsWith('ctrl+');
  const base = ctrl ? want.slice(5) : want;
  const onKey = (ev: Event): void => {
    const e = ev as KeyboardEvent;
    if (e.repeat || e.key?.toLowerCase() !== base) return;
    const mod = !!(e.ctrlKey || e.metaKey);
    if (ctrl !== mod || e.altKey) return;
    if (isTextFieldActive() || opts.ignore?.()) return;
    if (ctrl) e.preventDefault?.();
    (opts.manager?.() ?? audio()).toggleMute();
  };
  target.addEventListener('keydown', onKey);
  return () => target.removeEventListener('keydown', onKey);
}
