/**
 * A real DOM `<textarea>` laid over the canvas, for save strings (tens of KB: far too long for bitmap text, and players
 * need the browser's select / copy / paste). Positioned in logical 640x400 coordinates and kept aligned on resize;
 * removed when the scene shuts down. KeyRouter leaves typing keys alone while it has focus (keys.ts).
 */
import type Phaser from 'phaser';
import { GAME_WIDTH } from '@/config';
import { activePalette } from '@/gfx/palette';
import { DOM_FONT } from './theme';

export interface TextAreaOptions {
  /** Element id (e2e tests find the field by it). */
  id: string;
  value?: string;
  readOnly?: boolean;
  maxLength?: number;
  placeholder?: string;
}

export class TextArea {
  readonly el: HTMLTextAreaElement;
  private readonly place: () => void;

  constructor(private readonly scene: Phaser.Scene, private readonly rect: { x: number; y: number; w: number; h: number }, opts: TextAreaOptions) {
    const el = document.createElement('textarea');
    el.id = opts.id;
    el.value = opts.value ?? '';
    el.readOnly = opts.readOnly ?? false;
    if (opts.maxLength) el.maxLength = opts.maxLength;
    if (opts.placeholder) el.placeholder = opts.placeholder;
    el.spellcheck = false;
    el.setAttribute('autocomplete', 'off');
    const pal = activePalette();
    Object.assign(el.style, {
      position: 'fixed', zIndex: '10', boxSizing: 'border-box', margin: '0', padding: '6px', resize: 'none',
      background: pal.black, color: pal.phosphor, border: `1px solid ${pal.phosphor}`, outline: 'none', caretColor: pal.phosphorHi,
      font: DOM_FONT, wordBreak: 'break-all', whiteSpace: 'pre-wrap',
    } satisfies Partial<CSSStyleDeclaration>);
    document.body.appendChild(el);
    this.el = el;
    this.place = () => this.layout();
    this.layout();
    window.addEventListener('resize', this.place);
    scene.events.once('shutdown', () => this.destroy());
    el.focus();
    if (el.readOnly) el.select();
  }

  get value(): string {
    return this.el.value;
  }

  destroy(): void {
    window.removeEventListener('resize', this.place);
    this.el.remove();
    this.scene.game.canvas?.focus();
  }

  private layout(): void {
    const canvas = this.scene.game.canvas;
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    const k = r.width / GAME_WIDTH;
    Object.assign(this.el.style, {
      left: `${r.left + this.rect.x * k}px`, top: `${r.top + this.rect.y * k}px`,
      width: `${this.rect.w * k}px`, height: `${this.rect.h * k}px`,
    });
  }
}
