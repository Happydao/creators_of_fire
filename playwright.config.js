import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', outputDir: '/tmp/creators-fire-browser-results', fullyParallel: true,
  use: { baseURL: 'http://127.0.0.1:4178', headless: true },
  webServer: { command: 'node scripts/serve.mjs --dist', url: 'http://127.0.0.1:4178/fire/', env: { PORT: '4178' }, reuseExistingServer: false },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } }
  ]
});
