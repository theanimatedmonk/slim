import {
  createTokenRegistry,
  resolveTokenTree,
  resolveValueTrees,
  terminalValue,
  extractVarRefs,
  classifyToken,
  normalizeColor,
} from './lib/index.mjs';

/**
 * Load primitives + semantic + any other custom properties from the page CSSOM / Vite.
 * @returns {Promise<Map<string, { value: string, file: string, layer: string }>>}
 */
export async function loadTokenRegistry() {
  let primitivesCss = '';
  let semanticCss = '';

  primitivesCss = await fetchCss('/src/styles/tokens/primitives.css');
  semanticCss = await fetchCss('/src/styles/tokens/semantic.css');

  const registry = createTokenRegistry(primitivesCss, semanticCss);

  // Harvest component / page custom properties from live stylesheets
  for (const sheet of document.styleSheets) {
    let href = '';
    try {
      href = sheet.href ?? 'inline';
    } catch {
      continue;
    }
    const file = fileNameFromHref(href);
    harvestCustomProps(sheet, registry, file);
  }

  return registry;
}

async function fetchCss(path) {
  try {
    const res = await fetch(new URL(path, window.location.origin));
    if (res.ok) return await res.text();
  } catch {
    // ignore
  }
  return '';
}

function fileNameFromHref(href) {
  if (!href || href === 'inline') return 'inline';
  try {
    return decodeURIComponent(new URL(href).pathname.split('/').pop() || href);
  } catch {
    return href.split('/').pop() || href;
  }
}

function harvestCustomProps(styleSheet, registry, file, seen = new Set()) {
  if (!styleSheet || seen.has(styleSheet)) return;
  seen.add(styleSheet);

  let rules;
  try {
    rules = styleSheet.cssRules;
  } catch {
    return;
  }
  if (!rules) return;

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    if (rule.type === CSSRule.STYLE_RULE) {
      const style = /** @type {CSSStyleRule} */ (rule).style;
      for (let j = 0; j < style.length; j++) {
        const prop = style[j];
        if (!prop.startsWith('--')) continue;
        if (registry.has(prop)) continue;
        const value = style.getPropertyValue(prop).trim();
        registry.set(prop, {
          value,
          file,
          layer: classifyToken(prop, registry),
        });
      }
    } else if (rule.type === CSSRule.IMPORT_RULE) {
      const imported = /** @type {CSSImportRule} */ (rule).styleSheet;
      if (imported) harvestCustomProps(imported, registry, fileNameFromHref(imported.href), seen);
    } else if ('cssRules' in rule && rule.cssRules) {
      harvestCustomProps(/** @type {CSSStyleSheet} */ (rule), registry, file, seen);
    }
  }
}

export {
  resolveTokenTree,
  resolveValueTrees,
  terminalValue,
  extractVarRefs,
  classifyToken,
  normalizeColor,
};
