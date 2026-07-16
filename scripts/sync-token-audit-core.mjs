#!/usr/bin/env node
/**
 * Copy token-audit-core into the Chrome extension lib/ folder.
 * Chrome extensions cannot import from outside their package directory.
 */

import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'packages/token-audit-core/src');
const DEST = join(ROOT, 'extensions/token-audit/lib');

rmSync(DEST, { recursive: true, force: true });
mkdirSync(DEST, { recursive: true });
cpSync(SRC, DEST, { recursive: true });

console.log('Synced token-audit-core → extensions/token-audit/lib');

await import('./bundle-token-audit-extension.mjs');
