import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  globalTimeout: 300_000,
  workers: 2,
  use: { baseURL: 'http://127.0.0.1:5199', viewport: { width: 1280, height: 800 } },
  webServer: { command: process.env.ODDLINGS_PREVIEW === '1' ? 'pnpm preview' : 'pnpm dev', url: 'http://127.0.0.1:5199', reuseExistingServer: !process.env.CI && process.env.ODDLINGS_PREVIEW !== '1' },
});
