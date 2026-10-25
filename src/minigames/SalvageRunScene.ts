/** Salvage Run (minigames.md section 1): the drone, the drifting field, the grapple. Rules live in salvageLogic. */
import Phaser from 'phaser';
import { SALVAGE_RUN } from '@/content';
import { haulUnits, partsPhrase, type GameState, type SalvageResult } from '@/sim';
import { t } from '@/ui/copy';
import { COLORS } from '@/ui/theme';
import { eventLine, mt } from './copy';
import { MiniGameScene, type MiniGameInput } from './MiniGameScene';
import type { PanelLine } from './overlays';
import { createSalvageWorld, salvageOutcome, salvageOver, stepSalvage, type Debris, type SalvageEvent, type SalvageWorld } from './salvageLogic';

const GREEN = 0x5cff5c;
const DIM = 0x2e8a2e;
const BRIGHT = 0xc8ffc8;
const AMBER = 0xffd75c;
const GREY = 0x6b6b6b;
const HOT = 0x9dff3c;

/** Flash line per logic event (others are silent until audio lands in M4). */
const FLASH: Partial<Record<SalvageEvent, () => string>> = {
  holdFull: () => t('minigame.holdFull'),
  click: () => t('minigame.outOfCharges'),
  scrap: () => mt('minigame.salvage.scrap'),
  snap: () => mt('minigame.salvage.snap'),
  hit: () => mt('minigame.salvage.hit'),
  hot: () => mt('minigame.salvage.hot'),
};

export class SalvageRunScene extends MiniGameScene<SalvageResult> {
  protected readonly kind = 'salvage' as const;
  protected readonly durationS = SALVAGE_RUN.durationS;
  protected override readonly actionKey = 'minigame.common.fire';
  private world!: SalvageWorld;
  private gfx!: Phaser.GameObjects.Graphics;

  constructor() {
    super('Salvage');
  }

  protected setup(state: GameState): void {
    this.world = createSalvageWorld(state);
    const f = SALVAGE_RUN.field;
    const g = this.add.graphics();
    for (let i = 0; i < 50; i++) g.fillStyle(this.rng.chance(0.2) ? DIM : 0x123d12).fillRect(this.rng.int(0, f.right), this.rng.int(f.top, f.bottom), 1, 1);
    g.fillStyle(0x0a2a0a).fillRect(0, f.top, SALVAGE_RUN.shipW, f.bottom - f.top);
    g.lineStyle(1, DIM).strokeRect(0, f.top, SALVAGE_RUN.shipW, f.bottom - f.top);
    g.lineStyle(1, GREEN).strokeRect(8, 180, 24, 40);
    this.gfx = this.add.graphics().setDepth(10);
  }

  protected step(input: MiniGameInput): boolean {
    stepSalvage(this.world, input, this.rng);
    for (const e of this.world.events) {
      const line = FLASH[e];
      if (line) this.flash(line(), e === 'scrap' ? COLORS.dim : COLORS.warn);
    }
    return salvageOver(this.world);
  }

  protected hud(): string[] {
    const w = this.world;
    return [
      t('minigame.salvage.hudCharges', { n: w.chargesLeft }),
      t('minigame.salvage.hudHp', { n: Math.max(0, w.drone.hp) }),
      t('minigame.salvage.hudHold', { n: haulUnits(w.haul) }),
    ];
  }

  protected result(): { result: SalvageResult; notes?: PanelLine[] } {
    const { result, overweight } = salvageOutcome(this.world);
    const notes = overweight > 0
      ? [{ text: eventLine('salvage.overweight', { n: overweight }, 'You could only tow {n} units back.'), color: COLORS.warn }]
      : [];
    return { result, notes };
  }

  protected resultLines(r: SalvageResult): PanelLine[] {
    const parts = partsPhrase({ plates: r.plates, pumps: r.pumps, gyros: r.gyros });
    const haul = r.rations > 0 && parts ? t('minigame.salvage.resultHaul', { n: r.rations, parts })
      : r.rations > 0 ? mt('minigame.salvage.resultRations', { n: r.rations })
        : parts ? mt('minigame.salvage.resultParts', { parts }) : t('minigame.salvage.resultNothing');
    return [
      ...(r.droneWrecked ? [{ text: t('minigame.salvage.droneWrecked'), color: COLORS.warn }] : []),
      { text: haul },
      { text: t('minigame.salvage.chargesUsed', { n: r.chargesUsed }), color: COLORS.dim },
    ];
  }

  protected draw(): void {
    const g = this.gfx.clear();
    const w = this.world;
    const d = w.drone;
    const blip = w.params.blipRange;
    for (const p of w.debris) {
      if (blip !== null && !p.hooked && Math.hypot(p.x - d.x, p.y - d.y) > blip) g.fillStyle(GREY).fillCircle(p.x, p.y, 2);
      else this.drawDebris(g, p);
    }
    const gr = w.grapple;
    if (gr) {
      const tip = gr.phase === 'flying' ? { x: gr.origin.x + gr.dir.x * gr.dist, y: gr.origin.y + gr.dir.y * gr.dist } : gr.target!;
      g.lineStyle(1, BRIGHT).lineBetween(d.x, d.y, tip.x, tip.y);
    }
    const blink = d.invuln > 0 && Math.floor(d.invuln * 10) % 2 === 0;
    if (!blink) {
      const r = SALVAGE_RUN.drone.radius;
      const { x: fx, y: fy } = d.facing;
      g.fillStyle(w.wrecked ? GREY : GREEN).fillTriangle(d.x + fx * r * 1.6, d.y + fy * r * 1.6, d.x - fx * r - fy * r, d.y - fy * r + fx * r, d.x - fx * r + fy * r, d.y - fy * r - fx * r);
      g.lineStyle(1, BRIGHT).strokeCircle(d.x, d.y, r);
    }
  }

  private drawDebris(g: Phaser.GameObjects.Graphics, p: Debris): void {
    const { x, y, r } = p;
    switch (p.type) {
      case 'crate': g.lineStyle(1, GREEN).strokeRect(x - r, y - r, 2 * r, 2 * r); break;
      case 'pallet': g.lineStyle(1, GREEN).strokeRect(x - r, y - r, 2 * r, r).strokeRect(x - r, y, 2 * r, r); break;
      case 'galley': g.lineStyle(1, GREEN).strokeCircle(x, y, r).strokeCircle(x, y, r / 2); break;
      case 'plate': g.fillStyle(BRIGHT).fillRect(x - r, y - r * 0.3, 2 * r, r * 0.6); break;
      case 'pump': g.lineStyle(1, BRIGHT).strokeRect(x - r * 0.6, y - r, r * 1.2, 2 * r); break;
      case 'gyro': g.lineStyle(1, BRIGHT).strokeCircle(x, y, r).strokeEllipse(x, y, r * 3.2, r); break;
      case 'scrap': g.fillStyle(GREY).fillTriangle(x - r, y + r * 0.6, x + r * 0.4, y - r, x + r, y + r * 0.8); break;
      case 'tumbler': {
        const a = p.spin * this.world.steps * 0.08;
        const pts = [0, 1, 2, 3].map((i) => new Phaser.Math.Vector2(x + Math.cos(a + (i * Math.PI) / 2) * r, y + Math.sin(a + (i * Math.PI) / 2) * r));
        g.lineStyle(2, AMBER).strokePoints(pts, true);
        break;
      }
      case 'hot': g.fillStyle(HOT, 0.25).fillCircle(x, y, r * 1.6).fillStyle(HOT).fillCircle(x, y, r * 0.7); break;
    }
  }
}

