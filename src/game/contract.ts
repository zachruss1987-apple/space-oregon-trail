/** The test/debug surface on window (see src/sim/README.md "UI contract"). */
import type { GameState, MiniGameKind, MiniGameResult } from '@/sim';

/** `window.__PROXIMA__.minigame` while a mini-game scene runs (minigames.md "Debug hooks"). */
export interface MiniGameDebug {
  kind: MiniGameKind;
  /** Fixed-step play seconds (excludes countdown and pause). */
  readonly elapsed: number;
  /** Set when the run ends, before the result panel closes. */
  result?: MiniGameResult;
  /** Set when the run was skipped (penalty path). */
  skipped?: boolean;
  /** End the run now as if time ran out (remaining steps run instantly, no input). */
  finishNow(): void;
  /** Test builds / `?debug=1`: end with this result (validated like normal play). Returns the refusal, or null. */
  finishWith(result: unknown): string | null;
}

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
  /** Live mini-game hooks, or null outside the mini-game scenes. */
  minigame: MiniGameDebug | null;
  /** `?debug=1` / dev builds only: replace the run with a `toJSON` state and open Hazard (crossing pending) or Travel. */
  loadState?: (json: string) => string | null;
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
  markFlag('paused', false);
  delete document.body.dataset['minigame'];
}

/**
 * Flag UI states e2e tests wait on: `data-modal="1"` while a modal is open, `data-busy="1"` while a day animates,
 * `data-paused="1"` while a mini-game is paused.
 */
export function markFlag(name: 'modal' | 'busy' | 'beacon' | 'paused', on: boolean): void {
  if (on) document.body.dataset[name] = '1';
  else delete document.body.dataset[name];
}
