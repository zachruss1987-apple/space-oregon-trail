import { expect, test } from '@playwright/test';
import { autoTravelUntil, body, buy, getState, idle, leaveStore, startRun } from './helpers';
import { FAST_FIRST_WAYPOINT_SEEDS } from './seeds';

test('first waypoint (Lunar Debris Ring): crossing modal, then Continue returns to Travel', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startRun(page, FAST_FIRST_WAYPOINT_SEEDS[0] as string);
  for (const [row, qty] of [[1, 3], [2, 2000], [3, 10], [4, 5], [5, 1], [6, 1], [7, 1]] as const) await buy(page, row, qty);
  await leaveStore(page);

  const s = await autoTravelUntil(page, (_st, scene) => scene === 'Waypoint');
  expect(s.arrivedAt).toBe(1);
  await expect(body(page)).toHaveAttribute('data-scene', 'Waypoint');
  await expect(body(page)).toHaveAttribute('data-modal', '1'); // hazard crossing outcome
  const hazardLog = s.log.filter((e) => e.kind === 'hazard' && e.day === s.day);
  expect(hazardLog.length).toBeGreaterThan(0);

  await page.keyboard.press('Enter'); // dismiss modal
  await expect(body(page)).not.toHaveAttribute('data-modal', '1');
  await page.keyboard.press('Enter'); // Continue on the Lane
  await expect(body(page)).toHaveAttribute('data-scene', 'Travel');
  const dayAtLeave = (await getState(page))?.day ?? 0;
  await page.keyboard.press('Enter'); // one more day
  await idle(page);
  await expect.poll(async () => (await getState(page))?.day).toBeGreaterThan(dayAtLeave);
  expect((await getState(page))?.arrivedAt).toBeNull();
  expect(errors).toEqual([]);
});
