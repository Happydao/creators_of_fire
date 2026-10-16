import test from 'node:test';
import assert from 'node:assert/strict';
import { serialize } from 'borsh';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHandler } from '../workers/fire-access/index.js';
import { atomicAmount, displayAmount, messageHash, verifySignature } from '../workers/fire-access/security.js';
import { encode, toBase64, fromBase64, encryptJSON, decryptJSON, validPlaylists } from '../fire/crypto.js';

const origin = 'https://creatorsoffire.com';
// Synthetic fixture IDs, never used by production or the public catalog.
const playlists = { exclusive: 'PL_TEST_EXCLUSIVE_00000000001', alternate: 'PL_TEST_ALTERNATE_00000000002', early: 'PL_TEST_EARLY_000000000000003' };
test('playlist validation accepts short IDs without accepting URLs or duplicate IDs', () => {
  const short = { exclusive: 'PLabcdefghij', alternate: 'PLklmnopqrst', early: 'PLuvwxyz0123' };
  assert.equal(validPlaylists(short), true);
  assert.equal(validPlaylists(playlists), true);
  assert.equal(validPlaylists({ ...short, early: short.exclusive }), false);
  assert.equal(validPlaylists({ ...short, early: 'https://youtube.com/playlist?list=PLuvwxyz0123' }), false);
  assert.equal(validPlaylists({ ...short, early: 'PLabc<script>' }), false);
});
function base58(bytes) {
  let n = BigInt('0x' + Buffer.from(bytes).toString('hex')), result = '';
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  while (n) { result = alphabet[Number(n % 58n)] + result; n /= 58n; }
  for (const byte of bytes) { if (byte !== 0) break; result = '1' + result; }
  return result;
}
async function fixture(options = {}) {
  const key = crypto.getRandomValues(new Uint8Array(32));
  const env = { NETWORK: 'testnet', FIRE_CONTRACT: 'fixture-token.testnet', MINIMUM_FIRE: '100.25', ALLOWED_ORIGINS: origin, SESSION_SECONDS: '1800', PLAYLIST_KEY: toBase64(key), CHALLENGE_SECRET: toBase64(crypto.getRandomValues(new Uint8Array(32))) };
  const bundle = await encryptJSON(playlists, key, 'creators-of-fire:playlists:v1');
  const calls = [];
  let time = Date.now();
  const handler = createHandler({ bundle, now: () => time, fetchRPC: async (url, request) => {
    const { method, params } = JSON.parse(request.body); calls.push(params);
    assert.equal(method, 'query'); assert.equal(url, 'https://rpc.testnet.near.org');
    if (options.rpcError) return Response.json({ error: { message: 'Unavailable' } });
    if (params.request_type === 'view_access_key') return Response.json({ result: { permission: options.permission ?? 'FullAccess', block_hash: 'final-fixture-block' } });
    assert.equal(params.block_id, 'final-fixture-block'); assert.equal(params.account_id, env.FIRE_CONTRACT);
    const value = params.method_name === 'ft_metadata' ? { decimals: options.decimals ?? 2 } : options.balance ?? '10025';
    if (params.method_name === 'ft_balance_of') assert.deepEqual(JSON.parse(Buffer.from(params.args_base64, 'base64')), { account_id: 'listener.testnet' });
    return Response.json({ result: { result: Array.from(encode(JSON.stringify(value))) } });
  } });
  const request = (path, body, overrides = {}) => handler.fetch(new Request('https://worker.test' + path, {
    method: body === undefined ? 'GET' : 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...overrides.headers }, body: body === undefined ? undefined : JSON.stringify(body)
  }), { ...env, ...overrides.env });
  const clientNonce = toBase64(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = await (await request('/challenge', { clientNonce })).json();
  const pair = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
  const publicKey = 'ed25519:' + base58(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey)));
  const signature = toBase64(await crypto.subtle.sign('Ed25519', pair.privateKey, await messageHash(challenge)));
  const proof = { token: challenge.token, clientNonce, accountId: 'listener.testnet', publicKey, signature };
  return { env, request, proof, calls, bundle, advance: ms => { time += ms; }, challenge };
}

