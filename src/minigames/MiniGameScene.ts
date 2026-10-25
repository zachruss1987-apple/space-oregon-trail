/**
 * Abstract mini-game scene (minigames.md "Shared rules"). Owns everything the three games share: instruction screen,
 * 3-2-1 countdown, fixed 60 Hz steps with an accumulator, timer + HUD slots, keyboard and touch input, pause / skip,
 * the result panel, dispatching the outcome to the sim, and the `__PROXIMA__.minigame` debug hooks.
 * A game supplies `kind`, `durationS`, and the hooks `setup / step / draw / hud / result / resultLines`.
 */
import { MINIGAME_SCENE } from '@/content';
import type { MiniGameDebug } from '@/game/contract';
import { session } from '@/game/session';
import { createRng, minigameSeed, resultError, type GameState, type MiniGameKind, type MiniGameResult, type Rng } from '@/sim';
import { BaseScene, type SceneKey } from '@/scenes/BaseScene';
import { t } from '@/ui/copy';
import { COLORS } from '@/ui/theme';
import { mt } from './copy';
import { MiniGameHud } from './hud';
import { dispatchOutcome } from './outcome';
import { confirmSkip, introPanel, PauseMenu, resultPanel, touchButtons, type Panel, type PanelLine } from './overlays';
import { isTouchDevice, TouchLayer, type TouchPoint } from './touch';

/** One fixed simulation step in seconds. */
export const STEP_S = 1 / MINIGAME_SCENE.stepHz;
/** Longest frame fed to the accumulator (a stalled tab must not spiral). */
const MAX_FRAME_S = 0.25;

/** Input for one fixed step: keyboard direction (-1..1), touch steer point, and a fire edge (aimed when tapped). */
export interface MiniGameInput { dirX: number; dirY: number; target: TouchPoint | null; fire: boolean; fireAt: TouchPoint | null }

/** Data for `scene.start(key, data)`. */
export interface MiniGameLaunch { returnTo: SceneKey }

const NO_INPUT: MiniGameInput = { dirX: 0, dirY: 0, target: null, fire: false, fireAt: null };
type Phase = 'intro' | 'countdown' | 'play' | 'done';

export abstract class MiniGameScene<R extends MiniGameResult> extends BaseScene {
  /** The scene's own Rng: `createRng(minigameSeed(state, kind))`, set before `setup`. */
  protected rng!: Rng;
  /** ui.json key of the on-screen action button (touch) and whether Space / tap fire; null for dodge games. */
  protected readonly actionKey: string | null = null;
  protected abstract readonly kind: MiniGameKind;
  protected abstract readonly durationS: number;

  private phase: Phase = 'intro';
  private paused = false;
  private steps = 0;
  private acc = 0;
  private countdown = 0;
  private doneAt = 0;
  private returnTo: SceneKey = 'Travel';
  private readonly held = new Set<string>();
  private fireEdge: { at: TouchPoint | null } | null = null;
  private touch!: TouchLayer;
  private panel: Panel | null = null;
  private hudView!: MiniGameHud;
  private hook!: MiniGameDebug;

  /** Build the world and draw static art (state is the live GameState; `this.rng` is ready). */
  protected abstract setup(state: GameState): void;
  /** Advance one fixed step; return true when the run ended early (wrecked, crash). */
  protected abstract step(input: MiniGameInput): boolean;
  /** Redraw dynamic objects (every frame, also while paused). */
  protected abstract draw(): void;
  /** HUD slot strings, left to right (timer and pause icon are drawn by the base). */
  protected abstract hud(): string[];
  /** The result of the run so far, plus extra panel notes (e.g. the overweight line). */
  protected abstract result(): { result: R; notes?: PanelLine[] };
  /** Panel lines describing a result (also used for `finishWith`). */
  protected abstract resultLines(result: R): PanelLine[];

  /** Seconds of fixed-step play so far. */
  protected get elapsed(): number {
    return this.steps * STEP_S;
  }

  create(data?: Partial<MiniGameLaunch>): void {
    this.begin();
    const s = session.state;
    if (!s) return this.go('Title');
    Object.assign(this, { phase: 'intro', paused: false, steps: 0, acc: 0, panel: null, fireEdge: null });
    this.held.clear();
    this.returnTo = data?.returnTo ?? 'Travel';
    document.body.dataset['minigame'] = this.kind;
    this.rng = createRng(minigameSeed(s, this.kind));
    this.setup(s);
    this.hudView = new MiniGameHud(this, this.hud().length);
    const buttons = isTouchDevice() || session.settings.touchControls;
    const regions = touchButtons(this, MINIGAME_SCENE.pauseIcon, buttons && this.actionKey ? mt(this.actionKey) : null);
    this.touch = new TouchLayer(this, regions, { live: () => !this.paused, pause: () => this.pause(), tap: (at) => this.onTap(at) });
    this.router.push({ onKey: (e) => this.onKey(e), onKeyUp: (e) => this.held.delete(e.key.toLowerCase()) });
    this.installHook();
    this.events.once('shutdown', () => {
      if (window.__PROXIMA__) window.__PROXIMA__.minigame = null;
      delete document.body.dataset['minigame'];
    });
    this.panel = introPanel(this, this.kind);
  }

