import { build } from 'esbuild';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
export async function buildWallet(outdir = 'fire/vendor') {
  await build({ entryPoints: ['fire/wallet.js'], outdir, bundle: true, format: 'esm', platform: 'browser',
    target: ['es2022'], minify: true, sourcemap: false, legalComments: 'eof',
    inject: ['fire/buffer-shim.js'], define: { 'process.env.NODE_ENV': '"production"', global: 'globalThis' },
    // The upstream SDK logs local key material in its unused sign-in flow.
    drop: ['console', 'debugger'],
    plugins: [{ name: 'patched-uri-decoder-compat', setup(builder) {
      // query-string 7 uses require(); the patched decoder 0.5 is ESM-only.
      builder.onResolve({ filter: /^decode-uri-component$/ }, () => ({ path: 'decoder', namespace: 'decoder-compat' }));
      builder.onLoad({ filter: /.*/, namespace: 'decoder-compat' }, () => ({
        contents: `import decode from ${JSON.stringify(require.resolve('decode-uri-component'))}; module.exports = decode;`,
        loader: 'js', resolveDir: process.cwd()
      }));
    }}] });
}
if (process.argv[1]?.endsWith('build-wallet.mjs')) await buildWallet();
