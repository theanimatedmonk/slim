const ROOT_ID = 'slimvg-token-audit-root';
const STYLE_ID = 'slimvg-token-audit-style';

/** @type {{ slides: Array<any>, index: number, reposition: () => void } | null} */
let state = null;

export function clearOverlay() {
  const root = document.getElementById(ROOT_ID);
  root?._cleanup?.();
  document.getElementById(ROOT_ID)?.remove();
  document.getElementById(STYLE_ID)?.remove();
  state = null;
}

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
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
    color: 'Color',
    'background-color': 'Background color',
    'border-color': 'Border color',
    padding: 'Padding',
    margin: 'Margin',
    gap: 'Gap',
    width: 'Width',
    height: 'Height',
    'font-size': 'Font size',
    'border-radius': 'Border radius',
    'z-index': 'Z-index',
    'box-shadow': 'Box shadow',
  };
  if (labels[property]) return labels[property];
  if (property?.startsWith('--')) return property;
  return (property ?? 'Value')
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function humanRuleLabel(rule, value) {
  switch (rule) {
    case 'no-naked-color':
      if (/#([0-9a-f]{3,8})\b/i.test(value)) return 'Hard coded HEX value';
      if (/rgba?\(/i.test(value)) return 'Hard coded rgb value';
      return 'Hard coded color value';
    case 'no-naked-length':
      if (/\d+px\b/.test(value)) return 'Hard coded px value';
      if (/\d+rem\b/.test(value)) return 'Hard coded rem value';
      if (/\d+em\b/.test(value)) return 'Hard coded em value';
      return 'Hard coded size value';
    case 'no-primitive-in-component':
      return 'Primitive token leak';
    case 'no-naked-z-index':
      return 'Hard coded z-index';
    case 'unknown-color':
      return 'Off-palette color';
    default:
      return 'Token violation';
  }
}

function formatDetail(property, value) {
  const trimmed = value.trim();
  if (property === 'color' || property?.includes('color')) {
    const colorMatch = trimmed.match(/#[0-9a-f]{3,8}\b|rgba?\([^)]+\)/i);
    if (colorMatch) return `${humanProperty(property)} is ${colorMatch[0]}`;
  }
  const lengthMatch = trimmed.match(/\d*\.?\d+(px|rem|em)\b/);
  if (lengthMatch && /padding|margin|gap|width|height|font-size|radius/i.test(property ?? '')) {
    return `${humanProperty(property)} is ${lengthMatch[0]}`;
  }
  return `${humanProperty(property)} is ${trimmed}`;
}

/**
 * @param {Array<any>} findings
 */
function buildSlides(findings) {
  const slides = [];
  const sorted = [...findings].sort((a, b) => {
    if (a.severity === b.severity) return 0;
    return a.severity === 'error' ? -1 : 1;
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
  let placement = 'bottom';

  if (top + calloutRect.height > viewportH - margin) {
    top = rect.top - calloutRect.height - margin;
    placement = 'top';
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
  callout.style.setProperty('--ta-arrow-left', `${arrowLeft}px`);
}

function showSlide(index) {
  if (!state || state.slides.length === 0) return;

  const total = state.slides.length;
  state.index = ((index % total) + total) % total;
  const { finding, element } = state.slides[state.index];

  const root = document.getElementById(ROOT_ID);
  if (!root) return;

  const spotlight = root.querySelector('.ta-spotlight');
  const callout = root.querySelector('.ta-callout');
  if (!spotlight || !callout) return;

  element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });

  requestAnimationFrame(() => {
    const rect = positionSpotlight(spotlight, element);
    positionCallout(callout, rect);

    const kind = finding.severity === 'error' ? 'Error' : 'Warning';
    callout.className = `ta-callout ${finding.severity}`;
    callout.querySelector('.ta-detail').textContent = formatDetail(finding.property, finding.value);
    callout.querySelector('.ta-label').textContent = humanRuleLabel(finding.rule, finding.value);
    callout.querySelector('.ta-counter').textContent = `${kind} ${state.index + 1}/${total}`;

    const prevBtn = callout.querySelector('.ta-prev');
    const nextBtn = callout.querySelector('.ta-next');
    prevBtn.disabled = state.index === 0;
    nextBtn.disabled = state.index === total - 1;
  });
}

function onKeyDown(event) {
  if (!state) return;
  if (event.key === 'ArrowRight') {
    event.preventDefault();
    showSlide(state.index + 1);
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault();
    showSlide(state.index - 1);
  }
}

/**
 * @param {Array<any>} findings
 * @param {number} [startIndex]
 */
export function renderOverlay(findings, startIndex = 0) {
  clearOverlay();
  ensureStyles();

  const slides = buildSlides(findings);
  const root = document.createElement('div');
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
          <button type="button" class="ta-nav-btn ta-prev" aria-label="Previous finding">←</button>
          <button type="button" class="ta-nav-btn ta-next" aria-label="Next finding">→</button>
        </div>
      </div>
    </div>
  `;

  document.documentElement.appendChild(root);

  const callout = root.querySelector('.ta-callout');
  callout.querySelector('.ta-prev').addEventListener('click', () => showSlide(state.index - 1));
  callout.querySelector('.ta-next').addEventListener('click', () => showSlide(state.index + 1));

  const reposition = () => {
    if (!state) return;
    const { element } = state.slides[state.index];
    const spotlight = root.querySelector('.ta-spotlight');
    const calloutEl = root.querySelector('.ta-callout');
    if (!spotlight || !calloutEl || !element.isConnected) return;
    const rect = positionSpotlight(spotlight, element);
    positionCallout(calloutEl, rect);
  };

  state = { slides, index: startIndex, reposition };

  const observer = new ResizeObserver(reposition);
  observer.observe(document.documentElement);
  window.addEventListener('scroll', reposition, true);
  window.addEventListener('resize', reposition);
  window.addEventListener('keydown', onKeyDown);

  root._cleanup = () => {
    observer.disconnect();
    window.removeEventListener('scroll', reposition, true);
    window.removeEventListener('resize', reposition);
    window.removeEventListener('keydown', onKeyDown);
  };

  showSlide(startIndex);
}
