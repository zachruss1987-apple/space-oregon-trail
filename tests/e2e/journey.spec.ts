import { expect, test } from '@playwright/test';
import { ALL_ALIVE } from './seeds';
import { autoTravelUntil, body, buy, getState, leaveStore, snap, startRun } from './helpers';

test('death path: no rations ends in the Death scene, a beacon is saved, back to Title', async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startRun(page, 'DEATHSEED');
  await buy(page, 1, 1);
  await leaveStore(page);
  expect((await getState(page))?.supplies.rations).toBe(0);

  const end = await autoTravelUntil(page, (_s, scene) => scene === 'Death');
  expect(['dead', 'adrift']).toContain(end.status);
  await expect(body(page)).toHaveAttribute('data-scene', 'Death');
  await page.waitForTimeout(300);
  await page.keyboard.type('Should have packed lunch');
  await page.keyboard.press('Enter');
  const beacons = await page.evaluate(() => JSON.parse(localStorage.getItem('proxima.beacons') ?? '[]') as { text: string }[]);
  expect(beacons).toHaveLength(1);
  expect(beacons[0]?.text).toBe('Should have packed lunch');
  await page.keyboard.press('Enter'); // Continue -> Title
  await expect(body(page)).toHaveAttribute('data-scene', 'Title');
  expect(errors).toEqual([]);
});

test('arrival path: generous Executive run reaches a legal ending (pinned arrival seed search)', async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const results: string[] = [];
  let arrivedSeed: string | null = null;
  for (const seed of ALL_ALIVE) {
    await startRun(page, seed);
    for (const [row, qty] of [[1, 4], [2, 3000], [3, 10], [4, 5], [5, 1], [6, 1], [7, 1]] as const) await buy(page, row, qty);
    await leaveStore(page);
    const end = await autoTravelUntil(page, (s) => s.status !== 'traveling', { maxSteps: 4000 });
    results.push(`${seed}:${end.status}@day${end.day}`);
    expect(['arrived', 'dead', 'adrift']).toContain(end.status);
    if (end.status === 'arrived') {
      arrivedSeed = seed;
      await expect(body(page)).toHaveAttribute('data-scene', 'Arrival');
      await page.waitForTimeout(1500); // typewriter
      await snap(page, 'Arrival');
      await page.keyboard.press('Enter'); // See your score
      await page.waitForTimeout(500);
      await snap(page, 'Arrival-score'); // score table is canvas text; rating text cannot be asserted (needs M5 live region)
      expect((await getState(page))?.status).toBe('arrived');
      break;
    }
    await expect(body(page)).toHaveAttribute('data-scene', 'Death');
  }
  test.info().annotations.push({ type: 'arrival-seed', description: arrivedSeed ?? `none arrived: ${results.join(', ')}` });
  console.log('arrival path results:', results.join(', '));
  expect(errors).toEqual([]);
});
