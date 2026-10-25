import { expect, test } from '@playwright/test';
import { gotoScene } from './helpers';

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
