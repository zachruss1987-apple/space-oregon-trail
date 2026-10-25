import { expect, test } from '@playwright/test';
import { autoTravelUntil, body, buy, getState, idle, leaveStore, startRun } from './helpers';
import { FAST_FIRST_WAYPOINT_SEEDS } from './seeds';

// M2 (hazards.md "Flow"): arrival pauses with `state.crossing` set. Waypoint row 1 "Approach the crossing" opens the
// Hazard scene; its cursor starts on the first enabled option (Thread it), Enter crosses, the outcome modal shows,
// Enter returns to Travel.
test('first waypoint (Lunar Debris Ring): Hazard scene, Thread it, outcome modal, then Travel', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startRun(page, FAST_FIRST_WAYPOINT_SEEDS[0] as string);
  for (const [row, qty] of [[1, 3], [2, 2000], [3, 10], [4, 5], [5, 1], [6, 1], [7, 1]] as const) await buy(page, row, qty);
  await leaveStore(page);

  const s = await autoTravelUntil(page, (_st, scene) => scene === 'Waypoint');
  expect(s.arrivedAt).toBe(1);
  expect(s.crossing?.waypoint).toBe(1);
  await expect(body(page)).not.toHaveAttribute('data-modal', '1');

  await page.keyboard.press('Enter'); // Approach the crossing
  await expect(body(page)).toHaveAttribute('data-scene', 'Hazard');
  const before = await getState(page);
  expect(before?.crossing?.waypoint).toBe(1);

  await page.keyboard.press('Enter'); // 1. Thread it
  await expect(body(page)).toHaveAttribute('data-modal', '1'); // narration + outcome
  const crossed = await getState(page);
  expect(crossed?.crossing).toBeNull();
  expect(crossed?.log.some((e) => e.kind === 'crossing' && e.id === 'thread')).toBe(true);
  expect(crossed?.log.filter((e) => e.kind === 'hazard' && e.day === crossed.day).length).toBeGreaterThan(0);

  await page.keyboard.press('Enter'); // dismiss the outcome modal
  await expect(body(page)).toHaveAttribute('data-scene', 'Travel');
  const dayAtLeave = (await getState(page))?.day ?? 0;
  await page.keyboard.press('Enter'); // Continue: departs
  await idle(page);
  await expect.poll(async () => (await getState(page))?.day).toBeGreaterThan(dayAtLeave);
  expect((await getState(page))?.arrivedAt).toBeNull();
  expect(errors).toEqual([]);
});
