import { expect, test } from '@playwright/test';
import { gotoScene, snap } from './helpers';

test('game boots to the title screen', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await gotoScene(page, 'Title');
  await expect(page.locator('canvas')).toBeVisible();
  const info = await page.evaluate(() => ({ version: window.__PROXIMA__?.version, seed: window.__PROXIMA__?.seed, state: window.__PROXIMA__?.state }));
  expect(info.version).toBeTruthy();
  expect(info.seed).toBe('test');
  expect(info.state).toBeNull();
  await snap(page, 'Title');
  expect(errors).toEqual([]);
});
