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
      let href = "inline";
      try {
        href = sheet.href ?? "inline";
      } catch {
        continue;
      }
      const file = fileNameFromHref2(href);
      for (const rule of walkStyleRules(sheet)) {
        const selector = rule.selectorText;
        if (!selector || !matchesElement(el, selector)) continue;
        const properties = [];
        const style = rule.style;
        for (let i = 0; i < style.length; i++) {
          const property = style[i];
          const value = style.getPropertyValue(property).trim();
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
        groups.push({ selector, file, properties });
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

  // extensions/token-audit/panel.js
  var ROOT_ID = "slimvg-token-inspect-root";
  var STYLE_ID = "slimvg-token-inspect-style";
  var ui = null;
  function clearInspectorUi() {
    document.getElementById(ROOT_ID)?.remove();
    document.getElementById(STYLE_ID)?.remove();
    ui = null;
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
      width: min(340px, calc(100vw - 32px));
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
      z-index: 1;
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
      margin: 0 0 6px;
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
      max-width: 200px;
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
      <div class="ti-hint">Click an element to inspect. Esc exits inspect mode.</div>
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
  function showInspectPanel(label, groups) {
    const current = ensureInspectorUi();
    current.panel.classList.add("open");
    current.panel.querySelector(".ti-selector").textContent = label;
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
        section.appendChild(renderProperty(prop));
      }
      body.appendChild(section);
    }
  }
  function renderProperty(prop) {
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
      chip.textContent = primary.name;
      btn.appendChild(chip);
      const chevron = document.createElement("span");
      chevron.className = "ti-chevron";
      chevron.textContent = "\u25B8";
      btn.appendChild(chevron);
      const tree = document.createElement("div");
      tree.className = "ti-tree";
      for (const node of prop.trees) {
        tree.appendChild(renderTreeNode(node, 0));
      }
      btn.addEventListener("click", () => {
        const open = tree.classList.toggle("open");
        btn.setAttribute("aria-expanded", open ? "true" : "false");
      });
      valueCell.appendChild(btn);
      valueCell.appendChild(tree);
    } else {
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
      valueCell.appendChild(literal);
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
    const registry = await ensureRegistry();
    const groups = collectMatchedStyles(target, registry);
    showInspectPanel(elementLabel(target), groups);
  }
  function onKeyDown(event) {
    if (!enabled) return;
    if (event.key === "Escape") {
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
