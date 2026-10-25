import { expect, test } from '@playwright/test';
import { snap } from './helpers';

// Dev gallery for designer review (no pixel asserts): page 0 = fonts, then sprite pages.
test('gfx preview scene renders fonts and sprites', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?scene=gfxpreview');
  await expect(page.locator('body')).toHaveAttribute('data-scene', 'GfxPreview');
  await page.waitForTimeout(300);
  await snap(page, 'GfxPreview');
  const pages = Number(await page.locator('body').getAttribute('data-pages'));
  expect(pages).toBeGreaterThan(1);
  for (let i = 1; i < pages; i++) {
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('body')).toHaveAttribute('data-page', String(i));
    await snap(page, `GfxPreview-${i}`);
  }
  expect(errors).toEqual([]);
});
