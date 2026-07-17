import { collectMatchedStyles, elementLabel } from './collect-styles.js';
import { loadTokenRegistry } from './tokens.js';
import {
  clearInspectorUi,
  ensureInspectorUi,
  hidePanel,
  reposition,
  setHoverTarget,
  setOnClose,
  setSelectTarget,
  showInspectPanel,
} from './panel.js';

const STORAGE_KEY = 'tokenInspectEnabled';

/** @type {Map<string, { value: string, file: string, layer: string }> | null} */
let tokenRegistry = null;
let enabled = false;
/** @type {Element | null} */
let selectedEl = null;
/** @type {Element | null} */
let hoverEl = null;

function isOurUi(el) {
  return Boolean(el?.closest?.('#slimvg-token-inspect-root'));
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
  if (event.key === 'Escape') {
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
    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    document.documentElement.style.cursor = 'crosshair';
    await ensureRegistry();
  } else {
    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('scroll', onScrollOrResize, true);
    window.removeEventListener('resize', onScrollOrResize);
    document.documentElement.style.cursor = '';
    selectedEl = null;
    hoverEl = null;
    hidePanel();
    clearInspectorUi();
  }
}

export function getStatus() {
  return {
    enabled,
    selected: selectedEl ? elementLabel(selectedEl) : null,
    tokens: tokenRegistry?.size ?? 0,
  };
}

export async function enableInspect() {
  await setEnabled(true);
  return getStatus();
}

export async function disableInspect() {
  await setEnabled(false);
  return getStatus();
}

export async function initFromStorage() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  if (result[STORAGE_KEY]) {
    await setEnabled(true);
  }
}
