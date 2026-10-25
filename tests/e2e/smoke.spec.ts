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

// M4 acceptance: the production bundle still loads in under 3 s (navigation timing, local preview server).
test('production bundle loads in under 3 s', async ({ page }) => {
  await gotoScene(page, 'Title');
  const ms = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    return nav ? nav.loadEventEnd - nav.startTime : performance.timing.loadEventEnd - performance.timing.navigationStart;
  });
  console.log(`bundle load: ${Math.round(ms)} ms`);
  expect(ms).toBeGreaterThan(0);
  expect(ms).toBeLessThan(3000);
});
