/** Key hints bar rules (docs/design/keyhints.md). */
import { describe, expect, it } from 'vitest';
import { UI_TEXT } from '@/content';
import {
  currentHints, detectPlatform, fitHints, groupText, HINT_BUDGET_PX, hintsShown, isCanonicalKey, keyLabel, onHints, parseHint,
  parseHintSet, platformOverride, publishHints, type Hint, type Platform,
} from '@/ui/keyHints';

const UA = {
  win: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  linux: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
  ipad: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/124.0 Mobile Safari/537.36',
};
const env = (userAgent: string, uaPlatform = '', coarsePointer = false): { userAgent: string; uaPlatform: string; coarsePointer: boolean } => ({ userAgent, uaPlatform, coarsePointer });
const ALL: Platform[] = ['mac', 'windows', 'linux', 'touch'];

describe('detectPlatform (keyhints.md "Platform detection")', () => {
  it.each([
    ['Windows UA', env(UA.win), 'windows'],
    ['Macintosh UA', env(UA.mac), 'mac'],
    ['Linux UA', env(UA.linux), 'linux'],
    ['iPhone UA (mentions Mac OS X) is touch first', env(UA.iphone), 'touch'],
    ['iPad UA', env(UA.ipad), 'touch'],
    ['Android UA (mentions Linux)', env(UA.android), 'touch'],
    ['coarse pointer beats a desktop UA', env(UA.win, '', true), 'touch'],
    ['uaPlatform macOS with a generic UA', env('Mozilla/5.0', 'macOS'), 'mac'],
    ['uaPlatform Windows with a generic UA', env('Mozilla/5.0', 'Windows'), 'windows'],
    ['unknown falls back to linux', env('', ''), 'linux'],
  ] as const)('%s', (_name, e, want) => expect(detectPlatform(e)).toBe(want));

  it('?platform= overrides detection for each platform', () => {
    for (const p of ALL) expect(detectPlatform(env(UA.win, '', true), `?seed=1&platform=${p}`)).toBe(p);
  });
  it('an unknown ?platform= value is ignored', () => {
    expect(platformOverride('?platform=amiga')).toBeNull();
    expect(detectPlatform(env(UA.mac), '?platform=amiga')).toBe('mac');
  });
});

describe('keyLabel (platform key names)', () => {
  it('Mac says Return and Delete', () => {
    expect(keyLabel('Enter', 'mac')).toBe('Return');
    expect(keyLabel('Backspace', 'mac')).toBe('Delete');
  });
  it('Windows and Linux keep Enter and Backspace', () => {
    for (const p of ['windows', 'linux'] as Platform[]) {
      expect(keyLabel('Enter', p)).toBe('Enter');
      expect(keyLabel('Backspace', p)).toBe('Backspace');
    }
  });
  it('other keys are unchanged everywhere', () => {
    for (const p of ALL) for (const k of ['Esc', 'Space', 'Tab', 'Shift+1', 'Arrows', 'A-Z', '1-9', '?']) expect(keyLabel(k, p)).toBe(k);
  });
});

describe('parseHint / parseHintSet ("Key|Label")', () => {
  it('splits on the one bar', () => expect(parseHint('Esc|Back')).toEqual({ key: 'Esc', label: 'Back' }));
  it('rejects entries without exactly one bar or with an empty side', () => {
    for (const bad of ['Esc Back', 'a|b|c', '|Back', 'Esc|', 7, null]) expect(parseHint(bad)).toBeNull();
  });
  it('skips malformed entries and non-arrays', () => {
    expect(parseHintSet(['Enter|OK', 'junk', 'Esc|Cancel'])).toEqual([{ key: 'Enter', label: 'OK' }, { key: 'Esc', label: 'Cancel' }]);
    expect(parseHintSet('Enter|OK')).toEqual([]);
  });
});

const H = (key: string, label: string): Hint => ({ key, label });
const HELP = H('?', 'Help');
const wide = Array.from({ length: 12 }, (_, i) => H(String.fromCharCode(65 + i), 'Labelword12'));
const px = (h: Hint, p: Platform = 'windows'): number => groupText(h, p).length * 8;

