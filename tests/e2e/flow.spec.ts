import { expect, test, type Page } from '@playwright/test';
import { gotoScene, snap } from './helpers';

const body = (page: Page) => page.locator('body');
const state = (page: Page) => page.evaluate(() => window.__PROXIMA__?.state ?? null);

/** Wait until no day is animating. */
async function idle(page: Page): Promise<void> {
  await expect(body(page)).not.toHaveAttribute('data-busy', '1');
}

test('keyboard only: title, setup defaults, store, five days of travel', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await gotoScene(page, 'Title', 'TESTSEED');

  await page.keyboard.press('Enter'); // Travel the Trail
  await expect(body(page)).toHaveAttribute('data-scene', 'Setup');
  await page.keyboard.press('Enter'); // Corporate Executive
  for (let i = 0; i < 5; i++) await page.keyboard.press('Enter'); // default names
  await snap(page, 'Setup-window');
  await page.keyboard.press('Enter'); // first launch window
  await expect(body(page)).toHaveAttribute('data-scene', 'Store');

  // Store rows 1-7: drives, rations, suits, charge boxes, plates, pumps, gyros.
  const buys: [string, string][] = [['1', '3'], ['2', '1000'], ['3', '10'], ['4', '5'], ['5', '1'], ['6', '1'], ['7', '1']];
  for (const [row, qty] of buys) {
    await page.keyboard.press(row);
    await page.keyboard.type(qty);
    await page.keyboard.press('Enter');
  }
  const bought = await state(page);
  expect(bought?.credits).toBe(1600 - (120 + 300 + 100 + 10 + 30));
  expect(bought?.supplies).toMatchObject({ drives: 3, rations: 1000, suits: 10, charges: 100, plates: 1, pumps: 1, gyros: 1 });
  await snap(page, 'Store');

  await page.keyboard.press('8'); // Leave the store
  await expect(body(page)).toHaveAttribute('data-modal', '1');
  await page.keyboard.press('Enter'); // Yes
  await page.keyboard.press('Enter'); // Mattie's farewell
  await expect(body(page)).toHaveAttribute('data-scene', 'Travel');
  expect((await state(page))?.status).toBe('traveling');

  // Continue until day 5; Enter also dismisses any event modal or waypoint screen along the way.
  for (let guard = 0; guard < 40 && ((await state(page))?.day ?? 0) < 5; guard++) {
    await idle(page);
    await page.keyboard.press('Enter');
    await idle(page);
  }
  expect((await state(page))?.day).toBe(5);
  expect(['Travel', 'Waypoint']).toContain(await body(page).getAttribute('data-scene'));
  await snap(page, 'Travel');
  expect(errors).toEqual([]);
});
