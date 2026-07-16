#!/usr/bin/env node
/**
 * Audit frontend CSS for design-token compliance.
 *
 * Layers: primitive → semantic → component
 * See docs/DESIGN_SYSTEM.md
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditCssText, createTokenRegistry } from '@asset-optimiser/token-audit-core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const FRONTEND_SRC = join(ROOT, 'apps/frontend/src');
const PRIMITIVES_PATH = join(FRONTEND_SRC, 'styles/tokens/primitives.css');
const SEMANTIC_PATH = join(FRONTEND_SRC, 'styles/tokens/semantic.css');

const args = new Set(process.argv.slice(2));
const jsonOutput = args.has('--json');
const strict = args.has('--strict');
const showTrace = args.has('--trace') || jsonOutput;

const tokenRegistry = createTokenRegistry(
  readFileSync(PRIMITIVES_PATH, 'utf8'),
  readFileSync(SEMANTIC_PATH, 'utf8')
);

/** @type {Array<{ severity: string, rule: string, file: string, line?: number, property?: string, value: string, message: string, trace?: string[], selector?: string }>} */
const findings = [];

function collectCssFiles(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectCssFiles(full, acc);
    } else if (entry.endsWith('.css')) {
      acc.push(full);
    }
  }
  return acc;
}

function auditFile(filePath) {
  const rel = relative(ROOT, filePath);
  const cssText = readFileSync(filePath, 'utf8');
  findings.push(
    ...auditCssText(cssText, rel, {
      tokenRegistry,
      showTrace,
    })
  );
}

function printReport() {
  const errors = findings.filter((f) => f.severity === 'error');
  const warnings = findings.filter((f) => f.severity === 'warn');
  const filesScanned = collectCssFiles(FRONTEND_SRC).filter(
    (f) => !['primitives.css', 'semantic.css', 'index.css'].includes(f.split(/[/\\]/).pop())
  ).length;

  if (jsonOutput) {
    console.log(
      JSON.stringify(
        {
          summary: {
            errors: errors.length,
            warnings: warnings.length,
            filesScanned,
            tokens: {
              primitive: [...tokenRegistry.values()].filter((t) => t.layer === 'primitive').length,
              semantic: [...tokenRegistry.values()].filter((t) => t.layer === 'semantic').length,
            },
          },
          findings,
        },
        null,
        2
      )
    );
    return;
  }

  console.log('\nDesign token audit\n');
  console.log(
    `Tokens loaded: ${tokenRegistry.size} (${[...tokenRegistry.values()].filter((t) => t.layer === 'primitive').length} primitive, ${[...tokenRegistry.values()].filter((t) => t.layer === 'semantic').length} semantic)`
  );
  console.log(`Findings: ${errors.length} error(s), ${warnings.length} warning(s)\n`);

  const byFile = new Map();
  for (const finding of findings) {
    if (!byFile.has(finding.file)) byFile.set(finding.file, []);
    byFile.get(finding.file).push(finding);
  }

  for (const [file, fileFindings] of [...byFile.entries()].sort()) {
    console.log(file);
    for (const f of fileFindings) {
      const icon = f.severity === 'error' ? '✖' : '⚠';
      const loc = f.property ? `${f.property}` : 'value';
      console.log(`  ${icon} [${f.rule}] line ${f.line} ${loc}`);
      console.log(`    ${f.message}`);
      console.log(`    ${f.value}`);
      if (showTrace && f.trace?.length) {
        console.log('    trace:');
        for (const t of f.trace) console.log(`      ${t}`);
      }
    }
    console.log('');
  }

  if (findings.length === 0) {
    console.log('No naked values or primitive leaks found in component CSS.\n');
  } else {
    console.log(
      'Fix errors first: component CSS should use semantic/component tokens, not primitives or raw values.'
    );
    console.log('Re-run: npm run audit:tokens');
    if (showTrace === false) console.log('Add --trace to see token chains.\n');
  }
}

for (const file of collectCssFiles(FRONTEND_SRC)) {
  auditFile(file);
}

printReport();

if (strict && findings.some((f) => f.severity === 'error')) {
  process.exit(1);
}
