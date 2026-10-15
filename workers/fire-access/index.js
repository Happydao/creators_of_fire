import encryptedPlaylists from './playlists.encrypted.json' with { type: 'json' };
import { encode, decode, toBase64, fromBase64, encryptJSON, decryptJSON, validPlaylists } from '../../fire/crypto.js';
import { validAccount, atomicAmount, displayAmount, verifySignature, signChallenge, readChallenge } from './security.js';

const RPC = { mainnet: 'https://rpc.mainnet.near.org', testnet: 'https://rpc.testnet.near.org' };
const STORAGE_CONTEXT = 'creators-of-fire:playlists:v1';
class AccessError extends Error {
  constructor(status, code, details = {}) { super(code); Object.assign(this, { status, code, details }); }
}
const fail = (status, code, details) => { throw new AccessError(status, code, details); };
function configuration(env, bundle) {
  try {
    return Boolean(RPC[env.NETWORK] && validAccount(env.FIRE_CONTRACT) && typeof env.MINIMUM_FIRE === 'string' && /^(0|[1-9]\d{0,38})(\.\d{1,38})?$/.test(env.MINIMUM_FIRE) && /[1-9]/.test(env.MINIMUM_FIRE) &&
      fromBase64(env.PLAYLIST_KEY).length === 32 && fromBase64(env.CHALLENGE_SECRET).length === 32 &&
      bundle.version === 1 && fromBase64(bundle.iv).length === 12 && fromBase64(bundle.ciphertext).length > 16);
  } catch { return false; }
}
const configBinding = (env, bundle) => JSON.stringify([env.NETWORK, env.FIRE_CONTRACT, env.MINIMUM_FIRE, env.SESSION_SECONDS, bundle.iv]);

