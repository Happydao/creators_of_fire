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
for (const key of ['buyTax', 'sellTax', 'burnAllocation', 'creatorFees', 'platformFees']) {
  const value = information.fees?.[key];
  const field = document.querySelector(`[data-fee="${key}"]`);
  if (field && typeof value === 'string' && value.trim()) field.textContent = value.trim();
}

let officialContract = '';
export function showTokenAccessInformation(status) {
  // Reset to preparatory defaults before applying authoritative metadata.
  officialContract = '';
  document.getElementById('token-contract').textContent = 'Coming soon.';
  document.getElementById('token-minimum').textContent = 'Coming soon.';
  document.getElementById('copy-contract').disabled = true;
  for (const id of ['get-fire', 'token-explorer']) {
    const link = document.getElementById(id);
    link.removeAttribute('href'); link.setAttribute('aria-disabled', 'true'); link.tabIndex = -1;
  }
  document.getElementById('get-fire').textContent = '🔥 GET $FIRE — COMING SOON';
  document.getElementById('token-description').textContent = 'FIRE is a planned music community token designed to provide access to exclusive digital music content within the Creators of Fire ecosystem.';
  document.getElementById('token-disclosure-intro').textContent = 'FIRE is a planned music community token associated with the Creators of Fire music project on NEAR Protocol.';
  document.getElementById('token-fees-explanation').textContent = 'Token fees and their allocation will be disclosed once the token is created and the final contract parameters are available.';
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
  // Worker readiness is configuration readiness, not proof that the service launched.
  // The separate owner flag confirms operational testing without changing wallet checks.
  const live = Boolean(officialContract && status?.ready === true && information.serviceLive === true);
  if (live) {
    document.getElementById('token-description').textContent = 'FIRE is a music community utility token on NEAR Protocol, providing access to exclusive digital music experiences within the Creators of Fire ecosystem.';
    document.getElementById('token-disclosure-intro').textContent = 'FIRE is a community utility token associated with the Creators of Fire music project on NEAR Protocol.';
    document.getElementById('token-fees-explanation').textContent = 'Fee information is listed below when final contract parameters have been confirmed. Unconfigured fields do not mean zero fees.';
  }
  if (live && information.tradingEnabled === true && tradingUrl) {
    activateLink('get-fire', tradingUrl);
    document.getElementById('get-fire').textContent = '🔥 GET $FIRE ↗';
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
