#!/usr/bin/env node
/**
 * Local CSS writer for SlimVG Token Inspect (approach 2A).
 *
 * Listens on http://127.0.0.1:7319
 * Accepts POST /apply with a strict JSON changelog and surgically updates
 * allowlisted CSS files under apps/frontend/src — nothing else.
 *
 * Run: npm run token-inspect:writer
 */

import { createServer } from 'node:http';
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, normalize, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const FRONTEND_SRC = join(ROOT, 'apps/frontend/src');
const PORT = Number(process.env.TOKEN_INSPECT_WRITER_PORT || 7319);
const HOST = '127.0.0.1';

const ALLOWED_ROOT = resolve(FRONTEND_SRC);

function json(res, status, body) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(payload);
}

function collectCssFiles(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collectCssFiles(full, acc);
    else if (entry.endsWith('.css')) acc.push(full);
  }
  return acc;
}

/** @type {Map<string, string>} basename → absolute path (first wins if unique enough) */
function buildCssIndex() {
  const index = new Map();
  for (const abs of collectCssFiles(FRONTEND_SRC)) {
    const base = abs.split(sep).pop();
    if (!index.has(base)) index.set(base, abs);
    else index.set(base, ''); // ambiguous
  }
  return index;
}

function resolveEditFile(edit, cssIndex) {
  const candidates = [edit.file, edit.sourcePath].filter(Boolean).map(String);

  for (const raw of candidates) {
    if (!raw || raw === 'inline' || raw === 'element.style') continue;

    let rel = raw.replace(/\\/g, '/').replace(/^\//, '');
    try {
      if (rel.includes('://')) rel = new URL(rel).pathname.replace(/^\//, '');
    } catch {
      // keep
    }
    rel = rel.split('?')[0];

    // Absolute FS path containing /apps/frontend/src/
    const absMarker = '/apps/frontend/src/';
    const absIdx = `/${rel}`.replace(/\\/g, '/').lastIndexOf(absMarker);
    if (absIdx !== -1) {
      const fromSrc = `/${rel}`.replace(/\\/g, '/').slice(absIdx + '/apps/frontend/'.length);
      // fromSrc like src/components/AssetRow.css
      const abs = resolve(ROOT, 'apps/frontend', fromSrc);
      assertAllowlisted(abs);
      if (existsSync(abs)) return abs;
    }

    if (rel.startsWith('src/')) rel = `apps/frontend/${rel}`;

    if (rel.startsWith('apps/frontend/src/')) {
      const abs = resolve(ROOT, rel);
      assertAllowlisted(abs);
      if (!existsSync(abs)) throw new Error(`File not found: ${rel}`);
      return abs;
    }

    // bare filename e.g. AssetRow.css
    const base = rel.split('/').pop();
    const abs = cssIndex.get(base);
    if (abs) return abs;
    if (abs === '') throw new Error(`Ambiguous CSS filename: ${base}`);
  }

  throw new Error(
    `Cannot resolve CSS file: ${edit.file || edit.sourcePath || '(missing)'}. ` +
      'Vite may have injected the rule without a path — reload the page and try again.'
  );
}

function assertAllowlisted(absPath) {
  const normalized = resolve(absPath);
  const root = ALLOWED_ROOT.endsWith(sep) ? ALLOWED_ROOT : ALLOWED_ROOT + sep;
  if (normalized !== ALLOWED_ROOT && !normalized.startsWith(root)) {
    throw new Error(`Refusing path outside apps/frontend/src: ${absPath}`);
  }
  if (!normalized.endsWith('.css')) {
    throw new Error(`Refusing non-CSS file: ${absPath}`);
  }
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Replace a declaration value. Prefers matching inside the selector block when provided.
 */
function applyPropertyEdit(css, edit) {
  const { selector, property, from, to } = edit;
  if (!property || from == null || to == null) {
    throw new Error('Property edit requires property, from, to');
  }
  if (from === to) return { css, changed: false };

  const declRe = new RegExp(
    `(${escapeRegExp(property)}\\s*:\\s*)${escapeRegExp(from)}(\\s*;)`,
    'g'
  );

  if (selector && selector !== 'element.style' && !selector.startsWith('element.')) {
    const block = findRuleBlock(css, selector);
    if (block) {
      const slice = css.slice(block.bodyStart, block.bodyEnd);
      if (!declRe.test(slice)) {
        throw new Error(
          `Could not find \`${property}: ${from}\` in selector \`${selector}\` (${relative(ROOT, edit._abs || '')})`
        );
      }
      declRe.lastIndex = 0;
      let count = 0;
      const nextSlice = slice.replace(declRe, (_, pre, semi) => {
        count += 1;
        return `${pre}${to}${semi}`;
      });
      if (count !== 1) {
        throw new Error(
          `Expected exactly 1 match for \`${property}: ${from}\` in \`${selector}\`, found ${count}`
        );
      }
      return {
        css: css.slice(0, block.bodyStart) + nextSlice + css.slice(block.bodyEnd),
        changed: true,
      };
    }
  }

  // Fallback: whole file, still require exactly one match
  const matches = css.match(declRe);
  if (!matches || matches.length === 0) {
    throw new Error(`Could not find \`${property}: ${from}\` in file`);
  }
  if (matches.length > 1) {
    throw new Error(
      `Ambiguous: found ${matches.length} matches for \`${property}: ${from}\` — include a selector`
    );
  }
  declRe.lastIndex = 0;
  return {
    css: css.replace(declRe, (_, pre, semi) => `${pre}${to}${semi}`),
    changed: true,
  };
}

function applyTokenEdit(css, edit) {
  const { tokenName, from, to } = edit;
  if (!tokenName || from == null || to == null) {
    throw new Error('Token edit requires tokenName, from, to');
  }
  if (from === to) return { css, changed: false };

  const declRe = new RegExp(
    `(${escapeRegExp(tokenName)}\\s*:\\s*)${escapeRegExp(from)}(\\s*;)`,
    'g'
  );
  const matches = css.match(declRe);
  if (!matches || matches.length === 0) {
    throw new Error(`Could not find \`${tokenName}: ${from}\` in file`);
  }
  if (matches.length > 1) {
    throw new Error(`Ambiguous: found ${matches.length} matches for \`${tokenName}: ${from}\``);
  }
  declRe.lastIndex = 0;
  return {
    css: css.replace(declRe, (_, pre, semi) => `${pre}${to}${semi}`),
    changed: true,
  };
}

/**
 * Best-effort locate `{ ... }` body for a selector appearing in the file.
 */
function findRuleBlock(css, selector) {
  const needle = selector.trim();
  let searchFrom = 0;
  while (searchFrom < css.length) {
    const idx = css.indexOf(needle, searchFrom);
    if (idx === -1) return null;

    // Ensure it's a selector occurrence (not inside a comment roughly)
    const before = css.slice(Math.max(0, idx - 80), idx);
    if (before.includes('/*') && !before.includes('*/')) {
      searchFrom = idx + needle.length;
      continue;
    }

    let i = idx + needle.length;
    while (i < css.length && /\s/.test(css[i])) i++;
    // Allow comma-separated selector lists: if next is comma, skip this occurrence
    // and keep looking for a block that starts with { after this selector alone or in a list
    // Simpler: find next `{` before a `;` that would end a weird case
    const open = css.indexOf('{', i);
    if (open === -1) return null;
    const between = css.slice(i, open);
    if (between.includes('}')) {
      searchFrom = idx + needle.length;
      continue;
    }

    let depth = 0;
    let bodyStart = -1;
    for (let j = open; j < css.length; j++) {
      const ch = css[j];
      if (ch === '{') {
        depth += 1;
        if (depth === 1) bodyStart = j + 1;
      } else if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          return { bodyStart, bodyEnd: j };
        }
      }
    }
    return null;
  }
  return null;
}

function validateEditShape(edit) {
  if (!edit || typeof edit !== 'object') throw new Error('Invalid edit');
  if (edit.kind !== 'property' && edit.kind !== 'token') {
    throw new Error(`Unsupported edit kind: ${edit.kind}`);
  }
  if (typeof edit.from !== 'string' || typeof edit.to !== 'string') {
    throw new Error('Edit requires string from/to');
  }
  // Hard rule: no path traversal / script payloads in values
  if (edit.to.includes('</') || edit.from.includes('</')) {
    throw new Error('Refusing HTML-like content in CSS values');
  }
}

function applyEdits(edits) {
  const cssIndex = buildCssIndex();
  /** @type {Map<string, { abs: string, css: string, dirty: boolean }>} */
  const files = new Map();
  const results = [];

  for (const [index, edit] of edits.entries()) {
    try {
      validateEditShape(edit);
      const abs = resolveEditFile(edit, cssIndex);
      edit._abs = abs;
      const rel = relative(ROOT, abs);

      if (!files.has(abs)) {
        files.set(abs, { abs, css: readFileSync(abs, 'utf8'), dirty: false });
      }
      const entry = files.get(abs);
      const applied =
        edit.kind === 'property' ? applyPropertyEdit(entry.css, edit) : applyTokenEdit(entry.css, edit);

      entry.css = applied.css;
      if (applied.changed) entry.dirty = true;

      results.push({
        index,
        ok: true,
        file: rel,
        kind: edit.kind,
        changed: applied.changed,
      });
    } catch (err) {
      results.push({
        index,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        kind: edit?.kind,
      });
    }
  }

  const written = [];
  const failed = results.some((r) => !r.ok);
  if (failed) {
    return {
      ok: false,
      message: 'One or more edits failed — no files were written',
      results,
      written,
    };
  }

  for (const entry of files.values()) {
    if (!entry.dirty) continue;
    writeFileSync(entry.abs, entry.css, 'utf8');
    written.push(relative(ROOT, entry.abs));
  }

  return {
    ok: true,
    message: written.length ? `Wrote ${written.length} file(s)` : 'No file changes needed',
    results,
    written,
  };
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${HOST}:${PORT}`);

  if (req.method === 'OPTIONS') {
    json(res, 204, {});
    return;
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    json(res, 200, {
      ok: true,
      service: 'token-inspect-writer',
      root: relative(ROOT, FRONTEND_SRC),
      port: PORT,
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/apply') {
    try {
      const raw = await readBody(req);
      const body = raw ? JSON.parse(raw) : {};
      const edits = Array.isArray(body.edits) ? body.edits : null;
      if (!edits || edits.length === 0) {
        json(res, 400, { ok: false, message: 'Body must include non-empty edits[]' });
        return;
      }
      if (edits.length > 100) {
        json(res, 400, { ok: false, message: 'Too many edits (max 100)' });
        return;
      }

      const outcome = applyEdits(edits);
      json(res, outcome.ok ? 200 : 422, outcome);
    } catch (err) {
      json(res, 400, {
        ok: false,
        message: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }

  json(res, 404, { ok: false, message: 'Not found. Use GET /health or POST /apply' });
});

server.listen(PORT, HOST, () => {
  console.log(`Token Inspect writer listening on http://${HOST}:${PORT}`);
  console.log(`Allowlisted CSS root: ${relative(ROOT, FRONTEND_SRC)}`);
  console.log('POST /apply  { "edits": [ ... ] }');
});
