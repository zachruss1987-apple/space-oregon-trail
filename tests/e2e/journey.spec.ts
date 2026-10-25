import { expect, test } from '@playwright/test';
import { autoTravelUntil, body, buy, getState, leaveStore, setHalfRations, snap, startRun } from './helpers';

test('death path: no rations ends in the Death scene, a beacon is saved, back to Title', async ({ page }) => {
  test.setTimeout(process.env.CI ? 180_000 : 60_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startRun(page, 'DEATHSEED');
  await buy(page, 1, 1);
  await leaveStore(page);
  expect((await getState(page))?.supplies.rations).toBe(0);

  // A mid-run death opens the per-death beacon prompt (after the death modal); Esc skips it.
  const mid = await autoTravelUntil(page, (s, scene) => scene === 'Death' || (scene === 'Travel' && s.crew.some((c) => !c.alive)));
  if (mid.status === 'traveling') {
    await page.keyboard.press('Enter');
    await expect(body(page)).toHaveAttribute('data-beacon', '1');
    await page.keyboard.press('Escape');
    await expect(body(page)).not.toHaveAttribute('data-beacon', '1');
  }
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

// T-039 re-tune: verified through the UI (4 drives, 3000 rations, 10 suits, 5 boxes, 1 of each part, Half rations, Cruise, T
// auto-travel, first enabled hazard option, ?minigames=auto, no resting) to ARRIVE: SEED-9 day 112 (3 alive), SEED-20 day 123
// (2), SEED-8 day 128 (2). The policy-run FULL_CREW_ARRIVAL_SEEDS (SEED-5/10/20) rest and scan, which this autopilot does not,
// so SEED-5 and SEED-10 die here (days 96 / 141); they are not used.
const UI_ARRIVAL_SEEDS: readonly string[] = ['SEED-9', 'SEED-20', 'SEED-8'];

test('arrival path: generous Executive run reaches a legal ending (pinned arrival seed search)', async ({ page }) => {
  test.setTimeout(process.env.CI ? 450_000 : 150_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const results: string[] = [];
  let arrivedSeed: string | null = null;
  for (const seed of UI_ARRIVAL_SEEDS) {
    await startRun(page, seed);
    for (const [row, qty] of [[1, 4], [2, 3000], [3, 10], [4, 5], [5, 1], [6, 1], [7, 1]] as const) await buy(page, row, qty);
    await leaveStore(page);
    await setHalfRations(page);
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
