import { expect, test } from '@playwright/test';
import { autoTravelUntil, body, generousRun, getState, idle, reachWaypoint, sceneTexts, snap } from './helpers';
import { FULL_CREW_ARRIVAL_SEEDS } from './seeds';

// hazards.md "Route branch": at Titan Refinery (10) Continue asks Oort / direct; direct skips Oort Beacon (12).
test('Titan Refinery: choose the direct route; Oort Beacon is skipped, Heliopause follows Kuiper Gate', async ({ page }) => {
  test.setTimeout(process.env.CI ? 450_000 : 150_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await generousRun(page, FULL_CREW_ARRIVAL_SEEDS[1] as string);
  const s = await reachWaypoint(page, 10, 12000);
  expect(s.route).toBe('oort');
  await page.keyboard.press('2'); // Enter station
  await expect(body(page)).toHaveAttribute('data-scene', 'Station');
  await page.waitForTimeout(500);
  await page.keyboard.press('5'); // Continue -> route prompt
  await expect(body(page)).toHaveAttribute('data-modal', '1');
  await page.waitForTimeout(600);
  await snap(page, 'Station-route-prompt');
  await page.keyboard.press('2'); // direct
  await expect.poll(async () => (await getState(page))?.route).toBe('direct');
  // No confirmation modal: the chosen-route line is in the Travel log, so choosing departs at once.
  await expect(body(page)).toHaveAttribute('data-scene', 'Travel');
  await idle(page);

  // Map lists Oort Beacon as skipped (canvas text read from the scene graph).
  await page.keyboard.press('3');
  await expect(body(page)).toHaveAttribute('data-scene', 'Map');
  await page.waitForTimeout(300);
  await snap(page, 'Map-direct');
  const texts = (await sceneTexts(page, 'Map')).join('\n');
  expect(texts).toContain('Oort Beacon');
  expect(texts).toContain('Proxima Heliopause Shock');
  expect(texts).toContain('skipped');
  await page.keyboard.press('Enter');
  await expect(body(page)).toHaveAttribute('data-scene', 'Travel');

  // Kuiper Gate (11), then the next arrival is the Heliopause (13), not Oort Beacon (12).
  await autoTravelUntil(page, (st, scene) => scene === 'Waypoint' && st.arrivedAt === 11, { maxSteps: 6000 });
  const next = await autoTravelUntil(page, (st, scene) => scene === 'Waypoint' && st.arrivedAt !== null && st.arrivedAt !== 11, { maxSteps: 6000 });
  expect(next.route).toBe('direct');
  expect(next.arrivedAt).toBe(13);
  expect(errors).toEqual([]);
});
