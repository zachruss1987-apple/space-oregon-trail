/** Spec-driven key hints tests: typed from docs/design/keyhints.md (deviations logged in decisions.md, T-069 key hints). */
import { describe, expect, it } from 'vitest';
import { UI_TEXT } from '@/content';
import { DEFAULT_OPTIONS, parseOptions, serializeOptions } from '@/game/options';
import { numberRow } from '@/ui/Menu';
import { detectPlatform, fitHints, groupText, hintsShown, keyLabel, parseHint, type Hint, type Platform } from '@/ui/keyHints';

const hints = (UI_TEXT as unknown as { hints: Record<string, string[] | string> }).hints;
const WIN_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0';
const E = (userAgent: string, uaPlatform = '', coarsePointer = false) => ({ userAgent, uaPlatform, coarsePointer });

describe('keyhints.md "Platform detection"', () => {
  it.each([
    ['coarse pointer is touch', E(WIN_UA, '', true), 'touch'],
    ['Android UA is touch', E('Mozilla/5.0 (Linux; Android 14) Mobile', ''), 'touch'],
    ['iPhone UA is touch', E('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'), 'touch'],
    ['iPad UA is touch (rule 1 beats Mac)', E('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)'), 'touch'],
    ['iPod and generic Mobile are touch', E('Mozilla/5.0 (iPod) Mobile'), 'touch'],
    ['Macintosh UA is mac', E('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'), 'mac'],
    ['uaPlatform containing Mac is mac', E('Mozilla/5.0', 'macOS'), 'mac'],
    ['Windows UA is windows', E(WIN_UA), 'windows'],
    ['anything else is linux', E('Mozilla/5.0 (X11; Linux x86_64)'), 'linux'],
  ] as const)('%s', (_n, env, want) => expect(detectPlatform(env)).toBe(want));
  it('?platform=mac|windows|linux|touch overrides everything', () => {
    for (const p of ['mac', 'windows', 'linux', 'touch'] as const) {
      expect(detectPlatform(E(WIN_UA, '', true), `?platform=${p}`)).toBe(p);
      expect(detectPlatform(E('Mozilla/5.0 (Macintosh)'), `?seed=1&platform=${p}`)).toBe(p);
    }
  });
});

describe('keyhints.md "Content and layout" key names', () => {
  it('Enter -> Return and Backspace -> Delete on mac only', () => {
    expect(keyLabel('Enter', 'mac')).toBe('Return');
    expect(keyLabel('Backspace', 'mac')).toBe('Delete');
    for (const p of ['windows', 'linux'] as Platform[]) {
      expect(keyLabel('Enter', p)).toBe('Enter');
      expect(keyLabel('Backspace', p)).toBe('Backspace');
    }
  });
  it('Esc, Space, Tab, Shift+1, Arrows, A-Z, digits and ? are unchanged on every platform', () => {
    for (const p of ['windows', 'linux', 'mac', 'touch'] as Platform[]) {
      for (const k of ['Esc', 'Space', 'Tab', 'Shift+1', 'Arrows', 'A-Z', '1-9', '0-9', '?', 'M', 'T']) expect(keyLabel(k, p)).toBe(k);
    }
  });
});

describe('keyhints.md fit rule (624 px budget)', () => {
  const H = (key: string, label: string): Hint => ({ key, label });
  const help = H('?', 'Help');
  const long = Array.from({ length: 10 }, (_, i) => H('Enter', `Label${i}xxxxxx`));
  it('every spec set fits untouched at 624 px with [?] Help on windows and mac', () => {
    for (const [id, set] of Object.entries(hints)) {
      if (!Array.isArray(set)) continue;
      const parsed = set.map((e) => parseHint(e)!);
      for (const p of ['windows', 'mac'] as Platform[]) expect(fitHints(parsed, help, p).left.length, `${id} ${p}`).toBe(parsed.length);
    }
  });
  it('an overlong set drops from the end, the kept pairs are a prefix, and widths stay within 624 px', () => {
    const { left, help: h } = fitHints(long, help, 'windows');
    expect(left.length).toBeGreaterThan(0);
    expect(left.length).toBeLessThan(long.length);
    expect(left.map((g) => g.label)).toEqual(long.slice(0, left.length).map((x) => x.label));
    const last = left[left.length - 1]!;
    const end = last.x + groupText(H(last.key, last.label), 'windows').length * 8;
    expect(end - 8).toBeLessThanOrEqual(624 - '[?] Help'.length * 8);
    expect(h).not.toBeNull();
  });
  it('[?] Help is never dropped, even when nothing else fits', () => {
    const r = fitHints([H('Enter', 'x'.repeat(100))], help, 'windows');
    expect(r.left).toEqual([]);
    expect(r.help?.label).toBe('Help');
  });
  it('mac names are wider (Return), so mac never keeps more pairs than windows', () => {
    const set = Array.from({ length: 12 }, () => H('Enter', 'Labelword'));
    expect(fitHints(set, help, 'mac').left.length).toBeLessThanOrEqual(fitHints(set, help, 'windows').left.length);
  });
});