describe('fitHints (keyhints.md "Content and layout")', () => {
  it('lays groups from x = 8 with two spaces between them, 8 px per glyph', () => {
    const { left } = fitHints([H('Arrows', 'Move'), H('Enter', 'Choose')], HELP, 'windows');
    expect(left.map((g) => g.x)).toEqual([8, 8 + ('[Arrows] Move'.length + 2) * 8]);
  });
  it('puts [?] Help flush right inside the 624 px budget', () => {
    expect(fitHints([H('Enter', 'OK')], HELP, 'linux').help).toEqual({ key: '?', label: 'Help', x: 8 + 624 - '[?] Help'.length * 8 });
  });
  it('uses platform key names, which changes widths', () => {
    expect(groupText(H('Enter', 'OK'), 'mac')).toBe('[Return] OK');
    expect(fitHints([H('Enter', 'OK')], null, 'mac').left[0]?.key).toBe('Return');
  });
  it('drops pairs from the end of the set until it fits; help never drops', () => {
    const { left, help } = fitHints(wide, HELP, 'windows');
    expect(help).not.toBeNull();
    expect(left.length).toBeLessThan(wide.length);
    expect(left.map((g) => g.key)).toEqual(wide.slice(0, left.length).map((h) => h.key));
    const last = left[left.length - 1]!;
    const end = last.x + px(H(last.key, last.label));
    expect(end + 16).toBeLessThanOrEqual(help!.x);
    expect(end + 16 + px(wide[left.length]!) + 16).toBeGreaterThan(help!.x);
  });
  it('without help the whole budget is used', () => {
    const n = fitHints(wide, null, 'windows').left.length;
    const total = (k: number): number => k * px(wide[0]!) + (k - 1) * 16;
    expect(total(n)).toBeLessThanOrEqual(HINT_BUDGET_PX);
    expect(total(n + 1)).toBeGreaterThan(HINT_BUDGET_PX);
  });
  it('an empty set gives an empty bar', () => expect(fitHints([], null, 'linux')).toEqual({ left: [], help: null }));
});

describe('visibility option (keyhints.md "Visibility")', () => {
  it('Auto hides on touch only; On always; Off never', () => {
    expect(hintsShown('auto', 'windows')).toBe(true);
    expect(hintsShown('auto', 'touch')).toBe(false);
    expect(hintsShown('on', 'touch')).toBe(true);
    expect(hintsShown('off', 'mac')).toBe(false);
  });
});

describe('hint store (router -> bar)', () => {
  it('notifies listeners and keeps the last state', () => {
    const seen: string[] = [];
    const off = onHints((s) => seen.push(`${s.id}:${s.textEntry}`));
    publishHints('menu');
    publishHints('number', true);
    off();
    publishHints('none');
    expect(seen).toEqual(['menu:false', 'number:true']);
    expect(currentHints()).toEqual({ id: 'none', textEntry: false });
  });
});

/** The set ids in the keyhints.md table. `nameEntry` is extra (decisions.md 2026-10-25, T-069 key hints). */
const SPEC_SETS = [
  'menu', 'menuBack', 'modal', 'modalChoice', 'number', 'name', 'title', 'travel', 'travelAuto', 'table', 'guide', 'options',
  'minigameIntro', 'minigamePlay', 'minigameFire', 'minigameDone', 'help', 'none',
];

describe('ui.json hints.* (keyhints.md "ui.json")', () => {
  const hints = (UI_TEXT as unknown as { hints: Record<string, unknown> }).hints;
  it('every set in the spec table exists as an array', () => {
    for (const id of [...SPEC_SETS, 'nameEntry']) expect(Array.isArray(hints[id]), id).toBe(true);
  });
  it('every entry has exactly one bar, a canonical key and a label of at most 12 chars, no full stop', () => {
    for (const [id, set] of Object.entries(hints)) {
      if (id === 'helpKey') continue;
      for (const e of set as unknown[]) {
        expect(typeof e === 'string' && e.split('|').length === 2, `${id}: ${String(e)}`).toBe(true);
        const h = parseHint(e)!;
        expect(isCanonicalKey(h.key), `${id}: ${h.key}`).toBe(true);
        expect(h.label.length, `${id}: ${h.label}`).toBeLessThanOrEqual(12);
        expect(h.label, id).not.toMatch(/\.$/);
      }
    }
  });
  it('help is "Any key|Close", none is empty, helpKey is "?|Help"', () => {
    expect(hints['help']).toEqual(['Any key|Close']);
    expect(hints['none']).toEqual([]);
    expect(hints['helpKey']).toBe('?|Help');
  });
  it('the sets the spec spells out match it', () => {
    expect(hints['menuBack']).toEqual(['Arrows|Move', 'Enter|Choose', '1-9|Pick', 'Esc|Back']);
    expect(hints['options']).toEqual(['Up/Down|Move', 'Left/Right|Change', 'Enter|Change', 'Esc|Back']);
    expect(hints['modal']).toEqual(['Enter|OK']);
    expect(hints['travelAuto']).toEqual(['Any key|Stop']);
    expect(hints['minigameFire']).toEqual(['Arrows|Steer', 'Space|Fire', 'Esc|Pause']);
  });
  it('every set fits next to [?] Help on every keyboard platform without dropping a pair', () => {
    for (const p of ['mac', 'windows', 'linux'] as Platform[]) {
      for (const id of SPEC_SETS) {
        const set = parseHintSet(hints[id]);
        expect(fitHints(set, HELP, p).left.length, `${id} on ${p}`).toBe(set.length);
      }
    }
  });
});
