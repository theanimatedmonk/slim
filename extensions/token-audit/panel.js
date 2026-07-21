import {
  getPropertyOverride,
  hasOverrides,
  listPendingEdits,
  normalizeTokenFile,
  overrideCount,
  previewPropertyOverride,
  previewTokenOverride,
} from './overrides.js';
import {
  detectRawValueKind,
  getPropertyValueEditor,
  prefersFullValueEdit,
} from './property-options.js';
import { pushEditsToWriter } from './push.js';
import {
  editableTargetForNode,
  editableTargetForProperty,
  listTokensByLayerAndKind,
} from './token-options.js';
import { extractVarRefs, resolveValueTrees, terminalValue, normalizeColor } from './tokens.js';

const ROOT_ID = 'slimvg-token-inspect-root';
const STYLE_ID = 'slimvg-token-inspect-style';

/** @type {{ hoverBox: HTMLElement, selectBox: HTMLElement, panel: HTMLElement, onClose?: () => void } | null} */
let ui = null;

/** @type {{
 *   registry: Map<string, { value: string, file: string, layer: string }>,
 *   onRefresh?: () => void,
 *   onReset?: () => void,
 *   onPushed?: () => void,
 * } | null} */
let panelContext = null;

let outsideCloseArmed = false;

export function clearInspectorUi() {
  disarmOutsideClose();
  document.getElementById(ROOT_ID)?.remove();
  document.getElementById(STYLE_ID)?.remove();
  ui = null;
  panelContext = null;
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
    #${ROOT_ID} .ti-edit {
      border: none;
      background: transparent;
      color: #a3a3a3;
      cursor: pointer;
      padding: 0 2px;
      font-size: 12px;
      line-height: 1;
      border-radius: 4px;
      flex-shrink: 0;
    }
    #${ROOT_ID} .ti-edit:hover {
      color: #2563eb;
      background: #eff6ff;
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
      <div class="ti-hint">
        <span class="ti-hint-text">Expand tokens · ✎ reassigns in-browser only (clears on reload)</span>
      </div>
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

function closeAllEditors(except) {
  const root = document.getElementById(ROOT_ID);
  if (!root) return;
  for (const el of root.querySelectorAll('.ti-dropdown.open, .ti-value-editor.open')) {
    if (el !== except) el.classList.remove('open');
  }
  if (!root.querySelector('.ti-dropdown.open, .ti-value-editor.open')) {
    disarmOutsideClose();
  }
}

function onOutsidePointerDown(event) {
  const root = document.getElementById(ROOT_ID);
  if (!root) return;

  const open = root.querySelector('.ti-dropdown.open, .ti-value-editor.open');
  if (!open) {
    disarmOutsideClose();
    return;
  }

  const target = event.target;
  if (!(target instanceof Node)) return;

  // Keep open when interacting with the editor itself
  if (open.contains(target)) return;

  closeAllEditors();
}

function armOutsideClose() {
  if (outsideCloseArmed) return;
  outsideCloseArmed = true;
  // Defer so the same click that opened the editor doesn't immediately close it
  window.setTimeout(() => {
    if (!outsideCloseArmed) return;
    document.addEventListener('pointerdown', onOutsidePointerDown, true);
  }, 0);
}

function disarmOutsideClose() {
  if (!outsideCloseArmed) return;
  outsideCloseArmed = false;
  document.removeEventListener('pointerdown', onOutsidePointerDown, true);
}

/**
 * @param {HTMLElement} host
 * @param {{
 *   options: Array<{ name: string, swatch: string | null, label: string }>,
 *   currentRef: string,
 *   onPick: (name: string) => void,
 * }} config
 */
function mountDropdown(host, config) {
  closeAllEditors();

  let dropdown = host.querySelector(':scope > .ti-dropdown');
  if (!dropdown) {
    dropdown = document.createElement('div');
    dropdown.className = 'ti-dropdown';
    host.appendChild(dropdown);
  }

  dropdown.replaceChildren();
  dropdown.classList.add('open');
  armOutsideClose();

  const search = document.createElement('input');
  search.className = 'ti-dropdown-search';
  search.type = 'search';
  search.placeholder = 'Filter tokens…';
  dropdown.appendChild(search);

  const list = document.createElement('div');
  dropdown.appendChild(list);

  function renderOptions(filter = '') {
    list.replaceChildren();
    const q = filter.trim().toLowerCase();
    const filtered = config.options.filter(
      (opt) => !q || opt.name.toLowerCase().includes(q) || opt.label.toLowerCase().includes(q)
    );

    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'ti-dropdown-empty';
      empty.textContent = 'No matching tokens';
      list.appendChild(empty);
      return;
    }

    for (const opt of filtered) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ti-dropdown-option';
      if (opt.name === config.currentRef) btn.classList.add('active');

      if (opt.swatch) {
        const swatch = document.createElement('span');
        swatch.className = 'ti-swatch';
        swatch.style.background = opt.swatch;
        btn.appendChild(swatch);
      }

      btn.appendChild(document.createTextNode(opt.name));
      btn.title = opt.label;
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        dropdown.classList.remove('open');
        config.onPick(opt.name);
      });
      list.appendChild(btn);
    }
  }

  renderOptions();
  search.addEventListener('input', () => renderOptions(search.value));
  search.addEventListener('click', (e) => e.stopPropagation());
  requestAnimationFrame(() => search.focus());
}

