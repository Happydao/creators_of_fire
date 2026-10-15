import { readFile, writeFile, mkdir, chmod } from 'node:fs/promises';
import { encryptJSON, validPlaylists, toBase64, fromBase64 } from '../fire/crypto.js';

// Local-only files: never pass IDs/keys as command-line arguments or print them.
await mkdir('.fire-private', { recursive: true, mode: 0o700 });
await chmod('.fire-private', 0o700);
let playlists;
try { playlists = JSON.parse(await readFile('.fire-private/playlists.json', 'utf8')); }
catch { throw new Error('Create .fire-private/playlists.json first. See docs/FIRE-ACCESS.md.'); }
if (!validPlaylists(playlists)) throw new Error('Provide three distinct unlisted playlist IDs: exclusive, alternate, early.');
async function secret(filename) {
  try {
    const value = (await readFile(filename, 'utf8')).trim();
    if (fromBase64(value).length !== 32) throw new Error('Invalid secret');
    return value;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const value = toBase64(crypto.getRandomValues(new Uint8Array(32)));
    await writeFile(filename, value + '\n', { mode: 0o600, flag: 'wx' });
    return value;
  }
}
const key = await secret('.fire-private/playlist-key');
await secret('.fire-private/challenge-secret');
const envelope = await encryptJSON(playlists, fromBase64(key), 'creators-of-fire:playlists:v1');
await writeFile('workers/fire-access/playlists.encrypted.json', JSON.stringify(envelope, null, 2) + '\n');
console.log('Encrypted all three playlists. Secrets remain in .fire-private/ (ignored by Git). Upload them as Worker secrets, then remove local plaintext/back up securely.');
