import { describe, expect, it } from 'vitest';
import { CRT_FRAG, CRT_RANGES, CRT_UNIFORMS, clampCrt, crtDefaultOn, crtDefaults } from '@/gfx/crtCore';
import {
  LAYER_SPEEDS, STAR_LAYERS, WEATHER_ART, landmarkScale, lanePoints, phaseTint, scrollX, weatherTint,
} from '@/gfx/travelMath';
import { WEATHER_ORDER } from '@/content/windows';
import { ALL_SPRITES } from '@/gfx/sprites/index';

describe('new sprite groups', () => {
  const names = ALL_SPRITES.map((s) => s.name);
  it('has 7 stations at 96x64 with 2 frames', () => {
    const st = ALL_SPRITES.filter((s) => s.name.startsWith('station.'));
    expect(st.map((s) => s.name).sort()).toEqual([
      'station.ceres', 'station.europa', 'station.independence', 'station.mars', 'station.oort', 'station.terminus', 'station.titan',
    ]);
    for (const s of st) expect([s.w, s.h, s.frames]).toEqual([96, 64, 2]);
  });
  it('has 5 landmarks with art.md sizes', () => {
    const lm = Object.fromEntries(ALL_SPRITES.filter((s) => s.name.startsWith('landmark.')).map((s) => [s.name, [s.w, s.h, s.frames]]));
    expect(lm).toEqual({
      'landmark.spire': [48, 96, 1], 'landmark.eye': [96, 96, 2], 'landmark.gate': [96, 96, 4],
      'landmark.oort': [32, 64, 2], 'landmark.proxima': [96, 96, 1],
    });
  });
  it('has rocks, skiff, dock, overlays, planets, far icons and HUD icons', () => {
    const want = [
      'rock.16', 'rock.24', 'rock.32', 'rock.48', 'rock.shard', 'skiff', 'ship.dock', 'overlay.static', 'overlay.fog', 'overlay.streak',
      'planet.earth', 'planet.luna', 'planet.mars', 'planet.saturn', 'planet.titan', 'planet.europa', 'star.proxima',
      'far.station', 'far.planet', 'far.ring', 'far.hazard',
      'ui.icon.hp', 'ui.icon.charge', 'ui.icon.haul', 'ui.icon.hit', 'ui.icon.pause', 'ui.icon.sound', 'ui.icon.mute',
    ];
    for (const n of want) expect(names).toContain(n);
    const by = (n: string) => ALL_SPRITES.find((s) => s.name === n);
    expect([by('rock.48')?.w, by('ship.dock')?.h, by('overlay.static')?.frames, by('overlay.fog')?.frames, by('rock.shard')?.loop]).toEqual([48, 120, 4, 2, false]);
    expect(names).toHaveLength(new Set(names).size);
  });
});

describe('landmarkScale', () => {
  it('follows the art.md tiers and positions', () => {
    expect(landmarkScale(121).tier).toBe('none');
    expect(landmarkScale(120)).toMatchObject({ tier: 'blip', x: 600 });
    expect(landmarkScale(61)).toMatchObject({ tier: 'blip', x: 600 });
    expect(landmarkScale(60)).toMatchObject({ tier: 'far', x: 600 });
    expect(landmarkScale(21)).toMatchObject({ tier: 'far', x: 522 });
    expect(landmarkScale(20)).toMatchObject({ tier: 'full', x: 520 });
    expect(landmarkScale(0)).toMatchObject({ tier: 'full', x: 440 });
  });
  it('is monotonic (x never drops as mk grows), clamped to [440, 600], integer scale 1', () => {
    let prev = -Infinity;
    for (let mk = -5; mk <= 300; mk++) {
      const r = landmarkScale(mk);
      expect(r.x).toBeGreaterThanOrEqual(prev);
      expect(r.x).toBeGreaterThanOrEqual(440);
      expect(r.x).toBeLessThanOrEqual(600);
      expect(r.scale).toBe(1);
      prev = r.x;
    }
    expect(landmarkScale(-5)).toEqual(landmarkScale(0));
  });
});