/**
 * Keyword / size / freeform / color value editor for CSS properties & primitive raw values.
 * @param {HTMLElement} host
 * @param {{
 *   currentValue: string,
 *   options?: string[],
 *   allowCustom?: boolean,
 *   valueKind?: 'color' | 'length' | 'number' | 'text',
 *   placeholder?: string,
 *   onCommit: (value: string) => void,
 * }} config
 */
function mountValueEditor(host, config) {
  closeAllEditors();

  let editor = host.querySelector(':scope > .ti-value-editor');
  if (!editor) {
    editor = document.createElement('div');
    editor.className = 'ti-value-editor';
    host.appendChild(editor);
  }

  editor.replaceChildren();
  editor.classList.add('open');
  armOutsideClose();

  const options = config.options ?? [];
  const allowCustom = config.allowCustom !== false;
  const valueKind = config.valueKind ?? detectRawValueKind(config.currentValue);

  if (allowCustom) {
    const form = document.createElement('form');
    form.className = 'ti-value-editor-form';

    const textInput = document.createElement('input');
    textInput.className = 'ti-value-input';
    textInput.type = 'text';
    textInput.value = config.currentValue;
    textInput.placeholder = config.placeholder ?? 'Enter value…';

    if (valueKind === 'color') {
      const colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.className = 'ti-color-input';
      const hexMatch = config.currentValue.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
      colorInput.value = hexMatch
        ? normalizeHexForColorInput(config.currentValue.trim())
        : '#000000';
      colorInput.addEventListener('input', () => {
        textInput.value = colorInput.value;
      });
      form.appendChild(colorInput);
    }

    form.appendChild(textInput);

    const apply = document.createElement('button');
    apply.type = 'submit';
    apply.className = 'ti-apply';
    apply.textContent = 'Apply';
    form.appendChild(apply);

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const next = textInput.value.trim();
      if (!next) return;
      editor.classList.remove('open');
      config.onCommit(next);
    });

    textInput.addEventListener('click', (e) => e.stopPropagation());
    editor.appendChild(form);
    requestAnimationFrame(() => textInput.focus());
  }

  if (options.length) {
    const list = document.createElement('div');
    for (const opt of options) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ti-dropdown-option';
      if (opt === config.currentValue) btn.classList.add('active');

      if (/^#|^rgb/i.test(opt) || opt === 'transparent') {
        const swatch = document.createElement('span');
        swatch.className = 'ti-swatch';
        swatch.style.background = opt === 'transparent' ? 'transparent' : opt;
        btn.appendChild(swatch);
      }

      btn.appendChild(document.createTextNode(opt));
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        editor.classList.remove('open');
        config.onCommit(opt);
      });
      list.appendChild(btn);
    }
    editor.appendChild(list);
  }
}

function normalizeHexForColorInput(hex) {
  const h = hex.replace('#', '');
  if (h.length === 3) {
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
  }
  return `#${h.slice(0, 6)}`;
}

function replaceVarRef(value, fromName, toName) {
  const re = new RegExp(`var\\(\\s*${fromName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*([,)])`, 'g');
  return value.replace(re, `var(${toName}$1`);
}

/** Keep the current grid template at the top of suggestions. */
function withCurrentGridOption(options, currentValue) {
  const trimmed = currentValue.trim();
  if (!trimmed) return options;
  if (options.includes(trimmed)) return options;
  return [trimmed, ...options];
}

/**
 * @param {string} label
 * @param {Array<{ selector: string, file: string, sourcePath?: string, properties: Array<any> }>} groups
 * @param {{
 *   registry: Map<string, any>,
 *   onRefresh?: () => void,
 *   onReset?: () => void,
 *   onPushed?: () => void,
 * }} [context]
 */
