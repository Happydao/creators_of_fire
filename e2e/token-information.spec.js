import { test, expect } from '@playwright/test';

test('unconfigured token displays all information without actionable token links', async ({ page }) => {
  await page.goto('/creators_of_fire/fire/');
  await expect(page.locator('#get-fire')).toContainText('COMING SOON');
  await expect(page.locator('#get-fire')).not.toHaveAttribute('href');
  await expect(page.locator('#token-contract')).toHaveText('Coming soon.');
  await expect(page.locator('#copy-contract')).toBeDisabled();
  await expect(page.locator('#token-explorer')).not.toHaveAttribute('href');
  await expect(page.locator('[data-fee]')).toHaveText(Array(5).fill('Not configured'));
  await expect(page.locator('.token-disclosure p')).toHaveCount(6);
  await expect(page.locator('.exclusive-card')).toHaveCount(3);
  await expect(page.locator('iframe')).toHaveCount(0);
});

async function configure(page, nearlyTradeUrl = 'https://nearly.trade/test-only-token') {
  await page.route('**/fire/config.js', route => route.fulfill({ contentType: 'application/javascript', body: `
    export const FIRE_WORKER_URL = 'https://token-test.invalid';
    export const FIRE_TOKEN_INFORMATION = ${JSON.stringify({ nearlyTradeUrl, explorerUrl: 'https://explorer.test.invalid/account/fixture.testnet', fees: { buyTax: 'Test terms', sellTax: '', creatorFees: '0%' } })};
  ` }));
  await page.route('https://token-test.invalid/status', route => route.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ ready: false, network: 'testnet', contract: 'a'.repeat(56) + '.testnet', minimum: '100' }) }));
  await page.goto('/fire/');
  await expect(page.locator('#copy-contract')).toBeEnabled();
}

test('configured metadata uses the existing status, supports copying and remains responsive', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async text => { window.copiedContract = text; } } });
  });
  await configure(page);
  await expect(page.locator('#get-fire')).toHaveAttribute('href', 'https://nearly.trade/test-only-token');
  await expect(page.locator('#get-fire')).toHaveAttribute('target', '_blank');
  await expect(page.locator('#get-fire')).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(page.locator('#token-explorer')).toHaveAttribute('href', 'https://explorer.test.invalid/account/fixture.testnet');
  await expect(page.locator('#token-minimum')).toHaveText('100 FIRE');
  await expect(page.locator('[data-fee="creatorFees"]')).toHaveText('0%');
  await expect(page.locator('[data-fee="sellTax"]')).toHaveText('Not configured');
  await page.locator('#copy-contract').click();
  await expect(page.locator('#contract-feedback')).toHaveText('Contract copied.');
  expect(await page.evaluate(() => window.copiedContract)).toBe('a'.repeat(56) + '.testnet');
  await expect(page.locator('#connect-wallet')).toBeDisabled();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});

test('invalid trading URL is inert and clipboard denial preserves manual copying', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new Error('denied'); } } });
  });
  await configure(page, 'javascript:alert(1)');
  await expect(page.locator('#get-fire')).not.toHaveAttribute('href');
  await page.locator('#copy-contract').click();
  await expect(page.locator('#contract-feedback')).toContainText('copy it manually');
  expect(await page.evaluate(() => window.getSelection().toString())).toBe('a'.repeat(56) + '.testnet');
});
