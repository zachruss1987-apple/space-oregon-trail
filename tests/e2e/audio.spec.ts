import { expect, test } from '@playwright/test';
import { buy, gotoScene, leaveStore, startRun } from './helpers';

test('audio stays locked before input and an unlock is attempted on the first key', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await gotoScene(page, 'Title');
  await expect.poll(() => page.evaluate(() => window.__PROXIMA__?.audio?.state)).toBe('locked');
  expect(await page.evaluate(() => window.__PROXIMA__?.audio?.unlockAttempts)).toBe(0);

  await page.keyboard.press('Shift'); // a gesture that does not advance the Title scene
  // Headless Chromium may refuse resume(); 'running' or 'suspended' both prove the context was created by the attempt.
  await expect.poll(() => page.evaluate(() => window.__PROXIMA__?.audio?.state)).not.toBe('locked');
  const a = await page.evaluate(() => window.__PROXIMA__?.audio);
  expect(a?.unlockAttempts).toBeGreaterThanOrEqual(1);
  expect(['running', 'suspended']).toContain(a?.state);
  expect(errors).toEqual([]);
});

const playing = (page: import('@playwright/test').Page) => page.evaluate(() => window.__PROXIMA__?.audio?.playing ?? null);
const unlock = async (page: import('@playwright/test').Page) => {
  await page.keyboard.press('Shift'); // a gesture that advances no scene
  await expect.poll(() => page.evaluate(() => window.__PROXIMA__?.audio?.state)).not.toBe('locked');
};

// audio.md Songs table: Title plays `title`; Travel plays `travel`.
test('music follows the scene: title on Title, travel on Travel', async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await gotoScene(page, 'Title');
  await unlock(page);
  await expect.poll(() => playing(page)).toBe('title');
  await startRun(page, 'SEED-1');
  await expect.poll(() => playing(page)).toBe('station'); // Store shares the station theme
  await buy(page, 1, 3);
  await buy(page, 2, 1000);
  await leaveStore(page);
  await expect.poll(() => playing(page)).toBe('travel');
  expect(errors).toEqual([]);
});

// audio.md Persistence: music 0 is silent and survives a reload (Options step 0..10 -> proxima.options + proxima.settings).
test('Options music volume 0 persists after reload', async ({ page }) => {
  await gotoScene(page, 'Title');
  await page.keyboard.press('4');
  await expect(page.locator('body')).toHaveAttribute('data-scene', 'Options');
  await page.keyboard.press('ArrowDown'); // row 2: Music volume
  for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowLeft');
  await expect.poll(() => page.evaluate(() => window.__PROXIMA__?.audio?.volumes.music)).toBe(0);
  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-scene', 'Title');
  await expect.poll(() => page.evaluate(() => window.__PROXIMA__?.audio?.volumes.music)).toBe(0);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('proxima.settings') ?? '{}') as { music?: number });
  expect(stored.music).toBe(0);
});

// audio.md Mixing "Mute": M toggles audio().isMuted anywhere but Title (exposed as __PROXIMA__.audio.volumes.muted), persisted.
test('M toggles mute outside the Title scene and the choice persists', async ({ page }) => {
  await gotoScene(page, 'Title');
  await page.keyboard.press('4');
  await expect(page.locator('body')).toHaveAttribute('data-scene', 'Options');
  await unlock(page);
  expect(await page.evaluate(() => window.__PROXIMA__?.audio?.volumes.muted)).toBe(false);
  await page.keyboard.press('m');
  await expect.poll(() => page.evaluate(() => window.__PROXIMA__?.audio?.volumes.muted)).toBe(true);
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.__PROXIMA__?.audio?.volumes.muted)).toBe(true);
});
