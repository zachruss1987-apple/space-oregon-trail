import { expect, test } from '@playwright/test';
import { autoTravelUntil, body, buy, generousRun, leaveStore, reachWaypoint, sceneTexts, snap, startRun } from './helpers';

const EPITAPH = 'Here lies a test';
const stored = (page: import('@playwright/test').Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('proxima.beacons') ?? '[]') as { segment: number; text: string; captain: string }[]);

/** DEATHSEED, 1 drive, no rations: the first crew death opens the beacon prompt on Travel. Returns the state at the prompt. */
async function playToFirstDeath(page: import('@playwright/test').Page) {
  await startRun(page, 'DEATHSEED');
  await buy(page, 1, 1);
  await leaveStore(page);
  const mid = await autoTravelUntil(page, (s, scene) => scene === 'Death' || (scene === 'Travel' && s.crew.some((c) => !c.alive)));
  expect(mid.status).toBe('traveling');
  return mid;
}

// beacons.md / M2 acceptance: write a beacon, reload, and see it again at that segment's waypoint.
test('beacon written at a crew death survives a reload and shows at that waypoint', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  const mid = await playToFirstDeath(page);
  const segment = mid.arrivedAt ?? mid.segment;
  await page.keyboard.press('Enter'); // dismiss the death modal -> beacon prompt
  await expect(body(page)).toHaveAttribute('data-beacon', '1');
  await page.keyboard.type(EPITAPH);
  await page.keyboard.press('Enter');
  await expect(body(page)).not.toHaveAttribute('data-beacon', '1');
  const saved = await stored(page);
  expect(saved.some((b) => b.text === EPITAPH && b.segment === segment)).toBe(true);

  // Reload (new page load, same seed) and play a well-supplied run to that segment's waypoint: the memorial is listed there.
  // (The starving first run never reaches the waypoint alive, hence the different shopping.)
  await generousRun(page, 'DEATHSEED');
  expect((await stored(page)).map((b) => b.text)).toContain(EPITAPH);
  await reachWaypoint(page, segment);
  await page.waitForTimeout(500);
  await snap(page, 'Waypoint-beacons');
  expect((await sceneTexts(page, 'Waypoint')).join(' | ')).toContain(EPITAPH);
  expect(errors).toEqual([]);
});
