import { expect, test } from '@playwright/test';
import { snap } from './helpers';

// Dev gallery for designer review (no pixel asserts): page 0 = fonts, sprite pages, then the
// travel composition (second to last) and the title hero (last).
test('gfx preview scene renders fonts, sprites, travel composition and hero', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?scene=gfxpreview');
  await expect(page.locator('body')).toHaveAttribute('data-scene', 'GfxPreview');
  await page.waitForTimeout(300);
  await snap(page, 'GfxPreview');
  const pages = Number(await page.locator('body').getAttribute('data-pages'));
  expect(pages).toBeGreaterThan(3);
  for (let i = 1; i < pages; i++) {
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('body')).toHaveAttribute('data-page', String(i));
    if (i >= pages - 2) await page.waitForTimeout(600);
    await snap(page, i === pages - 2 ? 'GfxPreview-travel' : i === pages - 1 ? 'GfxPreview-hero' : `GfxPreview-${i}`);
  }
  expect(errors).toEqual([]);
});

// ?crt=1 enables the WebGL post pipeline (skipped silently on Canvas); screenshots show the effect.
test('gfx preview with the CRT pipeline', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?scene=gfxpreview&crt=1');
  await expect(page.locator('body')).toHaveAttribute('data-scene', 'GfxPreview');
  await expect(page.locator('body')).toHaveAttribute('data-crt', /on|off/);
  const pages = Number(await page.locator('body').getAttribute('data-pages'));
  for (let i = 1; i < pages; i++) await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(500);
  await snap(page, 'GfxPreview-crt-hero');
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(500);
  await snap(page, 'GfxPreview-crt-travel');
  expect(errors).toEqual([]);
});
