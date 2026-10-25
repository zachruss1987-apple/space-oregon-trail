import { expect, test, type Page } from '@playwright/test';
import { body, generousRun, getState, gotoScene, idle, leaveStore, loadPatchedState, sceneTexts, snap, startRun } from './helpers';

// M5 features (T-040): autosave + Continue journey, export/import, Top Ten, difficulty, the guidebook.

const texts = async (page: Page, key: string): Promise<string> => (await sceneTexts(page, key)).join('\n');
/** Total Mk via the Oort Beacon (the default route). */
const TOTAL_MK = 2040;

/** Travel (Enter on Continue, Enter through modals) until `day` has passed. */
async function travelDays(page: Page, day: number): Promise<number> {
  for (let i = 0; i < 60; i++) {
    const s = await getState(page);
    if (s && s.day >= day) return s.day;
    await idle(page);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(60);
  }
  throw new Error('travelDays: no progress');
}

test('autosave: reload shows Continue journey with the save line and resumes on the same day', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await generousRun(page, 'M5SAVE');
  expect(await page.evaluate(() => localStorage.getItem('proxima.autosave'))).not.toBeNull(); // written on departure
  await travelDays(page, 2);
  await idle(page);
  await page.waitForTimeout(300); // let any queued Enter finish its day
  await idle(page);
  const before = (await getState(page))!;
  await page.reload();
  await expect(body(page)).toHaveAttribute('data-scene', 'Title');
  const title = await texts(page, 'Title');
  expect(title).toContain('Continue journey');
  expect(title).toContain(`${before.crew[0]!.name}'s crew, day ${before.day}`);
  await snap(page, 'Title-continue');
  await page.keyboard.press('Enter');
  await expect(body(page)).toHaveAttribute('data-scene', /Travel|Hazard|Station/);
  const after = (await getState(page))!;
  expect(after.day).toBe(before.day);
  expect(after.distanceTotal).toBe(before.distanceTotal);
  expect(after.status).toBe('traveling');
  expect(errors).toEqual([]);
});

test('export / import round-trip through the Options fields', async ({ page }) => {
  await generousRun(page, 'M5XFER');
  await travelDays(page, 1);
  await idle(page);
  await page.waitForTimeout(300);
  await idle(page);
  const day = (await getState(page))!.day;
  await gotoScene(page, 'Title', 'M5XFER');
  await page.keyboard.press('5'); // Continue is item 1, so Options is 5
  await expect(body(page)).toHaveAttribute('data-scene', 'Options');
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowUp'); // Back -> Import -> Export
  await page.keyboard.press('Enter');
  await expect(body(page)).toHaveAttribute('data-modal', '1');
  const exported = await page.locator('#proxima-export').inputValue();
  expect(exported).toMatch(/^PROXIMA1\.[A-Za-z0-9+/=]+\.[0-9a-f]{8}$/);
  await snap(page, 'Options-export');
  await page.keyboard.press('Escape');
  await expect(page.locator('#proxima-export')).toHaveCount(0);

  await page.evaluate(() => localStorage.removeItem('proxima.autosave'));
  await page.keyboard.press('ArrowDown'); // Import
  await page.keyboard.press('Enter');
  const field = page.locator('#proxima-import');
  await field.fill('PROXIMA1.nope.00000000');
  await field.press('Enter');
  await expect.poll(() => texts(page, 'Options')).toContain('That save will not load.');
  await field.fill(exported);
  await field.press('Enter');
  await expect(body(page)).toHaveAttribute('data-scene', 'Title');
  expect(await texts(page, 'Title')).toContain('Continue journey');
  await page.keyboard.press('1');
  await expect(body(page)).toHaveAttribute('data-scene', /Travel|Hazard|Station/);
  expect((await getState(page))!.day).toBe(day);
});

