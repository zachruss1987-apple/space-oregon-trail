import { expect, test } from '@playwright/test';

test('game boots and renders the boot scene', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-scene', 'Boot');
  const version = await page.evaluate(() => window.__PROXIMA__?.version);
  expect(version).toBeTruthy();
  expect(errors).toEqual([]);
});
