import { expect, test } from '@playwright/test';
import { autoTravelUntil, body, buy, getState, idle, leaveStore, snap, startRun } from './helpers';
import { FAST_FIRST_WAYPOINT_SEEDS } from './seeds';

const MARS_RELAY = 3;

// economy.md "Enter station flow". Keys: Waypoint 2 = Enter station; Station 1 = Outfitters, row 2 = Rations,
// modal Enter = Buy, type the quantity, Enter; Esc back to the station menu; 5 = Continue (departs in Travel).
test('Mars Relay: enter the station, buy 10 rations, leave to Travel', async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startRun(page, FAST_FIRST_WAYPOINT_SEEDS[0] as string);
  for (const [row, qty] of [[1, 3], [2, 2000], [3, 10], [4, 5], [5, 1], [6, 1], [7, 1]] as const) await buy(page, row, qty);
  await leaveStore(page);

  // Auto-travel; Enter at each hazard picks Thread it (cursor on the first enabled option) and dismisses the outcome.
  const s = await autoTravelUntil(page, (st, scene) => scene === 'Waypoint' && st.arrivedAt === MARS_RELAY);
  expect(s.station?.waypoint).toBe(MARS_RELAY);
  expect(s.log.filter((e) => e.kind === 'crossing' && e.id === 'thread').length).toBe(2);

  await page.keyboard.press('2'); // Enter station
  await expect(body(page)).toHaveAttribute('data-scene', 'Station');
  const before = (await getState(page))!;
  await page.waitForTimeout(600);
  await snap(page, 'Station');

  await page.keyboard.press('1'); // Outfitters
  await snap(page, 'Station-outfitters');
  await page.keyboard.press('2'); // Rations
  await expect(body(page)).toHaveAttribute('data-modal', '1');
  await page.keyboard.press('Enter'); // Buy
  await page.keyboard.type('10');
  await page.keyboard.press('Enter');
  await expect(body(page)).not.toHaveAttribute('data-modal', '1');
  await expect.poll(async () => (await getState(page))?.supplies.rations).toBe(before.supplies.rations + 10);
  const after = (await getState(page))!;
  expect(after.credits).toBeLessThan(before.credits);
  expect(after.log.some((e) => e.kind === 'store' && e.id === 'rations')).toBe(true);

  await page.keyboard.press('Escape'); // back to the station menu
  await page.keyboard.press('5'); // Continue
  await expect(body(page)).toHaveAttribute('data-scene', 'Travel');
  await idle(page);
  await expect.poll(async () => (await getState(page))?.day).toBeGreaterThan(after.day);
  expect((await getState(page))?.station).toBeNull();
  expect(errors).toEqual([]);
});