export function showInspectPanel(label, groups, context) {
  const current = ensureInspectorUi();
  panelContext = context ?? null;
  current.panel.classList.add('open');
  current.panel.querySelector('.ti-selector').textContent = label;

  const hint = current.panel.querySelector('.ti-hint');
  hint.replaceChildren();
  const hintText = document.createElement('span');
  hintText.className = 'ti-hint-text';
  const count = overrideCount();
  hintText.textContent = count
    ? `${count} pending edit(s) · preview only until Push`
    : 'Expand tokens · ✎ preview · Push writes CSS via local writer';
  hint.appendChild(hintText);

  if (count) {
    const actions = document.createElement('div');
    actions.className = 'ti-hint-actions';

    if (context?.onReset) {
      const reset = document.createElement('button');
      reset.type = 'button';
      reset.className = 'ti-reset';
      reset.textContent = 'Reset';
      reset.addEventListener('click', (e) => {
        e.stopPropagation();
        context.onReset();
      });
      actions.appendChild(reset);
    }

    const push = document.createElement('button');
    push.type = 'button';
    push.className = 'ti-push';
    push.textContent = `Push ${count} change${count === 1 ? '' : 's'}`;
    push.addEventListener('click', async (e) => {
      e.stopPropagation();
      push.disabled = true;
      push.textContent = 'Pushing…';
      setPushStatus('Writing CSS files…', null);
      const result = await pushEditsToWriter(listPendingEdits());
      if (result.ok) {
        setPushStatus(
          `${result.message}${result.written?.length ? `: ${result.written.join(', ')}` : ''}`,
          'ok'
        );
        context?.onPushed?.();
      } else {
        setPushStatus(
          result.detail ? `${result.message} — ${result.detail}` : result.message,
          'error'
        );
        push.disabled = false;
        push.textContent = `Push ${overrideCount()} change${overrideCount() === 1 ? '' : 's'}`;
      }
    });
    actions.appendChild(push);
    hint.appendChild(actions);
  }

  // Clear previous status line
  current.panel.querySelector('.ti-push-status')?.remove();

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
      const displayProp = applyOverrideToProp(prop, group.selector, context?.registry);
      section.appendChild(renderProperty(displayProp, group));
    }

    body.appendChild(section);
  }
}

function setPushStatus(text, kind) {
  const panel = document.querySelector(`#${ROOT_ID} .ti-panel`);
  if (!panel) return;
  let status = panel.querySelector('.ti-push-status');
  if (!status) {
    status = document.createElement('div');
    status.className = 'ti-push-status';
    const hint = panel.querySelector('.ti-hint');
    hint?.insertAdjacentElement('afterend', status);
  }
  status.textContent = text;
  status.classList.remove('error', 'ok');
  if (kind) status.classList.add(kind);
}

function groupFileMeta(group) {
  const sourcePath = group.sourcePath || '';
  let file = group.file || '';
  if (sourcePath.startsWith('src/')) {
    file = `apps/frontend/${sourcePath}`;
  } else if (file && file !== 'inline' && file.endsWith('.css') && !file.includes('/')) {
    // Basename only — writer can resolve via allowlisted index
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
    sourcePath,
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
    file: normalizeTokenFile(entry?.file || ''),
    registry: panelContext.registry,
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
    if (normalized.startsWith('#') || /^rgb/i.test(terminal)) {
      swatch = terminal;
    }
  } else if (/^#|^rgb/i.test(overridden) || overridden === 'transparent') {
    swatch = overridden;
  }

  return {
    ...prop,
    _sourceValue: prop._sourceValue ?? prop.value,
    value: overridden,
    trees,
    swatch,
    hasTokens: trees.length > 0,
    preview: true,
  };
}

