/**
 * Keyboard routing. One window-level listener per scene; the top handler on the stack gets each key.
 * Window listeners work without the canvas having focus, so keys are live on page load.
 */
import type Phaser from 'phaser';

/** Anything that consumes keys (Menu, Modal, NumberInput, NameInput, scene-level handlers). */
export interface KeyHandler {
  onKey(e: KeyboardEvent): void;
  onKeyUp?(e: KeyboardEvent): void;
}

const NO_SCROLL = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Tab', 'Backspace', 'PageUp', 'PageDown']);

export class KeyRouter {
  private readonly stack: KeyHandler[] = [];

  constructor(scene: Phaser.Scene) {
    const down = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (NO_SCROLL.has(e.key)) e.preventDefault();
      this.stack[this.stack.length - 1]?.onKey(e);
    };
    const up = (e: KeyboardEvent): void => this.stack[this.stack.length - 1]?.onKeyUp?.(e);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    scene.events.once('shutdown', () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      this.stack.length = 0;
    });
  }

  push(h: KeyHandler): void {
    this.stack.push(h);
  }

  /** Remove a handler wherever it is in the stack. */
  remove(h: KeyHandler): void {
    const i = this.stack.lastIndexOf(h);
    if (i >= 0) this.stack.splice(i, 1);
  }

  /** Replace the whole stack with one handler (used when a scene swaps sub-steps). */
  set(h: KeyHandler): void {
    this.stack.length = 0;
    this.stack.push(h);
  }
}

export const isConfirm = (e: KeyboardEvent): boolean => e.key === 'Enter' || e.key === ' ';
export const isUp = (e: KeyboardEvent): boolean => e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W';
export const isDown = (e: KeyboardEvent): boolean => e.key === 'ArrowDown' || e.key === 's' || e.key === 'S';
export const isBack = (e: KeyboardEvent): boolean => e.key === 'Escape';
