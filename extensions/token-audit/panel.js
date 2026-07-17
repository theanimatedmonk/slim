const ROOT_ID = 'slimvg-token-inspect-root';
const STYLE_ID = 'slimvg-token-inspect-style';

/** @type {{ hoverBox: HTMLElement, selectBox: HTMLElement, panel: HTMLElement, onClose?: () => void } | null} */
let ui = null;

export function clearInspectorUi() {
  document.getElementById(ROOT_ID)?.remove();
  document.getElementById(STYLE_ID)?.remove();
  ui = null;
}

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
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
    box.style.display = 'none';
    return;
  }
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    box.style.display = 'none';
    return;
  }
  box.style.display = 'block';
  box.style.top = `${rect.top}px`;
  box.style.left = `${rect.left}px`;
  box.style.width = `${rect.width}px`;
  box.style.height = `${rect.height}px`;
}

export function ensureInspectorUi() {
  if (ui) return ui;
  ensureStyles();

  const root = document.createElement('div');
  root.id = ROOT_ID;
  root.innerHTML = `
    <div class="ti-box hover" style="display:none"></div>
    <div class="ti-box select" style="display:none"></div>
    <aside class="ti-panel" role="dialog" aria-label="Token inspector">
      <div class="ti-header">
        <div class="ti-selector">Select an element</div>
        <button type="button" class="ti-close" aria-label="Close">×</button>
      </div>
      <div class="ti-hint">Click an element to inspect. Esc exits inspect mode.</div>
      <div class="ti-body"></div>
    </aside>
  `;
  document.documentElement.appendChild(root);

  const panel = root.querySelector('.ti-panel');
  panel.querySelector('.ti-close').addEventListener('click', () => {
    ui?.onClose?.();
  });

  ui = {
    hoverBox: root.querySelector('.ti-box.hover'),
    selectBox: root.querySelector('.ti-box.select'),
    panel,
  };
  return ui;
}

export function setHoverTarget(el) {
  const current = ensureInspectorUi();
  positionBox(current.hoverBox, el);
}

export function setSelectTarget(el) {
  const current = ensureInspectorUi();
  positionBox(current.selectBox, el);
  current.hoverBox.style.display = 'none';
}

/**
 * @param {string} label
 * @param {Array<{ selector: string, file: string, properties: Array<any> }>} groups
 */
export function showInspectPanel(label, groups) {
  const current = ensureInspectorUi();
  current.panel.classList.add('open');
  current.panel.querySelector('.ti-selector').textContent = label;

  const body = current.panel.querySelector('.ti-body');
  body.replaceChildren();

  if (!groups.length) {
    const empty = document.createElement('div');
    empty.className = 'ti-hint';
    empty.textContent = 'No matching stylesheet rules found for this element.';
    body.appendChild(empty);
    return;
  }

  for (const group of groups) {
    const section = document.createElement('section');
    section.className = 'ti-group';

    const title = document.createElement('div');
    title.className = 'ti-group-title';
    title.textContent = group.selector;
    if (group.file && group.file !== 'inline') {
      const file = document.createElement('span');
      file.className = 'ti-group-file';
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
  const wrap = document.createElement('div');
  wrap.className = 'ti-prop';

  const row = document.createElement('div');
  row.className = 'ti-prop-row';

  const name = document.createElement('div');
  name.className = 'ti-prop-name';
  name.textContent = prop.property;
  row.appendChild(name);

  const valueCell = document.createElement('div');

  if (prop.trees?.length) {
    const primary = prop.trees[0];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ti-token-btn';
    btn.setAttribute('aria-expanded', 'false');

    if (prop.swatch) {
      const swatch = document.createElement('span');
      swatch.className = 'ti-swatch';
      swatch.style.background = prop.swatch;
      btn.appendChild(swatch);
    }

    const chip = document.createElement('span');
    chip.className = 'ti-token-chip';
    chip.textContent = primary.name;
    btn.appendChild(chip);

    const chevron = document.createElement('span');
    chevron.className = 'ti-chevron';
    chevron.textContent = '▸';
    btn.appendChild(chevron);

    const tree = document.createElement('div');
    tree.className = 'ti-tree';
    for (const node of prop.trees) {
      tree.appendChild(renderTreeNode(node, 0));
    }

    btn.addEventListener('click', () => {
      const open = tree.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    valueCell.appendChild(btn);
    valueCell.appendChild(tree);
  } else {
    const literal = document.createElement('div');
    literal.className = 'ti-literal';
    if (prop.swatch) {
      const swatch = document.createElement('span');
      swatch.className = 'ti-swatch';
      swatch.style.background = prop.swatch;
      swatch.style.display = 'inline-block';
      swatch.style.marginRight = '6px';
      swatch.style.verticalAlign = 'middle';
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
  const wrap = document.createElement('div');
  wrap.className = 'ti-tree-node';
  wrap.style.marginLeft = `${depth * 8}px`;

  const line = document.createElement('div');
  line.className = 'ti-tree-line';

  const layer = document.createElement('span');
  layer.className = `ti-layer ${node.layer}`;
  layer.textContent = node.layer;
  line.appendChild(layer);

  const tokenName = document.createElement('span');
  tokenName.className = 'ti-tree-name';
  tokenName.textContent = node.name;
  line.appendChild(tokenName);

  if (node.terminal) {
    const val = document.createElement('span');
    val.className = 'ti-tree-value';
    val.textContent = `= ${node.value}`;
    line.appendChild(val);

    if (/^#|^rgb/i.test(node.value)) {
      const swatch = document.createElement('span');
      swatch.className = 'ti-swatch';
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

export function hidePanel() {
  if (!ui) return;
  ui.panel.classList.remove('open');
  ui.selectBox.style.display = 'none';
  ui.hoverBox.style.display = 'none';
}

export function setOnClose(fn) {
  ensureInspectorUi().onClose = fn;
}

export function reposition(selectedEl, hoverEl) {
  if (!ui) return;
  if (selectedEl) positionBox(ui.selectBox, selectedEl);
  if (hoverEl) positionBox(ui.hoverBox, hoverEl);
}