describe('travel tables', () => {
  it('star layers match art.md', () => {
    expect(STAR_LAYERS.map((l) => [l.name, l.count, l.speed, l.size])).toEqual([['far', 90, 4, 1], ['mid', 40, 12, 1], ['near', 12, 36, 2]]);
    expect(LAYER_SPEEDS).toEqual({ far: 4, mid: 12, near: 36 });
  });
  it('scrollX moves left proportional to factor and wraps', () => {
    expect(scrollX(100, 36, 1000, 1)).toBeCloseTo(64);
    expect(scrollX(100, 36, 1000, 2)).toBeCloseTo(28);
    expect(scrollX(100, 36, 1000, 0)).toBe(100);
    expect(scrollX(5, 36, 1000, 1)).toBeCloseTo(609);
  });
  it('tint table covers all six weather states', () => {
    expect(Object.keys(WEATHER_ART).sort()).toEqual([...WEATHER_ORDER].sort());
    expect(weatherTint('calm').overlay).toBeNull();
    expect(weatherTint('fair').overlay).toBeNull();
    expect(weatherTint('unsettled').streakEveryMs).toBe(2000);
    expect(weatherTint('storm')).toMatchObject({ overlay: 'overlay.static', overlayAlpha: 0.25, borderFlashMs: 2000 });
    expect(weatherTint('fog')).toMatchObject({ overlay: 'overlay.fog', hideLayers: ['far'], layerMul: { mid: 0.5 } });
    expect(weatherTint('flare')).toMatchObject({ overlay: 'overlay.glow', extraStaticAlpha: 0.1 });
  });
  it('phase tint by segment', () => {
    expect([1, 5, 6, 11, 12, 16].map(phaseTint)).toEqual(['none', 'none', 'mid', 'mid', 'post', 'post']);
  });
  it('lane dots converge toward the vanishing point', () => {
    const pts = lanePoints(0, 100, 300, 50, 10);
    expect(pts).toHaveLength(10);
    const gaps = pts.slice(1).map((p, i) => p.x - (pts[i] as { x: number }).x);
    expect(gaps[0]).toBeGreaterThan(gaps[gaps.length - 1] as number);
  });
});

describe('crt core', () => {
  it('defaults match art.md', () => {
    expect(crtDefaults()).toEqual({ scanlines: 0.18, curvature: 0.04, vignette: 0.3, glowRadius: 1.0, glowStrength: 0.3, flicker: 0 });
  });
  it('clamps to ranges and zeroes flicker in reduced motion', () => {
    const c = clampCrt({ scanlines: 9, curvature: -1, vignette: 1, glowRadius: 5, glowStrength: 1, flicker: 1 });
    for (const k of Object.keys(CRT_RANGES) as (keyof typeof CRT_RANGES)[]) {
      expect(c[k]).toBeGreaterThanOrEqual(CRT_RANGES[k][0]);
      expect(c[k]).toBeLessThanOrEqual(CRT_RANGES[k][1]);
    }
    expect(clampCrt({ ...crtDefaults(), flicker: 0.02 }, true).flicker).toBe(0);
  });
  it('crtDefaultOn matrix: on only for desktop WebGL without reduced motion', () => {
    for (const webgl of [true, false])
      for (const coarsePointer of [true, false])
        for (const reducedMotion of [true, false])
          expect(crtDefaultOn({ webgl, coarsePointer, reducedMotion })).toBe(webgl && !coarsePointer && !reducedMotion);
    expect(crtDefaultOn({ webgl: true, coarsePointer: false, reducedMotion: false })).toBe(true);
  });
  it('fragment source declares every uniform and the sampler', () => {
    for (const u of Object.values(CRT_UNIFORMS)) expect(CRT_FRAG).toContain(`uniform float ${u};`);
    expect(CRT_FRAG).toContain('uMainSampler');
    expect(CRT_FRAG).toContain('uLogical');
    expect(CRT_FRAG).toContain('outTexCoord');
  });
});
