#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '../extensions/token-audit/icons');
mkdirSync(iconsDir, { recursive: true });

// 16×16 amber square (#d97706) — Chrome scales for larger sizes
const icon16 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAKklEQVQ4T2P8z8Dwn4GBgYGRgYGBgRHEwMjAwMDIwMDAwPifAQMDA8N/BqgFAD5oAwfJ8xKpAAAAAElFTkSuQmCC',
  'base64'
);

writeFileSync(join(iconsDir, 'icon16.png'), icon16);
writeFileSync(join(iconsDir, 'icon48.png'), icon16);
writeFileSync(join(iconsDir, 'icon128.png'), icon16);

console.log('Wrote extension icons');
