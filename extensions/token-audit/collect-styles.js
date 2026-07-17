import { extractVarRefs, resolveValueTrees, terminalValue, normalizeColor } from './tokens.js';

/**
 * Collect matched style rules for an element, grouped by selector (DevTools-like).
 * @param {Element} el
 * @param {Map<string, { value: string, file: string, layer: string }>} tokenRegistry
 */
export function collectMatchedStyles(el, tokenRegistry) {
  /** @type {Array<{ selector: string, file: string, properties: Array<any> }>} */
  const groups = [];

  for (const sheet of document.styleSheets) {
    let href = 'inline';
    try {
      href = sheet.href ?? 'inline';
    } catch {
      continue;
    }
    const file = fileNameFromHref(href);

    for (const rule of walkStyleRules(sheet)) {
      const selector = rule.selectorText;
      if (!selector || !matchesElement(el, selector)) continue;

      const properties = [];
      const style = rule.style;
      for (let i = 0; i < style.length; i++) {
        const property = style[i];
        const value = style.getPropertyValue(property).trim();
        if (!value) continue;

        const trees = resolveValueTrees(value, tokenRegistry);
        const computed = getComputedStyle(el).getPropertyValue(property).trim();
        const swatch = colorSwatchFor(property, trees, computed, value);

        properties.push({
          property,
          value,
          trees,
          computed,
          swatch,
          hasTokens: trees.length > 0,
        });
      }

      if (properties.length === 0) continue;

      // Prefer token-bearing props first within the group
      properties.sort((a, b) => Number(b.hasTokens) - Number(a.hasTokens));

      groups.push({ selector, file, properties });
    }
  }

  // Inline styles
  if (el instanceof HTMLElement && el.style.length > 0) {
    const properties = [];
    for (let i = 0; i < el.style.length; i++) {
      const property = el.style[i];
      const value = el.style.getPropertyValue(property).trim();
      const trees = resolveValueTrees(value, tokenRegistry);
      const computed = getComputedStyle(el).getPropertyValue(property).trim();
      properties.push({
        property,
        value,
        trees,
        computed,
        swatch: colorSwatchFor(property, trees, computed, value),
        hasTokens: trees.length > 0,
      });
    }
    if (properties.length) {
      groups.unshift({ selector: 'element.style', file: 'inline', properties });
    }
  }

  // Most specific / later rules last in DevTools; reverse so primary class is first-ish
  return prioritizeGroups(groups, el);
}

function prioritizeGroups(groups, el) {
  const classList = el instanceof Element ? [...el.classList] : [];
  return [...groups].sort((a, b) => {
    const score = (g) => {
      let s = 0;
      for (const cls of classList) {
        if (g.selector.includes(`.${cls}`)) s += 10;
      }
      if (g.selector === 'element.style') s += 100;
      // Prefer more specific selectors (more classes)
      s += (g.selector.match(/\./g) || []).length;
      return -s;
    };
    return score(a) - score(b);
  });
}

function matchesElement(el, selectorText) {
  // Split comma-separated selectors; ignore pseudo-elements for matching
  const parts = selectorText.split(',').map((s) => s.trim());
  for (let part of parts) {
    part = part.replace(/::?(before|after|placeholder|marker|selection|first-line|first-letter)\b.*/g, '');
    part = part.replace(/:(hover|focus|active|disabled|visited|focus-visible|focus-within)(?![-\w])/g, '');
    part = part.trim();
    if (!part) continue;
    try {
      if (el.matches(part)) return true;
    } catch {
      // invalid after stripping
    }
  }
  return false;
}

function* walkStyleRules(styleSheet, seen = new Set()) {
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
      yield /** @type {CSSStyleRule} */ (rule);
    } else if (rule.type === CSSRule.IMPORT_RULE) {
      const imported = /** @type {CSSImportRule} */ (rule).styleSheet;
      if (imported) yield* walkStyleRules(imported, seen);
    } else if ('cssRules' in rule && rule.cssRules) {
      yield* walkStyleRules(/** @type {CSSStyleSheet} */ (rule), seen);
    }
  }
}

function fileNameFromHref(href) {
  if (!href || href === 'inline') return 'inline';
  try {
    return decodeURIComponent(new URL(href).pathname.split('/').pop() || href);
  } catch {
    return href.split('/').pop() || href;
  }
}

function colorSwatchFor(property, trees, computed, declared) {
  const isColorProp =
    /color|background|fill|stroke|border|outline|shadow/i.test(property) ||
    property === 'background';

  if (!isColorProp) return null;

  let raw = '';
  if (trees.length) {
    raw = terminalValue(trees[0]);
  }
  if (!raw || raw.startsWith('var(') || extractVarRefs(raw).length) {
    raw = computed || declared;
  }

  const hex = normalizeColor(raw);
  if (hex.startsWith('#') || /^rgba?\(/i.test(raw) || raw === 'transparent') {
    return raw.startsWith('#') || raw.startsWith('rgb') || raw === 'transparent' ? raw : hex;
  }
  return null;
}

/**
 * Short label for the selected element.
 * @param {Element} el
 */
export function elementLabel(el) {
  if (el.classList?.length) {
    // Prefer the most specific modifier class last
    const classes = [...el.classList];
    const modifier = classes.find((c) => c.includes('--'));
    if (modifier) return `.${modifier}`;
    return `.${classes[0]}`;
  }
  if (el.id) return `#${el.id}`;
  return el.tagName.toLowerCase();
}
