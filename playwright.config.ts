import { defineConfig, devices } from '@playwright/test';

// E2E tests run against the production build served by `vite preview`.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4, // 16+ parallel Chromium boots time out on big machines
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  // Visual baselines are platform-specific (fonts, GPU): tests/e2e/__screenshots__/<platform>/<spec>/<name>.png
  snapshotPathTemplate: '{testDir}/__screenshots__/{platform}/{testFileName}/{arg}{ext}',
  outputDir: process.env.PW_OUT ?? 'test-results',
});
