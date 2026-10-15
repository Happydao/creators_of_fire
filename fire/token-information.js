import * as configuration from './config.js';

const information = configuration.FIRE_TOKEN_INFORMATION || {};
function safeLink(value, nearly = false) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return '';
    if (nearly && !['nearly.trade', 'www.nearly.trade'].includes(url.hostname)) return '';
    return url.href;
  } catch { return ''; }
}
function activateLink(id, href) {
  const link = document.getElementById(id);
  if (!href) return;
  link.href = href;
  link.removeAttribute('aria-disabled');
  link.removeAttribute('tabindex');
}
const tradingUrl = safeLink(information.nearlyTradeUrl, true);
if (tradingUrl) {
  activateLink('get-fire', tradingUrl);
  document.getElementById('get-fire').textContent = '🔥 GET $FIRE ↗';
}
for (const [key, value] of Object.entries(information.fees || {})) {
  const field = document.querySelector(`[data-fee="${key}"]`);
  if (field && typeof value === 'string' && value.trim()) field.textContent = value.trim();
}

let officialContract = '';
export function showTokenAccessInformation(status) {
  // Display only the account used by the authoritative access service.
  const account = status?.contract;
  if (typeof account === 'string' && account.length >= 2 && account.length <= 64 && /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(account)) {
    officialContract = account;
    document.getElementById('token-contract').textContent = account;
    document.getElementById('copy-contract').disabled = false;
    activateLink('token-explorer', safeLink(information.explorerUrl));
  }
  if (typeof status?.minimum === 'string' && /^(0|[1-9]\d*)(\.\d+)?$/.test(status.minimum) && /[1-9]/.test(status.minimum)) {
    document.getElementById('token-minimum').textContent = `${status.minimum} FIRE`;
  }
}
document.getElementById('copy-contract').addEventListener('click', async () => {
  if (!officialContract) return;
  const feedback = document.getElementById('contract-feedback');
  try {
    await navigator.clipboard.writeText(officialContract);
    feedback.textContent = 'Contract copied.';
  } catch {
    // Keep the full address selectable when clipboard permission is unavailable.
    const range = document.createRange();
    range.selectNodeContents(document.getElementById('token-contract'));
    const selection = window.getSelection();
    selection.removeAllRanges(); selection.addRange(range);
    feedback.textContent = 'Copy was unavailable. The contract is selected so you can copy it manually.';
  }
});
