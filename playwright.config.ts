import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  use: { baseURL: 'http://localhost:8082', channel: 'chrome', viewport: { width: 1440, height: 1000 }, screenshot: 'only-on-failure' },
  workers: 1,
  reporter: 'list',
  webServer: [
    { command: 'node --import tsx server/index.ts', url: 'http://127.0.0.1:3002/api/health', reuseExistingServer: false, env: { API_PORT: '3002', DATABASE_PATH: '.data/browser-test.sqlite', ALLOW_REGISTRATION: '1', ALLOWED_ORIGINS: 'http://localhost:8082' } },
    { command: 'node node_modules/expo/bin/cli start --host localhost --port 8082 --max-workers 2', url: 'http://localhost:8082', timeout: 120000, reuseExistingServer: false, env: { EXPO_PUBLIC_API_URL: 'http://127.0.0.1:3002', EXPO_NO_TELEMETRY: '1', EXPO_OFFLINE: '1', CI: '1' } },
  ],
});
