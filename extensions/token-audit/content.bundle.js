(() => {
  // extensions/token-audit/overlay.js
  var ROOT_ID = "slimvg-token-audit-root";
  var STYLE_ID = "slimvg-token-audit-style";
  var state = null;
  function clearOverlay() {
    const root = document.getElementById(ROOT_ID);
    root?._cleanup?.();
    document.getElementById(ROOT_ID)?.remove();
    document.getElementById(STYLE_ID)?.remove();
    state = null;
  }
  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
    #${ROOT_ID} {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 2147483646;
    }
    #${ROOT_ID} .ta-spotlight {
      position: fixed;
      box-sizing: border-box;
      border: 2px solid #171717;
      border-radius: 4px;
      pointer-events: none;
      box-shadow: 0 0 0 9999px rgba(23, 23, 23, 0.28);
      transition: top 0.2s ease, left 0.2s ease, width 0.2s ease, height 0.2s ease;
    }
    #${ROOT_ID} .ta-callout {
      position: fixed;
      width: min(360px, calc(100vw - 32px));
      pointer-events: auto;
      background: #fff;
      border: 1px solid #e5e5e5;
      border-radius: 14px;
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.14);
      font: 13px/1.45 system-ui, -apple-system, sans-serif;
      color: #171717;
      padding: 14px 16px 12px;
    }
    #${ROOT_ID} .ta-callout::before {
      content: '';
      position: absolute;
      width: 12px;
      height: 12px;
      background: #fff;
      border-left: 1px solid #e5e5e5;
      border-top: 1px solid #e5e5e5;
      transform: rotate(45deg);
    }
    #${ROOT_ID} .ta-callout[data-placement='bottom']::before {
      top: -7px;
      left: var(--ta-arrow-left, 24px);
    }
    #${ROOT_ID} .ta-callout[data-placement='top']::before {
      bottom: -7px;
      left: var(--ta-arrow-left, 24px);
      transform: rotate(225deg);
    }
    #${ROOT_ID} .ta-callout-body {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 12px;
      align-items: start;
    }
    #${ROOT_ID} .ta-detail {
      font-size: 14px;
      font-weight: 600;
      line-height: 1.35;
      word-break: break-word;
    }
    #${ROOT_ID} .ta-label {
      text-align: right;
      font-size: 12px;
      font-weight: 600;
      color: #e11d48;
      max-width: 9rem;
      line-height: 1.35;
    }
    #${ROOT_ID} .ta-callout.warn .ta-label {
      color: #d97706;
    }
    #${ROOT_ID} .ta-callout-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 14px;
      padding-top: 12px;
      border-top: 1px solid #f0f0f0;
    }
    #${ROOT_ID} .ta-counter {
      font-size: 12px;
      font-weight: 600;
      color: #525252;
    }
    #${ROOT_ID} .ta-nav {
      display: flex;
      gap: 8px;
    }
    #${ROOT_ID} .ta-nav-btn {
      width: 34px;
      height: 34px;
      border: none;
      border-radius: 999px;
      background: #171717;
      color: #fff;
      font-size: 16px;
      line-height: 1;
      cursor: pointer;
      display: grid;
      place-items: center;
      padding: 0;
    }
    #${ROOT_ID} .ta-nav-btn:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }
    #${ROOT_ID} .ta-nav-btn:not(:disabled):hover {
      background: #404040;
    }
    #${ROOT_ID} .ta-empty {
      position: fixed;
      top: 16px;
      right: 16px;
      pointer-events: auto;
      background: #fff;
      border: 1px solid #e5e5e5;
      border-radius: 12px;
      padding: 14px 16px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.12);
      font: 13px/1.4 system-ui, sans-serif;
    }
  `;
    document.documentElement.appendChild(style);
  }
  function humanProperty(property) {
    const labels = {
      color: "Color",
      "background-color": "Background color",
      "border-color": "Border color",
      padding: "Padding",
      margin: "Margin",
      gap: "Gap",
      width: "Width",
      height: "Height",
      "font-size": "Font size",
      "border-radius": "Border radius",
      "z-index": "Z-index",
      "box-shadow": "Box shadow"
    };
    if (labels[property]) return labels[property];
    if (property?.startsWith("--")) return property;
    return (property ?? "Value").split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
  }
  function humanRuleLabel(rule, value) {
    switch (rule) {
      case "no-naked-color":
        if (/#([0-9a-f]{3,8})\b/i.test(value)) return "Hard coded HEX value";
        if (/rgba?\(/i.test(value)) return "Hard coded rgb value";
        return "Hard coded color value";
      case "no-naked-length":
        if (/\d+px\b/.test(value)) return "Hard coded px value";
        if (/\d+rem\b/.test(value)) return "Hard coded rem value";
        if (/\d+em\b/.test(value)) return "Hard coded em value";
        return "Hard coded size value";
      case "no-primitive-in-component":
        return "Primitive token leak";
      case "no-naked-z-index":
        return "Hard coded z-index";
      case "unknown-color":
        return "Off-palette color";
      default:
        return "Token violation";
    }
  }
  function formatDetail(property, value) {
    const trimmed = value.trim();
    if (property === "color" || property?.includes("color")) {
      const colorMatch = trimmed.match(/#[0-9a-f]{3,8}\b|rgba?\([^)]+\)/i);
      if (colorMatch) return `${humanProperty(property)} is ${colorMatch[0]}`;
    }
    const lengthMatch = trimmed.match(/\d*\.?\d+(px|rem|em)\b/);
    if (lengthMatch && /padding|margin|gap|width|height|font-size|radius/i.test(property ?? "")) {
      return `${humanProperty(property)} is ${lengthMatch[0]}`;
    }
    return `${humanProperty(property)} is ${trimmed}`;
  }
  function buildSlides(findings) {
    const slides = [];
    const sorted = [...findings].sort((a, b) => {
      if (a.severity === b.severity) return 0;
      return a.severity === "error" ? -1 : 1;
    });
    for (const finding of sorted) {
      for (const element of finding.elements) {
        slides.push({ finding, element });
      }
    }
    return slides;
  }
  function positionSpotlight(spotlight, el) {
    const rect = el.getBoundingClientRect();
    const pad = 2;
    spotlight.style.top = `${Math.max(0, rect.top - pad)}px`;
    spotlight.style.left = `${Math.max(0, rect.left - pad)}px`;
    spotlight.style.width = `${Math.max(0, rect.width + pad * 2)}px`;
    spotlight.style.height = `${Math.max(0, rect.height + pad * 2)}px`;
    return rect;
  }
  function positionCallout(callout, rect) {
    const margin = 12;
    const calloutRect = callout.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    let top = rect.bottom + margin;
    let placement = "bottom";
    if (top + calloutRect.height > viewportH - margin) {
      top = rect.top - calloutRect.height - margin;
      placement = "top";
    }
    let left = rect.left + rect.width / 2 - calloutRect.width / 2;
    left = Math.max(margin, Math.min(left, viewportW - calloutRect.width - margin));
    const arrowLeft = Math.max(
      16,
      Math.min(rect.left + rect.width / 2 - left - 6, calloutRect.width - 28)
    );
    callout.style.top = `${Math.max(margin, top)}px`;
    callout.style.left = `${left}px`;
    callout.dataset.placement = placement;
    callout.style.setProperty("--ta-arrow-left", `${arrowLeft}px`);
  }
  function showSlide(index) {
    if (!state || state.slides.length === 0) return;
    const total = state.slides.length;
    state.index = (index % total + total) % total;
    const { finding, element } = state.slides[state.index];
    const root = document.getElementById(ROOT_ID);
    if (!root) return;
    const spotlight = root.querySelector(".ta-spotlight");
    const callout = root.querySelector(".ta-callout");
    if (!spotlight || !callout) return;
    element.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    requestAnimationFrame(() => {
      const rect = positionSpotlight(spotlight, element);
      positionCallout(callout, rect);
      const kind = finding.severity === "error" ? "Error" : "Warning";
      callout.className = `ta-callout ${finding.severity}`;
      callout.querySelector(".ta-detail").textContent = formatDetail(finding.property, finding.value);
      callout.querySelector(".ta-label").textContent = humanRuleLabel(finding.rule, finding.value);
      callout.querySelector(".ta-counter").textContent = `${kind} ${state.index + 1}/${total}`;
      const prevBtn = callout.querySelector(".ta-prev");
      const nextBtn = callout.querySelector(".ta-next");
      prevBtn.disabled = state.index === 0;
      nextBtn.disabled = state.index === total - 1;
    });
  }
  function onKeyDown(event) {
    if (!state) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      showSlide(state.index + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      showSlide(state.index - 1);
    }
  }
  function renderOverlay(findings, startIndex = 0) {
    clearOverlay();
    ensureStyles();
    const slides = buildSlides(findings);
    const root = document.createElement("div");
    root.id = ROOT_ID;
    if (slides.length === 0) {
      root.innerHTML = `<div class="ta-empty">No token violations found on this page.</div>`;
      document.documentElement.appendChild(root);
      return;
    }
    root.innerHTML = `
    <div class="ta-spotlight" aria-hidden="true"></div>
    <div class="ta-callout" role="dialog" aria-label="Token audit finding">
      <div class="ta-callout-body">
        <div class="ta-detail"></div>
        <div class="ta-label"></div>
      </div>
      <div class="ta-callout-footer">
        <div class="ta-counter"></div>
        <div class="ta-nav">
          <button type="button" class="ta-nav-btn ta-prev" aria-label="Previous finding">\u2190</button>
          <button type="button" class="ta-nav-btn ta-next" aria-label="Next finding">\u2192</button>
        </div>
      </div>
    </div>
  `;
    document.documentElement.appendChild(root);
    const callout = root.querySelector(".ta-callout");
    callout.querySelector(".ta-prev").addEventListener("click", () => showSlide(state.index - 1));
    callout.querySelector(".ta-next").addEventListener("click", () => showSlide(state.index + 1));
    const reposition = () => {
      if (!state) return;
      const { element } = state.slides[state.index];
      const spotlight = root.querySelector(".ta-spotlight");
      const calloutEl = root.querySelector(".ta-callout");
      if (!spotlight || !calloutEl || !element.isConnected) return;
      const rect = positionSpotlight(spotlight, element);
      positionCallout(calloutEl, rect);
    };
    state = { slides, index: startIndex, reposition };
    const observer = new ResizeObserver(reposition);
    observer.observe(document.documentElement);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    window.addEventListener("keydown", onKeyDown);
    root._cleanup = () => {
      observer.disconnect();
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("keydown", onKeyDown);
    };
    showSlide(startIndex);
  }

  // extensions/token-audit/lib/constants.mjs
  var ALLOWED_LITERALS = /* @__PURE__ */ new Set([
    "0",
    "1px",
    "2px",
    "100%",
    "50%",
    "auto",
    "none",
    "inherit",
    "unset",
    "initial",
    "transparent",
    "currentColor"
  ]);
  var NAKED_COLOR_RE = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/;
  var NAKED_RGB_RE = /\brgba?\([^)]+\)/;
  var NAKED_LENGTH_RE = /(?<![\w-])(\d*\.?\d+)(rem|px|em)\b/;
  var PRIMITIVE_VAR_RE = /var\(\s*(--primitive-[^,)]+)/g;
  var SKIP_FILE_NAMES = /* @__PURE__ */ new Set(["primitives.css", "semantic.css", "index.css"]);
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
  var LENGTH_PROPERTIES_RE = /^(padding|margin|gap|top|right|bottom|left|width|height|min-width|min-height|max-width|max-height|inset|border-radius|font-size|line-height|letter-spacing|outline-offset|scroll-margin|scroll-padding)/i;

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
  function classifyToken(name, tokenRegistry) {
    const entry = tokenRegistry.get(name);
    if (entry) return entry.layer;
    if (name.startsWith("--primitive-")) return "primitive";
    if (SEMANTIC_PREFIXES.some((prefix) => name.startsWith(prefix))) return "semantic";
    return "component";
  }
  function traceToken(name, tokenRegistry, seen = /* @__PURE__ */ new Set()) {
    if (seen.has(name)) return [`${name} (cycle)`];
    seen.add(name);
    const entry = tokenRegistry.get(name);
    if (!entry) return [`${name} (unknown)`];
    const refs = extractVarRefs(entry.value);
    if (refs.length === 0) {
      return [`${entry.layer}: ${name} = ${entry.value}`];
    }
    const lines = [`${entry.layer}: ${name}`];
    for (const ref of refs) {
      for (const child of traceToken(ref, tokenRegistry, seen)) {
        lines.push(`  \u2192 ${child}`);
      }
    }
    return lines;
  }
  function buildColorPalette(tokenRegistry) {
    const palette = /* @__PURE__ */ new Set();
    function resolveValue(value, seen = /* @__PURE__ */ new Set()) {
      const trimmed = value.trim();
      const refs = extractVarRefs(trimmed);
      if (refs.length === 0) {
        palette.add(normalizeColor(trimmed));
        return;
      }
      for (const ref of refs) {
        if (seen.has(ref)) continue;
        seen.add(ref);
        const entry = tokenRegistry.get(ref);
        if (entry) resolveValue(entry.value, seen);
      }
    }
    for (const entry of tokenRegistry.values()) {
      resolveValue(entry.value);
    }
    palette.delete("");
    palette.delete("transparent");
    palette.delete("currentcolor");
    return palette;
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

  // extensions/token-audit/lib/audit.mjs
  function isAllowedLiteral(value) {
    const trimmed = value.trim();
    if (ALLOWED_LITERALS.has(trimmed)) return true;
    if (/^\d+(\.\d+)?%$/.test(trimmed)) return true;
    if (/^\d+\s*\/\s*\d+$/.test(trimmed)) return true;
    if (/^calc\(/i.test(trimmed)) return true;
    if (/^clamp\(/i.test(trimmed)) return true;
    if (/^min\(/i.test(trimmed)) return true;
    if (/^max\(/i.test(trimmed)) return true;
    if (/^color-mix\(/i.test(trimmed)) return true;
    if (/^rgb\(from\s+var\(/i.test(trimmed)) return true;
    if (/^cubic-bezier\(/i.test(trimmed)) return true;
    if (/^translateX?\(/i.test(trimmed)) return true;
    if (/^var\(/.test(trimmed)) return true;
    return false;
  }
  function stripVarFallbacks(value) {
    return value.replace(/var\([^)]+\)/g, " ");
  }
  function shouldSkipFile(filePath) {
    const name = filePath.split(/[/\\]/).pop() ?? filePath;
    return SKIP_FILE_NAMES.has(name);
  }
  function auditValue(input) {
    const { file = "", line, property, value, context, tokenRegistry, showTrace = false, selector } = input;
    const findings = [];
    if (context !== "declaration") return findings;
    let primitiveMatch;
    const primitiveRe = new RegExp(PRIMITIVE_VAR_RE.source, "g");
    while ((primitiveMatch = primitiveRe.exec(value)) !== null) {
      findings.push({
        severity: "error",
        rule: "no-primitive-in-component",
        file,
        line,
        property,
        value: value.trim(),
        message: `Component CSS must not reference primitive token ${primitiveMatch[1]} directly \u2014 use a semantic or component token.`,
        trace: showTrace ? traceToken(primitiveMatch[1], tokenRegistry) : void 0,
        selector
      });
    }
    for (const ref of extractVarRefs(value)) {
      if (!tokenRegistry.has(ref) && !ref.match(/^--[a-z]+-/)) {
        if (classifyToken(ref, tokenRegistry) === "component" && !tokenRegistry.has(ref)) {
        }
      }
    }
    const nakedProbe = stripVarFallbacks(value);
    if (NAKED_COLOR_RE.test(nakedProbe)) {
      findings.push({
        severity: "error",
        rule: "no-naked-color",
        file,
        line,
        property,
        value: value.trim(),
        message: "Hardcoded color found \u2014 use a semantic or component token via var().",
        selector
      });
    } else if (NAKED_RGB_RE.test(nakedProbe) && !/rgb\(from\s+var\(/i.test(value)) {
      findings.push({
        severity: "error",
        rule: "no-naked-color",
        file,
        line,
        property,
        value: value.trim(),
        message: "Hardcoded rgb/rgba color found \u2014 use a token via var().",
        selector
      });
    }
    if (property && LENGTH_PROPERTIES_RE.test(property)) {
      const lengthMatch = nakedProbe.match(NAKED_LENGTH_RE);
      if (lengthMatch && !isAllowedLiteral(lengthMatch[0])) {
        findings.push({
          severity: "warn",
          rule: "no-naked-length",
          file,
          line,
          property,
          value: value.trim(),
          message: `Hardcoded length ${lengthMatch[0]} \u2014 prefer a spacing/size token.`,
          selector
        });
      }
    }
    if (property === "z-index" && /^\d+$/.test(value.trim())) {
      findings.push({
        severity: "warn",
        rule: "no-naked-z-index",
        file,
        line,
        property,
        value: value.trim(),
        message: "Hardcoded z-index \u2014 prefer --primitive-z-* via a component token.",
        selector
      });
    }
    return findings;
  }

  // extensions/token-audit/scanner.js
  var COLOR_PROPERTIES = /* @__PURE__ */ new Set([
    "color",
    "background-color",
    "border-color",
    "border-top-color",
    "border-right-color",
    "border-bottom-color",
    "border-left-color",
    "outline-color",
    "fill",
    "stroke",
    "caret-color",
    "column-rule-color"
  ]);
  function* walkRules(styleSheet, seen = /* @__PURE__ */ new Set()) {
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
        continue;
      }
      if (rule.type === CSSRule.IMPORT_RULE) {
        const imported = (
          /** @type {CSSImportRule} */
          rule.styleSheet
        );
        if (imported) yield* walkRules(imported, seen);
        continue;
      }
      if ("cssRules" in rule && rule.cssRules) {
        yield* walkRules(
          /** @type {CSSStyleSheet} */
          rule,
          seen
        );
      }
    }
  }
  function fileNameFromHref(href) {
    if (!href) return "inline";
    try {
      const url = new URL(href);
      return decodeURIComponent(url.pathname.split("/").pop() || href);
    } catch {
      return href.split("/").pop() || href;
    }
  }
  function elementDescriptor(el) {
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : "";
    const classes = el.classList.length ? `.${[...el.classList].join(".")}` : "";
    return `${tag}${id}${classes}`;
  }
  function matchElements(selector) {
    if (!selector || selector.includes(":") || selector.includes("@")) return [];
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
    }
    return "";
  }
  async function loadTokenRegistryFromPage() {
    let primitivesCss = "";
    let semanticCss = "";
    for (const sheet of document.styleSheets) {
      let href = "";
      try {
        href = sheet.href ?? "";
      } catch {
        continue;
      }
      const name = fileNameFromHref(href);
      if (name !== "primitives.css" && name !== "semantic.css") continue;
      try {
        const text = [...walkRules(sheet)].map((rule) => rule.cssText).join("\n");
        if (name === "primitives.css") primitivesCss += text;
        if (name === "semantic.css") semanticCss += text;
      } catch {
      }
      if (name === "primitives.css" && !primitivesCss || name === "semantic.css" && !semanticCss) {
      }
    }
    if (!primitivesCss || !semanticCss) {
      for (const sheet of document.styleSheets) {
        let cssText = "";
        try {
          cssText = [...walkRules(sheet)].map((r) => r.cssText).join("\n");
        } catch {
          continue;
        }
        if (!primitivesCss && cssText.includes("--primitive-brand-50")) primitivesCss = cssText;
        if (!semanticCss && cssText.includes("--space-page-x")) semanticCss = cssText;
      }
    }
    if (!primitivesCss) {
      primitivesCss = await fetchDevTokenCss("/src/styles/tokens/primitives.css");
    }
    if (!semanticCss) {
      semanticCss = await fetchDevTokenCss("/src/styles/tokens/semantic.css");
    }
    return createTokenRegistry(primitivesCss, semanticCss);
  }
  async function scanPage() {
    const tokenRegistry = await loadTokenRegistryFromPage();
    const colorPalette = buildColorPalette(tokenRegistry);
    const findings = [];
    let findingId = 0;
    function pushFinding(base, elements) {
      const uniqueElements = [...new Set(elements.filter(Boolean))];
      if (uniqueElements.length === 0) return;
      findings.push({
        id: `f-${findingId++}`,
        ...base,
        elements: uniqueElements
      });
    }
    for (const sheet of document.styleSheets) {
      let href = "";
      try {
        href = sheet.href ?? "inline";
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
            context: "declaration",
            tokenRegistry,
            showTrace: true,
            selector
          });
          for (const finding of ruleFindings) {
            pushFinding(finding, elements);
          }
        }
      }
    }
    const allElements = document.querySelectorAll("[style]");
    for (const el of allElements) {
      const style = el.style;
      for (let i = 0; i < style.length; i++) {
        const property = style[i];
        const value = style.getPropertyValue(property);
        const ruleFindings = auditValue({
          file: "inline",
          property,
          value,
          context: "declaration",
          tokenRegistry,
          showTrace: true,
          selector: elementDescriptor(el)
        });
        for (const finding of ruleFindings) {
          pushFinding(finding, [el]);
        }
      }
    }
    if (colorPalette.size > 0) {
      const checked = /* @__PURE__ */ new WeakSet();
      for (const el of document.querySelectorAll("body *")) {
        if (checked.has(el)) continue;
        checked.add(el);
        const computed = getComputedStyle(el);
        for (const property of COLOR_PROPERTIES) {
          const value = computed.getPropertyValue(property).trim();
          if (!value || value === "transparent" || value === "rgba(0, 0, 0, 0)") continue;
          const normalized = normalizeColor(value);
          if (!normalized.startsWith("#")) continue;
          if (colorPalette.has(normalized)) continue;
          pushFinding(
            {
              severity: "error",
              rule: "unknown-color",
              file: "computed",
              property,
              value,
              message: `Color ${value} is not in the design token palette \u2014 may be a naked or off-system value.`,
              selector: elementDescriptor(el)
            },
            [el]
          );
        }
      }
    }
    return findings;
  }
  function summarize(findings) {
    const errors = findings.filter((f) => f.severity === "error").length;
    const warnings = findings.filter((f) => f.severity === "warn").length;
    return { errors, warnings, total: findings.length };
  }

  // extensions/token-audit/content.js
  if (globalThis.__slimvgTokenAuditLoaded) {
  } else {
    globalThis.__slimvgTokenAuditLoaded = true;
    const STORAGE_KEY = "tokenAuditEnabled";
    let lastFindings = [];
    let enabled = false;
    async function loadEnabledState() {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      enabled = Boolean(result[STORAGE_KEY]);
    }
    async function runScan() {
      lastFindings = await scanPage();
      if (enabled) {
        renderOverlay(lastFindings);
      }
      return summarize(lastFindings);
    }
    async function setEnabled(next) {
      enabled = next;
      await chrome.storage.local.set({ [STORAGE_KEY]: next });
      if (enabled) {
        if (lastFindings.length === 0) {
          await runScan();
        } else {
          renderOverlay(lastFindings);
        }
      } else {
        const root = document.getElementById("slimvg-token-audit-root");
        root?._cleanup?.();
        clearOverlay();
      }
    }
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      const handle = async () => {
        switch (message.type) {
          case "PING":
            return { ok: true };
          case "ENABLE":
            await setEnabled(true);
            return summarize(lastFindings);
          case "DISABLE":
            await setEnabled(false);
            return summarize(lastFindings);
          case "SCAN":
            return runScan();
          case "GET_SUMMARY":
            return summarize(lastFindings);
          default:
            return null;
        }
      };
      handle().then(sendResponse).catch((err) => {
        console.error("[Token Audit]", err);
        sendResponse({ error: String(err) });
      });
      return true;
    });
    async function init() {
      await loadEnabledState();
      if (enabled) {
        await runScan();
      }
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
    let rescanTimer;
    const observer = new MutationObserver(() => {
      if (!enabled) return;
      clearTimeout(rescanTimer);
      rescanTimer = setTimeout(() => runScan(), 500);
    });
    observer.observe(document.head, { childList: true, subtree: true });
  }
})();