test('Top Ten: ten defaults; a qualifying arrival enters the crew; the autosave is cleared', async ({ page }) => {
  await gotoScene(page, 'Title', 'M5TOP');
  await page.keyboard.press('3');
  await expect(body(page)).toHaveAttribute('data-scene', 'TopTen');
  const rows = (await sceneTexts(page, 'TopTen')).filter((l) => /^(> )?\d+\.\s/.test(l));
  expect(rows).toHaveLength(10);
  expect(await texts(page, 'TopTen')).toContain('Profession');
  await snap(page, 'TopTen');
  await page.keyboard.press('Escape');
  await expect(body(page)).toHaveAttribute('data-scene', 'Title');

  await startRun(page, 'M5TOP', false, '&minigames=auto&debug=1');
  for (const [row, qty] of [[1, 4], [2, 3000], [3, 10]] as const) {
    await page.keyboard.press(String(row));
    await page.keyboard.type(String(qty));
    await page.keyboard.press('Enter');
  }
  await leaveStore(page);
  await loadPatchedState(page, {
    segment: 16, arrivedAt: null, crossing: null, station: null, distanceInSegment: 199, distanceTotal: TOTAL_MK - 2,
    credits: 20000, date: '2184-07-20', thrust: 'cruise',
  });
  await expect(body(page)).toHaveAttribute('data-scene', 'Travel');
  await page.keyboard.press('Enter'); // Continue: the last day
  await expect(body(page)).toHaveAttribute('data-scene', 'Arrival', { timeout: 10_000 });
  expect(await page.evaluate(() => localStorage.getItem('proxima.autosave'))).toBeNull();
  await page.keyboard.press('Enter'); // See your score
  await page.keyboard.press('Enter'); // Continue -> Top Ten entry
  await expect.poll(() => texts(page, 'Arrival')).toContain('made the Top Ten');
  await page.keyboard.type('Zara');
  await page.keyboard.press('Enter');
  await expect.poll(() => texts(page, 'Arrival')).toContain('Entered in the Top Ten');
  await snap(page, 'Arrival-topten');
  await page.keyboard.press('Enter'); // See the Top Ten
  await expect(body(page)).toHaveAttribute('data-scene', 'TopTen');
  expect(await texts(page, 'TopTen')).toMatch(/> \d+\.\s+Zara\s+Executive/);
  expect(await page.evaluate(() => localStorage.getItem('proxima.highscores'))).toContain('Zara');
});

test('difficulty cycles in Options, persists, shows on Setup and reaches the run', async ({ page }) => {
  await gotoScene(page, 'Title', 'M5DIFF');
  await page.keyboard.press('4');
  await expect(body(page)).toHaveAttribute('data-scene', 'Options');
  await page.keyboard.press('9'); // Difficulty: Spacer -> Pathfinder
  await expect.poll(() => texts(page, 'Options')).toContain('Pathfinder');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('proxima.options') ?? '{}').difficulty)).toBe('pathfinder');
  await page.keyboard.press('ArrowRight'); // Pathfinder -> Greenhorn
  await expect.poll(() => texts(page, 'Options')).toContain('Greenhorn');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Escape');
  await expect(body(page)).toHaveAttribute('data-scene', 'Title');
  await page.keyboard.press('Enter'); // Travel the Trail
  await expect(body(page)).toHaveAttribute('data-scene', 'Setup');
  await expect.poll(() => texts(page, 'Setup')).toContain('Difficulty: Pathfinder');
  await page.keyboard.press('Enter');
  for (let i = 0; i < 6; i++) await page.keyboard.press('Enter');
  await expect(body(page)).toHaveAttribute('data-scene', 'Store');
  expect((await getState(page))!.difficulty).toBe('pathfinder');
  expect(await texts(page, 'Store')).toContain('46 cr'); // drives: 40 cr x1.15
});

test('Learn about the Trail pages through the guidebook', async ({ page }) => {
  await gotoScene(page, 'Title', 'M5GUIDE');
  await page.keyboard.press('2');
  await expect(body(page)).toHaveAttribute('data-scene', 'Guide');
  await expect.poll(() => texts(page, 'Guide')).toContain('Page 1 of 11');
  expect(await texts(page, 'Guide')).toContain('The Lane and Why We Go');
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => texts(page, 'Guide')).toContain('Page 2 of 11');
  expect(await texts(page, 'Guide')).toContain('Choosing a Profession');
  await snap(page, 'Guide');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft'); // stays on page 1
  await expect.poll(() => texts(page, 'Guide')).toContain('Page 1 of 11');
  await page.keyboard.press('Escape');
  await expect(body(page)).toHaveAttribute('data-scene', 'Title');
});
