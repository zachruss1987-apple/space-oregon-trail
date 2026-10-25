import { expect, test } from '@playwright/test';
import { approachAndCross, body, generousRun, getState, idle, reachWaypoint, snap } from './helpers';
import { FAST_FIRST_WAYPOINT_SEEDS, FULL_CREW_ARRIVAL_SEEDS } from './seeds';

// hazards.md: Tug (row 3), Shields (row 2), Pilot (row 4, Belt Crossing 4 days / Saturn Ring Plane 3 days).
test('Lunar Debris Ring: hire a tug (25 cr) clears the crossing', async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await generousRun(page, FAST_FIRST_WAYPOINT_SEEDS[0] as string);
  const arrived = await reachWaypoint(page, 1);
  expect(arrived.crossing?.waypoint).toBe(1);
  await approachAndCross(page, 3);
  await expect(body(page)).toHaveAttribute('data-modal', '1');
  const after = (await getState(page))!;
  expect(after.crossing).toBeNull();
  expect(after.credits).toBeCloseTo(arrived.credits - 25, 5);
  const entry = after.log.filter((e) => e.kind === 'crossing').at(-1);
  expect(entry?.id).toBe('tug');
  // The outcome is logged as kind 'hazard' (id = outcome); a tug is the safe option, so it is overwhelmingly 'clear'.
  const outcome = after.log.filter((e) => e.kind === 'hazard' && e.day === after.day).map((e) => e.id);
  expect(outcome.length).toBeGreaterThan(0);
  expect(outcome).toContain('clear');
  await page.keyboard.press('Enter');
  await expect(body(page)).toHaveAttribute('data-scene', 'Travel');
  expect(errors).toEqual([]);
});

test('Lagrange Shoals: shields up and push is selectable and the run continues', async ({ page }) => {
  test.setTimeout(60_000);
  await generousRun(page, FAST_FIRST_WAYPOINT_SEEDS[0] as string);
  await reachWaypoint(page, 1);
  await approachAndCross(page, 1); // Lunar Debris Ring: thread
  await expect(body(page)).toHaveAttribute('data-modal', '1');
  await page.keyboard.press('Enter'); // outcome
  await expect(body(page)).toHaveAttribute('data-scene', 'Travel');
  const s = await reachWaypoint(page, 2);
  expect(s.crossing?.waypoint).toBe(2);
  await approachAndCross(page, 2);
  await expect(body(page)).toHaveAttribute('data-modal', '1');
  const after = (await getState(page))!;
  expect(after.crossing).toBeNull();
  expect(after.log.some((e) => e.kind === 'crossing' && e.id === 'shields')).toBe(true);
  await page.keyboard.press('Enter');
  await expect(body(page)).toHaveAttribute('data-scene', 'Travel');
});

test('The Belt Crossing: Belter pilot waits 4 days and the run continues', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await generousRun(page, FULL_CREW_ARRIVAL_SEEDS[1] as string);
  const s = await reachWaypoint(page, 7);
  expect(s.crossing?.waypoint).toBe(7);
  await page.keyboard.press('Enter');
  await expect(body(page)).toHaveAttribute('data-scene', 'Hazard');
  await page.waitForTimeout(300);
  await snap(page, 'Hazard-belt-pilot');
  await page.keyboard.press('4');
  await expect.poll(async () => (await getState(page))?.crossing, { timeout: 30_000 }).toBeNull();
  const after = (await getState(page))!;
  expect(after.day - s.day).toBeGreaterThanOrEqual(3);
  expect(after.day - s.day).toBeLessThanOrEqual(5);
  expect(after.log.some((e) => e.kind === 'crossing' && e.id === 'pilot')).toBe(true);
  expect(after.credits).toBeLessThan(s.credits);
  await idle(page);
  await page.keyboard.press('Enter'); // outcome modal -> Travel
  await expect(body(page)).toHaveAttribute('data-scene', 'Travel');
  expect(errors).toEqual([]);
});
