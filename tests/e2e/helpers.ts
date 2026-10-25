import { expect, type Page } from '@playwright/test';

/**
 * URL suffix that makes mini-games auto-resolve for the page load. The run helpers below default to it because their
 * hazard choreography (Enter on Thread it, T auto-travel) expects the statistical crossing, not a Threading / Flare
 * scene (minigames.md "Options flag"). Specs that play the real mini-games pass `''`.
 */
export const AUTO_MINIGAMES = '&minigames=auto';

/** Navigate to the game with a fixed seed (plus `query`, e.g. AUTO_MINIGAMES) and wait for the given scene key. */
export async function gotoScene(page: Page, sceneKey: string, seed: string | number = 'test', query = ''): Promise<void> {
  await page.goto(`/?seed=${encodeURIComponent(String(seed))}${query}`);
  await expect(page.locator('body')).toHaveAttribute('data-scene', sceneKey);
}

/** Save a screenshot to test-results/screens/<name>.png for designer review. */
export async function snap(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `test-results/screens/${name}.png` });
}

export const body = (page: Page) => page.locator('body');
export const getState = (page: Page) => page.evaluate(() => window.__PROXIMA__?.state ?? null);
export const sceneOf = (page: Page) => page.evaluate(() => document.body.dataset['scene'] ?? '');

/** Wait until no day is animating. */
export async function idle(page: Page): Promise<void> {
  await expect(body(page)).not.toHaveAttribute('data-busy', '1');
}

/** Title -> Setup -> Store with defaults (Corporate Executive, default names, first launch window). Auto-resolve by default. */
export async function startRun(page: Page, seed: string, snapSteps = false, query = AUTO_MINIGAMES): Promise<void> {
  await gotoScene(page, 'Title', seed, query);
  if (snapSteps) await snap(page, 'Title');
  await page.keyboard.press('Enter');
  await expect(body(page)).toHaveAttribute('data-scene', 'Setup');
  if (snapSteps) await snap(page, 'Setup-1-profession');
  await page.keyboard.press('Enter'); // profession
  for (let i = 0; i < 5; i++) {
    if (snapSteps) await snap(page, `Setup-${i + 2}-name${i + 1}`);
    await page.keyboard.press('Enter');
  }
  if (snapSteps) await snap(page, 'Setup-7-window');
  await page.keyboard.press('Enter');
  await expect(body(page)).toHaveAttribute('data-scene', 'Store');
}

/** Store: open row `row`, type quantity, confirm. */
export async function buy(page: Page, row: number, qty: number): Promise<void> {
  await page.keyboard.press(String(row));
  await page.keyboard.type(String(qty));
  await page.keyboard.press('Enter');
}

/** Store: leave (row 8), confirm, dismiss farewell; ends in Travel. */
export async function leaveStore(page: Page): Promise<void> {
  await page.keyboard.press('8');
  await expect(body(page)).toHaveAttribute('data-modal', '1');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect(body(page)).toHaveAttribute('data-scene', 'Travel');
}

/** Press Enter (up to `max` times) until body[data-scene] equals `scene`. */
export async function pressUntilScene(page: Page, scene: string, max = 20): Promise<void> {
  for (let i = 0; i < max && (await sceneOf(page)) !== scene; i++) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(50);
  }
  await expect(body(page)).toHaveAttribute('data-scene', scene);
}

/**
 * Drive the game with T (auto-travel), Enter on Waypoint scenes and modals, until `stop(state, scene)` is true or the
 * status leaves 'traveling'. Returns the final state. `onScene` is called once per newly seen scene (for screenshots).
 */
export async function autoTravelUntil(
  page: Page,
  stop: (s: NonNullable<Awaited<ReturnType<typeof getState>>>, scene: string) => boolean,
  opts: { maxSteps?: number; onScene?: (scene: string) => Promise<void> } = {},
) {
  const seen = new Set<string>();
  for (let i = 0; i < (opts.maxSteps ?? 20000); i++) {
    const snapshot = await page.evaluate(() => ({
      s: window.__PROXIMA__?.state ?? null,
      scene: document.body.dataset['scene'] ?? '',
      busy: document.body.dataset['busy'] === '1',
      modal: document.body.dataset['modal'] === '1',
    }));
    const { s, scene, busy, modal } = snapshot;
    if (s && stop(s, scene)) return s;
    if (opts.onScene && !seen.has(scene)) { seen.add(scene); await opts.onScene(scene); }
    if (s && s.status !== 'traveling') return s;
    if (busy) { await page.waitForTimeout(40); continue; }
    if (scene === 'Travel' && !modal) await page.keyboard.press('t');
    else await page.keyboard.press('Enter');
    await page.waitForTimeout(40);
  }
  throw new Error('autoTravelUntil: step budget exhausted');
}

