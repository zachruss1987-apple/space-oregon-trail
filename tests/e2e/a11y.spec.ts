/**
 * T-041 / T-063 accessibility: the hidden live region and listbox mirror the canvas, the `?` controls overlay, a
 * keyboard-only run, reduced motion, the colorblind palette and the global mute key.
 */
import { expect, test, type Page } from '@playwright/test';
import { autoTravelUntil, body, buy, getState, gotoScene, idle, leaveStore, sceneTexts, setHalfRations, startRun } from './helpers';

const muted = (page: Page) => page.evaluate(() => window.__PROXIMA__?.audio?.volumes.muted ?? null);
const live = (page: Page) => page.getByRole('log');
const listbox = (page: Page) => page.getByRole('listbox');

async function toTravel(page: Page, seed: string): Promise<void> {
  await startRun(page, seed);
  for (const [row, qty] of [[1, 3], [2, 1500], [3, 4]] as const) await buy(page, row, qty);
  await leaveStore(page);
  await idle(page);
}

async function toOptions(page: Page): Promise<void> {
  await gotoScene(page, 'Title');
  await page.keyboard.press('4');
  await expect(body(page)).toHaveAttribute('data-scene', 'Options');
}

test('live region mirrors the Travel log and the listbox mirrors the menu', async ({ page }) => {
  await toTravel(page, 'A11Y-1');
  const options = listbox(page).getByRole('option');
  await expect(options).toHaveCount(8);
  await expect(options.first()).toHaveText(/^1\. /);
  await expect(options.first()).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowDown');
  await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true');
  await expect(options.first()).toHaveAttribute('aria-selected', 'false');
  await page.keyboard.press('Tab');
  await expect(options.nth(2)).toHaveAttribute('aria-selected', 'true');
  // Continue one day and read the newest log line in the live region.
  const day0 = (await getState(page))!.day;
  await page.keyboard.press('1');
  await idle(page);
  await expect.poll(() => getState(page).then((s) => s?.day ?? 0)).toBeGreaterThan(day0);
  if ((await body(page).getAttribute('data-modal')) === '1') await page.keyboard.press('Enter');
  const last = (await getState(page))!.log.at(-1)!.text.replace(/\s+/g, ' ').trim();
  await expect(live(page)).toContainText(last);
  // A modal's buttons replace the menu in the listbox while it is open.
  await idle(page);
  await page.keyboard.press('4'); // Set rations: sub-menu modal
  await expect(body(page)).toHaveAttribute('data-modal', '1');
  await expect(options.last()).toHaveText(/Cancel/);
  await page.keyboard.press('Escape');
  await expect(body(page)).not.toHaveAttribute('data-modal', '1');
  await expect(options).toHaveCount(8);
});

test('? opens the controls overlay and any key closes it; ? typed in a name stays in the name', async ({ page }) => {
  await gotoScene(page, 'Title');
  await page.keyboard.press('?');
  await expect(body(page)).toHaveAttribute('data-help', '1');
  await expect(live(page)).toContainText('CONTROLS');
  await page.keyboard.press('Escape');
  await expect(body(page)).not.toHaveAttribute('data-help', '1');
  await expect(body(page)).toHaveAttribute('data-scene', 'Title'); // the closing key did nothing else
  await page.keyboard.press('Enter');
  await expect(body(page)).toHaveAttribute('data-scene', 'Setup');
  await page.keyboard.press('Enter'); // profession -> captain's name
  await page.keyboard.type('Ada?');
  await expect(body(page)).not.toHaveAttribute('data-help', '1');
  await expect.poll(async () => (await sceneTexts(page, 'Setup')).some((t) => t.includes('Ada?_'))).toBe(true);
});

test('keyboard only: title to day 10 with no mouse', async ({ page }) => {
  test.setTimeout(process.env.CI ? 270_000 : 90_000);
  await toTravel(page, 'A11Y-KEYS');
  const start = (await getState(page))!.day;
  const s = await autoTravelUntil(page, (st) => st.day >= start + 10, { maxSteps: 3000 });
  expect(s.day >= start + 10 || s.status !== 'traveling').toBe(true);
});

