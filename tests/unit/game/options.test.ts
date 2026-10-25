import { describe, expect, it } from 'vitest';
import {
  crtWanted, cycle, DEFAULT_OPTIONS, parseOptions, reducedMotionOn, serializeOptions, TEXT_SPEEDS, touchUiOn,
} from '@/game/options';

describe('parseOptions (ui.md "Options screen")', () => {
  it('garbage or missing values fall back to defaults', () => {
    expect(parseOptions(null)).toEqual(DEFAULT_OPTIONS);
    expect(parseOptions('not json')).toEqual(DEFAULT_OPTIONS);
    expect(parseOptions('[1,2]')).toEqual(DEFAULT_OPTIONS);
    expect(parseOptions('{"music":"loud","textSpeed":"warp","palette":7,"crt":"yes"}')).toEqual(DEFAULT_OPTIONS);
  });
  it('defaults match ui.md: music 6, sfx 8, Normal, Auto, Play, Auto, Off', () => {
    expect(DEFAULT_OPTIONS).toMatchObject({ music: 6, sfx: 8, textSpeed: 'normal', touch: 'auto', keyHints: 'auto', autoResolveMiniGames: false, reducedMotion: 'auto', palette: 'standard', crt: null });
  });
  it('keyHints is a TriState, default Auto, garbage falls back (keyhints.md "Visibility")', () => {
    expect(parseOptions('{"keyHints":"off"}').keyHints).toBe('off');
    expect(parseOptions('{"keyHints":"maybe"}').keyHints).toBe('auto');
    expect(parseOptions(serializeOptions({ ...DEFAULT_OPTIONS, keyHints: 'on' })).keyHints).toBe('on');
  });
  it('clamps volume steps to 0..10 integers', () => {
    expect(parseOptions('{"music":14,"sfx":-3}')).toMatchObject({ music: 10, sfx: 0 });
    expect(parseOptions('{"music":4.6}').music).toBe(5);
  });
  it('reads the M3 keys (autoResolveMiniGames, touchControls)', () => {
    expect(parseOptions('{"autoResolveMiniGames":true,"touchControls":true}')).toMatchObject({ autoResolveMiniGames: true, touch: 'on' });
  });
  it('round-trips through serializeOptions and keeps the M3 touchControls flag', () => {
    const o = { ...DEFAULT_OPTIONS, crt: false, music: 3, textSpeed: 'instant' as const, touch: 'on' as const, palette: 'cb' as const };
    const json = serializeOptions(o);
    expect(parseOptions(json)).toEqual(o);
    expect(JSON.parse(json)).toMatchObject({ v: 1, touchControls: true });
  });
});

describe('derived options', () => {
  it('reduced motion: On always, Auto follows the OS, Off never', () => {
    expect(reducedMotionOn({ ...DEFAULT_OPTIONS, reducedMotion: 'on' }, false)).toBe(true);
    expect(reducedMotionOn({ ...DEFAULT_OPTIONS, reducedMotion: 'auto' }, true)).toBe(true);
    expect(reducedMotionOn({ ...DEFAULT_OPTIONS, reducedMotion: 'off' }, true)).toBe(false);
  });
  it('touch controls: Auto shows them on touch screens only', () => {
    expect(touchUiOn(DEFAULT_OPTIONS, true)).toBe(true);
    expect(touchUiOn(DEFAULT_OPTIONS, false)).toBe(false);
    expect(touchUiOn({ ...DEFAULT_OPTIONS, touch: 'off' }, true)).toBe(false);
  });
  it('CRT: environment default until chosen; reduced motion forces it off', () => {
    expect(crtWanted(DEFAULT_OPTIONS, true, false)).toBe(true);
    expect(crtWanted(DEFAULT_OPTIONS, false, false)).toBe(false);
    expect(crtWanted({ ...DEFAULT_OPTIONS, crt: true }, false, false)).toBe(true);
    expect(crtWanted({ ...DEFAULT_OPTIONS, crt: true }, true, true)).toBe(false);
  });
  it('cycle wraps both ways', () => {
    expect(cycle(TEXT_SPEEDS, 'instant', 1)).toBe('slow');
    expect(cycle(TEXT_SPEEDS, 'slow', -1)).toBe('instant');
  });
});

describe('difficulty option (T-040)', () => {
  it('defaults to spacer, reads a valid level, rejects junk, round-trips', () => {
    expect(DEFAULT_OPTIONS.difficulty).toBe('spacer');
    expect(parseOptions('{"difficulty":"pathfinder"}').difficulty).toBe('pathfinder');
    expect(parseOptions('{"difficulty":"nightmare"}').difficulty).toBe('spacer');
    const o = { ...DEFAULT_OPTIONS, difficulty: 'greenhorn' as const };
    expect(parseOptions(serializeOptions(o))).toEqual(o);
  });
});
