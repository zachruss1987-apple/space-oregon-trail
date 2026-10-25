/** KeyRouter publishes the top handler's key hints set (keyhints.md "Which hints show"); numberRow Shift+3 (13 Options rows). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { currentHints } from '@/ui/keyHints';

type Listener = (e: unknown) => void;

beforeEach(() => {
  const listeners = new Map<string, Listener[]>();
  vi.stubGlobal('window', {
    addEventListener: (t: string, l: Listener) => listeners.set(t, [...(listeners.get(t) ?? []), l]),
    removeEventListener: () => undefined,
  });
  vi.stubGlobal('document', { activeElement: null, getElementById: () => null, body: { dataset: {} } });
});
afterEach(() => vi.unstubAllGlobals());

/** A scene stub with just the shutdown hook the router uses. */
function fakeScene(): { events: { once: (n: string, f: () => void) => void }; shutdown: () => void } {
  let onShutdown: () => void = () => undefined;
  return { events: { once: (_n, f) => (onShutdown = f) }, shutdown: () => onShutdown() };
}

describe('KeyRouter hints', async () => {
  const { KeyRouter, hintSetOf } = await import('@/ui/keys');

  it('publishes none for an empty stack, then the top handler set on push / remove / set', () => {
    const router = new KeyRouter(fakeScene() as never);
    expect(currentHints().id).toBe('none');
    const menu = { onKey: () => undefined, hints: 'menu' };
    const prompt = { onKey: () => undefined, hints: 'number', textEntry: true };
    router.push(menu);
    expect(currentHints()).toEqual({ id: 'menu', textEntry: false });
    router.push(prompt);
    expect(currentHints()).toEqual({ id: 'number', textEntry: true });
    router.remove(prompt);
    expect(currentHints().id).toBe('menu');
    router.set({ onKey: () => undefined });
    expect(currentHints().id).toBe('none');
  });

  it('function hints are re-read on refreshHints (Travel auto-travel, mini-game phases)', () => {
    const router = new KeyRouter(fakeScene() as never);
    let auto = false;
    router.push({ onKey: () => undefined, hints: () => (auto ? 'travelAuto' : 'travel') });
    expect(currentHints().id).toBe('travel');
    auto = true;
    router.refreshHints();
    expect(currentHints().id).toBe('travelAuto');
  });

  it('only the newest router publishes', () => {
    const old = new KeyRouter(fakeScene() as never);
    const fresh = new KeyRouter(fakeScene() as never);
    fresh.push({ onKey: () => undefined, hints: 'guide' });
    old.push({ onKey: () => undefined, hints: 'menu' });
    expect(currentHints().id).toBe('guide');
  });

  it('hintSetOf falls back to none (no handler, no hints, null)', () => {
    expect(hintSetOf(undefined)).toBe('none');
    expect(hintSetOf({ onKey: () => undefined })).toBe('none');
    expect(hintSetOf({ onKey: () => undefined, hints: () => null })).toBe('none');
  });
});

describe('numberRow (Options rows 11-13, keyhints.md)', async () => {
  const { numberRow } = await import('@/ui/Menu');
  const key = (k: string, code: string, shiftKey = false): { key: string; code: string; shiftKey: boolean } => ({ key: k, code, shiftKey });
  it('1-9 and 0 pick rows 1-10', () => {
    expect(numberRow(key('1', 'Digit1'))).toBe(0);
    expect(numberRow(key('0', 'Digit0'))).toBe(9);
  });
  it('Shift+1 / Shift+2 / Shift+3 pick rows 11 / 12 / 13 by physical key', () => {
    expect(numberRow(key('!', 'Digit1', true))).toBe(10);
    expect(numberRow(key('"', 'Digit2', true))).toBe(11);
    expect(numberRow(key('£', 'Digit3', true))).toBe(12);
    expect(numberRow(key('$', 'Digit4', true))).toBeNull();
  });
});
