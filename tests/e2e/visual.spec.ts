import { expect, test, type Page } from '@playwright/test';
import {
  autoTravelUntil, body, buy, generousRun, leaveStore, loadPatchedState, reachWaypoint, sceneOf, startRun, settle,
} from './helpers';
import { FAST_FIRST_WAYPOINT_SEEDS } from './seeds';

// Visual regression (M4 tests): one baseline per scene under tests/e2e/__screenshots__/<platform>/ (see
// playwright.config.ts snapshotPathTemplate). Baselines are platform-specific (font rasterization, GPU/WebGL), so these
// run on win32 only until Linux baselines are generated for CI (T-038 follow-up; the PM decides CI handling).
// Determinism: fixed seed, ?minigames=auto, and reduced motion + instant text + CRT off in `proxima.options` before load,
// so parallax, blinking cursor, typewriter and the CRT shader are all off.
test.skip(process.platform !== 'win32', 'baselines are generated on Windows only; Linux baselines follow in a CI card');

const SEED = FAST_FIRST_WAYPOINT_SEEDS[0] as string;
const OPTIONS = { v: 1, reducedMotion: 'on', textSpeed: 'instant', crt: false, music: 0, sfx: 0 };
const SHOT = { maxDiffPixelRatio: 0.02, threshold: 0.3 } as const;

test.beforeEach(async ({ page }) => {
  await page.addInitScript((o) => {
    try {
      if (!localStorage.getItem('proxima.options')) localStorage.setItem('proxima.options', JSON.stringify(o));
    } catch { /* storage blocked: baseline will differ, test fails loudly */ }
  }, OPTIONS);
});

async function expectScene(page: Page, name: string): Promise<void> {
  await page.waitForTimeout(400); // fade-ins and one frame of the scene art
  await expect(page.locator('canvas')).toHaveScreenshot(`${name}.png`, SHOT);
}

test('Title', async ({ page }) => {
  await page.goto(`/?seed=${SEED}&minigames=auto`);
  await expect(body(page)).toHaveAttribute('data-scene', 'Title');
  await expectScene(page, 'Title');
});

test('Options, TopTen and Guide', async ({ page }) => {
  await page.goto(`/?seed=${SEED}&minigames=auto`);
  await expect(body(page)).toHaveAttribute('data-scene', 'Title');
  await page.keyboard.press('4');
  await expect(body(page)).toHaveAttribute('data-scene', 'Options');
  await expectScene(page, 'Options');
  await page.keyboard.press('Escape');
  await expect(body(page)).toHaveAttribute('data-scene', 'Title');
  await page.keyboard.press('3');
  await expect(body(page)).toHaveAttribute('data-scene', 'TopTen');
  await expectScene(page, 'TopTen');
  await page.keyboard.press('Escape');
  await expect(body(page)).toHaveAttribute('data-scene', 'Title');
  await page.keyboard.press('2');
  await expect(body(page)).toHaveAttribute('data-scene', 'Guide');
  await expectScene(page, 'Guide');
});

test('Store, Travel, Supplies, Map', async ({ page }) => {
  test.setTimeout(60_000);
  await startRun(page, SEED);
  for (const [row, qty] of [[1, 3], [2, 2000], [3, 10], [4, 5], [5, 1], [6, 1], [7, 1]] as const) await buy(page, row, qty);
  await expectScene(page, 'Store');
  await leaveStore(page);
  await settle(page);
  await expectScene(page, 'Travel');
  await page.keyboard.press('2');
  await expect(body(page)).toHaveAttribute('data-scene', 'Supplies');
  await expectScene(page, 'Supplies');
  await page.keyboard.press('Enter');
  await expect(body(page)).toHaveAttribute('data-scene', 'Travel');
  await page.keyboard.press('3');
  await expect(body(page)).toHaveAttribute('data-scene', 'Map');
  await expectScene(page, 'Map');
});

test('Hazard', async ({ page }) => {
  test.setTimeout(60_000);
  await generousRun(page, SEED);
  await autoTravelUntil(page, (_s, scene) => scene === 'Waypoint');
  await page.keyboard.press('Enter');
  await expect(body(page)).toHaveAttribute('data-scene', 'Hazard');
  await expectScene(page, 'Hazard');
});

test('Station', async ({ page }) => {
  test.setTimeout(60_000);
  await generousRun(page, SEED);
  await reachWaypoint(page, 3);
  await page.keyboard.press('2');
  await expect(body(page)).toHaveAttribute('data-scene', 'Station');
  await expectScene(page, 'Station');
});

test('Death', async ({ page }) => {
  test.setTimeout(60_000);
  await startRun(page, 'DEATHSEED');
  await buy(page, 1, 1);
  await leaveStore(page);
  await autoTravelUntil(page, (_s, scene) => scene === 'Death');
  await page.waitForTimeout(500);
  await expectScene(page, 'Death');
});

test('Arrival', async ({ page }) => {
  test.setTimeout(60_000);
  await generousRun(page, SEED, '&minigames=auto&debug=1');
  await loadPatchedState(page, { status: 'arrived' });
  await page.evaluate(() => (window.__PROXIMA__?.game as { scene: { start(k: string): void } }).scene.start('Arrival'));
  await expect.poll(() => sceneOf(page)).toBe('Arrival');
  await expectScene(page, 'Arrival');
});

test('Salvage instructions', async ({ page }) => {
  test.setTimeout(60_000);
  await startRun(page, SEED, false, ''); // real mini-games
  for (const [row, qty] of [[1, 3], [2, 1500], [4, 3]] as const) await buy(page, row, qty);
  await leaveStore(page);
  await settle(page);
  await page.keyboard.press('8');
  await expect(body(page)).toHaveAttribute('data-modal', '1');
  await page.keyboard.press('Enter');
  await expect(body(page)).toHaveAttribute('data-scene', 'Salvage');
  await expectScene(page, 'Salvage-instructions');
});

test('GfxPreview font page', async ({ page }) => {
  await page.goto('/?scene=gfxpreview');
  await expect(body(page)).toHaveAttribute('data-scene', 'GfxPreview');
  await expect(body(page)).toHaveAttribute('data-page', '0');
  await expectScene(page, 'GfxPreview-fonts');
});
