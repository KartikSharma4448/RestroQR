import { defineConfig, devices } from '@playwright/test';

// Isolate both server-rendered menu requests and browser orders from the live API.
export default defineConfig({
  testDir: './e2e',
  testMatch: ['order-receipt.spec.ts', 'cart-quantity.spec.ts', 'profile-activation.spec.ts', 'menu-media.spec.ts', 'menu-options.spec.ts', 'customer-email.spec.ts', 'order-payment.spec.ts','waiter-call.spec.ts','engagement.spec.ts','cafe-redesign.spec.ts','menu-tabs.spec.ts'],
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3107',
    launchOptions: { channel: 'chrome' },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 } } },
  ],
  webServer: [
    {
      command: 'node e2e/fixtures/receipt-api.cjs',
      url: 'http://127.0.0.1:4319/health',
      reuseExistingServer: false,
    },
    {
      command: 'node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3107',
      url: 'http://127.0.0.1:3107',
      env: { NEXT_PUBLIC_API_URL: 'http://127.0.0.1:4319', NEXT_DIST_DIR: '.next/receipt-tests' },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
