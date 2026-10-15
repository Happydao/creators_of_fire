import { FIRE_WORKER_URL } from './config.js';
import { showTokenAccessInformation } from './token-information.js';
import { decryptJSON, fromBase64, toBase64, validPlaylists } from './crypto.js';

const $ = selector => document.querySelector(selector);
const connect = $('#connect-wallet'), disconnect = $('#disconnect-wallet'), dialog = $('#wallet-dialog');
const meteor = $('#meteor-connect'), status = $('#access-status'), dialogStatus = $('#wallet-dialog-status');
let endpoint, config, wallet, challenge, clientNonce, generation = 0, expiry = 0, expiryTimer;
let busy = false;
const errorMessages = {
  PREPARING: 'FIRE access is still being prepared. Please come back later.',
  NETWORK_UNAVAILABLE: 'NEAR could not be reached. Content stays locked. Please try again.',
  EXPIRED_PROOF: 'Your access message expired. Close this window and connect again.',
  INVALID_PROOF: 'We could not verify the wallet signature. Please reconnect.',
  ACCOUNT_NOT_VERIFIED: 'This signature could not be matched to a full-access key on your NEAR account.',
  TOKEN_CONFIGURATION_ERROR: 'FIRE access is not ready yet. Please try again later.',
  INSUFFICIENT_FIRE: 'Your wallet does not yet meet the FIRE requirement. Content remains locked.'
};
async function request(path, body) {
  const response = await fetch(endpoint + path, { method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(15000) });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(errorMessages[data.error] || 'Access could not be verified. Please try again.'), { data });
  return data;
}
function lock(message) {
  generation++;
  clearTimeout(expiryTimer);
  expiry = 0;
  for (const card of document.querySelectorAll('.exclusive-card')) {
    const player = card.querySelector('.playlist-player');
    player.replaceChildren(); player.hidden = true;
    card.querySelector('.card-art').hidden = false;
    card.querySelector('.locked-message').hidden = false;
    card.classList.remove('is-unlocked');
  }
  $('#wallet-details').hidden = true;
  $('#wallet-account').textContent = ''; $('#wallet-balance').textContent = ''; $('#wallet-expiry').textContent = '—';
  disconnect.hidden = true;
  $('#library-state').textContent = 'HOLDER ACCESS / LOCKED';
  $('#access-badge').textContent = config?.ready ? 'LOCKED' : 'COMING SOON';
  if (message) status.textContent = message;
  connect.textContent = 'CONNECT NEAR WALLET ↗';
}
function showBalance(data) {
  $('#wallet-details').hidden = false;
  $('#wallet-account').textContent = data.accountId;
  $('#wallet-balance').textContent = `${data.balance} FIRE`;
  disconnect.hidden = false;
}
function checkExpiry() {
  if (expiry && Date.now() >= expiry) lock('Your listening session has expired. Connect again to renew access.');
}
function unlock(playlists, data) {
  if (!validPlaylists(playlists) || !Number.isFinite(data.expiresAt) || data.expiresAt <= Date.now() || data.expiresAt > Date.now() + 3600000) throw new Error('Invalid access session. Please reconnect.');
  for (const card of document.querySelectorAll('.exclusive-card')) {
    const iframe = document.createElement('iframe');
    iframe.title = `${card.querySelector('h3').textContent} — Creators of Fire playlist`;
    iframe.src = `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(playlists[card.dataset.section])}&playsinline=1`;
    iframe.allow = 'encrypted-media; fullscreen; picture-in-picture';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.allowFullscreen = true;
    const player = card.querySelector('.playlist-player');
    player.replaceChildren(iframe); player.hidden = false;
    card.querySelector('.card-art').hidden = true; card.querySelector('.locked-message').hidden = true;
    card.classList.add('is-unlocked');
  }
  expiry = data.expiresAt;
  clearTimeout(expiryTimer);
  expiryTimer = setTimeout(checkExpiry, expiry - Date.now() + 100);
  showBalance(data);
  $('#wallet-expiry').textContent = new Date(expiry).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
  $('#access-badge').textContent = 'ACCESS UNLOCKED';
  $('#library-state').textContent = 'HOLDER ACCESS / UNLOCKED';
  status.textContent = 'You’re inside. Explore all three playlists. Your access is verified for this listening session.';
  connect.textContent = 'RENEW ACCESS ↗';
}
async function prepareConnection() {
  if (busy || !config?.ready) return;
  // Relocking before renewal avoids playback under a different wallet identity.
  lock('Connect your wallet and sign the access message to verify your FIRE balance.');
  const run = generation;
  dialogStatus.textContent = 'Preparing a secure access message…';
  meteor.disabled = true; meteor.textContent = 'PREPARING WALLET…';
  dialog.showModal();
  try {
    clientNonce = toBase64(crypto.getRandomValues(new Uint8Array(32)));
    const nonce = clientNonce;
    const [module, proof] = await Promise.all([import('./vendor/wallet.js'), request('/challenge', { clientNonce: nonce })]);
    const prepared = await module.prepareWallet(config.network, () => {
      lock('Your wallet changed. Connect again to verify access.');
      if (dialog.open) dialog.close();
    });
    if (run !== generation || !dialog.open) return;
    wallet = prepared; challenge = proof;
    meteor.textContent = 'CONTINUE WITH METEOR ↗'; meteor.disabled = false;
    dialogStatus.textContent = `Network: ${config.network}. Required balance: ${config.minimum} FIRE.`;
    meteor.focus();
  } catch {
    if (run !== generation) return;
    dialogStatus.textContent = 'Wallet connection is unavailable. Close this window and try again.';
    meteor.textContent = 'CONNECTION UNAVAILABLE';
  }
}
connect.addEventListener('click', prepareConnection);
meteor.addEventListener('click', async () => {
  if (busy || !wallet || !challenge) return;
  if (challenge.expiresAt <= Date.now()) { dialogStatus.textContent = errorMessages.EXPIRED_PROOF; meteor.disabled = true; return; }
  const run = generation, proof = challenge, nonce = clientNonce;
  busy = true; meteor.disabled = true; meteor.textContent = 'WAITING FOR YOUR WALLET…';
  dialogStatus.textContent = 'Approve the message in Meteor. No transaction will be sent.';
  let timer;
  try {
    // Bound abandoned wallet popups. A late signature cannot unlock a closed dialog.
    const signed = await Promise.race([wallet.sign(proof), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Wallet approval timed out. Please try again.')), 120000); })]);
    clearTimeout(timer);
    if (run !== generation || !dialog.open) return;
    if (!signed?.accountId || !signed?.signature || !signed?.publicKey) throw new Error('The wallet did not return an access signature. Please try again.');
    meteor.textContent = 'VERIFYING FIRE BALANCE…';
    dialogStatus.textContent = 'Checking your account and token balance on NEAR…';
    const result = await request('/unlock', { token: proof.token, clientNonce: nonce, accountId: signed.accountId, publicKey: signed.publicKey, signature: signed.signature });
    const expectedContext = `creators-of-fire:session:${signed.accountId}:${result.expiresAt}:${nonce}`;
    if (result.context !== expectedContext || result.accountId !== signed.accountId) throw new Error('The access response could not be verified.');
    const playlists = await decryptJSON(result.envelope, fromBase64(result.sessionKey), expectedContext);
    delete result.sessionKey;
    if (run !== generation || !dialog.open) return;
    unlock(playlists, result);
    dialog.close();
    $('#library-title').tabIndex = -1; $('#library-title').focus({ preventScroll: true });
  } catch (error) {
    if (run !== generation || !dialog.open) return;
    dialogStatus.textContent = error.data ? (errorMessages[error.data.error] || error.message) : 'Wallet approval was cancelled or could not be completed. Close this window and try again.';
    status.textContent = dialogStatus.textContent;
    if (error.data?.error === 'INSUFFICIENT_FIRE') showBalance(error.data);
    meteor.textContent = 'CLOSE & RECONNECT TO RETRY';
  } finally {
    clearTimeout(timer); if (run === generation) busy = false;
  }
});
$('#close-wallet').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
dialog.addEventListener('close', () => { generation++; busy = false; challenge = undefined; clientNonce = undefined; });
dialog.addEventListener('keydown', event => {
  if (event.key !== 'Tab') return;
  const buttons = [...dialog.querySelectorAll('button:not(:disabled)')];
  const first = buttons[0], last = buttons.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});
disconnect.addEventListener('click', () => { lock('Disconnected. Exclusive content is locked.'); connect.focus(); });
document.addEventListener('visibilitychange', checkExpiry);
window.addEventListener('pageshow', checkExpiry);
window.addEventListener('pagehide', () => lock());

async function initialize() {
  if (!FIRE_WORKER_URL) return;
  try {
    const url = new URL(FIRE_WORKER_URL);
    const local = ['localhost', '127.0.0.1'].includes(location.hostname) && ['localhost', '127.0.0.1'].includes(url.hostname);
    if (url.protocol !== 'https:' && !local) throw new Error('HTTPS required');
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Invalid endpoint');
    endpoint = url.origin;
    status.textContent = 'Checking FIRE access availability…';
    config = await request('/status');
    showTokenAccessInformation(config);
    if (!config.ready) { status.textContent = errorMessages.PREPARING; return; }
    if (!['mainnet', 'testnet'].includes(config.network)) throw new Error('Invalid network');
    connect.disabled = false;
    $('#access-badge').textContent = 'LOCKED';
    status.textContent = `Hold at least ${config.minimum} FIRE on NEAR ${config.network} to unlock all three playlists. Connect to verify your balance.`;
    document.querySelector('#how-access-works li:nth-child(2) p').textContent = `Hold at least ${config.minimum} FIRE. Your balance is verified directly on NEAR ${config.network}.`;
  } catch { status.textContent = 'FIRE access is temporarily unavailable. Content remains locked. Please try again later.'; }
}
initialize();
