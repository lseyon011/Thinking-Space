// Bundle the thinkspc CLI (capabilityRunner.ts + all its deps) into a single
// self-contained ESM file that the Electron-as-Node shim can invoke.
//
// Output: frontend/electron/resources/cli/thinkspc-runner.mjs
//
// Invoked as part of the electron build (see frontend/electron/package.json).
// Also runnable standalone for dev: `node frontend/scripts/bundle-cli.mjs`.

import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRONTEND = resolve(__dirname, '..');
const ENTRY = resolve(FRONTEND, 'scripts/agent/capabilityRunner.ts');
const OUT = resolve(FRONTEND, 'electron/resources/cli/thinkspc-runner.mjs');

await mkdir(dirname(OUT), { recursive: true });

const result = await build({
  entryPoints: [ENTRY],
  outfile: OUT,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  // Node 20+ ESM doesn't auto-resolve __dirname; banner provides shims.
  banner: {
    js: [
      "import { createRequire as __thinkspcCreateRequire } from 'node:module';",
      "import { fileURLToPath as __thinkspcFileURLToPath } from 'node:url';",
      "import { dirname as __thinkspcDirname } from 'node:path';",
      "const require = __thinkspcCreateRequire(import.meta.url);",
      "const __filename = __thinkspcFileURLToPath(import.meta.url);",
      "const __dirname = __thinkspcDirname(__filename);",
    ].join('\n'),
  },
  // Keep names + don't minify for sane stack traces; size is not a concern
  // (one file, a few MB at worst).
  minify: false,
  sourcemap: false,
  keepNames: true,
  legalComments: 'none',
  // Mark Node built-ins as external so esbuild doesn't try to bundle them.
  external: [
    'node:*',
    'electron',
  ],
  logLevel: 'info',
  metafile: true,
});

const totalBytes = Object.values(result.metafile.outputs).reduce((n, o) => n + o.bytes, 0);
console.log(`[bundle-cli] wrote ${OUT} (${(totalBytes / 1024).toFixed(1)} KB)`);
