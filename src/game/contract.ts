/** The test/debug surface on window (see src/sim/README.md "UI contract"). */
import type { GameState } from '@/sim';

/** `window.__PROXIMA__`. */
export interface ProximaDebug {
  /** The Phaser.Game (typed loosely so e2e tests need no Phaser types). */
  game: unknown;
  /** package.json version. */
  version: string;
  /** Seed label in use (the `?seed=` value or the random one shown on the title). */
  seed: string;
  /** Current GameState, or null before a run starts. */
  readonly state: GameState | null;
}

declare global {
  interface Window {
    /** Exposed for Playwright tests and debugging. */
    __PROXIMA__?: ProximaDebug;
  }
}

/** Mark the active scene for e2e tests. */
export function markScene(key: string): void {
  document.body.dataset['scene'] = key;
  markFlag('modal', false);
  markFlag('busy', false);
  markFlag('beacon', false);
}

/** Flag UI states e2e tests wait on: `data-modal="1"` while a modal is open, `data-busy="1"` while a day animates. */
export function markFlag(name: 'modal' | 'busy' | 'beacon', on: boolean): void {
  if (on) document.body.dataset[name] = '1';
  else delete document.body.dataset[name];
}