// Dependency injection is used by offline security tests; production always uses real RPC.
export function createHandler({ bundle = encryptedPlaylists, fetchRPC = fetch, now = Date.now } = {}) {
  async function query(env, params) {
    let response;
    try {
      response = await fetchRPC(RPC[env.NETWORK], { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 'fire-access', method: 'query', params }), signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error('RPC unavailable');
      const data = await response.json();
      if (data.error || !data.result) throw new Error('Invalid RPC response');
      return data.result;
    } catch { fail(503, 'NETWORK_UNAVAILABLE'); }
  }
  async function view(env, method, args, blockId) {
    const result = await query(env, { request_type: 'call_function', block_id: blockId, account_id: env.FIRE_CONTRACT,
      method_name: method, args_base64: toBase64(encode(JSON.stringify(args))) });
    try { return JSON.parse(decode(new Uint8Array(result.result))); } catch { fail(503, 'NETWORK_UNAVAILABLE'); }
  }
  return {
    async fetch(request, env) {
      const origin = request.headers.get('Origin');
      const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
      const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin', 'X-Content-Type-Options': 'nosniff' };
      const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
      if (!origin || !allowed.includes(origin)) return reply({ error: 'ORIGIN_NOT_ALLOWED' }, 403);
      headers['Access-Control-Allow-Origin'] = origin;
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...headers, 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' } });
      const path = new URL(request.url).pathname;
      const ready = configuration(env, bundle);
      if (path === '/status' && request.method === 'GET') return reply({ ready, network: env.NETWORK, contract: env.FIRE_CONTRACT || '', minimum: env.MINIMUM_FIRE || '' });
      if (!['/challenge', '/unlock'].includes(path)) return reply({ error: 'NOT_FOUND' }, 404);
      if (request.method !== 'POST') return reply({ error: 'METHOD_NOT_ALLOWED' }, 405);
      if (!ready) return reply({ error: 'PREPARING' }, 503);
      try {
        if (!request.headers.get('Content-Type')?.startsWith('application/json')) fail(415, 'INVALID_REQUEST');
        // Bound streamed bodies too, including requests without Content-Length.
        const reader = request.body?.getReader();
        if (!reader) fail(400, 'INVALID_REQUEST');
        let size = 0, chunks = [];
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 8192) { await reader.cancel(); fail(413, 'INVALID_REQUEST'); }
          chunks.push(value);
        }
        let body;
        try { body = JSON.parse(decode(new Uint8Array(chunks.flatMap(chunk => Array.from(chunk))))); } catch { fail(400, 'INVALID_REQUEST'); }
        if (!body || typeof body !== 'object') fail(400, 'INVALID_REQUEST');
        if (path === '/challenge') {
          if (typeof body.clientNonce !== 'string' || fromBase64(body.clientNonce).length !== 32) fail(400, 'INVALID_REQUEST');
          const expiresAt = now() + 120000;
          const challenge = {
            message: `Creators of Fire — verify exclusive music access.\nNo payment, transfer or transaction.\nNetwork: ${env.NETWORK}\nToken contract: ${env.FIRE_CONTRACT}\nSite: ${origin}\nExpires: ${new Date(expiresAt).toISOString()}\nBrowser: ${body.clientNonce}`,
            nonce: toBase64(crypto.getRandomValues(new Uint8Array(32))), recipient: new URL(origin).host,
            origin, expiresAt, clientNonce: body.clientNonce, binding: configBinding(env, bundle)
          };
          return reply({ message: challenge.message, nonce: challenge.nonce, recipient: challenge.recipient, expiresAt, token: await signChallenge(challenge, env.CHALLENGE_SECRET) });
        }
        let challenge;
        try { challenge = await readChallenge(body.token, env.CHALLENGE_SECRET); } catch { fail(401, 'INVALID_PROOF'); }
        if (challenge.expiresAt <= now() || challenge.expiresAt > now() + 120000 || challenge.origin !== origin || challenge.clientNonce !== body.clientNonce || challenge.binding !== configBinding(env, bundle)) fail(401, 'EXPIRED_PROOF');
        if (!validAccount(body.accountId) || !await verifySignature(challenge, body.publicKey, body.signature)) fail(401, 'INVALID_PROOF');
        // Match this exact signing key to the claimed account on a final block.
        const access = await query(env, { request_type: 'view_access_key', finality: 'final', account_id: body.accountId, public_key: body.publicKey });
        if (access.permission !== 'FullAccess' || typeof access.block_hash !== 'string' || !access.block_hash) fail(403, 'ACCOUNT_NOT_VERIFIED');
        const [metadata, raw] = await Promise.all([
          view(env, 'ft_metadata', {}, access.block_hash), view(env, 'ft_balance_of', { account_id: body.accountId }, access.block_hash)
        ]);
        let balance, minimum;
        try {
          if (typeof raw !== 'string' || !/^(0|[1-9]\d{0,38})$/.test(raw)) throw new Error();
          balance = BigInt(raw);
          minimum = atomicAmount(env.MINIMUM_FIRE, metadata.decimals);
          if (balance > (1n << 128n) - 1n || minimum <= 0n) throw new Error();
        } catch { fail(503, 'TOKEN_CONFIGURATION_ERROR'); }
        const details = { accountId: body.accountId, balance: displayAmount(balance, metadata.decimals), minimum: env.MINIMUM_FIRE };
        if (balance < minimum) fail(403, 'INSUFFICIENT_FIRE', details);
        const playlists = await decryptJSON(bundle, fromBase64(env.PLAYLIST_KEY), STORAGE_CONTEXT);
        if (!validPlaylists(playlists)) fail(503, 'CONTENT_UNAVAILABLE');
        const seconds = Number(env.SESSION_SECONDS || 1800);
        if (!Number.isInteger(seconds) || seconds < 60 || seconds > 3600) fail(503, 'CONTENT_UNAVAILABLE');
        const expiresAt = now() + seconds * 1000;
        const context = `creators-of-fire:session:${body.accountId}:${expiresAt}:${body.clientNonce}`;
        const sessionKey = crypto.getRandomValues(new Uint8Array(32));
        // Never release the permanent PLAYLIST_KEY. Each verified response gets a fresh envelope.
        const envelope = await encryptJSON(playlists, sessionKey, context);
        return reply({ ...details, expiresAt, context, envelope, sessionKey: toBase64(sessionKey) });
      } catch (error) {
        if (error instanceof AccessError) return reply({ error: error.code, ...error.details }, error.status);
        return reply({ error: 'ACCESS_UNAVAILABLE' }, 503);
      }
    }
  };
}
export default createHandler();
