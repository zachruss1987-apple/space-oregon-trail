import { expect, test } from '@playwright/test';
import { autoTravelUntil, body, buy, generousRun, leaveStore, reachWaypoint, snap, startRun } from './helpers';
import { FAST_FIRST_WAYPOINT_SEEDS } from './seeds';

// Screenshots for designer review (no pixel asserts). Arrival and Arrival-score are saved by journey.spec.ts.
test('screenshot every scene except Arrival', async ({ page }) => {
  test.setTimeout(process.env.CI ? 270_000 : 90_000);
  await startRun(page, FAST_FIRST_WAYPOINT_SEEDS[0] as string, true);
  for (const [row, qty] of [[1, 3], [2, 2000], [3, 10], [4, 5], [5, 1], [6, 1], [7, 1]] as const) await buy(page, row, qty);
  await snap(page, 'Store');
  await leaveStore(page);
  await page.waitForTimeout(300);
  await snap(page, 'Travel');
  await page.keyboard.press('2');
  await expect(body(page)).toHaveAttribute('data-scene', 'Supplies');
  await snap(page, 'Supplies');
  await page.keyboard.press('Enter');
  await expect(body(page)).toHaveAttribute('data-scene', 'Travel');
  await page.keyboard.press('3');
  await expect(body(page)).toHaveAttribute('data-scene', 'Map');
  await snap(page, 'Map');
  await page.keyboard.press('Enter');
  await expect(body(page)).toHaveAttribute('data-scene', 'Travel');

  await autoTravelUntil(page, (_s, scene) => scene === 'Waypoint');
  await page.waitForTimeout(500);
  await snap(page, 'Waypoint');
  await page.keyboard.press('Enter'); // Approach the crossing
  await expect(body(page)).toHaveAttribute('data-scene', 'Hazard');
  await page.waitForTimeout(200);
  await snap(page, 'Hazard');
  await page.keyboard.press('Enter'); // Thread it
  await expect(body(page)).toHaveAttribute('data-modal', '1');
  await snap(page, 'Hazard-outcome');
});

test('screenshot the Death scene', async ({ page }) => {
  test.setTimeout(process.env.CI ? 180_000 : 60_000);
  await startRun(page, 'DEATHSEED');
  await buy(page, 1, 1);
  await leaveStore(page);
  await autoTravelUntil(page, (_s, scene) => scene === 'Death');
  await page.waitForTimeout(1500);
  await snap(page, 'Death');
});

// M2 screens: Station-trade and the per-death BeaconPrompt are saved here; Hazard-belt-pilot (pilot option visible),
// Map-direct and Station-route-prompt are saved by m2-crossing / m2-route; Waypoint-beacons by m2-beacons.
test('screenshot Station-trade', async ({ page }) => {
  test.setTimeout(process.env.CI ? 180_000 : 60_000);
  await generousRun(page, FAST_FIRST_WAYPOINT_SEEDS[0] as string);
  await reachWaypoint(page, 3);
  await page.keyboard.press('2');
  await expect(body(page)).toHaveAttribute('data-scene', 'Station');
  await page.waitForTimeout(500);
  await page.keyboard.press('2'); // Trade
  await page.waitForTimeout(600);
  await snap(page, 'Station-trade');
});

test('screenshot the BeaconPrompt', async ({ page }) => {
  test.setTimeout(process.env.CI ? 180_000 : 60_000);
  await startRun(page, 'DEATHSEED');
  await buy(page, 1, 1);
  await leaveStore(page);
  await autoTravelUntil(page, (s, scene) => scene === 'Death' || (scene === 'Travel' && s.crew.some((c) => !c.alive)));
  await page.keyboard.press('Enter'); // death modal -> beacon prompt
  await expect(body(page)).toHaveAttribute('data-beacon', '1');
  await page.keyboard.type('Here lies a test');
  await page.waitForTimeout(300);
  await snap(page, 'BeaconPrompt');
});
