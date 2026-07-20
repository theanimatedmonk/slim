const OVERRIDE_STYLE_ID = 'slimvg-token-inspect-overrides';

/** @type {Map<string, { selector: string, property: string, value: string }>} */
const propertyOverrides = new Map();

/** @type {Map<string, string>} */
const tokenOverrides = new Map();

function propertyKey(selector, property) {
  return `${selector}\0${property}`;
}

function ensureOverrideSheet() {
  let el = document.getElementById(OVERRIDE_STYLE_ID);
  if (!el) {
    el = document.createElement('style');
    el.id = OVERRIDE_STYLE_ID;
    document.documentElement.appendChild(el);
  }
  return el;
}

function rebuildPropertySheet() {
  const el = ensureOverrideSheet();
  const rules = [];
  for (const { selector, property, value } of propertyOverrides.values()) {
    // High specificity + !important so preview wins over source rules temporarily
    rules.push(`${selector} { ${property}: ${value} !important; }`);
  }
  el.textContent = rules.join('\n');
}

/**
 * Temporarily reassign a CSS property on a selector (e.g. background → different semantic).
 */
export function previewPropertyOverride(selector, property, cssValue) {
  propertyOverrides.set(propertyKey(selector, property), {
    selector,
    property,
    value: cssValue,
  });
  rebuildPropertySheet();
}

/**
 * Temporarily reassign a custom property on :root (e.g. semantic → different primitive).
 * Also updates the in-memory registry so trees refresh.
 * @param {string} tokenName
 * @param {string} cssValue e.g. `var(--primitive-brand-800)`
 * @param {Map<string, { value: string, file: string, layer: string }>} registry
 */
export function previewTokenOverride(tokenName, cssValue, registry) {
  document.documentElement.style.setProperty(tokenName, cssValue);
  tokenOverrides.set(tokenName, cssValue);
  const existing = registry.get(tokenName);
  registry.set(tokenName, {
    value: cssValue,
    file: existing?.file ?? 'preview',
    layer: existing?.layer ?? 'semantic',
  });
}

export function getPropertyOverride(selector, property) {
  return propertyOverrides.get(propertyKey(selector, property))?.value ?? null;
}

export function getTokenOverride(tokenName) {
  return tokenOverrides.get(tokenName) ?? null;
}

export function hasOverrides() {
  return propertyOverrides.size > 0 || tokenOverrides.size > 0;
}

export function clearOverrides(registry) {
  for (const name of tokenOverrides.keys()) {
    document.documentElement.style.removeProperty(name);
    // Registry values stay dirty until reload — acceptable for session preview
    void registry;
  }
  tokenOverrides.clear();
  propertyOverrides.clear();
  const el = document.getElementById(OVERRIDE_STYLE_ID);
  if (el) el.textContent = '';
}

export function overrideCount() {
  return propertyOverrides.size + tokenOverrides.size;
}
