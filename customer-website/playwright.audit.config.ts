import path from 'node:path';
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e', testMatch: 'audit-fixes.spec.ts', workers: 1, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5178', channel: 'chrome' },
  webServer: [
    { command: 'node e2e/fixtures/receipt-api.cjs', url: 'http://127.0.0.1:4319/health', reuseExistingServer: false },
    { command: 'node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3107',
      env: { NEXT_PUBLIC_API_URL: 'http://127.0.0.1:4319' }, url: 'http://127.0.0.1:3107', timeout: 120000, reuseExistingServer: false },
    { command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5178 --strictPort',
      cwd: path.resolve(__dirname, '../admin-panel'), url: 'http://127.0.0.1:5178', reuseExistingServer: false },
  ],
});
