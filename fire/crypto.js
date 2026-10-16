export const encode = value => new TextEncoder().encode(value);
export const decode = bytes => new TextDecoder('utf-8', { fatal: true }).decode(bytes);
export const toBase64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
export function fromBase64(value) {
  if (typeof value !== 'string' || value.length > 16384) throw new Error('Invalid encoding');
  return Uint8Array.from(atob(value), c => c.charCodeAt(0));
}
export async function encryptJSON(value, rawKey, context) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['encrypt']);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encode(context) }, key, encode(JSON.stringify(value)));
  return { version: 1, iv: toBase64(iv), ciphertext: toBase64(ciphertext) };
}
export async function decryptJSON(envelope, rawKey, context) {
  if (envelope?.version !== 1 || rawKey.length !== 32) throw new Error('Invalid envelope');
  const iv = fromBase64(envelope.iv);
  if (iv.length !== 12) throw new Error('Invalid nonce');
  const key = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['decrypt']);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: encode(context) }, key, fromBase64(envelope.ciphertext));
  return JSON.parse(decode(plain));
}
export const PLAYLIST_KEYS = ['exclusive', 'alternate', 'early'];
export function validPlaylists(value) {
  // YouTube also issues shorter playlist IDs; retain the safe ID alphabet.
  return value && Object.keys(value).length === 3 && PLAYLIST_KEYS.every(key => typeof value[key] === 'string' && /^PL[A-Za-z0-9_-]{10,64}$/.test(value[key])) && new Set(Object.values(value)).size === 3;
}
