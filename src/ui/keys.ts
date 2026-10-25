/**
 * Keyboard routing. One window-level listener per scene; the top handler on the stack gets each key.
 * Window listeners work without the canvas having focus, so keys are live on page load.
 * `?` opens the controls overlay anywhere a text field is not taking input (any key closes it).
 * The router also publishes the top handler's key hints set (keyhints.md "Which hints show") to the KeyHints bar.
 */
import type Phaser from 'phaser';
import { HELP_HINTS, openHelp as showHelp, type HelpOverlay } from './HelpOverlay';
import { publishHints } from './keyHints';

/** Anything that consumes keys (Menu, Modal, NumberInput, NameInput, scene-level handlers). */
export interface KeyHandler {
  onKey(e: KeyboardEvent): void;
  onKeyUp?(e: KeyboardEvent): void;
  /** True for typing fields (NameInput, NumberInput): `?` and the mute key are left to them. */
  readonly textEntry?: boolean;
  /** Called before the `?` overlay opens (e.g. Travel stops auto-travel, a mini-game pauses). */
  onHelp?(): void;
  /** Key hints set id (`hints.<id>` in ui.json) while this handler is on top; a function is re-read on every publish. */
  readonly hints?: string | (() => string | null);
}

/** The set id a handler shows (`none` without one). */
export function hintSetOf(h: KeyHandler | undefined): string {
  const v = typeof h?.hints === 'function' ? h.hints() : h?.hints;
  return v || 'none';
}

/** A key typed into a DOM text field (TextArea): leave Backspace, Space and arrows to the field. */
const inTextField = (e: KeyboardEvent): boolean => {
  const el = e.target as HTMLElement | null;
  return !!el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT');
};

const NO_SCROLL = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Tab', 'Backspace', 'PageUp', 'PageDown']);

/** The router of the scene that took input last (one scene runs at a time). */
const current: { router: KeyRouter | null } = { router: null };

/** DOM save-string boxes (Options export / import) count as text fields while they exist. */
const SAVE_BOXES = ['proxima-export', 'proxima-import'];

/**
 * True while typing goes to a field: a NameInput / NumberInput on top of the active router, a focused DOM input or
 * textarea, or an open export/import box. The global mute key and `?` stay out of the way then.
 */
export function textEntryActive(): boolean {
  if (current.router?.top?.textEntry) return true;
  if (typeof document === 'undefined') return false;
  const el = document.activeElement as HTMLElement | null;
  if (el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT')) return true;
  return SAVE_BOXES.some((id) => document.getElementById(id) !== null);
}

export class KeyRouter {
  private readonly stack: KeyHandler[] = [];
  private help: HelpOverlay | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    current.router = this;
    const down = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (NO_SCROLL.has(e.key) && !inTextField(e)) e.preventDefault();
      if (this.help) {
        if (e.key !== 'Shift') this.closeHelp();
        return;
      }
      if (e.key === '?' && !e.repeat && !textEntryActive()) {
        this.openHelp();
        return;
      }
      this.stack[this.stack.length - 1]?.onKey(e);
    };
    const up = (e: KeyboardEvent): void => this.stack[this.stack.length - 1]?.onKeyUp?.(e);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    scene.events.once('shutdown', () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      this.stack.length = 0;
      this.help = null;
      if (current.router === this) current.router = null;
    });
    this.refreshHints();
  }

  /** Publish the hint set of the top handler (or `help` while the overlay is open). Handlers call it when their set changes. */
  refreshHints(): void {
    if (current.router !== this) return;
    const top = this.top;
    publishHints(this.help ? HELP_HINTS : hintSetOf(top), !this.help && !!top?.textEntry);
  }

  /** The handler that gets keys now. */
  get top(): KeyHandler | undefined {
    return this.stack[this.stack.length - 1];
  }

  /** True while the `?` overlay is open. */
  get helpOpen(): boolean {
    return this.help !== null;
  }

  /** Show the controls overlay (the top handler hears `onHelp` first). */
  openHelp(): void {
    if (this.help) return;
    this.top?.onHelp?.();
    this.help = showHelp(this.scene, () => this.closeHelp());
    this.refreshHints();
  }

  closeHelp(): void {
    this.help?.destroy();
    this.help = null;
    this.refreshHints();
  }

  push(h: KeyHandler): void {
    this.stack.push(h);
    this.refreshHints();
  }

  /** Remove a handler wherever it is in the stack. */
  remove(h: KeyHandler): void {
    const i = this.stack.lastIndexOf(h);
    if (i >= 0) this.stack.splice(i, 1);
    this.refreshHints();
  }

  /** Replace the whole stack with one handler (used when a scene swaps sub-steps). */
  set(h: KeyHandler): void {
    this.stack.length = 0;
    this.stack.push(h);
    this.refreshHints();
  }
}

export const isConfirm = (e: KeyboardEvent): boolean => e.key === 'Enter' || e.key === ' ';
export const isUp = (e: KeyboardEvent): boolean => e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W';
export const isDown = (e: KeyboardEvent): boolean => e.key === 'ArrowDown' || e.key === 's' || e.key === 'S';
export const isBack = (e: KeyboardEvent): boolean => e.key === 'Escape';
