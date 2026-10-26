import { defineConfig, devices } from '@playwright/test';

// E2E tests run against the production build served by `vite preview`.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: process.env.CI ? 90_000 : 30_000,
  expect: { timeout: process.env.CI ? 15_000 : 5_000 }, // CI runners are several times slower (software GL)
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4, // 16+ parallel Chromium boots time out on big machines
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  projects: [
    // Desktop Chromium runs everything except the touch spec, so suite time is unchanged.
    { name: 'chromium', testIgnore: /touch\.spec\.ts$/ },
    // Real touch (T-072): WebKit with the iPhone 13 profile (hasTouch, isMobile, pointer: coarse). Windows-local until CI installs webkit.
    { name: 'touch', testMatch: /touch\.spec\.ts$/, use: { ...devices['iPhone 13'] } },
  ],
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
