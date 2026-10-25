import { expect, test } from '@playwright/test';
import { gotoScene, snap } from './helpers';

test('game boots and renders the boot scene', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await gotoScene(page, 'Boot');
  await expect(page.locator('canvas')).toBeVisible();
  const version = await page.evaluate(() => window.__PROXIMA__?.version);
  expect(version).toBeTruthy();
  await snap(page, 'Boot');
  expect(errors).toEqual([]);
});
