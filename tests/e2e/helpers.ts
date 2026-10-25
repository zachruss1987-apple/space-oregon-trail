import { expect, type Page } from '@playwright/test';

/** Navigate to the game with a fixed seed and wait for the given scene key. */
export async function gotoScene(page: Page, sceneKey: string, seed: string | number = 'test'): Promise<void> {
  await page.goto(`/?seed=${encodeURIComponent(String(seed))}`);
  await expect(page.locator('body')).toHaveAttribute('data-scene', sceneKey);
}

/** Save a screenshot to test-results/screens/<name>.png for designer review. */
export async function snap(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `test-results/screens/${name}.png` });
}
