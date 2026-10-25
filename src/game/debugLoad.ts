/**
 * `__PROXIMA__.loadState(json)` (`?debug=1` / dev builds only): replace the live run with a saved `GameState` and open
 * the scene it implies (Hazard while a crossing is pending, else Travel). Lets e2e tests start at, e.g., the Flare Belt.
 */
import type Phaser from 'phaser';
import { fromJSON } from '@/sim';
import { session } from './session';

/** Load `json` (toJSON format) into the session; returns a refusal or null. */
export function debugLoadState(game: Phaser.Game, json: string): string | null {
  if (!session.debug) return 'loadState needs ?debug=1.';
  try {
    session.state = fromJSON(json);
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
  session.shownWaypoint = session.state.arrivedAt;
  session.pendingDay = null;
  const active = game.scene.getScenes(true)[0];
  active?.scene.start(session.state.crossing ? 'Hazard' : 'Travel');
  return null;
}