type RunState = NonNullable<Awaited<ReturnType<typeof getState>>>;

/** Standard generous Executive shopping (4 drives, 3000 rations, 10 suits, 5 boxes, 1 of each part), then leave to Travel. */
export async function generousRun(page: Page, seed: string, query = AUTO_MINIGAMES): Promise<void> {
  await startRun(page, seed, false, query);
  for (const [row, qty] of [[1, 4], [2, 3000], [3, 10], [4, 5], [5, 1], [6, 1], [7, 1]] as const) await buy(page, row, qty);
  await leaveStore(page);
}

/**
 * Auto-travel to the Waypoint scene of waypoint `wp` (stops BEFORE pressing anything there). Earlier hazards are threaded
 * (Enter picks the first enabled option, the outcome modal and beacon prompts are dismissed by Enter).
 */
export async function reachWaypoint(page: Page, wp: number, maxSteps = 6000): Promise<RunState> {
  const s = await autoTravelUntil(page, (st, scene) => scene === 'Waypoint' && st.arrivedAt === wp, { maxSteps });
  expect(s.arrivedAt, `reached waypoint ${wp} (status ${s.status})`).toBe(wp);
  return s;
}

/** At a hazard's Waypoint scene: open the Hazard scene and press option `row` (1 thread, 2 shields, 3 tug, 4 pilot). */
export async function approachAndCross(page: Page, row: number): Promise<void> {
  await page.keyboard.press('Enter');
  await expect(body(page)).toHaveAttribute('data-scene', 'Hazard');
  await page.waitForTimeout(150);
  await page.keyboard.press(String(row));
}

/** All text currently drawn by Phaser Text objects in scene `key` (the canvas is opaque to Playwright; this reads the scene graph). */
export async function sceneTexts(page: Page, key: string): Promise<string[]> {
  return page.evaluate((k) => {
    const game = window.__PROXIMA__?.game as { scene: { getScene(k: string): { children: { list: { text?: unknown }[] } } } } | undefined;
    const sc = game?.scene.getScene(k);
    return (sc?.children.list ?? []).map((o) => o.text).filter((x): x is string => typeof x === 'string');
  }, key);
}

/** Wait until every day animation and modal has finished. */
export async function settle(page: Page): Promise<void> {
  await idle(page);
  await expect(body(page)).not.toHaveAttribute('data-modal', '1');
}

/** Save-format version for `__PROXIMA__.loadState` (STATE_VERSION in src/sim/types.ts). */
const SAVE_VERSION = 3;

/**
 * `?debug=1` runs only: copy the live state, apply `patch` (e.g. park the ship at a crossing), and load it with
 * `__PROXIMA__.loadState`, which opens Hazard (crossing pending) or Travel.
 */
export async function loadPatchedState(page: Page, patch: Record<string, unknown>): Promise<void> {
  const error = await page.evaluate(([p, version]) => {
    const live = window.__PROXIMA__?.state;
    if (!live || !window.__PROXIMA__?.loadState) return 'no state or no loadState (needs ?debug=1)';
    const state = { ...JSON.parse(JSON.stringify(live)), ...p };
    return window.__PROXIMA__.loadState(JSON.stringify({ version, state }));
  }, [patch, SAVE_VERSION] as const);
  expect(error).toBeNull();
}

/** Read `__PROXIMA__.minigame` as plain data (null outside the mini-game scenes). */
export const minigameOf = (page: Page) => page.evaluate(() => {
  const m = window.__PROXIMA__?.minigame;
  return m ? { kind: m.kind, elapsed: m.elapsed, result: m.result ?? null, skipped: m.skipped ?? false } : null;
});
