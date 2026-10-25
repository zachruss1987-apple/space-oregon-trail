/**
 * Flare Belt Finale (minigames.md section 3): steer in 2D between flare arcs for 45 s; 5 hits is a crash (early end).
 * Rules live in flareLogic. A clean run earns "Rode the wind" (the sim sets `rodeTheWind`). Arcs are Graphics per
 * art.md "Flare arcs"; the ship is `ship.mini`, `star.proxima` burns at the right edge.
 */
import type Phaser from 'phaser';
import { audio } from '@/audio/AudioManager';
import { FLARE_RUN } from '@/content';
import { activeNumbers } from '@/gfx/palette';
import type { FlareResult, GameState } from '@/sim';
import { t } from '@/ui/copy';
import { COLORS } from '@/ui/theme';
import { mt } from './copy';
import { arcPhase, createFlareWorld, flareElapsed, flareOver, flareResult, stepFlare, type Arc, type FlareWorld } from './flareLogic';
import { MiniGameScene, type MiniGameInput } from './MiniGameScene';
import type { PanelLine } from './overlays';
import { addAnchored } from './pool';

type Pt = { x: number; y: number };

/** The curve offset by `d` px along its normal (for the telegraph's two edges). */
function offsetCurve(pts: readonly Pt[], d: number): Pt[] {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)] as Pt;
    const b = pts[Math.min(pts.length - 1, i + 1)] as Pt;
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: p.x - ((b.y - a.y) / len) * d, y: p.y + ((b.x - a.x) / len) * d };
  });
}

/** 1-px dashed polyline, 3 on / 3 off. */
function dashed(g: Phaser.GameObjects.Graphics, pts: readonly Pt[]): void {
  let run = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1] as Pt;
    const b = pts[i] as Pt;
    const n = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y)));
    for (let k = 0; k < n; k++, run++) {
      if (run % 6 < 3) g.fillRect(Math.round(a.x + ((b.x - a.x) * k) / n), Math.round(a.y + ((b.y - a.y) * k) / n), 1, 1);
    }
  }
}

export class FlareScene extends MiniGameScene<FlareResult> {
  protected readonly kind = 'flare' as const;
  protected readonly durationS = FLARE_RUN.durationS;
  private world!: FlareWorld;
  private gfx!: Phaser.GameObjects.Graphics;
  private ship!: Phaser.GameObjects.Image;
  private warned = new Set<number>();

  constructor() {
    super('Flare');
  }

  protected override music(): string {
    return 'mg.flare';
  }

  protected override hudIcons(): (string | null)[] {
    return ['ui.icon.hit'];
  }

  protected override isClean(r: FlareResult): boolean {
    return r.hits === 0;
  }

  protected setup(state: GameState): void {
    this.world = createFlareWorld(state, this.rng);
    this.warned = new Set();
    const f = FLARE_RUN.field;
    const pal = activeNumbers();
    const g = this.add.graphics();
    for (let i = 0; i < 40; i++) g.fillStyle(this.rng.chance(0.3) ? pal.brown : pal.plum).fillRect(this.rng.int(0, f.right), this.rng.int(f.top, f.bottom), 1, 1);
    addAnchored(this, f.right - 8, Math.floor((f.top + f.bottom) / 2), 'star.proxima').setScale(2).setAlpha(0.8);
    this.gfx = this.add.graphics().setDepth(10);
    this.ship = addAnchored(this, 0, 0, 'ship.mini').setDepth(12);
  }

  protected step(input: MiniGameInput): boolean {
    const w = this.world;
    stepFlare(w, input);
    const now = flareElapsed(w);
    for (const arc of w.arcs) {
      if (!this.warned.has(arc.id) && arcPhase(w.params, arc, now) === 'telegraph') {
        this.warned.add(arc.id);
        audio().sfx('flare.warn');
      }
    }
    const ev = w.events;
    if (ev.includes('crash')) {
      this.flash(t('minigame.flare.crash'));
      audio().sfx('crash');
    } else if (ev.includes('hit')) {
      this.flash(mt('minigame.flare.hit'));
      audio().sfx('flare.hit');
    }
    return w.crashed;
  }

  protected hud(): string[] {
    return [t('minigame.flare.hudHits', { hits: this.world.hits, n: this.world.hits })];
  }

  protected result(): { result: FlareResult } {
    return { result: flareResult(this.world) };
  }

  protected resultLines(r: FlareResult): PanelLine[] {
    if (r.hits >= 5) return [{ text: t('minigame.flare.crash'), color: COLORS.warn }];
    if (r.hits === 0) return [{ text: t('minigame.flare.rodeTheWind'), color: COLORS.bright, scale: 2 }];
    return [{ text: mt('minigame.flare.resultHits', { hits: r.hits, n: r.hits }) }];
  }

  /** art.md: telegraph = dashed orange edges at 50%; active = orange band, amber inner 12 px, white 2-px centre; fade = 3 steps. */
  private drawArc(g: Phaser.GameObjects.Graphics, arc: Arc, now: number): void {
    const pal = activeNumbers();
    const p = this.world.params;
    const phase = arcPhase(p, arc, now);
    const th = FLARE_RUN.arc.thickness;
    if (phase === 'telegraph') {
      g.fillStyle(pal.orange, 0.5);
      dashed(g, offsetCurve(arc.pts, th / 2));
      dashed(g, offsetCurve(arc.pts, -th / 2));
      return;
    }
    let alpha = 1;
    if (phase === 'fade') {
      const k = (now - arc.t0 - p.telegraphS - p.activeS) / FLARE_RUN.arc.fadeS;
      alpha = [0.75, 0.5, 0.25][Math.min(2, Math.floor(k * 3))] ?? 0.25;
    }
    const shimmer = Math.floor(now * 12) % 2 === 0 ? pal.amber : pal.orange;
    g.lineStyle(th, pal.orange, 0.9 * alpha).strokePoints(arc.pts, false);
    g.lineStyle(12, shimmer, alpha).strokePoints(arc.pts, false);
    g.lineStyle(2, pal.white, alpha).strokePoints(arc.pts, false);
  }

  protected draw(): void {
    const g = this.gfx.clear();
    const w = this.world;
    const now = flareElapsed(w);
    for (const arc of w.arcs) {
      const phase = arcPhase(w.params, arc, now);
      if (phase !== 'pending' && phase !== 'gone') this.drawArc(g, arc, now);
    }
    const s = w.ship;
    const blink = !flareOver(w) && s.invuln > 0 && Math.floor(s.invuln * 10) % 2 === 0;
    this.ship.setPosition(Math.round(s.x), Math.round(s.y)).setAlpha(blink ? 0.25 : 1).setFrame(Math.floor(w.steps / 8) % 2);
    if (w.crashed) this.ship.setTint(activeNumbers().grey);
    else this.ship.clearTint();
  }
}
