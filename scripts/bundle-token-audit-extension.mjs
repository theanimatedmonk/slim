#!/usr/bin/env node
/**
 * Bundle the Chrome extension content script into a single IIFE.
 * ES module content scripts fail to resolve imports without web_accessible_resources.
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const __dirname = dirname(fileURLToPath(import.meta.url));
const extDir = join(__dirname, '../extensions/token-audit');

await esbuild.build({
  entryPoints: [join(extDir, 'content.js')],
  bundle: true,
  outfile: join(extDir, 'content.bundle.js'),
  format: 'iife',
  target: 'chrome100',
  logLevel: 'info',
});

console.log('Bundled extensions/token-audit/content.bundle.js');
