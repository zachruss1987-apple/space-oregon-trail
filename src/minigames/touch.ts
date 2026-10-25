/**
 * Touch / mouse layer for mini-games (minigames.md "Touch"): drag anywhere steers toward a point 40 px above the
 * finger; a tap (< 200 ms, < 10 px) acts at the tap point; the pause icon and the optional action button are regions.
 */
import type Phaser from 'phaser';
import { MINIGAME_SCENE } from '@/content';

export interface TouchPoint { x: number; y: number }

export interface TouchHandlers {
  /** Pause icon pressed. */
  pause(): void;
  /** Tap (or action button: `at` null). */
  tap(at: TouchPoint | null): void;
  /** False while the layer should ignore input (paused, panels). */
  live(): boolean;
}

/** True on touch screens (on-screen buttons are shown there, or when `settings.touchControls` is on). */
export function isTouchDevice(): boolean {
  return typeof window !== 'undefined' && ('ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0);
}

export class TouchLayer {
  /** Current steer point (null when not dragging). */
  target: TouchPoint | null = null;
  private down: { x: number; y: number; at: number; moved: boolean } | null = null;

  constructor(scene: Phaser.Scene, private readonly regions: { pause: Phaser.Geom.Rectangle; action: Phaser.Geom.Rectangle | null }, private readonly on: TouchHandlers) {
    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.press(p));
    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => this.move(p));
    scene.input.on('pointerup', (p: Phaser.Input.Pointer) => this.release(p));
  }

  /** Forget any drag in progress (on pause / end). */
  clear(): void {
    this.down = null;
    this.target = null;
  }

  private press(p: Phaser.Input.Pointer): void {
    if (!this.on.live()) return;
    if (this.regions.pause.contains(p.worldX, p.worldY)) return this.on.pause();
    if (this.regions.action?.contains(p.worldX, p.worldY)) return this.on.tap(null);
    this.down = { x: p.worldX, y: p.worldY, at: p.downTime, moved: false };
  }

  private move(p: Phaser.Input.Pointer): void {
    if (!this.down || !p.isDown || !this.on.live()) return;
    if (Math.hypot(p.worldX - this.down.x, p.worldY - this.down.y) >= MINIGAME_SCENE.tapMovePx) this.down.moved = true;
    if (this.down.moved) this.target = { x: p.worldX, y: p.worldY - MINIGAME_SCENE.touchOffsetY };
  }

  private release(p: Phaser.Input.Pointer): void {
    const d = this.down;
    this.clear();
    if (!d || !this.on.live()) return;
    if (!d.moved && p.upTime - d.at < MINIGAME_SCENE.tapMs) this.on.tap({ x: p.worldX, y: p.worldY });
  }
}
