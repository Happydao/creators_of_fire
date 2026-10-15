import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { validTrack } from '../src/catalog.js';
import { buildWallet } from './build-wallet.mjs';
const catalog = JSON.parse(await readFile('data/catalog.json', 'utf8'));
if (!catalog.tracks.length || !catalog.tracks.every(validTrack)) throw new Error('Invalid catalog');
if (new Set(catalog.tracks.map(t => t.id)).size !== catalog.tracks.length) throw new Error('Duplicate video IDs');
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
for (const name of ['index.html', 'privacy.html', 'src', 'assets', 'data']) await cp(name, `dist/${name}`, { recursive: true });
await mkdir('dist/fire', { recursive: true });
for (const name of ['index.html', 'styles.css', 'app.js', 'config.js', 'crypto.js', 'token-information.js']) await cp(`fire/${name}`, `dist/fire/${name}`);
await buildWallet('dist/fire/vendor');
// A newly deployed document must not reuse an older cached shared stylesheet.
const styleVersion = createHash('sha256').update(await readFile('src/styles.css')).digest('hex').slice(0, 12);
for (const page of ['index.html', 'privacy.html', 'fire/index.html']) {
  const filename = `dist/${page}`;
  const html = await readFile(filename, 'utf8');
  await writeFile(filename, html.replace(/href="(\.\.?\/src\/styles\.css)"/g, `href="$1?v=${styleVersion}"`));
}
await writeFile('dist/.nojekyll', '');
await writeFile('dist/404.html', '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Frequency not found — Creators of Fire</title><style>body{background:#0b0b0d;color:#eee;font:18px sans-serif;padding:12vw}a{color:#ff662f}</style><h1>Frequency not found.</h1><p>Let’s get you back to the music.</p><a href="/">Return to Creators of Fire →</a></html>');
await writeFile('dist/sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://creatorsoffire.com/</loc></url></urlset>');
console.log(`Built GitHub Pages site with ${catalog.tracks.length} verified tracks. All app assets use relative paths.`);
