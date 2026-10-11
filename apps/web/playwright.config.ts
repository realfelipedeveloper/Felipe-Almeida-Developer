import { defineConfig, devices } from '@playwright/test';

const port = 3100;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `pnpm exec next dev -p ${port}`,
    url: `${baseURL}/pt-BR`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      API_URL: 'http://127.0.0.1:3999',
      NEXT_PUBLIC_API_URL: 'http://127.0.0.1:3999',
      NEXT_PUBLIC_SITE_URL: baseURL,
      NEXT_PUBLIC_ANALYTICS_SCRIPT_URL: `${baseURL}/analytics-test.js`,
    },
  },
});