function renderProperty(prop, group) {
  const selector = group.selector;
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
    const head = document.createElement('div');
    head.style.display = 'flex';
    head.style.alignItems = 'center';
    head.style.gap = '4px';

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
    // For grid tracks, show the full template (ratios + vars), not only the first token
    chip.textContent = prefersFullValueEdit(prop.property)
      ? prop.value
      : extractVarRefs(prop.value)[0] || primary.name;
    chip.title = prop.value;
    if (prefersFullValueEdit(prop.property)) {
      chip.style.maxWidth = '220px';
    }
    btn.appendChild(chip);

    const chevron = document.createElement('span');
    chevron.className = 'ti-chevron';
    chevron.textContent = '▸';
    btn.appendChild(chevron);

    if (prop.preview) {
      const badge = document.createElement('span');
      badge.className = 'ti-preview-badge';
      badge.textContent = 'preview';
      head.appendChild(badge);
    }

    const tree = document.createElement('div');
    tree.className = 'ti-tree';
    for (const node of prop.trees) {
      tree.appendChild(renderTreeNode(node, 0));
    }

    btn.addEventListener('click', () => {
      const open = tree.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    head.appendChild(btn);

    // Full-value edit for grid templates (ratios / tracks), even when a var() is present
    const valueEditor = getPropertyValueEditor(prop.property);
    if (prefersFullValueEdit(prop.property) && valueEditor) {
      const tracksEdit = document.createElement('button');
      tracksEdit.type = 'button';
      tracksEdit.className = 'ti-edit';
      tracksEdit.title = 'Edit grid tracks / ratios';
      tracksEdit.textContent = '✎';
      tracksEdit.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        mountValueEditor(valueCell, {
          currentValue: prop.value,
          options: withCurrentGridOption(valueEditor.options, prop.value),
          allowCustom: true,
          valueKind: 'text',
          placeholder: 'e.g. 2.5rem 2fr 4fr 1fr',
          onCommit: (next) => commitPropertyEdit(group, prop, next),
        });
      });
      head.appendChild(tracksEdit);
    } else {
      const propEdit = editableTargetForProperty(prop);
      if (propEdit && panelContext?.registry) {
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'ti-edit';
        editBtn.title = `Reassign ${propEdit.optionLayer} token`;
        editBtn.textContent = '✎';
        editBtn.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          tree.classList.add('open');
          btn.setAttribute('aria-expanded', 'true');

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
              const nextValue =
                refs.length > 0
                  ? replaceVarRef(prop.value, fromRef, tokenName)
                  : `var(${tokenName})`;
              commitPropertyEdit(group, prop, nextValue);
            },
          });
        });
        head.appendChild(editBtn);
      }
    }

    valueCell.appendChild(head);
    valueCell.appendChild(tree);
  } else {
    const literalRow = document.createElement('div');
    literalRow.className = 'ti-literal-row';

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
    literalRow.appendChild(literal);

    if (prop.preview) {
      const badge = document.createElement('span');
      badge.className = 'ti-preview-badge';
      badge.textContent = 'preview';
      literalRow.appendChild(badge);
    }

    const valueEditor = getPropertyValueEditor(prop.property);
    if (valueEditor) {
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'ti-edit';
      editBtn.title =
        valueEditor.mode === 'keywords'
          ? `Change ${prop.property}`
          : `Edit ${prop.property}`;
      editBtn.textContent = '✎';
      editBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        mountValueEditor(valueCell, {
          currentValue: prop.value,
          options: valueEditor.options,
          allowCustom: valueEditor.mode !== 'keywords',
          valueKind:
            valueEditor.mode === 'color'
              ? 'color'
              : valueEditor.mode === 'size'
                ? 'length'
                : detectRawValueKind(prop.value),
          placeholder:
            valueEditor.mode === 'size'
              ? 'e.g. 90%, fit-content, 2rem'
              : `New ${prop.property} value`,
          onCommit: (next) => commitPropertyEdit(group, prop, next),
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

  const nodeEdit = editableTargetForNode(node);
  if (nodeEdit && panelContext?.registry) {
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'ti-edit';
    editBtn.title =
      nodeEdit.optionLayer === 'primitive'
        ? 'Reassign primitive'
        : 'Reassign semantic';
    editBtn.textContent = '✎';
    editBtn.addEventListener('click', (event) => {
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
        onPick: (tokenName) => {
          const declared =
            panelContext.registry.get(nodeEdit.tokenName)?.value ||
            `var(${nodeEdit.currentRef})`;
          commitTokenEdit(nodeEdit.tokenName, declared, `var(${tokenName})`);
        },
      });
    });
    line.appendChild(editBtn);
  }

  // Edit raw primitive values (hex, rem, etc.)
  if (node.layer === 'primitive' && node.terminal && panelContext?.registry) {
    const rawEdit = document.createElement('button');
    rawEdit.type = 'button';
    rawEdit.className = 'ti-edit';
    rawEdit.title = 'Edit raw value';
    rawEdit.textContent = '✎';
    rawEdit.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const kind = detectRawValueKind(node.value);
      mountValueEditor(wrap, {
        currentValue: node.value,
        options: kind === 'length' ? ['0', '0.25rem', '0.5rem', '1rem', '1.5rem', '2rem', '2.5rem', '3rem', '4rem'] : [],
        allowCustom: true,
        valueKind: kind,
        placeholder: kind === 'color' ? '#hex or rgb()' : kind === 'length' ? 'e.g. 1rem, 16px' : 'Raw value',
        onCommit: (next) => {
          const declared = panelContext.registry.get(node.name)?.value || node.value;
          commitTokenEdit(node.name, declared, next);
        },
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
