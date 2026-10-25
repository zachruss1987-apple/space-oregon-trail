import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { crtRowScale } from '@/gfx/crtCore';
import { lineCount, linePitch, wrapLines } from '@/ui/text';

describe('wrapLines (mirrors Phaser BitmapText word wrap)', () => {
  it('breaks greedily on spaces and keeps explicit newlines', () => {
    expect(wrapLines('the quick brown fox', 10)).toEqual(['the quick', 'brown fox']);
    expect(wrapLines('a\nb c', 10)).toEqual(['a', 'b c']);
  });
  it('a word longer than the line stays whole', () => {
    expect(wrapLines('supercalifragilistic x', 8)).toEqual(['supercalifragilistic', 'x']);
  });
  it('counts lines in a pixel box (8 px cells, x2 = 16 px)', () => {
    expect(lineCount('x'.repeat(80), 640)).toBe(1);
    expect(lineCount('aaaa bbbb', 64, 2)).toBe(2);
    expect(linePitch(1)).toBe(12);
    expect(linePitch(2)).toBe(24);
  });
});

describe('CRT scanline scale', () => {
  it('one device row per logical row has no room for a scanline; 2x and up get one per row', () => {
    expect(crtRowScale(400)).toBe(1);
    expect(crtRowScale(800)).toBe(2);
    expect(crtRowScale(1300)).toBe(3);
  });
});

describe('"No default Phaser text remains" (M4 acceptance)', () => {
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : [];
    });
  it('src/ has no this.add.text( and no fontFamily', () => {
    for (const f of files('src')) {
      const src = readFileSync(f, 'utf8');
      expect(src.includes('add.text('), f).toBe(false);
      expect(src.includes('fontFamily'), f).toBe(false);
    }
  });
  const scoped = ['src/scenes', 'src/ui', 'src/minigames'].flatMap((d) => files(d));
  it('scenes, ui and minigames create no Phaser Text objects, fonts or CSS font strings', () => {
    expect(scoped.length).toBeGreaterThan(10);
    for (const f of scoped) {
      const src = readFileSync(f, 'utf8');
      for (const bad of ['add.text(', 'fontFamily', 'GameObjects.Text(', 'new Text(', 'setFontFamily', 'setFont(', 'sans-serif', 'Courier'])
        expect(src.includes(bad), f + ' contains ' + bad).toBe(false);
    }
  });
  it('no file but theme.ts names a CSS monospace font', () => {
    for (const f of scoped.filter((x) => !x.endsWith('theme.ts'))) expect(readFileSync(f, 'utf8').includes('px monospace'), f).toBe(false);
  });
  it('the only CSS font is the DOM_FONT constant in theme.ts, used by TextArea', () => {
    expect(readFileSync('src/ui/theme.ts', 'utf8')).toMatch(/DOM_FONT = '12px monospace'/);
    expect(readFileSync('src/ui/TextArea.ts', 'utf8')).toContain('DOM_FONT');
  });
  it('scenes, ui and minigames take colors from palette keys, not hex literals (art.md checklist)', () => {
    const offenders = scoped.filter((f) => /['\"]#[0-9a-fA-F]{6}['\"]/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