// T-043 / M5 Tests: a whole run, Title to an ending, with the keyboard only. The page counts every pointer event; the
// run must finish with zero. SEED-9 arrives through the UI choices below under the T-039 tuning (day 112; see journey.spec.ts).
test('keyboard only: full run from Title to an ending with zero pointer events', async ({ page }) => {
  test.setTimeout(process.env.CI ? 450_000 : 150_000);
  await page.addInitScript(() => {
    (window as unknown as { __ptr: number }).__ptr = 0;
    for (const t of ['mousedown', 'mouseup', 'click', 'pointerdown', 'touchstart']) {
      window.addEventListener(t, () => { (window as unknown as { __ptr: number }).__ptr++; }, true);
    }
  });
  await startRun(page, 'SEED-9');
  for (const [row, qty] of [[1, 4], [2, 3000], [3, 10], [4, 5], [5, 1], [6, 1], [7, 1]] as const) await buy(page, row, qty);
  await leaveStore(page);
  await setHalfRations(page);
  const end = await autoTravelUntil(page, (s) => s.status !== 'traveling', { maxSteps: 4000 });
  expect(end.status).toBe('arrived');
  await expect(body(page)).toHaveAttribute('data-scene', 'Arrival');
  expect(await page.evaluate(() => (window as unknown as { __ptr: number }).__ptr)).toBe(0);
});

test('reduced motion sets data-reduced and turns the CRT off', async ({ page }) => {
  await toOptions(page);
  await expect(body(page)).toHaveAttribute('data-reduced', '0');
  await page.keyboard.press('8'); // Reduced motion (row 8 since Key hints, keyhints.md): Auto -> On
  await expect(body(page)).toHaveAttribute('data-reduced', '1');
  await expect(body(page)).toHaveAttribute('data-crt', 'off');
  await expect(listbox(page).getByRole('option').nth(7)).toHaveText(/Reduced motion.*On/);
  await page.reload();
  await expect(body(page)).toHaveAttribute('data-scene', 'Title');
  await expect(body(page)).toHaveAttribute('data-reduced', '1');
  await expect(body(page)).toHaveAttribute('data-crt', 'off');
});

test('colorblind toggle switches data-palette and back', async ({ page }) => {
  await toOptions(page);
  await expect(body(page)).toHaveAttribute('data-palette', 'standard');
  await page.keyboard.press('9'); // Colorblind palette (row 9 since Key hints, keyhints.md)
  await expect(body(page)).toHaveAttribute('data-palette', 'cb');
  await expect(body(page)).toHaveAttribute('data-scene', 'Options');
  await expect(listbox(page).getByRole('option').nth(8)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Enter');
  await expect(body(page)).toHaveAttribute('data-palette', 'standard');
});

test('M toggles mute in Travel but not on the Title or while typing a name', async ({ page }) => {
  await gotoScene(page, 'Title', 'A11Y-M');
  await expect.poll(() => muted(page)).toBe(false);
  await page.keyboard.press('m'); // Title's own M (mini-game auto-resolve) wins
  expect(await muted(page)).toBe(false);
  await page.keyboard.press('m'); // toggle auto-resolve back
  await page.keyboard.press('Enter');
  await expect(body(page)).toHaveAttribute('data-scene', 'Setup');
  await page.keyboard.press('Enter');
  await page.keyboard.type('mm');
  expect(await muted(page)).toBe(false);
  await expect.poll(async () => (await sceneTexts(page, 'Setup')).some((t) => t.includes('mm_'))).toBe(true);
  for (let i = 0; i < 5; i++) await page.keyboard.press('Enter'); // commit "mm", then the other four names
  await page.keyboard.press('Enter'); // first launch window
  await expect(body(page)).toHaveAttribute('data-scene', 'Store');
  for (const [row, qty] of [[1, 3], [2, 1500]] as const) await buy(page, row, qty);
  await leaveStore(page);
  await idle(page);
  await page.keyboard.press('m');
  await expect.poll(() => muted(page)).toBe(true);
  await expect(live(page)).toContainText('Sound off.');
  await page.keyboard.press('m');
  await expect.poll(() => muted(page)).toBe(false);
  await expect(live(page)).toContainText('Sound on.');
});

test('Guide page text is read into the log region', async ({ page }) => {
  await gotoScene(page, 'Title');
  await page.keyboard.press('2');
  await expect(body(page)).toHaveAttribute('data-scene', 'Guide');
  await expect(live(page).getByText(/Page 1 of|1 of \d+/).first()).toBeVisible();
});

test('Options row 11 is reachable with Shift+1', async ({ page }) => {
  await toOptions(page);
  await page.keyboard.press('Shift+Digit1'); // row 11 (Export save since Key hints, keyhints.md): disabled with no journey, so it explains itself
  await expect(live(page).getByText('No journey in progress to export.')).toBeVisible();
});

test('a disabled Travel row carries the x marker in the listbox', async ({ page }) => {
  await toTravel(page, 'a11y-mark');
  await expect(listbox(page).getByRole('option', { name: /x Attempt repair.*unavailable/ })).toHaveAttribute('aria-disabled', 'true');
});
