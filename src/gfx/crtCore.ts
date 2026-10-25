/** Phaser-free CRT data: parameters, ranges, the GLSL source and the default-on decision. */

export interface CrtParams {
  /** Darkens the lower part of each logical pixel row. */
  scanlines: number;
  /** Barrel distortion k; outside the tube is black. */
  curvature: number;
  /** Corner darkening. */
  vignette: number;
  /** Blur radius in logical pixels for the 5-tap glow. */
  glowRadius: number;
  glowStrength: number;
  /** Debug only; forced 0 in reduced motion. */
  flicker: number;
}

/** art.md CRT table: [min, max]. */
export const CRT_RANGES: Readonly<Record<keyof CrtParams, readonly [number, number]>> = {
  scanlines: [0, 0.5],
  curvature: [0, 0.12],
  vignette: [0, 0.6],
  glowRadius: [0, 2],
  glowStrength: [0, 0.6],
  flicker: [0, 0.03],
};

export function crtDefaults(): CrtParams {
  return { scanlines: 0.18, curvature: 0.04, vignette: 0.3, glowRadius: 1.0, glowStrength: 0.3, flicker: 0 };
}

/** Clamp every field to its range (and zero flicker when reduced motion). */
export function clampCrt(p: CrtParams, reducedMotion = false): CrtParams {
  const out = { ...p };
  for (const k of Object.keys(CRT_RANGES) as (keyof CrtParams)[]) {
    const [lo, hi] = CRT_RANGES[k];
    out[k] = Math.min(hi, Math.max(lo, out[k]));
  }
  if (reducedMotion) out.flicker = 0;
  return out;
}

export interface CrtEnv {
  /** Renderer is WebGL. */
  webgl: boolean;
  /** `(pointer: coarse)` matches (touch device). */
  coarsePointer: boolean;
  /** `prefers-reduced-motion: reduce` or the in-game reduced-motion setting. */
  reducedMotion: boolean;
}

/** Default On for desktop WebGL; Off for coarse pointers, Canvas, or reduced motion (art.md). */
export function crtDefaultOn(env: CrtEnv): boolean {
  return env.webgl && !env.coarsePointer && !env.reducedMotion;
}

/** Uniform name for each parameter. */
export const CRT_UNIFORMS: Readonly<Record<keyof CrtParams, string>> = {
  scanlines: 'uScanlines',
  curvature: 'uCurvature',
  vignette: 'uVignette',
  glowRadius: 'uGlowRadius',
  glowStrength: 'uGlowStrength',
  flicker: 'uFlicker',
};

/** Logical canvas the tube covers: the 640x400 view plus the 16 px key hints band (keyhints.md). */
export const CRT_LOGICAL = { w: 640, h: 416 } as const;

/** Device rows per logical row for the scanline (1 = no room for a scanline). */
export const crtRowScale = (deviceHeight: number): number => Math.max(1, Math.floor(deviceHeight / CRT_LOGICAL.h));

export const CRT_FRAG = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uMainSampler;
uniform vec2 uLogical;
uniform float uTime;
uniform float uScanlines;
uniform float uCurvature;
uniform float uVignette;
uniform float uGlowRadius;
uniform float uGlowStrength;
uniform float uFlicker;
uniform float uScale;
varying vec2 outTexCoord;

void main() {
  vec2 p = outTexCoord * 2.0 - 1.0;
  p *= 1.0 + uCurvature * vec2(p.y * p.y, p.x * p.x);
  vec2 uv = p * 0.5 + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }
  vec4 base = texture2D(uMainSampler, uv);
  vec2 px = uGlowRadius / uLogical;
  vec3 blur = (base.rgb
    + texture2D(uMainSampler, uv + vec2(px.x, 0.0)).rgb
    + texture2D(uMainSampler, uv - vec2(px.x, 0.0)).rgb
    + texture2D(uMainSampler, uv + vec2(0.0, px.y)).rgb
    + texture2D(uMainSampler, uv - vec2(0.0, px.y)).rgb) / 5.0;
  vec3 col = base.rgb + blur * uGlowStrength;
  // One dark device row at the bottom of each logical row, in screen space (gl_FragCoord), so the lines stay
  // straight and evenly spaced at any integer scale; sampling them through the curved uv made moire rings.
  float rowInCell = mod(floor(gl_FragCoord.y), max(uScale, 1.0));
  col *= 1.0 - uScanlines * step(1.0, uScale - 1.0) * step(uScale - 1.0, rowInCell);
  float v = dot(p, p) * 0.5;
  col *= 1.0 - uVignette * v;
  col *= 1.0 + uFlicker * sin(uTime * 60.0);
  // Alpha passes through (premultiplied) so an overlay camera (the KeyHints band) only covers what it draws;
  // scene cameras fill their background, so for them this is the old opaque output.
  gl_FragColor = vec4(col * base.a, base.a);
}
`;
