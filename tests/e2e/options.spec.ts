import { expect, test } from '@playwright/test';
import { body, gotoScene, sceneTexts, snap } from './helpers';

type Stored = { crt?: boolean | null; music?: number; sfx?: number };
const stored = (page: import('@playwright/test').Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('proxima.options') ?? '{}') as Stored);

// ui.md "Options screen": rows change with Left/Right/Enter, apply at once and persist in proxima.options.
test('options: toggle CRT and music volume, reload, settings persist', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await gotoScene(page, 'Title');
  await page.keyboard.press('4');
  await expect(body(page)).toHaveAttribute('data-scene', 'Options');
  const texts = (await sceneTexts(page, 'Options')).join('\n');
  for (const row of ['CRT effect', 'Music volume', 'Sound effects', 'Text speed', 'Touch controls', 'Mini-games', 'Reduced motion', 'Colorblind palette', 'Difficulty', 'Spacer']) {
    expect(texts).toContain(row);
  }
  await snap(page, 'Options');

  const webgl = await page.evaluate(() => (window.__PROXIMA__?.game as { renderer: { type: number } }).renderer.type === 2);
  const crtBefore = await body(page).getAttribute('data-crt');
  await page.keyboard.press('Enter'); // row 1: CRT effect
  if (webgl) {
    const want = crtBefore !== 'on';
    await expect(body(page)).toHaveAttribute('data-crt', want ? 'on' : 'off');
    expect((await stored(page)).crt).toBe(want);
  } else {
    expect(texts).toContain('n/a');
  }

  await page.keyboard.press('ArrowDown'); // row 2: Music volume (default 6)
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect.poll(async () => (await stored(page)).music).toBe(4);
  await expect.poll(() => page.evaluate(() => window.__PROXIMA__?.audio?.volumes.music)).toBeCloseTo(0.4, 5);

  await page.keyboard.press('Escape');
  await expect(body(page)).toHaveAttribute('data-scene', 'Title');

  await page.reload();
  await expect(body(page)).toHaveAttribute('data-scene', 'Title');
  expect((await stored(page)).music).toBe(4);
  await expect.poll(() => page.evaluate(() => window.__PROXIMA__?.audio?.volumes.music)).toBeCloseTo(0.4, 5);
  if (webgl) await expect(body(page)).toHaveAttribute('data-crt', crtBefore !== 'on' ? 'on' : 'off');
  expect(errors).toEqual([]);
});
