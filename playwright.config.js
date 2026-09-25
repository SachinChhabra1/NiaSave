import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  use: { baseURL: process.env.UI_BASE_URL || 'http://127.0.0.1:4187', launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {} },
  webServer: process.env.UI_BASE_URL ? undefined : { command: 'npm run dev -- --host 127.0.0.1 --port 4187', url: 'http://127.0.0.1:4187', reuseExistingServer: false },
});
