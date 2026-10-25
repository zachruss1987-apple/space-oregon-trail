import { expect, type Page } from '@playwright/test';

/** Navigate to the game with a fixed seed and wait for the given scene key. */
export async function gotoScene(page: Page, sceneKey: string, seed: string | number = 'test'): Promise<void> {
  await page.goto(`/?seed=${encodeURIComponent(String(seed))}`);
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

/** Title -> Setup -> Store with defaults (Corporate Executive, default names, first launch window). */
export async function startRun(page: Page, seed: string, snapSteps = false): Promise<void> {
  await gotoScene(page, 'Title', seed);
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
export async function generousRun(page: Page, seed: string): Promise<void> {
  await startRun(page, seed);
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
