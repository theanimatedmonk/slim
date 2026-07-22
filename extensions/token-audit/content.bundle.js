(() => {
  // extensions/token-audit/lib/constants.mjs
  var SEMANTIC_PREFIXES = [
    "--color-",
    "--space-",
    "--font-",
    "--radius-",
    "--shadow-",
    "--duration-",
    "--ease-",
    "--layout-",
    "--icon-",
    "--line-height-",
    "--letter-spacing-"
  ];

  // extensions/token-audit/lib/registry.mjs
  function stripComments(css) {
    return css.replace(/\/\*[\s\S]*?\*\//g, "");
  }
  function parseCustomProperties(css, layer, file = "") {
    const registry = /* @__PURE__ */ new Map();
    const cleaned = stripComments(css);
    const re = /(--[a-zA-Z0-9_-]+)\s*:\s*([^;]+);/g;
    let match;
    while ((match = re.exec(cleaned)) !== null) {
      registry.set(match[1], {
        value: match[2].trim(),
        file,
        layer
      });
    }
    return registry;
  }
  function createTokenRegistry(primitivesCss, semanticCss) {
    const registry = /* @__PURE__ */ new Map();
    for (const [key, entry] of parseCustomProperties(primitivesCss, "primitive", "primitives.css")) {
      registry.set(key, entry);
    }
    for (const [key, entry] of parseCustomProperties(semanticCss, "semantic", "semantic.css")) {
      registry.set(key, entry);
    }
    return registry;
  }
  function extractVarRefs(value) {
    const refs = [];
    const re = /var\(\s*(--[a-zA-Z0-9_-]+)/g;
    let match;
    while ((match = re.exec(value)) !== null) {
      refs.push(match[1]);
    }
    return refs;
  }
  function classifyToken(name, tokenRegistry2) {
    const entry = tokenRegistry2.get(name);
    if (entry) return entry.layer;
    if (name.startsWith("--primitive-")) return "primitive";
    if (SEMANTIC_PREFIXES.some((prefix) => name.startsWith(prefix))) return "semantic";
    return "component";
  }
  function resolveTokenTree(name, tokenRegistry2, seen = /* @__PURE__ */ new Set()) {
    if (seen.has(name)) {
      return {
        name,
        layer: "unknown",
        value: "(cycle)",
        children: [],
        terminal: true
      };
    }
    seen.add(name);
    const entry = tokenRegistry2.get(name);
    const layer = entry?.layer ?? classifyToken(name, tokenRegistry2);
    const value = entry?.value ?? "";
    if (!entry) {
      return {
        name,
        layer,
        value: "(unknown)",
        children: [],
        terminal: true
      };
    }
    const refs = extractVarRefs(value);
    if (refs.length === 0) {
      return {
        name,
        layer,
        value,
        file: entry.file,
        children: [],
        terminal: true
      };
    }
    return {
      name,
      layer,
      value,
      file: entry.file,
      children: refs.map((ref) => resolveTokenTree(ref, tokenRegistry2, new Set(seen))),
      terminal: false
    };
  }
  function resolveValueTrees(cssValue, tokenRegistry2) {
    const refs = extractVarRefs(cssValue);
    return refs.map((ref) => resolveTokenTree(ref, tokenRegistry2));
  }
  function terminalValue(node) {
    if (!node) return "";
    if (node.terminal || !node.children?.length) return node.value;
    return terminalValue(node.children[0]);
  }
  function normalizeColor(color) {
    const trimmed = color.trim().toLowerCase();
    if (trimmed.startsWith("#")) return trimmed;
    const rgbMatch = trimmed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (rgbMatch) {
      const [r, g, b] = rgbMatch.slice(1, 4).map((n) => Number(n));
      return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
    }
    return trimmed;
  }

  // extensions/token-audit/tokens.js
  async function loadTokenRegistry() {
    let primitivesCss = "";
    let semanticCss = "";
    primitivesCss = await fetchCss("/src/styles/tokens/primitives.css");
    semanticCss = await fetchCss("/src/styles/tokens/semantic.css");
    const registry = createTokenRegistry(primitivesCss, semanticCss);
    for (const sheet of document.styleSheets) {
      let href = "";
      try {
        href = sheet.href ?? "inline";
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
    }
    return "";
  }
  function fileNameFromHref(href) {
    if (!href || href === "inline") return "inline";
    try {
      return decodeURIComponent(new URL(href).pathname.split("/").pop() || href);
    } catch {
      return href.split("/").pop() || href;
    }
  }
  function harvestCustomProps(styleSheet, registry, file, seen = /* @__PURE__ */ new Set()) {
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
        const style = (
          /** @type {CSSStyleRule} */
          rule.style
        );
        for (let j = 0; j < style.length; j++) {
          const prop = style[j];
          if (!prop.startsWith("--")) continue;
          if (registry.has(prop)) continue;
          const value = style.getPropertyValue(prop).trim();
          registry.set(prop, {
            value,
            file,
            layer: classifyToken(prop, registry)
          });
        }
      } else if (rule.type === CSSRule.IMPORT_RULE) {
        const imported = (
          /** @type {CSSImportRule} */
          rule.styleSheet
        );
        if (imported) harvestCustomProps(imported, registry, fileNameFromHref(imported.href), seen);
      } else if ("cssRules" in rule && rule.cssRules) {
        harvestCustomProps(
          /** @type {CSSStyleSheet} */
          rule,
          registry,
          file,
          seen
        );
      }
    }
  }

  // extensions/token-audit/collect-styles.js
  function collectMatchedStyles(el, tokenRegistry2) {
    const groups = [];
    for (const sheet of document.styleSheets) {
      let href = "";
      try {
        href = sheet.href ?? "";
      } catch {
        continue;
      }
      const viteId = viteDevIdFromSheet(sheet);
      const sourcePath = sourcePathFromHref(href) || sourcePathFromViteId(viteId);
      const file = fileNameFromHref2(href) || fileNameFromPath(sourcePath) || (viteId ? fileNameFromPath(viteId) : "inline");
      for (const rule of walkStyleRules(sheet)) {
        const selector = rule.selectorText;
        if (!selector || !matchesElement(el, selector)) continue;
        const declarations = getRuleDeclarations(rule);
        const properties = [];
        for (const { property, value } of declarations) {
          if (!value) continue;
          const trees = resolveValueTrees(value, tokenRegistry2);
          const computed = getComputedStyle(el).getPropertyValue(property).trim();
          const swatch = colorSwatchFor(property, trees, computed, value);
          properties.push({
            property,
            value,
            trees,
            computed,
            swatch,
            hasTokens: trees.length > 0
          });
        }
        if (properties.length === 0) continue;
        properties.sort((a, b) => Number(b.hasTokens) - Number(a.hasTokens));
        groups.push({ selector, file, sourcePath, properties });
      }
    }
    if (el instanceof HTMLElement && el.style.length > 0) {
      const properties = [];
      for (let i = 0; i < el.style.length; i++) {
        const property = el.style[i];
        const value = el.style.getPropertyValue(property).trim();
        const trees = resolveValueTrees(value, tokenRegistry2);
        const computed = getComputedStyle(el).getPropertyValue(property).trim();
        properties.push({
          property,
          value,
          trees,
          computed,
          swatch: colorSwatchFor(property, trees, computed, value),
          hasTokens: trees.length > 0
        });
      }
      if (properties.length) {
        groups.unshift({ selector: "element.style", file: "inline", properties });
      }
    }
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
        if (g.selector === "element.style") s += 100;
        s += (g.selector.match(/\./g) || []).length;
        return -s;
      };
      return score(a) - score(b);
    });
  }
  function getRuleDeclarations(rule) {
    const fromText = parseDeclarationsFromCssText(rule.cssText);
    if (fromText.length > 0) return fromText;
    const style = rule.style;
    const decls = [];
    const seen = /* @__PURE__ */ new Set();
    for (let i = 0; i < style.length; i++) {
      const property = style[i];
      const value = style.getPropertyValue(property).trim();
      if (!value || seen.has(property)) continue;
      seen.add(property);
      decls.push({ property, value });
    }
    for (const shorthand of SHORTHAND_PROPS) {
      if (seen.has(shorthand)) continue;
      const value = style.getPropertyValue(shorthand).trim();
      if (!value) continue;
      seen.add(shorthand);
      decls.push({ property: shorthand, value });
    }
    return decls;
  }
  var SHORTHAND_PROPS = [
    "border",
    "border-top",
    "border-right",
    "border-bottom",
    "border-left",
    "border-width",
    "border-style",
    "border-color",
    "background",
    "margin",
    "padding",
    "font",
    "outline",
    "inset",
    "gap",
    "flex",
    "grid",
    "transition",
    "animation",
    "box-shadow"
  ];
  function parseDeclarationsFromCssText(cssText) {
    if (!cssText) return [];
    const start = cssText.indexOf("{");
    const end = cssText.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return [];
    const body = cssText.slice(start + 1, end).trim();
    if (!body) return [];
    const decls = [];
    let i = 0;
    while (i < body.length) {
      while (i < body.length && /\s/.test(body[i])) i++;
      if (i >= body.length) break;
      const colon = body.indexOf(":", i);
      if (colon === -1) break;
      const property = body.slice(i, colon).trim();
      if (!property || property.startsWith("/*")) {
        const commentEnd = body.indexOf("*/", i);
        i = commentEnd === -1 ? body.length : commentEnd + 2;
        continue;
      }
      i = colon + 1;
      let value = "";
      let depth = 0;
      while (i < body.length) {
        const ch = body[i];
        if (ch === "(") depth++;
        else if (ch === ")") depth = Math.max(0, depth - 1);
        else if (ch === ";" && depth === 0) {
          i++;
          break;
        }
        value += ch;
        i++;
      }
      const trimmedProp = property.replace(/\/\*[\s\S]*?\*\//g, "").trim();
      const trimmedValue = value.replace(/\/\*[\s\S]*?\*\//g, "").trim();
      if (trimmedProp && trimmedValue) {
        decls.push({ property: trimmedProp, value: trimmedValue });
      }
    }
    return decls;
  }
  function matchesElement(el, selectorText) {
    const parts = selectorText.split(",").map((s) => s.trim());
    for (let part of parts) {
      part = part.replace(/::?(before|after|placeholder|marker|selection|first-line|first-letter)\b.*/g, "");
      part = part.replace(/:(hover|focus|active|disabled|visited|focus-visible|focus-within)(?![-\w])/g, "");
      part = part.trim();
      if (!part) continue;
      try {
        if (el.matches(part)) return true;
      } catch {
      }
    }
    return false;
  }
  function* walkStyleRules(styleSheet, seen = /* @__PURE__ */ new Set()) {
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
        yield (
          /** @type {CSSStyleRule} */
          rule
        );
      } else if (rule.type === CSSRule.IMPORT_RULE) {
        const imported = (
          /** @type {CSSImportRule} */
          rule.styleSheet
        );
        if (imported) yield* walkStyleRules(imported, seen);
      } else if ("cssRules" in rule && rule.cssRules) {
        yield* walkStyleRules(
          /** @type {CSSStyleSheet} */
          rule,
          seen
        );
      }
    }
  }
  function fileNameFromHref2(href) {
    if (!href || href === "inline") return "inline";
    try {
      return decodeURIComponent(new URL(href).pathname.split("/").pop() || href);
    } catch {
      return href.split("/").pop() || href;
    }
  }
  function sourcePathFromHref(href) {
    if (!href || href === "inline") return "";
    try {
      const pathname = new URL(href).pathname;
      const idx = pathname.indexOf("/src/");
      if (idx !== -1) return decodeURIComponent(pathname.slice(idx + 1));
      return decodeURIComponent(pathname.replace(/^\//, ""));
    } catch {
      return "";
    }
  }
  function viteDevIdFromSheet(sheet) {
    try {
      const node = sheet.ownerNode;
      if (!(node instanceof HTMLElement)) return "";
      return node.getAttribute("data-vite-dev-id") || node.dataset?.viteDevId || "";
    } catch {
      return "";
    }
  }
  function sourcePathFromViteId(viteId) {
    if (!viteId) return "";
    const cleaned = viteId.split("?")[0].replace(/\\/g, "/");
    const marker = "/src/";
    const idx = cleaned.lastIndexOf(marker);
    if (idx !== -1) return cleaned.slice(idx + 1);
    if (cleaned.endsWith(".css")) {
      const parts = cleaned.split("/");
      const file = parts[parts.length - 1];
      return file;
    }
    return "";
  }
  function fileNameFromPath(path) {
    if (!path) return "";
    const clean = path.split("?")[0];
    const parts = clean.split("/");
    return parts[parts.length - 1] || "";
  }
  function colorSwatchFor(property, trees, computed, declared) {
    const isColorProp = /color|background|fill|stroke|border|outline|shadow/i.test(property) || property === "background";
    if (!isColorProp) return null;
    let raw = "";
    if (trees.length) {
      raw = terminalValue(trees[0]);
    }
    if (!raw || raw.startsWith("var(") || extractVarRefs(raw).length) {
      raw = computed || declared;
    }
    const hex = normalizeColor(raw);
    if (hex.startsWith("#") || /^rgba?\(/i.test(raw) || raw === "transparent") {
      return raw.startsWith("#") || raw.startsWith("rgb") || raw === "transparent" ? raw : hex;
    }
    return null;
  }
  function elementLabel(el) {
    if (el.classList?.length) {
      const classes = [...el.classList];
      const modifier = classes.find((c) => c.includes("--"));
      if (modifier) return `.${modifier}`;
      return `.${classes[0]}`;
    }
    if (el.id) return `#${el.id}`;
    return el.tagName.toLowerCase();
  }

  // extensions/token-audit/overrides.js
  var OVERRIDE_STYLE_ID = "slimvg-token-inspect-overrides";
  var propertyOverrides = /* @__PURE__ */ new Map();
  var tokenOverrides = /* @__PURE__ */ new Map();
  var pendingEdits = /* @__PURE__ */ new Map();
  function propertyKey(selector, property) {
    return `${selector}\0${property}`;
  }
  function editKey(edit) {
    if (edit.kind === "property") {
      return `property\0${edit.file || edit.sourcePath || ""}\0${edit.selector || ""}\0${edit.property}`;
    }
    return `token\0${edit.file || ""}\0${edit.tokenName}`;
  }
  function ensureOverrideSheet() {
    let el = document.getElementById(OVERRIDE_STYLE_ID);
    if (!el) {
      el = document.createElement("style");
      el.id = OVERRIDE_STYLE_ID;
      document.documentElement.appendChild(el);
    }
    return el;
  }
  function rebuildPropertySheet() {
    const el = ensureOverrideSheet();
    const rules = [];
    for (const { selector, property, value } of propertyOverrides.values()) {
      rules.push(`${selector} { ${property}: ${value} !important; }`);
    }
    el.textContent = rules.join("\n");
  }
  function rememberEdit(partial) {
    const key = editKey(partial);
    const existing = pendingEdits.get(key);
    const from = existing ? existing.from : partial.from;
    const to = partial.to;
    if (from === to) {
      pendingEdits.delete(key);
      return;
    }
    pendingEdits.set(key, {
      ...partial,
      id: existing?.id || key,
      from,
      to
    });
  }
  function previewPropertyOverride(input) {
    const { selector, property, from, to, file = "", sourcePath = "" } = input;
    propertyOverrides.set(propertyKey(selector, property), {
      selector,
      property,
      value: to
    });
    rebuildPropertySheet();
    rememberEdit({
      kind: "property",
      file,
      sourcePath,
      selector,
      property,
      from,
      to
    });
  }
  function previewTokenOverride(input) {
    const { tokenName, from, to, file = "", registry } = input;
    document.documentElement.style.setProperty(tokenName, to);
    tokenOverrides.set(tokenName, to);
    const existing = registry.get(tokenName);
    registry.set(tokenName, {
      value: to,
      file: existing?.file ?? file ?? "preview",
      layer: existing?.layer ?? "semantic"
    });
    rememberEdit({
      kind: "token",
      file: file || existing?.file || "",
      tokenName,
      from,
      to
    });
  }
  function getPropertyOverride(selector, property) {
    return propertyOverrides.get(propertyKey(selector, property))?.value ?? null;
  }
  function clearOverrides(registry) {
    for (const name of tokenOverrides.keys()) {
      document.documentElement.style.removeProperty(name);
      void registry;
    }
    tokenOverrides.clear();
    propertyOverrides.clear();
    pendingEdits.clear();
    const el = document.getElementById(OVERRIDE_STYLE_ID);
    if (el) el.textContent = "";
  }
  function overrideCount() {
    return pendingEdits.size;
  }
  function listPendingEdits() {
    return [...pendingEdits.values()];
  }
  function normalizeTokenFile(file) {
    if (!file) return "";
    if (file === "semantic.css" || file.endsWith("/semantic.css")) {
      return "apps/frontend/src/styles/tokens/semantic.css";
    }
    if (file === "primitives.css" || file.endsWith("/primitives.css")) {
      return "apps/frontend/src/styles/tokens/primitives.css";
    }
    if (file.startsWith("apps/frontend/")) return file;
    if (file.startsWith("src/")) return `apps/frontend/${file}`;
    return file;
  }

  // extensions/token-audit/property-options.js
  var KEYWORD_OPTIONS = {
    display: [
      "none",
      "block",
      "inline",
      "inline-block",
      "flex",
      "inline-flex",
      "grid",
      "inline-grid",
      "contents",
      "flow-root",
      "list-item"
    ],
    "flex-direction": ["row", "row-reverse", "column", "column-reverse"],
    "flex-wrap": ["nowrap", "wrap", "wrap-reverse"],
    "align-items": ["stretch", "flex-start", "flex-end", "center", "baseline", "start", "end", "normal"],
    "align-self": ["auto", "stretch", "flex-start", "flex-end", "center", "baseline", "start", "end"],
    "align-content": [
      "stretch",
      "flex-start",
      "flex-end",
      "center",
      "space-between",
      "space-around",
      "space-evenly",
      "start",
      "end",
      "normal"
    ],
    "justify-content": [
      "flex-start",
      "flex-end",
      "center",
      "space-between",
      "space-around",
      "space-evenly",
      "start",
      "end",
      "left",
      "right",
      "normal"
    ],
    "justify-items": ["stretch", "start", "end", "center", "left", "right", "normal"],
    "justify-self": ["auto", "stretch", "start", "end", "center", "left", "right"],
    position: ["static", "relative", "absolute", "fixed", "sticky"],
    overflow: ["visible", "hidden", "clip", "scroll", "auto"],
    "overflow-x": ["visible", "hidden", "clip", "scroll", "auto"],
    "overflow-y": ["visible", "hidden", "clip", "scroll", "auto"],
    "text-align": ["start", "end", "left", "right", "center", "justify"],
    "white-space": ["normal", "nowrap", "pre", "pre-wrap", "pre-line", "break-spaces"],
    "pointer-events": ["auto", "none"],
    cursor: [
      "auto",
      "default",
      "pointer",
      "not-allowed",
      "grab",
      "grabbing",
      "text",
      "move",
      "crosshair",
      "help"
    ],
    "box-sizing": ["border-box", "content-box"],
    visibility: ["visible", "hidden", "collapse"],
    "object-fit": ["fill", "contain", "cover", "none", "scale-down"],
    "object-position": ["center", "top", "bottom", "left", "right"],
    "flex-shrink": ["0", "1"],
    "flex-grow": ["0", "1"],
    float: ["none", "left", "right"],
    clear: ["none", "left", "right", "both"],
    "user-select": ["auto", "none", "text", "all"],
    "text-decoration": ["none", "underline", "line-through", "overline"],
    "font-style": ["normal", "italic", "oblique"],
    "font-weight": ["100", "200", "300", "400", "500", "600", "700", "800", "900", "normal", "bold"],
    "border-style": ["none", "solid", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset"]
  };
  var SIZE_SUGGESTIONS = [
    "auto",
    "0",
    "100%",
    "90%",
    "80%",
    "75%",
    "50%",
    "33%",
    "25%",
    "fit-content",
    "max-content",
    "min-content",
    "100vw",
    "100vh",
    "1rem",
    "1.5rem",
    "2rem",
    "2.5rem",
    "3rem",
    "4rem",
    "8px",
    "16px",
    "24px",
    "32px"
  ];
  var SIZE_PROPERTIES = /* @__PURE__ */ new Set([
    "width",
    "height",
    "min-width",
    "max-width",
    "min-height",
    "max-height",
    "flex-basis",
    "gap",
    "row-gap",
    "column-gap",
    "top",
    "right",
    "bottom",
    "left",
    "inset",
    "margin",
    "margin-top",
    "margin-right",
    "margin-bottom",
    "margin-left",
    "padding",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    "border-radius",
    "border-width",
    "font-size",
    "line-height",
    "outline-offset"
  ]);
  var GRID_TRACK_SUGGESTIONS = [
    "1fr",
    "1fr 1fr",
    "1fr 2fr",
    "2fr 1fr",
    "1fr 1fr 1fr",
    "2fr 3fr 1fr",
    "2fr 4fr 1fr",
    "1fr 3fr 1fr",
    "auto 1fr",
    "auto 1fr auto",
    "max-content 1fr",
    "minmax(0, 1fr)",
    "minmax(0, 1fr) minmax(0, 2fr)",
    "repeat(2, 1fr)",
    "repeat(3, 1fr)",
    "repeat(4, minmax(0, 1fr))"
  ];
  var GRID_TEMPLATE_PROPERTIES = /* @__PURE__ */ new Set([
    "grid-template-columns",
    "grid-template-rows",
    "grid-auto-columns",
    "grid-auto-rows",
    "grid-template"
  ]);
  function prefersFullValueEdit(property) {
    return GRID_TEMPLATE_PROPERTIES.has(property.toLowerCase());
  }
  function getPropertyValueEditor(property) {
    const prop = property.toLowerCase();
    if (GRID_TEMPLATE_PROPERTIES.has(prop)) {
      return { mode: "grid", options: GRID_TRACK_SUGGESTIONS };
    }
    if (KEYWORD_OPTIONS[prop]) {
      return { mode: "keywords", options: KEYWORD_OPTIONS[prop] };
    }
    if (SIZE_PROPERTIES.has(prop)) {
      return { mode: "size", options: SIZE_SUGGESTIONS };
    }
    if (prop === "color" || prop === "background" || prop === "background-color" || prop.endsWith("-color") || prop === "fill" || prop === "stroke" || prop === "border" || prop.startsWith("border-") && prop.includes("color")) {
      return { mode: "color", options: ["transparent", "currentColor", "#000000", "#ffffff"] };
    }
    if (prop === "opacity" || prop === "z-index" || prop === "order" || prop === "flex" || prop === "transform" || prop === "transition" || prop === "box-shadow" || prop === "border" || prop.startsWith("border-")) {
      return { mode: "freeform", options: [] };
    }
    return { mode: "freeform", options: [] };
  }
  function detectRawValueKind(value) {
    const v = value.trim();
    if (/^#([0-9a-f]{3,8})$/i.test(v) || /^rgba?\(/i.test(v) || /^hsla?\(/i.test(v)) {
      return "color";
    }
    if (/^-?[\d.]+(rem|px|em|%|vh|vw|ch|ex)$/i.test(v) || v === "0") {
      return "length";
    }
    if (/^-?[\d.]+$/.test(v)) {
      return "number";
    }
    return "text";
  }

  // extensions/token-audit/push.js
  var WRITER_BASE = "http://127.0.0.1:7319";
  async function pushEditsToWriter(edits) {
    if (!edits.length) {
      return { ok: false, message: "No pending edits" };
    }
    const payload = {
      edits: edits.map((e) => {
        if (e.kind === "property") {
          return {
            kind: "property",
            file: e.file,
            sourcePath: e.sourcePath,
            selector: e.selector,
            property: e.property,
            from: e.from,
            to: e.to
          };
        }
        return {
          kind: "token",
          file: e.file,
          tokenName: e.tokenName,
          from: e.from,
          to: e.to
        };
      })
    };
    let res;
    try {
      res = await fetch(`${WRITER_BASE}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } catch {
      return {
        ok: false,
        message: "Writer not reachable. Run `npm run token-inspect:writer` in the repo, then try again."
      };
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.ok) {
      const failed = (body.results || []).filter((r) => !r.ok);
      const detail = failed.map((f) => f.error).filter(Boolean).join("; ");
      return {
        ok: false,
        message: body.message || `Push failed (${res.status})`,
        detail,
        body
      };
    }
    return {
      ok: true,
      message: body.message || "Pushed",
      written: body.written || [],
      body
    };
  }

  // extensions/token-audit/token-options.js
  function tokenKind(name) {
    const n = name.toLowerCase();
    if (n.includes("color") || n.includes("brand") || n.includes("success") || n.includes("warning") || n.includes("error") || n.includes("-white") || n.endsWith("white") || n.includes("-black") || n.includes("bg-") || n.includes("text-") || n.includes("border-") || n.includes("fill") || n.includes("stroke")) {
      return "color";
    }
    if (n.includes("space") || n.includes("gap") || n.includes("inset") || n.includes("page-")) {
      return "space";
    }
    if (n.includes("radius")) return "radius";
    if (n.includes("font-size") || n.includes("line-height")) return "font-size";
    if (n.includes("font-weight") || n.includes("font-family") || n.includes("letter-spacing")) {
      return "font";
    }
    if (n.includes("shadow")) return "shadow";
    if (n.includes("duration") || n.includes("ease")) return "motion";
    if (n.includes("z-") || n.includes("z-index")) return "z";
    if (n.includes("icon")) return "icon";
    return "other";
  }
  function listTokensByLayerAndKind(registry, layer, kind) {
    const options = [];
    for (const [name, entry] of registry.entries()) {
      if (entry.layer !== layer) continue;
      if (tokenKind(name) !== kind) continue;
      const tree = resolveTokenTree(name, registry);
      const terminal = terminalValue(tree);
      let swatch = null;
      if (kind === "color") {
        const normalized = normalizeColor(terminal);
        if (normalized.startsWith("#") || /^rgba?\(/i.test(terminal) || terminal === "transparent") {
          swatch = terminal.startsWith("#") || terminal.startsWith("rgb") || terminal === "transparent" ? terminal : normalized;
        }
      }
      options.push({
        name,
        value: entry.value,
        swatch,
        label: kind === "color" && terminal ? `${name} \xB7 ${terminal}` : name
      });
    }
    options.sort((a, b) => a.name.localeCompare(b.name));
    return options;
  }
  function editableTargetForNode(node) {
    if (!node?.children?.length) return null;
    const child = node.children[0];
    if (node.layer === "semantic") {
      if (child?.layer === "primitive" || child?.name?.startsWith("--primitive-")) {
        return {
          mode: "token",
          tokenName: node.name,
          currentRef: child.name,
          optionLayer: "primitive",
          kind: tokenKind(node.name)
        };
      }
      if (child?.layer === "semantic") {
        return {
          mode: "token",
          tokenName: node.name,
          currentRef: child.name,
          optionLayer: "semantic",
          kind: tokenKind(node.name)
        };
      }
    }
    if (node.layer === "component") {
      if (child?.layer === "semantic") {
        return {
          mode: "token",
          tokenName: node.name,
          currentRef: child.name,
          optionLayer: "semantic",
          kind: tokenKind(child.name)
        };
      }
      if (child?.layer === "primitive") {
        return {
          mode: "token",
          tokenName: node.name,
          currentRef: child.name,
          optionLayer: "primitive",
          kind: tokenKind(child.name)
        };
      }
    }
    return null;
  }
  function editableTargetForProperty(prop) {
    if (!prop?.trees?.length) return null;
    const primary = prop.trees[0];
    if (!primary?.name) return null;
    if (primary.layer === "semantic") {
      return {
        mode: "property",
        currentRef: primary.name,
        optionLayer: "semantic",
        kind: tokenKind(primary.name)
      };
    }
    if (primary.layer === "primitive") {
      return {
        mode: "property",
        currentRef: primary.name,
        optionLayer: "primitive",
        kind: tokenKind(primary.name)
      };
    }
    if (primary.layer === "component") {
      const child = primary.children?.[0];
      if (child?.layer === "semantic") {
        return {
          mode: "property",
          currentRef: primary.name,
          optionLayer: "semantic",
          kind: tokenKind(child.name)
        };
      }
    }
    return null;
  }

  // extensions/token-audit/panel.js
  var ROOT_ID = "slimvg-token-inspect-root";
  var STYLE_ID = "slimvg-token-inspect-style";
  var ui = null;
  var panelContext = null;
  var outsideCloseArmed = false;
  function clearInspectorUi() {
    disarmOutsideClose();
    document.getElementById(ROOT_ID)?.remove();
    document.getElementById(STYLE_ID)?.remove();
    ui = null;
    panelContext = null;
  }
  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
    #${ROOT_ID} {
      all: initial;
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 2147483646;
      font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
    }
    #${ROOT_ID} * {
      box-sizing: border-box;
    }
    #${ROOT_ID} .ti-box {
      position: fixed;
      pointer-events: none;
      border: 2px solid #2563eb;
      border-radius: 2px;
      background: rgba(37, 99, 235, 0.08);
    }
    #${ROOT_ID} .ti-box.select {
      border-color: #1d4ed8;
      background: rgba(37, 99, 235, 0.12);
      box-shadow: 0 0 0 1px rgba(29, 78, 216, 0.35);
    }
    #${ROOT_ID} .ti-box.hover {
      border-style: dashed;
      opacity: 0.85;
    }
    #${ROOT_ID} .ti-panel {
      position: fixed;
      top: 16px;
      right: 16px;
      width: min(360px, calc(100vw - 32px));
      max-height: calc(100vh - 32px);
      overflow: auto;
      pointer-events: auto;
      background: #fff;
      color: #171717;
      border: 1px solid #e5e5e5;
      border-radius: 14px;
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.16);
      font-size: 13px;
      line-height: 1.4;
      display: none;
    }
    #${ROOT_ID} .ti-panel.open {
      display: block;
    }
    #${ROOT_ID} .ti-header {
      position: sticky;
      top: 0;
      z-index: 2;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 12px 14px;
      background: #fafafa;
      border-bottom: 1px solid #e5e5e5;
    }
    #${ROOT_ID} .ti-selector {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 13px;
      font-weight: 700;
      color: #171717;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    #${ROOT_ID} .ti-close {
      border: none;
      background: transparent;
      color: #737373;
      font-size: 18px;
      line-height: 1;
      cursor: pointer;
      padding: 2px 6px;
      border-radius: 6px;
    }
    #${ROOT_ID} .ti-close:hover {
      background: #f0f0f0;
      color: #171717;
    }
    #${ROOT_ID} .ti-hint {
      padding: 10px 14px;
      font-size: 12px;
      color: #737373;
      border-bottom: 1px solid #f5f5f5;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    #${ROOT_ID} .ti-hint-text {
      flex: 1;
    }
    #${ROOT_ID} .ti-hint-actions {
      display: flex;
      gap: 6px;
      flex-shrink: 0;
    }
    #${ROOT_ID} .ti-reset,
    #${ROOT_ID} .ti-push {
      border: 1px solid #e5e5e5;
      background: #fff;
      border-radius: 6px;
      padding: 4px 8px;
      font-size: 11px;
      cursor: pointer;
      color: #525252;
      white-space: nowrap;
    }
    #${ROOT_ID} .ti-reset:hover,
    #${ROOT_ID} .ti-push:hover {
      background: #f5f5f5;
    }
    #${ROOT_ID} .ti-push {
      background: #171717;
      border-color: #171717;
      color: #fff;
      font-weight: 600;
    }
    #${ROOT_ID} .ti-push:hover {
      background: #404040;
    }
    #${ROOT_ID} .ti-push:disabled {
      opacity: 0.5;
      cursor: wait;
    }
    #${ROOT_ID} .ti-push-status {
      font-size: 11px;
      color: #525252;
      padding: 0 14px 10px;
    }
    #${ROOT_ID} .ti-push-status.error {
      color: #e11d48;
    }
    #${ROOT_ID} .ti-push-status.ok {
      color: #059669;
    }
    #${ROOT_ID} .ti-group {
      padding: 10px 14px 12px;
      border-bottom: 1px solid #f0f0f0;
    }
    #${ROOT_ID} .ti-group-title {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
      font-weight: 700;
      color: #404040;
      margin-bottom: 8px;
    }
    #${ROOT_ID} .ti-group-file {
      font-size: 10px;
      font-weight: 500;
      color: #a3a3a3;
      margin-left: 6px;
    }
    #${ROOT_ID} .ti-prop {
      margin: 0 0 8px;
    }
    #${ROOT_ID} .ti-prop-row {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 8px;
      align-items: start;
      min-height: 22px;
    }
    #${ROOT_ID} .ti-prop-name {
      color: #737373;
      font-size: 12px;
      padding-top: 2px;
      min-width: 4.5rem;
    }
    #${ROOT_ID} .ti-token-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: none;
      background: transparent;
      padding: 0;
      cursor: pointer;
      font: inherit;
      text-align: left;
      color: #171717;
      max-width: 100%;
    }
    #${ROOT_ID} .ti-token-btn:hover .ti-token-chip {
      background: #f0f0f0;
    }
    #${ROOT_ID} .ti-swatch {
      width: 12px;
      height: 12px;
      border-radius: 3px;
      border: 1px solid rgba(0,0,0,0.15);
      flex-shrink: 0;
    }
    #${ROOT_ID} .ti-token-chip {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px;
      background: #f5f5f5;
      border-radius: 6px;
      padding: 2px 6px;
      color: #262626;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 180px;
    }
    #${ROOT_ID} .ti-chevron {
      color: #a3a3a3;
      font-size: 10px;
      flex-shrink: 0;
      transition: transform 0.15s ease;
    }
    #${ROOT_ID} .ti-token-btn[aria-expanded="true"] .ti-chevron {
      transform: rotate(90deg);
    }
    #${ROOT_ID} .ti-editable {
      border-radius: 6px;
    }
    #${ROOT_ID} .ti-edit {
      border: none;
      background: transparent;
      color: #737373;
      cursor: pointer;
      padding: 0;
      width: 22px;
      height: 22px;
      display: inline-grid;
      place-items: center;
      border-radius: 4px;
      flex-shrink: 0;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.12s ease, color 0.12s ease, background 0.12s ease;
    }
    #${ROOT_ID} .ti-edit svg {
      width: 14px;
      height: 14px;
      display: block;
    }
    #${ROOT_ID} .ti-editable:hover .ti-edit,
    #${ROOT_ID} .ti-editable:focus-within .ti-edit {
      opacity: 1;
      pointer-events: auto;
    }
    #${ROOT_ID} .ti-edit:hover,
    #${ROOT_ID} .ti-edit:focus-visible {
      color: #2563eb;
      background: #eff6ff;
      opacity: 1;
      pointer-events: auto;
    }
    #${ROOT_ID} .ti-literal {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px;
      color: #525252;
      word-break: break-all;
    }
    #${ROOT_ID} .ti-tree {
      display: none;
      margin: 4px 0 8px 0;
      padding-left: 8px;
      border-left: 2px solid #e5e5e5;
    }
    #${ROOT_ID} .ti-tree.open {
      display: block;
    }
    #${ROOT_ID} .ti-tree-node {
      margin: 4px 0 4px 8px;
    }
    #${ROOT_ID} .ti-tree-line {
      display: flex;
      align-items: center;
      gap: 6px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px;
      flex-wrap: wrap;
    }
    #${ROOT_ID} .ti-layer {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      font-weight: 700;
      border-radius: 4px;
      padding: 1px 4px;
      flex-shrink: 0;
    }
    #${ROOT_ID} .ti-layer.semantic { background: #dbeafe; color: #1d4ed8; }
    #${ROOT_ID} .ti-layer.primitive { background: #fef3c7; color: #b45309; }
    #${ROOT_ID} .ti-layer.component { background: #f3e8ff; color: #7e22ce; }
    #${ROOT_ID} .ti-layer.unknown { background: #f5f5f5; color: #737373; }
    #${ROOT_ID} .ti-tree-name {
      color: #262626;
    }
    #${ROOT_ID} .ti-tree-value {
      color: #737373;
    }
    #${ROOT_ID} .ti-dropdown {
      display: none;
      margin-top: 6px;
      width: 100%;
      max-height: 180px;
      overflow: auto;
      border: 1px solid #e5e5e5;
      border-radius: 8px;
      background: #fff;
      box-shadow: 0 8px 24px rgba(0,0,0,0.08);
    }
    #${ROOT_ID} .ti-dropdown.open {
      display: block;
    }
    #${ROOT_ID} .ti-dropdown-search {
      width: 100%;
      border: none;
      border-bottom: 1px solid #f0f0f0;
      padding: 8px 10px;
      font: inherit;
      font-size: 11px;
      outline: none;
    }
    #${ROOT_ID} .ti-dropdown-option {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      border: none;
      background: transparent;
      padding: 7px 10px;
      text-align: left;
      cursor: pointer;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px;
      color: #262626;
    }
    #${ROOT_ID} .ti-dropdown-option:hover,
    #${ROOT_ID} .ti-dropdown-option.active {
      background: #f5f5f5;
    }
    #${ROOT_ID} .ti-dropdown-option.active {
      color: #2563eb;
    }
    #${ROOT_ID} .ti-dropdown-empty {
      padding: 10px;
      font-size: 11px;
      color: #a3a3a3;
    }
    #${ROOT_ID} .ti-preview-badge {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #b45309;
      background: #fef3c7;
      border-radius: 4px;
      padding: 1px 4px;
    }
    #${ROOT_ID} .ti-value-editor {
      display: none;
      margin-top: 6px;
      width: 100%;
      border: 1px solid #e5e5e5;
      border-radius: 8px;
      background: #fff;
      box-shadow: 0 8px 24px rgba(0,0,0,0.08);
      overflow: hidden;
    }
    #${ROOT_ID} .ti-value-editor.open {
      display: block;
    }
    #${ROOT_ID} .ti-value-editor-form {
      display: flex;
      gap: 6px;
      padding: 8px;
      border-bottom: 1px solid #f0f0f0;
      align-items: center;
    }
    #${ROOT_ID} .ti-value-input {
      flex: 1;
      min-width: 0;
      border: 1px solid #e5e5e5;
      border-radius: 6px;
      padding: 6px 8px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px;
      outline: none;
    }
    #${ROOT_ID} .ti-value-input:focus {
      border-color: #2563eb;
    }
    #${ROOT_ID} .ti-color-input {
      width: 28px;
      height: 28px;
      padding: 0;
      border: 1px solid #e5e5e5;
      border-radius: 6px;
      background: transparent;
      cursor: pointer;
    }
    #${ROOT_ID} .ti-apply {
      border: none;
      background: #171717;
      color: #fff;
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 11px;
      cursor: pointer;
      white-space: nowrap;
    }
    #${ROOT_ID} .ti-apply:hover {
      background: #404040;
    }
    #${ROOT_ID} .ti-literal-row {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
  `;
    document.documentElement.appendChild(style);
  }
  function positionBox(box, el) {
    if (!el || !el.isConnected) {
      box.style.display = "none";
      return;
    }
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      box.style.display = "none";
      return;
    }
    box.style.display = "block";
    box.style.top = `${rect.top}px`;
    box.style.left = `${rect.left}px`;
    box.style.width = `${rect.width}px`;
    box.style.height = `${rect.height}px`;
  }
  function ensureInspectorUi() {
    if (ui) return ui;
    ensureStyles();
    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.innerHTML = `
    <div class="ti-box hover" style="display:none"></div>
    <div class="ti-box select" style="display:none"></div>
    <aside class="ti-panel" role="dialog" aria-label="Token inspector">
      <div class="ti-header">
        <div class="ti-selector">Select an element</div>
        <button type="button" class="ti-close" aria-label="Close">\xD7</button>
      </div>
      <div class="ti-hint">
        <span class="ti-hint-text">Hover a value to edit \xB7 Push writes CSS via local writer</span>
      </div>
      <div class="ti-body"></div>
    </aside>
  `;
    document.documentElement.appendChild(root);
    const panel = root.querySelector(".ti-panel");
    panel.querySelector(".ti-close").addEventListener("click", () => {
      ui?.onClose?.();
    });
    ui = {
      hoverBox: root.querySelector(".ti-box.hover"),
      selectBox: root.querySelector(".ti-box.select"),
      panel
    };
    return ui;
  }
  function setHoverTarget(el) {
    const current = ensureInspectorUi();
    positionBox(current.hoverBox, el);
  }
  function setSelectTarget(el) {
    const current = ensureInspectorUi();
    positionBox(current.selectBox, el);
    current.hoverBox.style.display = "none";
  }
  function closeAllEditors(except) {
    const root = document.getElementById(ROOT_ID);
    if (!root) return;
    for (const el of root.querySelectorAll(".ti-dropdown.open, .ti-value-editor.open")) {
      if (el !== except) el.classList.remove("open");
    }
    if (!root.querySelector(".ti-dropdown.open, .ti-value-editor.open")) {
      disarmOutsideClose();
    }
  }
  function onOutsidePointerDown(event) {
    const root = document.getElementById(ROOT_ID);
    if (!root) return;
    const open = root.querySelector(".ti-dropdown.open, .ti-value-editor.open");
    if (!open) {
      disarmOutsideClose();
      return;
    }
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (open.contains(target)) return;
    closeAllEditors();
  }
  function armOutsideClose() {
    if (outsideCloseArmed) return;
    outsideCloseArmed = true;
    window.setTimeout(() => {
      if (!outsideCloseArmed) return;
      document.addEventListener("pointerdown", onOutsidePointerDown, true);
    }, 0);
  }
  function disarmOutsideClose() {
    if (!outsideCloseArmed) return;
    outsideCloseArmed = false;
    document.removeEventListener("pointerdown", onOutsidePointerDown, true);
  }
  function mountDropdown(host, config) {
    closeAllEditors();
    let dropdown = host.querySelector(":scope > .ti-dropdown");
    if (!dropdown) {
      dropdown = document.createElement("div");
      dropdown.className = "ti-dropdown";
      host.appendChild(dropdown);
    }
    dropdown.replaceChildren();
    dropdown.classList.add("open");
    armOutsideClose();
    const search = document.createElement("input");
    search.className = "ti-dropdown-search";
    search.type = "search";
    search.placeholder = "Filter tokens\u2026";
    dropdown.appendChild(search);
    const list = document.createElement("div");
    dropdown.appendChild(list);
    function renderOptions(filter = "") {
      list.replaceChildren();
      const q = filter.trim().toLowerCase();
      const filtered = config.options.filter(
        (opt) => !q || opt.name.toLowerCase().includes(q) || opt.label.toLowerCase().includes(q)
      );
      if (!filtered.length) {
        const empty = document.createElement("div");
        empty.className = "ti-dropdown-empty";
        empty.textContent = "No matching tokens";
        list.appendChild(empty);
        return;
      }
      for (const opt of filtered) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "ti-dropdown-option";
        if (opt.name === config.currentRef) btn.classList.add("active");
        if (opt.swatch) {
          const swatch = document.createElement("span");
          swatch.className = "ti-swatch";
          swatch.style.background = opt.swatch;
          btn.appendChild(swatch);
        }
        btn.appendChild(document.createTextNode(opt.name));
        btn.title = opt.label;
        btn.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          dropdown.classList.remove("open");
          config.onPick(opt.name);
        });
        list.appendChild(btn);
      }
    }
    renderOptions();
    search.addEventListener("input", () => renderOptions(search.value));
    search.addEventListener("click", (e) => e.stopPropagation());
    requestAnimationFrame(() => search.focus());
  }
  function mountValueEditor(host, config) {
    closeAllEditors();
    let editor = host.querySelector(":scope > .ti-value-editor");
    if (!editor) {
      editor = document.createElement("div");
      editor.className = "ti-value-editor";
      host.appendChild(editor);
    }
    editor.replaceChildren();
    editor.classList.add("open");
    armOutsideClose();
    const options = config.options ?? [];
    const allowCustom = config.allowCustom !== false;
    const valueKind = config.valueKind ?? detectRawValueKind(config.currentValue);
    if (allowCustom) {
      const form = document.createElement("form");
      form.className = "ti-value-editor-form";
      const textInput = document.createElement("input");
      textInput.className = "ti-value-input";
      textInput.type = "text";
      textInput.value = config.currentValue;
      textInput.placeholder = config.placeholder ?? "Enter value\u2026";
      if (valueKind === "color") {
        const colorInput = document.createElement("input");
        colorInput.type = "color";
        colorInput.className = "ti-color-input";
        const hexMatch = config.currentValue.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
        colorInput.value = hexMatch ? normalizeHexForColorInput(config.currentValue.trim()) : "#000000";
        colorInput.addEventListener("input", () => {
          textInput.value = colorInput.value;
        });
        form.appendChild(colorInput);
      }
      form.appendChild(textInput);
      const apply = document.createElement("button");
      apply.type = "submit";
      apply.className = "ti-apply";
      apply.textContent = "Apply";
      form.appendChild(apply);
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const next = textInput.value.trim();
        if (!next) return;
        editor.classList.remove("open");
        config.onCommit(next);
      });
      textInput.addEventListener("click", (e) => e.stopPropagation());
      editor.appendChild(form);
      requestAnimationFrame(() => textInput.focus());
    }
    if (options.length) {
      const list = document.createElement("div");
      for (const opt of options) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "ti-dropdown-option";
        if (opt === config.currentValue) btn.classList.add("active");
        if (/^#|^rgb/i.test(opt) || opt === "transparent") {
          const swatch = document.createElement("span");
          swatch.className = "ti-swatch";
          swatch.style.background = opt === "transparent" ? "transparent" : opt;
          btn.appendChild(swatch);
        }
        btn.appendChild(document.createTextNode(opt));
        btn.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          editor.classList.remove("open");
          config.onCommit(opt);
        });
        list.appendChild(btn);
      }
      editor.appendChild(list);
    }
  }
  function normalizeHexForColorInput(hex) {
    const h = hex.replace("#", "");
    if (h.length === 3) {
      return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
    }
    return `#${h.slice(0, 6)}`;
  }
  function replaceVarRef(value, fromName, toName) {
    const re = new RegExp(`var\\(\\s*${fromName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*([,)])`, "g");
    return value.replace(re, `var(${toName}$1`);
  }
  function withCurrentGridOption(options, currentValue) {
    const trimmed = currentValue.trim();
    if (!trimmed) return options;
    if (options.includes(trimmed)) return options;
    return [trimmed, ...options];
  }
  var EDIT_ICON_SVG = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M2 14V11.1667L10.8 2.38333C10.9333 2.26111 11.0807 2.16667 11.242 2.1C11.4033 2.03333 11.5727 2 11.75 2C11.9273 2 12.0996 2.03333 12.2667 2.1C12.4338 2.16667 12.5782 2.26667 12.7 2.4L13.6167 3.33333C13.75 3.45556 13.8473 3.6 13.9087 3.76667C13.97 3.93333 14.0004 4.1 14 4.26667C14 4.44444 13.9696 4.614 13.9087 4.77533C13.8478 4.93667 13.7504 5.08378 13.6167 5.21667L4.83333 14H2ZM11.7333 5.2L12.6667 4.26667L11.7333 3.33333L10.8 4.26667L11.7333 5.2Z" fill="currentColor"/></svg>';
  function createEditButton(title) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ti-edit";
    btn.title = title;
    btn.setAttribute("aria-label", title);
    btn.innerHTML = EDIT_ICON_SVG;
    return btn;
  }
  function showInspectPanel(label, groups, context) {
    const current = ensureInspectorUi();
    panelContext = context ?? null;
    current.panel.classList.add("open");
    current.panel.querySelector(".ti-selector").textContent = label;
    const hint = current.panel.querySelector(".ti-hint");
    hint.replaceChildren();
    const hintText = document.createElement("span");
    hintText.className = "ti-hint-text";
    const count = overrideCount();
    hintText.textContent = count ? `${count} pending edit(s) \xB7 preview only until Push` : "Hover a value to edit \xB7 Push writes CSS via local writer";
    hint.appendChild(hintText);
    if (count) {
      const actions = document.createElement("div");
      actions.className = "ti-hint-actions";
      if (context?.onReset) {
        const reset = document.createElement("button");
        reset.type = "button";
        reset.className = "ti-reset";
        reset.textContent = "Reset";
        reset.addEventListener("click", (e) => {
          e.stopPropagation();
          context.onReset();
        });
        actions.appendChild(reset);
      }
      const push = document.createElement("button");
      push.type = "button";
      push.className = "ti-push";
      push.textContent = `Push ${count} change${count === 1 ? "" : "s"}`;
      push.addEventListener("click", async (e) => {
        e.stopPropagation();
        push.disabled = true;
        push.textContent = "Pushing\u2026";
        setPushStatus("Writing CSS files\u2026", null);
        const result = await pushEditsToWriter(listPendingEdits());
        if (result.ok) {
          setPushStatus(
            `${result.message}${result.written?.length ? `: ${result.written.join(", ")}` : ""}`,
            "ok"
          );
          context?.onPushed?.();
        } else {
          setPushStatus(
            result.detail ? `${result.message} \u2014 ${result.detail}` : result.message,
            "error"
          );
          push.disabled = false;
          push.textContent = `Push ${overrideCount()} change${overrideCount() === 1 ? "" : "s"}`;
        }
      });
      actions.appendChild(push);
      hint.appendChild(actions);
    }
    current.panel.querySelector(".ti-push-status")?.remove();
    const body = current.panel.querySelector(".ti-body");
    body.replaceChildren();
    if (!groups.length) {
      const empty = document.createElement("div");
      empty.className = "ti-hint";
      empty.textContent = "No matching stylesheet rules found for this element.";
      body.appendChild(empty);
      return;
    }
    for (const group of groups) {
      const section = document.createElement("section");
      section.className = "ti-group";
      const title = document.createElement("div");
      title.className = "ti-group-title";
      title.textContent = group.selector;
      if (group.file && group.file !== "inline") {
        const file = document.createElement("span");
        file.className = "ti-group-file";
        file.textContent = group.file;
        title.appendChild(file);
      }
      section.appendChild(title);
      for (const prop of group.properties) {
        const displayProp = applyOverrideToProp(prop, group.selector, context?.registry);
        section.appendChild(renderProperty(displayProp, group));
      }
      body.appendChild(section);
    }
  }
  function setPushStatus(text, kind) {
    const panel = document.querySelector(`#${ROOT_ID} .ti-panel`);
    if (!panel) return;
    let status = panel.querySelector(".ti-push-status");
    if (!status) {
      status = document.createElement("div");
      status.className = "ti-push-status";
      const hint = panel.querySelector(".ti-hint");
      hint?.insertAdjacentElement("afterend", status);
    }
    status.textContent = text;
    status.classList.remove("error", "ok");
    if (kind) status.classList.add(kind);
  }
  function groupFileMeta(group) {
    const sourcePath = group.sourcePath || "";
    let file = group.file || "";
    if (sourcePath.startsWith("src/")) {
      file = `apps/frontend/${sourcePath}`;
    } else if (file && file !== "inline" && file.endsWith(".css") && !file.includes("/")) {
      file = file;
    }
    return { file, sourcePath };
  }
  function commitPropertyEdit(group, prop, next) {
    const { file, sourcePath } = groupFileMeta(group);
    previewPropertyOverride({
      selector: group.selector,
      property: prop.property,
      from: prop._sourceValue ?? prop.value,
      to: next,
      file,
      sourcePath
    });
    panelContext?.onRefresh?.();
  }
  function commitTokenEdit(tokenName, from, to) {
    if (!panelContext?.registry) return;
    const entry = panelContext.registry.get(tokenName);
    previewTokenOverride({
      tokenName,
      from,
      to,
      file: normalizeTokenFile(entry?.file || ""),
      registry: panelContext.registry
    });
    panelContext.onRefresh?.();
  }
  function applyOverrideToProp(prop, selector, registry) {
    const overridden = getPropertyOverride(selector, prop.property);
    if (!overridden) return prop;
    const trees = registry ? resolveValueTrees(overridden, registry) : [];
    let swatch = prop.swatch;
    if (trees.length) {
      const terminal = terminalValue(trees[0]);
      const normalized = normalizeColor(terminal);
      if (normalized.startsWith("#") || /^rgb/i.test(terminal)) {
        swatch = terminal;
      }
    } else if (/^#|^rgb/i.test(overridden) || overridden === "transparent") {
      swatch = overridden;
    }
    return {
      ...prop,
      _sourceValue: prop._sourceValue ?? prop.value,
      value: overridden,
      trees,
      swatch,
      hasTokens: trees.length > 0,
      preview: true
    };
  }
  function renderProperty(prop, group) {
    const selector = group.selector;
    const wrap = document.createElement("div");
    wrap.className = "ti-prop";
    const row = document.createElement("div");
    row.className = "ti-prop-row";
    const name = document.createElement("div");
    name.className = "ti-prop-name";
    name.textContent = prop.property;
    row.appendChild(name);
    const valueCell = document.createElement("div");
    if (prop.trees?.length) {
      const primary = prop.trees[0];
      const head = document.createElement("div");
      head.className = "ti-editable";
      head.style.display = "flex";
      head.style.alignItems = "center";
      head.style.gap = "4px";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ti-token-btn";
      btn.setAttribute("aria-expanded", "false");
      if (prop.swatch) {
        const swatch = document.createElement("span");
        swatch.className = "ti-swatch";
        swatch.style.background = prop.swatch;
        btn.appendChild(swatch);
      }
      const chip = document.createElement("span");
      chip.className = "ti-token-chip";
      chip.textContent = prefersFullValueEdit(prop.property) ? prop.value : extractVarRefs(prop.value)[0] || primary.name;
      chip.title = prop.value;
      if (prefersFullValueEdit(prop.property)) {
        chip.style.maxWidth = "220px";
      }
      btn.appendChild(chip);
      const chevron = document.createElement("span");
      chevron.className = "ti-chevron";
      chevron.textContent = "\u25B8";
      btn.appendChild(chevron);
      if (prop.preview) {
        const badge = document.createElement("span");
        badge.className = "ti-preview-badge";
        badge.textContent = "preview";
        head.appendChild(badge);
      }
      const tree = document.createElement("div");
      tree.className = "ti-tree";
      for (const node of prop.trees) {
        tree.appendChild(renderTreeNode(node, 0));
      }
      btn.addEventListener("click", () => {
        const open = tree.classList.toggle("open");
        btn.setAttribute("aria-expanded", open ? "true" : "false");
      });
      head.appendChild(btn);
      const valueEditor = getPropertyValueEditor(prop.property);
      if (prefersFullValueEdit(prop.property) && valueEditor) {
        const tracksEdit = createEditButton("Edit grid tracks / ratios");
        tracksEdit.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          mountValueEditor(valueCell, {
            currentValue: prop.value,
            options: withCurrentGridOption(valueEditor.options, prop.value),
            allowCustom: true,
            valueKind: "text",
            placeholder: "e.g. 2.5rem 2fr 4fr 1fr",
            onCommit: (next) => commitPropertyEdit(group, prop, next)
          });
        });
        head.appendChild(tracksEdit);
      } else {
        const propEdit = editableTargetForProperty(prop);
        if (propEdit && panelContext?.registry) {
          const editBtn = createEditButton(`Reassign ${propEdit.optionLayer} token`);
          editBtn.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            tree.classList.add("open");
            btn.setAttribute("aria-expanded", "true");
            const options = listTokensByLayerAndKind(
              panelContext.registry,
              propEdit.optionLayer,
              propEdit.kind
            );
            mountDropdown(valueCell, {
              options,
              currentRef: propEdit.currentRef,
              onPick: (tokenName) => {
                const refs = extractVarRefs(prop.value);
                const fromRef = refs[0] || propEdit.currentRef;
                const nextValue = refs.length > 0 ? replaceVarRef(prop.value, fromRef, tokenName) : `var(${tokenName})`;
                commitPropertyEdit(group, prop, nextValue);
              }
            });
          });
          head.appendChild(editBtn);
        }
      }
      valueCell.appendChild(head);
      valueCell.appendChild(tree);
    } else {
      const literalRow = document.createElement("div");
      literalRow.className = "ti-literal-row";
      const literal = document.createElement("div");
      literal.className = "ti-literal";
      if (prop.swatch) {
        const swatch = document.createElement("span");
        swatch.className = "ti-swatch";
        swatch.style.background = prop.swatch;
        swatch.style.display = "inline-block";
        swatch.style.marginRight = "6px";
        swatch.style.verticalAlign = "middle";
        literal.appendChild(swatch);
      }
      literal.appendChild(document.createTextNode(prop.value));
      literalRow.appendChild(literal);
      if (prop.preview) {
        const badge = document.createElement("span");
        badge.className = "ti-preview-badge";
        badge.textContent = "preview";
        literalRow.appendChild(badge);
      }
      const valueEditor = getPropertyValueEditor(prop.property);
      if (valueEditor) {
        literalRow.classList.add("ti-editable");
        const editBtn = createEditButton(
          valueEditor.mode === "keywords" ? `Change ${prop.property}` : `Edit ${prop.property}`
        );
        editBtn.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          mountValueEditor(valueCell, {
            currentValue: prop.value,
            options: valueEditor.options,
            allowCustom: valueEditor.mode !== "keywords",
            valueKind: valueEditor.mode === "color" ? "color" : valueEditor.mode === "size" ? "length" : detectRawValueKind(prop.value),
            placeholder: valueEditor.mode === "size" ? "e.g. 90%, fit-content, 2rem" : `New ${prop.property} value`,
            onCommit: (next) => commitPropertyEdit(group, prop, next)
          });
        });
        literalRow.appendChild(editBtn);
      }
      valueCell.appendChild(literalRow);
    }
    row.appendChild(valueCell);
    wrap.appendChild(row);
    return wrap;
  }
  function renderTreeNode(node, depth) {
    const wrap = document.createElement("div");
    wrap.className = "ti-tree-node";
    wrap.style.marginLeft = `${depth * 8}px`;
    const line = document.createElement("div");
    line.className = "ti-tree-line";
    const layer = document.createElement("span");
    layer.className = `ti-layer ${node.layer}`;
    layer.textContent = node.layer;
    line.appendChild(layer);
    const tokenName = document.createElement("span");
    tokenName.className = "ti-tree-name";
    tokenName.textContent = node.name;
    line.appendChild(tokenName);
    if (node.terminal) {
      const val = document.createElement("span");
      val.className = "ti-tree-value";
      val.textContent = `= ${node.value}`;
      line.appendChild(val);
      if (/^#|^rgb/i.test(node.value)) {
        const swatch = document.createElement("span");
        swatch.className = "ti-swatch";
        swatch.style.background = node.value;
        line.appendChild(swatch);
      }
    }
    const nodeEdit = editableTargetForNode(node);
    if (nodeEdit && panelContext?.registry) {
      line.classList.add("ti-editable");
      const editBtn = createEditButton(
        nodeEdit.optionLayer === "primitive" ? "Reassign primitive" : "Reassign semantic"
      );
      editBtn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const options = listTokensByLayerAndKind(
          panelContext.registry,
          nodeEdit.optionLayer,
          nodeEdit.kind
        );
        mountDropdown(wrap, {
          options,
          currentRef: nodeEdit.currentRef,
          onPick: (tokenName2) => {
            const declared = panelContext.registry.get(nodeEdit.tokenName)?.value || `var(${nodeEdit.currentRef})`;
            commitTokenEdit(nodeEdit.tokenName, declared, `var(${tokenName2})`);
          }
        });
      });
      line.appendChild(editBtn);
    }
    if (node.layer === "primitive" && node.terminal && panelContext?.registry) {
      line.classList.add("ti-editable");
      const rawEdit = createEditButton("Edit raw value");
      rawEdit.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const kind = detectRawValueKind(node.value);
        mountValueEditor(wrap, {
          currentValue: node.value,
          options: kind === "length" ? ["0", "0.25rem", "0.5rem", "1rem", "1.5rem", "2rem", "2.5rem", "3rem", "4rem"] : [],
          allowCustom: true,
          valueKind: kind,
          placeholder: kind === "color" ? "#hex or rgb()" : kind === "length" ? "e.g. 1rem, 16px" : "Raw value",
          onCommit: (next) => {
            const declared = panelContext.registry.get(node.name)?.value || node.value;
            commitTokenEdit(node.name, declared, next);
          }
        });
      });
      line.appendChild(rawEdit);
    }
    wrap.appendChild(line);
    for (const child of node.children || []) {
      wrap.appendChild(renderTreeNode(child, depth + 1));
    }
    return wrap;
  }
  function hidePanel() {
    if (!ui) return;
    ui.panel.classList.remove("open");
    ui.selectBox.style.display = "none";
    ui.hoverBox.style.display = "none";
  }
  function setOnClose(fn) {
    ensureInspectorUi().onClose = fn;
  }
  function reposition(selectedEl2, hoverEl2) {
    if (!ui) return;
    if (selectedEl2) positionBox(ui.selectBox, selectedEl2);
    if (hoverEl2) positionBox(ui.hoverBox, hoverEl2);
  }

  // extensions/token-audit/inspector.js
  var STORAGE_KEY = "tokenInspectEnabled";
  var tokenRegistry = null;
  var enabled = false;
  var selectedEl = null;
  var hoverEl = null;
  function isOurUi(el) {
    return Boolean(el?.closest?.("#slimvg-token-inspect-root"));
  }
  async function ensureRegistry() {
    if (!tokenRegistry) {
      tokenRegistry = await loadTokenRegistry();
    }
    return tokenRegistry;
  }
  function refreshSelectedPanel() {
    if (!selectedEl || !tokenRegistry) return;
    const groups = collectMatchedStyles(selectedEl, tokenRegistry);
    showInspectPanel(elementLabel(selectedEl), groups, {
      registry: tokenRegistry,
      onRefresh: refreshSelectedPanel,
      onReset: () => {
        clearOverrides(tokenRegistry);
        tokenRegistry = null;
        ensureRegistry().then(() => refreshSelectedPanel());
      },
      onPushed: () => {
        clearOverrides(tokenRegistry);
        tokenRegistry = null;
        setTimeout(() => {
          ensureRegistry().then(() => refreshSelectedPanel());
        }, 300);
      }
    });
  }
  function onMouseMove(event) {
    if (!enabled) return;
    const target = event.target;
    if (!(target instanceof Element) || isOurUi(target)) {
      setHoverTarget(null);
      hoverEl = null;
      return;
    }
    hoverEl = target;
    if (selectedEl !== target) setHoverTarget(target);
  }
  async function onClick(event) {
    if (!enabled) return;
    const target = event.target;
    if (!(target instanceof Element) || isOurUi(target)) return;
    event.preventDefault();
    event.stopPropagation();
    selectedEl = target;
    hoverEl = null;
    setSelectTarget(target);
    setHoverTarget(null);
    await ensureRegistry();
    refreshSelectedPanel();
  }
  function onKeyDown(event) {
    if (!enabled) return;
    if (event.key === "Escape") {
      const openEditor = document.querySelector(
        "#slimvg-token-inspect-root .ti-dropdown.open, #slimvg-token-inspect-root .ti-value-editor.open"
      );
      if (openEditor) {
        event.preventDefault();
        openEditor.classList.remove("open");
        return;
      }
      event.preventDefault();
      setEnabled(false);
    }
  }
  function onScrollOrResize() {
    if (!enabled) return;
    reposition(selectedEl, hoverEl);
  }
  async function setEnabled(next) {
    enabled = next;
    await chrome.storage.local.set({ [STORAGE_KEY]: next });
    if (enabled) {
      ensureInspectorUi();
      setOnClose(() => setEnabled(false));
      document.addEventListener("mousemove", onMouseMove, true);
      document.addEventListener("click", onClick, true);
      document.addEventListener("keydown", onKeyDown, true);
      window.addEventListener("scroll", onScrollOrResize, true);
      window.addEventListener("resize", onScrollOrResize);
      document.documentElement.style.cursor = "crosshair";
      await ensureRegistry();
    } else {
      document.removeEventListener("mousemove", onMouseMove, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
      document.documentElement.style.cursor = "";
      selectedEl = null;
      hoverEl = null;
      hidePanel();
      clearInspectorUi();
    }
  }
  function getStatus() {
    return {
      enabled,
      selected: selectedEl ? elementLabel(selectedEl) : null,
      tokens: tokenRegistry?.size ?? 0
    };
  }
  async function enableInspect() {
    await setEnabled(true);
    return getStatus();
  }
  async function disableInspect() {
    await setEnabled(false);
    return getStatus();
  }
  async function initFromStorage() {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    if (result[STORAGE_KEY]) {
      await setEnabled(true);
    }
  }

  // extensions/token-audit/content.js
  if (!globalThis.__slimvgTokenInspectLoaded) {
    globalThis.__slimvgTokenInspectLoaded = true;
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      const handle = async () => {
        switch (message.type) {
          case "PING":
            return { ok: true };
          case "ENABLE":
            return enableInspect();
          case "DISABLE":
            return disableInspect();
          case "GET_STATUS":
            return getStatus();
          default:
            return null;
        }
      };
      handle().then(sendResponse).catch((err) => {
        console.error("[Token Inspect]", err);
        sendResponse({ error: String(err) });
      });
      return true;
    });
    initFromStorage();
  }
})();
