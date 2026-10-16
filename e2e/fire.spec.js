import { test, expect } from '@playwright/test';
import { encryptJSON, toBase64 } from '../fire/crypto.js';

test('preparatory page is locked, responsive and makes no third-party requests', async ({ page }, info) => {
  await page.route('**/fire/config.js', route => route.fulfill({ contentType: 'application/javascript', body: "export const FIRE_WORKER_URL = '';" }));
  const errors = [], external = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:4178')) external.push(request.url()); });
  for (const prefix of ['', '/creators_of_fire']) {
    await page.goto(prefix + '/fire/');
    await expect(page.locator('#connect-wallet')).toBeDisabled();
    await expect(page.locator('.exclusive-card')).toHaveCount(3);
    await expect(page.locator('iframe')).toHaveCount(0);
    await expect(page.locator('#access-status')).toContainText('not live yet');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.screenshot({ path: `/tmp/fire-${info.project.name}.png`, fullPage: true });
  expect(external).toEqual([]); expect(errors).toEqual([]);
});

test('layout fits small phones and tablets', async ({ page }) => {
  await page.goto('/fire/');
  for (const width of [320, 375, 540, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), `overflow at ${width}px`).toBeLessThanOrEqual(width);
  }
});

test('unreachable Worker fails closed', async ({ page }) => {
  await page.route('**/fire/config.js', route => route.fulfill({ contentType: 'application/javascript', body: "export const FIRE_WORKER_URL = 'https://fire-test.invalid';" }));
  await page.route('https://fire-test.invalid/**', route => route.abort());
  await page.goto('/fire/');
  await expect(page.locator('#access-status')).toContainText('temporarily unavailable');
  await expect(page.locator('#connect-wallet')).toBeDisabled();
  await expect(page.locator('iframe')).toHaveCount(0);
});

async function configured(page, { error, slowSign = false, realWallet = false } = {}) {
  let unlocks = 0;
  await page.route('**/fire/config.js', route => route.fulfill({ contentType: 'application/javascript', body: "export const FIRE_WORKER_URL = 'https://fire-test.invalid';" }));
  if (!realWallet) await page.route('**/fire/vendor/wallet.js', route => route.fulfill({ contentType: 'application/javascript', body: `export async function prepareWallet() { return { sign: async () => { ${slowSign ? 'await new Promise(resolve => setTimeout(resolve, 500));' : ''} return { accountId:'listener.testnet', publicKey:'test-only-key', signature:'test-only-signature' }; } }; }` }));
  await page.route('https://fire-test.invalid/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET, POST' } });
    let result, status = 200;
    if (path === '/status') result = { ready: true, network: 'testnet', minimum: '100', contract: 'fixture-token.testnet' };
    if (path === '/challenge') result = { message: 'TEST ONLY — NO TRANSACTION', nonce: toBase64(new Uint8Array(32)), recipient: '127.0.0.1:4178', expiresAt: Date.now() + 120000, token: 'fixture' };
    if (path === '/unlock') {
      unlocks++;
      if (error) { status = 403; result = { error, balance: '50', minimum: '100', accountId: 'listener.testnet' }; }
      else {
        const { clientNonce } = route.request().postDataJSON();
        const expiresAt = Date.now() + 1800000;
        const context = `creators-of-fire:session:listener.testnet:${expiresAt}:${clientNonce}`;
        const key = crypto.getRandomValues(new Uint8Array(32));
        const envelope = await encryptJSON({ exclusive: 'PL_TEST_EXCLUSIVE_00000000001', alternate: 'PL_TEST_ALTERNATE_00000000002', early: 'PL_TEST_EARLY_000000000000003' }, key, context);
        result = { accountId: 'listener.testnet', balance: '150', minimum: '100', expiresAt, context, envelope, sessionKey: toBase64(key) };
      }
    }
    await route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(result) });
  });
  await page.route('https://www.youtube-nocookie.com/**', route => route.fulfill({ contentType: 'text/html', body: '<html><body>Test playlist embed</body></html>' }));
  await page.goto('/creators_of_fire/fire/');
  await expect(page.locator('#connect-wallet')).toBeEnabled();
  return () => unlocks;
}