  override update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, MAX_FRAME_S);
    if (!this.paused && this.phase === 'countdown') this.tickCountdown(dt);
    else if (!this.paused && this.phase === 'play') {
      this.acc += dt;
      while (this.acc >= STEP_S && this.phase === 'play') {
        this.acc -= STEP_S;
        this.runStep(this.readInput());
      }
    }
    this.draw();
    this.hudView.update(this.hud(), this.durationS - this.elapsed);
  }

  /** Show a short message under the HUD for ~1.2 s (e.g. "Hold full."). */
  protected flash(text: string, color: string = COLORS.warn): void {
    this.hudView.flash(text, color);
  }

  private onKey(e: KeyboardEvent): void {
    if (this.paused) return;
    if (e.key === 'Escape') return this.pause();
    const confirm = e.key === 'Enter' || e.key === ' ';
    if (this.phase === 'intro') {
      if (confirm) this.startCountdown();
    } else if (this.phase === 'done') {
      if (confirm && !e.repeat) this.leaveIfReady();
    } else {
      this.held.add(e.key.toLowerCase());
      if (e.key === ' ' && !e.repeat && this.phase === 'play' && this.actionKey) this.fireEdge = { at: null };
    }
  }

  private onTap(at: TouchPoint | null): void {
    if (this.phase === 'intro') this.startCountdown();
    else if (this.phase === 'done') this.leaveIfReady();
    else if (this.phase === 'play' && this.actionKey) this.fireEdge = { at };
  }

  private readInput(): MiniGameInput {
    const k = (a: string, b: string): number => (this.held.has(a) || this.held.has(b) ? 1 : 0);
    const dirX = k('arrowright', 'd') - k('arrowleft', 'a');
    const dirY = k('arrowdown', 's') - k('arrowup', 'w');
    const fire = this.fireEdge;
    this.fireEdge = null;
    return { dirX, dirY, target: dirX || dirY ? null : this.touch.target, fire: fire !== null, fireAt: fire?.at ?? null };
  }

  private startCountdown(): void {
    this.panel?.destroy();
    this.panel = null;
    this.phase = 'countdown';
    this.countdown = MINIGAME_SCENE.countdownS;
    this.tickCountdown(0);
  }

  private tickCountdown(dt: number): void {
    this.countdown -= dt;
    if (this.countdown > 0) {
      const n = Math.ceil((this.countdown / MINIGAME_SCENE.countdownS) * 3);
      this.hudView.big(`${t('minigame.countdown')}\n${mt('minigame.common.countdownN', { n })}`);
      return;
    }
    this.phase = 'play';
    this.hudView.big(t('minigame.common.go'));
    this.time.delayedCall(500, () => this.phase === 'play' && this.hudView.big(null));
  }

  private runStep(input: MiniGameInput): void {
    this.steps += 1;
    const early = this.step(input);
    if (early || this.steps >= Math.round(this.durationS * MINIGAME_SCENE.stepHz)) this.end();
  }

  private pause(): void {
    if (this.paused || this.phase === 'done') return;
    this.paused = true;
    this.held.clear();
    this.fireEdge = null;
    this.touch.clear();
    const resume = (): void => {
      this.paused = false;
      this.acc = 0;
    };
    new PauseMenu(this, this.router, {
      resume,
      skip: () => confirmSkip(this, this.router, () => this.skip(), () => { resume(); this.pause(); }),
    });
  }

  /** End the run: build (or take) the result, dispatch it, show the panel. */
  private end(forced?: R): void {
    if (this.phase === 'done') return;
    this.phase = 'done';
    this.doneAt = this.time.now;
    this.panel?.destroy();
    this.hudView.big(null);
    this.touch.clear();
    const { result, notes = [] }: { result: R; notes?: PanelLine[] } = forced ? { result: forced } : this.result();
    this.hook.result = result;
    const error = dispatchOutcome(this.kind, { result });
    this.panel = resultPanel(this, [...this.resultLines(result), ...notes], error);
  }

  /** Skip from the pause menu: no result, the sim's penalty auto-resolve, straight back. */
  private skip(): void {
    this.phase = 'done';
    this.hook.skipped = true;
    const error = dispatchOutcome(this.kind, { skipped: true });
    if (error) {
      this.doneAt = this.time.now;
      this.panel = resultPanel(this, [], error);
    } else this.leave();
  }

  /** Leave the result panel (ignores the confirm for 0.4 s so a held fire key does not skip it). */
  private leaveIfReady(): void {
    if (this.time.now - this.doneAt > 400) this.leave();
  }

  private leave(): void {
    this.scene.start(this.returnTo);
  }

  private installHook(): void {
    const hook: Omit<MiniGameDebug, 'elapsed'> = {
      kind: this.kind,
      finishNow: () => {
        if (this.phase === 'done') return;
        this.panel?.destroy();
        this.panel = null;
        this.phase = 'play';
        while (this.phase === 'play') this.runStep(NO_INPUT);
      },
      finishWith: (result: unknown) => {
        if (!session.debug) return 'finishWith needs ?debug=1.';
        if (this.phase === 'done') return 'The run is over.';
        const err = resultError(result, this.kind);
        if (err) return err;
        this.end(result as R);
        return null;
      },
    };
    this.hook = Object.defineProperty(hook, 'elapsed', { get: () => this.elapsed, enumerable: true }) as MiniGameDebug;
    if (window.__PROXIMA__) window.__PROXIMA__.minigame = this.hook;
  }
}
