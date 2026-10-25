/**
 * CRT post-effect (art.md "CRT shader"): a Phaser WebGL PostFX pipeline plus a runtime toggle.
 * Canvas renderers skip it entirely (`enableCrt` returns false). Not wired to any scene here;
 * the Options scene calls `enableCrt(game, on)` and boot uses `crtDefaultOn(detectCrtEnv(game))`.
 */
import Phaser from 'phaser';
import {
  CRT_FRAG, CRT_LOGICAL, CRT_UNIFORMS, clampCrt, crtDefaults, crtRowScale,
  type CrtEnv, type CrtParams,
} from './crtCore';

export { crtDefaults, crtDefaultOn, clampCrt, CRT_FRAG, CRT_RANGES } from './crtCore';
export type { CrtEnv, CrtParams } from './crtCore';

export const CRT_KEY = 'ProximaCRT';

export class CrtPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  params: CrtParams = crtDefaults();
  private t = 0;

  constructor(game: Phaser.Game) {
    super({ game, name: CRT_KEY, fragShader: CRT_FRAG });
  }

  override onPreRender(): void {
    this.t += 1 / 60;
    for (const k of Object.keys(CRT_UNIFORMS) as (keyof CrtParams)[]) this.set1f(CRT_UNIFORMS[k], this.params[k]);
    this.set1f('uTime', this.t);
    this.set2f('uLogical', CRT_LOGICAL.w, CRT_LOGICAL.h);
    this.set1f('uScale', crtRowScale(this.renderer.height));
  }
}

interface CrtState {
  on: boolean;
  params: CrtParams;
  hooked: boolean;
}
const states = new WeakMap<Phaser.Game, CrtState>();

export const isWebGL = (game: Phaser.Game): boolean => game.renderer.type === Phaser.WEBGL;

/** Detect the environment for `crtDefaultOn`. Pass the in-game reduced-motion setting if it is on. */
export function detectCrtEnv(game: Phaser.Game, reducedMotionSetting = false): CrtEnv {
  const mq = (q: string): boolean => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(q).matches : false);
  return {
    webgl: isWebGL(game),
    coarsePointer: mq('(pointer: coarse)'),
    reducedMotion: reducedMotionSetting || mq('(prefers-reduced-motion: reduce)'),
  };
}

function sync(game: Phaser.Game, st: CrtState): void {
  for (const scene of game.scene.getScenes(true)) {
    const cam = scene.cameras?.main;
    if (!cam) continue;
    const found = cam.getPostPipeline(CRT_KEY);
    const list = (Array.isArray(found) ? found : [found]).filter(Boolean) as CrtPipeline[];
    if (st.on) {
      if (list.length === 0) cam.setPostPipeline(CRT_KEY);
      for (const p of list) p.params = st.params;
    } else if (list.length > 0) cam.removePostPipeline(CRT_KEY);
  }
}

/**
 * Turn the CRT on/off at runtime (no scene restart). Returns true when the effect is active, false
 * when it is off or unavailable (Canvas renderer: strictly a no-op).
 */
export function enableCrt(game: Phaser.Game, on: boolean, params?: Partial<CrtParams>, reducedMotion = false): boolean {
  if (!isWebGL(game)) return false;
  const gl = game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
  if (!gl.pipelines.getPostPipeline(CRT_KEY)) gl.pipelines.addPostPipeline(CRT_KEY, CrtPipeline);
  let st = states.get(game);
  if (!st) {
    st = { on: false, params: crtDefaults(), hooked: false };
    states.set(game, st);
  }
  st.on = on;
  st.params = clampCrt({ ...st.params, ...params }, reducedMotion);
  if (!st.hooked) {
    const s = st;
    game.events.on('prerender', () => sync(game, s));
    st.hooked = true;
  }
  sync(game, st);
  return on;
}

export function isCrtOn(game: Phaser.Game): boolean {
  return isWebGL(game) && (states.get(game)?.on ?? false);
}