test('wallet popup opens, traps focus, closes with Escape and restores focus', async ({ page }) => {
  await configured(page);
  await page.locator('#connect-wallet').click();
  await expect(page.locator('#meteor-connect')).toBeEnabled();
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement.closest('#wallet-dialog') !== null)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('#wallet-dialog')).not.toBeVisible();
  await expect(page.locator('#connect-wallet')).toBeFocused();
});

test('verified response unlocks all embeds, prevents double submit and disconnect relocks', async ({ page }) => {
  const count = await configured(page);
  await page.locator('#connect-wallet').click(); await expect(page.locator('#meteor-connect')).toBeEnabled();
  await page.locator('#meteor-connect').evaluate(button => { button.click(); button.click(); });
  await expect(page.locator('.playlist-player iframe')).toHaveCount(3);
  expect(count()).toBe(1);
  await expect(page.locator('#wallet-balance')).toHaveText('150 FIRE');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#disconnect-wallet').click();
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.locator('.card-art:visible')).toHaveCount(3);
});

test('insufficient balance remains locked with useful feedback', async ({ page }) => {
  await configured(page, { error: 'INSUFFICIENT_FIRE' });
  await page.locator('#connect-wallet').click(); await expect(page.locator('#meteor-connect')).toBeEnabled(); await page.locator('#meteor-connect').click();
  await expect(page.locator('#wallet-dialog-status')).toContainText('does not yet meet');
  await expect(page.locator('iframe')).toHaveCount(0);
  await page.locator('#close-wallet').click(); await expect(page.locator('#wallet-balance')).toHaveText('50 FIRE');
});

test('closing during a signature prevents a stale response from unlocking', async ({ page }) => {
  const count = await configured(page, { slowSign: true });
  await page.locator('#connect-wallet').click(); await expect(page.locator('#meteor-connect')).toBeEnabled(); await page.locator('#meteor-connect').click();
  await page.locator('#close-wallet').click();
  await page.waitForTimeout(700);
  expect(count()).toBe(0); await expect(page.locator('iframe')).toHaveCount(0);
});

test('expired sessions remove players when returning from a suspended tab', async ({ page }) => {
  await configured(page);
  await page.locator('#connect-wallet').click(); await expect(page.locator('#meteor-connect')).toBeEnabled(); await page.locator('#meteor-connect').click();
  await expect(page.locator('.playlist-player iframe')).toHaveCount(3);
  await page.evaluate(() => { const time = Date.now(); Date.now = () => time + 1801000; document.dispatchEvent(new Event('visibilitychange')); });
  await expect(page.locator('iframe')).toHaveCount(0); await expect(page.locator('#access-status')).toContainText('expired');
});

test('actual bundled Wallet Selector and Meteor initialize without a sign-in transaction', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await configured(page, { realWallet: true });
  const initialization = await page.evaluate(async () => {
    try { const module = await import('./vendor/wallet.js'); await module.prepareWallet('testnet', () => {}); return 'ready'; }
    catch (error) { return error.stack; }
  });
  expect(initialization).toBe('ready');
  await page.locator('#connect-wallet').click();
  await expect(page.locator('#meteor-connect')).toHaveText('CONTINUE WITH METEOR ↗', { timeout: 15000 });
  expect(errors).toEqual([]);
  await page.locator('#close-wallet').click();
});

test('homepage preserves free request modal alongside new CTA', async ({ page }, info) => {
  await page.route('https://**/*', route => route.abort());
  await page.goto('/creators_of_fire/#create');
  await expect(page.locator('.fire-access-cta')).toHaveAttribute('href', './fire/');
  await page.locator('.request-section [data-open-request]').click();
  await expect(page.locator('#request-dialog')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.locator('#request-dialog')).not.toBeVisible();
  await page.locator('.request-section').screenshot({ path: `/tmp/fire-cta-${info.project.name}.png` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
