import { encode, fromBase64, toBase64 } from '../../fire/crypto.js';

export const validAccount = value => typeof value === 'string' && value.length >= 2 && value.length <= 64 && /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(value);
export function atomicAmount(amount, decimals) {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 38 || typeof amount !== 'string' || !/^(0|[1-9]\d{0,38})(\.\d+)?$/.test(amount)) throw new Error('Invalid token amount');
  const [whole, fraction = ''] = amount.split('.');
  if (fraction.length > decimals) throw new Error('Too many decimal places');
  const result = BigInt(whole + fraction.padEnd(decimals, '0'));
  if (result > (1n << 128n) - 1n) throw new Error('Amount exceeds NEP-141 range');
  return result;
}
export function displayAmount(raw, decimals) {
  const digits = raw.toString().padStart(decimals + 1, '0');
  if (!decimals) return digits;
  return `${digits.slice(0, -decimals)}.${digits.slice(-decimals)}`.replace(/\.?0+$/, '');
}
const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export function decodePublicKey(publicKey) {
  if (typeof publicKey !== 'string' || !/^ed25519:[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(publicKey)) throw new Error('Unsupported public key');
  const input = publicKey.slice(8);
  let number = 0n;
  for (const letter of input) number = number * 58n + BigInt(alphabet.indexOf(letter));
  const bytes = [];
  while (number) { bytes.unshift(Number(number & 255n)); number >>= 8n; }
  for (const letter of input) { if (letter !== '1') break; bytes.unshift(0); }
  if (bytes.length !== 32) throw new Error('Invalid key length');
  return new Uint8Array(bytes);
}
function u32(value) { const bytes = new Uint8Array(4); new DataView(bytes.buffer).setUint32(0, value, true); return bytes; }
function string(value) { const bytes = encode(value); return [...u32(bytes.length), ...bytes]; }
export async function messageHash({ message, nonce, recipient, callbackUrl }) {
  const bytes = typeof nonce === 'string' ? fromBase64(nonce) : nonce;
  if (bytes.length !== 32) throw new Error('Invalid nonce');
  const payload = new Uint8Array([...u32(2147484061), ...string(message), ...bytes, ...string(recipient), ...(callbackUrl === undefined ? [0] : [1, ...string(callbackUrl)])]);
  return crypto.subtle.digest('SHA-256', payload);
}
export async function verifySignature(challenge, publicKey, signature) {
  try {
    const key = await crypto.subtle.importKey('raw', decodePublicKey(publicKey), 'Ed25519', false, ['verify']);
    const bytes = fromBase64(signature);
    return bytes.length === 64 && await crypto.subtle.verify('Ed25519', key, bytes, await messageHash(challenge));
  } catch { return false; }
}
async function hmacKey(secret, usage) {
  const bytes = fromBase64(secret);
  if (bytes.length !== 32) throw new Error('Invalid secret');
  return crypto.subtle.importKey('raw', bytes, { name: 'HMAC', hash: 'SHA-256' }, false, [usage]);
}
export async function signChallenge(challenge, secret) {
  const payload = toBase64(encode(JSON.stringify(challenge)));
  const mac = await crypto.subtle.sign('HMAC', await hmacKey(secret, 'sign'), encode(payload));
  return `${payload}.${toBase64(mac)}`;
}
export async function readChallenge(token, secret) {
  if (typeof token !== 'string' || token.length > 4096) throw new Error('Invalid challenge');
  const parts = token.split('.');
  if (parts.length !== 2 || !await crypto.subtle.verify('HMAC', await hmacKey(secret, 'verify'), fromBase64(parts[1]), encode(parts[0]))) throw new Error('Invalid challenge');
  return JSON.parse(new TextDecoder().decode(fromBase64(parts[0])));
}