test('NEP-413 serialization matches independent Borsh serialization, including callback option', async () => {
  const schema = { struct: { tag: 'u32', message: 'string', nonce: { array: { type: 'u8', len: 32 } }, recipient: 'string', callbackUrl: { option: 'string' } } };
  for (const callbackUrl of [undefined, 'myapp.com/callback']) {
    const values = { tag: 2147484061, message: 'hi', nonce: Uint8Array.from({ length: 32 }, (_, i) => i), recipient: 'myapp.com', callbackUrl };
    const independent = await crypto.subtle.digest('SHA-256', serialize(schema, values));
    assert.deepEqual(new Uint8Array(await messageHash(values)), new Uint8Array(independent));
  }
});
test('token threshold uses exact integer arithmetic, rejects imprecise and overflowing values', () => {
  assert.equal(atomicAmount('100.25', 2), 10025n);
  assert.equal(atomicAmount('100000000000000.000001', 6), 100000000000000000001n);
  for (const amount of ['-1', 'NaN', '1e3', '1.001']) assert.throws(() => atomicAmount(amount, 2));
  assert.throws(() => atomicAmount('1', 39));
  assert.throws(() => atomicAmount('999999999999999999999999999999999999999', 0));
  assert.equal(displayAmount(10000n, 2), '100'); assert.equal(displayAmount(0n, 24), '0'); assert.equal(displayAmount(100n, 0), '100');
});
test('unconfigured token stays locked without querying RPC or releasing content', async () => {
  const f = await fixture();
  const response = await f.request('/status', undefined, { env: { FIRE_CONTRACT: '' } });
  assert.equal((await response.json()).ready, false);
  const result = await f.request('/unlock', f.proof, { env: { FIRE_CONTRACT: '' } });
  assert.equal(result.status, 503); assert.equal(f.calls.length, 0);
});
test('verified full-access signature and threshold balance unlock three AES-encrypted playlists', async () => {
  const f = await fixture();
  assert.equal(await verifySignature(f.challenge, f.proof.publicKey, f.proof.signature), true);
  const response = await f.request('/unlock', f.proof); assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.balance, '100.25'); assert.notEqual(result.sessionKey, f.env.PLAYLIST_KEY);
  assert.equal(f.calls.length, 3); assert.equal(f.calls[0].account_id, f.proof.accountId); assert.equal(f.calls[0].public_key, f.proof.publicKey);
  assert.equal(validPlaylists(await decryptJSON(result.envelope, fromBase64(result.sessionKey), result.context)), true);
  assert.deepEqual(await decryptJSON(result.envelope, fromBase64(result.sessionKey), result.context), playlists);
  assert.ok(!JSON.stringify(result).includes(playlists.early));
  await assert.rejects(decryptJSON(f.bundle, fromBase64(result.sessionKey), 'creators-of-fire:playlists:v1'));
  await assert.rejects(decryptJSON(result.envelope, fromBase64(result.sessionKey), 'wrong-context'));
});
test('insufficient balance exposes balance but never session content', async () => {
  const f = await fixture({ balance: '10024' }); const response = await f.request('/unlock', f.proof);
  assert.equal(response.status, 403); const result = await response.json();
  assert.equal(result.balance, '100.24'); assert.equal(result.error, 'INSUFFICIENT_FIRE'); assert.equal(result.sessionKey, undefined);
});
test('function-call keys cannot authorize access even with a valid signature', async () => {
  const f = await fixture({ permission: { FunctionCall: {} } });
  assert.equal((await f.request('/unlock', f.proof)).status, 403); assert.equal(f.calls.length, 1);
});
test('forged signature, challenge tampering, changed browser and expired proof fail before RPC', async () => {
  const f = await fixture();
  for (const changed of [{ signature: toBase64(new Uint8Array(64)) }, { token: f.proof.token + 'x' }, { clientNonce: 'wrong' }, { publicKey: 'secp256k1:invalid' }]) {
    assert.equal((await f.request('/unlock', { ...f.proof, ...changed })).status, 401);
  }
  f.advance(120001);
  assert.equal((await f.request('/unlock', f.proof)).status, 401); assert.equal(f.calls.length, 0);
});
test('changed contract or threshold invalidates an outstanding proof', async () => {
  const f = await fixture();
  for (const env of [{ FIRE_CONTRACT: 'other.testnet' }, { MINIMUM_FIRE: '200' }]) assert.equal((await f.request('/unlock', f.proof, { env })).status, 401);
  assert.equal(f.calls.length, 0);
});
test('RPC errors and malformed balances fail closed', async () => {
  for (const options of [{ rpcError: true }, { balance: '-1' }, { balance: 10025 }, { decimals: 100 }]) {
    const f = await fixture(options); const result = await f.request('/unlock', f.proof);
    assert.equal(result.status, 503); assert.equal((await result.json()).envelope, undefined);
  }
});
test('origin isolation, no-store responses and oversized request protection', async () => {
  const f = await fixture();
  assert.equal((await f.request('/unlock', f.proof, { headers: { Origin: 'https://evil.example' } })).status, 403);
  const response = await f.request('/status'); assert.equal(response.headers.get('Cache-Control'), 'no-store'); assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
  assert.equal((await f.request('/unlock', { data: 'x'.repeat(9000) })).status, 413);
  assert.equal((await f.request('/unlock', f.proof, { headers: { 'Content-Type': 'text/plain' } })).status, 415);
});
test('stateless proof replay within TTL rechecks chain and yields a new session key', async () => {
  const f = await fixture(); const a = await (await f.request('/unlock', f.proof)).json(); const b = await (await f.request('/unlock', f.proof)).json();
  assert.notEqual(a.sessionKey, b.sessionKey); assert.equal(f.calls.length, 6);
});

test('encryption tool keeps plaintext out of the tracked envelope and reuses the local secret', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'fire-encryption-'));
  try {
    await mkdir(path.join(directory, '.fire-private'));
    await mkdir(path.join(directory, 'workers/fire-access'), { recursive: true });
    await writeFile(path.join(directory, '.fire-private/playlists.json'), JSON.stringify(playlists));
    const script = path.resolve('scripts/encrypt-fire.mjs');
    const first = execFileSync(process.execPath, [script], { cwd: directory, encoding: 'utf8' });
    const key = (await readFile(path.join(directory, '.fire-private/playlist-key'), 'utf8')).trim();
    const envelopeText = await readFile(path.join(directory, 'workers/fire-access/playlists.encrypted.json'), 'utf8');
    assert.ok(!envelopeText.includes(playlists.exclusive)); assert.ok(!first.includes(key));
    assert.deepEqual(await decryptJSON(JSON.parse(envelopeText), fromBase64(key), 'creators-of-fire:playlists:v1'), playlists);
    execFileSync(process.execPath, [script], { cwd: directory, encoding: 'utf8' });
    assert.equal((await readFile(path.join(directory, '.fire-private/playlist-key'), 'utf8')).trim(), key);
    assert.notEqual(await readFile(path.join(directory, 'workers/fire-access/playlists.encrypted.json'), 'utf8'), envelopeText);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