/** keyhints.md "Which hints show" table, with the logged deviations: title M label, extra nameEntry set. */
const SPEC: Record<string, string[]> = {
  menu: ['Arrows|Move', 'Enter|Choose', '1-9|Pick'],
  menuBack: ['Arrows|Move', 'Enter|Choose', '1-9|Pick', 'Esc|Back'],
  modal: ['Enter|OK'],
  modalChoice: ['Arrows|Move', 'Enter|Choose', 'Esc|Cancel'],
  number: ['0-9|Type', 'Arrows|Adjust', 'Enter|OK', 'Esc|Cancel'],
  name: ['A-Z|Type', 'Backspace|Erase', 'Tab|Random', 'Enter|OK'],
  nameEntry: ['A-Z|Type', 'Backspace|Erase', 'Enter|OK'],
  title: ['Arrows|Move', 'Enter|Choose', '1-9|Pick', 'M|Auto-resolve'],
  travel: ['Arrows|Move', 'Enter|Choose', 'T|Travel on', 'M|Mute'],
  travelAuto: ['Any key|Stop'],
  table: ['Enter|Back', 'Esc|Back'],
  guide: ['Arrows|Page', 'Enter|Next', 'Esc|Back'],
  options: ['Up/Down|Move', 'Left/Right|Change', 'Enter|Change', 'Esc|Back'],
  minigameIntro: ['Enter|Start', 'Esc|Pause'],
  minigamePlay: ['Arrows|Steer', 'Esc|Pause'],
  minigameFire: ['Arrows|Steer', 'Space|Fire', 'Esc|Pause'],
  minigameDone: ['Enter|Continue'],
  help: ['Any key|Close'],
  none: [],
};

describe('keyhints.md "Which hints show" / "ui.json"', () => {
  it.each(Object.entries(SPEC))('hints.%s exists with the spec pairs in order', (id, pairs) => expect(hints[id]).toEqual(pairs));
  it('hints.helpKey is "?|Help"', () => expect(hints['helpKey']).toBe('?|Help'));
  it('every pair has exactly one "|" and a label of at most 12 characters', () => {
    for (const [id, set] of Object.entries(hints)) {
      if (!Array.isArray(set)) continue;
      for (const e of set) {
        expect(e.split('|').length, `${id}: ${e}`).toBe(2);
        expect(parseHint(e)!.label.length, `${id}: ${e}`).toBeLessThanOrEqual(12);
      }
    }
  });
});

describe('keyhints.md "Visibility"', () => {
  // T-071 changed "Visibility" to On / Off (default on, legacy auto reads as on); keyhints.md "Visibility".
  it('Options default keyHints is on', () => expect(DEFAULT_OPTIONS.keyHints).toBe('on'));
  it('keyHints parses, serializes and round-trips for on and off; legacy auto and garbage read as on', () => {
    for (const v of ['on', 'off'] as const) {
      const o = { ...DEFAULT_OPTIONS, keyHints: v };
      expect(parseOptions(serializeOptions(o)).keyHints).toBe(v);
      expect(JSON.parse(serializeOptions(o)).keyHints).toBe(v);
    }
    expect(parseOptions('{"keyHints":"auto"}').keyHints).toBe('on');
    expect(parseOptions('{"keyHints":"maybe"}').keyHints).toBe('on');
    expect(parseOptions(null).keyHints).toBe('on');
  });
  it('on shows the band content on every platform (touch gets buttons); off hides it', () => {
    expect(hintsShown('on')).toBe(true);
    expect(hintsShown('off')).toBe(false);
  });
});

describe('keyhints.md "Visibility": numberRow gains Shift+3 -> row 13', () => {
  const k = (key: string, code: string, shiftKey: boolean) => numberRow({ key, code, shiftKey });
  it('Shift+1/2/3 pick rows 11/12/13 (0-based 10/11/12) by physical key', () => {
    expect(k('!', 'Digit1', true)).toBe(10);
    expect(k('@', 'Digit2', true)).toBe(11);
    expect(k('#', 'Digit3', true)).toBe(12);
  });
  it('0 is row 10 and 1-9 are rows 1-9', () => {
    expect(k('0', 'Digit0', false)).toBe(9);
    expect(k('3', 'Digit3', false)).toBe(2);
  });
});
