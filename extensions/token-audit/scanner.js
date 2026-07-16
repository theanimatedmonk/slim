import {
  auditValue,
  buildColorPalette,
  createTokenRegistry,
  normalizeColor,
  shouldSkipFile,
} from './lib/index.mjs';

const COLOR_PROPERTIES = new Set([
  'color',
  'background-color',
  'border-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'outline-color',
  'fill',
  'stroke',
  'caret-color',
  'column-rule-color',
]);

/**
 * @param {CSSStyleSheet} styleSheet
 * @returns {Generator<CSSStyleRule>}
 */
function* walkRules(styleSheet, seen = new Set()) {
  if (!styleSheet || seen.has(styleSheet)) return;
  seen.add(styleSheet);

  /** @type {CSSRuleList | undefined} */
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
      continue;
    }

    if (rule.type === CSSRule.IMPORT_RULE) {
      const imported = /** @type {CSSImportRule} */ (rule).styleSheet;
      if (imported) yield* walkRules(imported, seen);
      continue;
    }

    if ('cssRules' in rule && rule.cssRules) {
      yield* walkRules(/** @type {CSSStyleSheet} */ (rule), seen);
    }
  }
}

function fileNameFromHref(href) {
  if (!href) return 'inline';
  try {
    const url = new URL(href);
    return decodeURIComponent(url.pathname.split('/').pop() || href);
  } catch {
    return href.split('/').pop() || href;
  }
}

function elementDescriptor(el) {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const classes = el.classList.length ? `.${[...el.classList].join('.')}` : '';
  return `${tag}${id}${classes}`;
}

function matchElements(selector) {
  if (!selector || selector.includes(':') || selector.includes('@')) return [];
  try {
    return [...document.querySelectorAll(selector)];
  } catch {
    return [];
  }
}

async function fetchDevTokenCss(path) {
  try {
    const res = await fetch(new URL(path, window.location.origin));
    if (res.ok) return await res.text();
  } catch {
    // dev server may not expose raw CSS
  }
  return '';
}

async function loadTokenRegistryFromPage() {
  let primitivesCss = '';
  let semanticCss = '';

  for (const sheet of document.styleSheets) {
    let href = '';
    try {
      href = sheet.href ?? '';
    } catch {
      continue;
    }

    const name = fileNameFromHref(href);
    if (name !== 'primitives.css' && name !== 'semantic.css') continue;

    try {
      const text = [...walkRules(sheet)]
        .map((rule) => rule.cssText)
        .join('\n');
      if (name === 'primitives.css') primitivesCss += text;
      if (name === 'semantic.css') semanticCss += text;
    } catch {
      // fall through to fetch
    }

    if ((name === 'primitives.css' && !primitivesCss) || (name === 'semantic.css' && !semanticCss)) {
      // Vite may inline; try reading rule parent cssText from owner node — skip if unavailable
    }
  }

  if (!primitivesCss || !semanticCss) {
    for (const sheet of document.styleSheets) {
      let cssText = '';
      try {
        cssText = [...walkRules(sheet)].map((r) => r.cssText).join('\n');
      } catch {
        continue;
      }
      if (!primitivesCss && cssText.includes('--primitive-brand-50')) primitivesCss = cssText;
      if (!semanticCss && cssText.includes('--space-page-x')) semanticCss = cssText;
    }
  }

  if (!primitivesCss) {
    primitivesCss = await fetchDevTokenCss('/src/styles/tokens/primitives.css');
  }
  if (!semanticCss) {
    semanticCss = await fetchDevTokenCss('/src/styles/tokens/semantic.css');
  }

  return createTokenRegistry(primitivesCss, semanticCss);
}

/**
 * @returns {Promise<Array<{
 *   id: string,
 *   severity: string,
 *   rule: string,
 *   file: string,
 *   property?: string,
 *   value: string,
 *   message: string,
 *   selector?: string,
 *   trace?: string[],
 *   elements: Element[],
 * }>>}
 */
export async function scanPage() {
  const tokenRegistry = await loadTokenRegistryFromPage();
  const colorPalette = buildColorPalette(tokenRegistry);
  /** @type {Array<any>} */
  const findings = [];
  let findingId = 0;

  function pushFinding(base, elements) {
    const uniqueElements = [...new Set(elements.filter(Boolean))];
    if (uniqueElements.length === 0) return;
    findings.push({
      id: `f-${findingId++}`,
      ...base,
      elements: uniqueElements,
    });
  }

  for (const sheet of document.styleSheets) {
    let href = '';
    try {
      href = sheet.href ?? 'inline';
    } catch {
      continue;
    }

    const file = fileNameFromHref(href);
    if (shouldSkipFile(file)) continue;

    for (const rule of walkRules(sheet)) {
      const selector = rule.selectorText;
      const elements = matchElements(selector);
      if (elements.length === 0) continue;

      const style = rule.style;
      for (let i = 0; i < style.length; i++) {
        const property = style[i];
        const value = style.getPropertyValue(property);
        const ruleFindings = auditValue({
          file,
          property,
          value,
          context: 'declaration',
          tokenRegistry,
          showTrace: true,
          selector,
        });

        for (const finding of ruleFindings) {
          pushFinding(finding, elements);
        }
      }
    }
  }

  const allElements = document.querySelectorAll('[style]');
  for (const el of allElements) {
    const style = el.style;
    for (let i = 0; i < style.length; i++) {
      const property = style[i];
      const value = style.getPropertyValue(property);
      const ruleFindings = auditValue({
        file: 'inline',
        property,
        value,
        context: 'declaration',
        tokenRegistry,
        showTrace: true,
        selector: elementDescriptor(el),
      });
      for (const finding of ruleFindings) {
        pushFinding(finding, [el]);
      }
    }
  }

  if (colorPalette.size > 0) {
    const checked = new WeakSet();
    for (const el of document.querySelectorAll('body *')) {
      if (checked.has(el)) continue;
      checked.add(el);
      const computed = getComputedStyle(el);
      for (const property of COLOR_PROPERTIES) {
        const value = computed.getPropertyValue(property).trim();
        if (!value || value === 'transparent' || value === 'rgba(0, 0, 0, 0)') continue;
        const normalized = normalizeColor(value);
        if (!normalized.startsWith('#')) continue;
        if (colorPalette.has(normalized)) continue;

        pushFinding(
          {
            severity: 'error',
            rule: 'unknown-color',
            file: 'computed',
            property,
            value,
            message: `Color ${value} is not in the design token palette — may be a naked or off-system value.`,
            selector: elementDescriptor(el),
          },
          [el]
        );
      }
    }
  }

  return findings;
}

export function summarize(findings) {
  const errors = findings.filter((f) => f.severity === 'error').length;
  const warnings = findings.filter((f) => f.severity === 'warn').length;
  return { errors, warnings, total: findings.length };
}
