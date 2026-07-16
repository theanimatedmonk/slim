import { clearOverlay, renderOverlay } from './overlay.js';
import { scanPage, summarize } from './scanner.js';

if (globalThis.__slimvgTokenAuditLoaded) {
  // Bundled script may be injected more than once — keep the first instance only.
} else {
  globalThis.__slimvgTokenAuditLoaded = true;

  const STORAGE_KEY = 'tokenAuditEnabled';

  /** @type {Array<any>} */
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
      const root = document.getElementById('slimvg-token-audit-root');
      root?._cleanup?.();
      clearOverlay();
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const handle = async () => {
      switch (message.type) {
        case 'PING':
          return { ok: true };
        case 'ENABLE':
          await setEnabled(true);
          return summarize(lastFindings);
        case 'DISABLE':
          await setEnabled(false);
          return summarize(lastFindings);
        case 'SCAN':
          return runScan();
        case 'GET_SUMMARY':
          return summarize(lastFindings);
        default:
          return null;
      }
    };

    handle()
      .then(sendResponse)
      .catch((err) => {
        console.error('[Token Audit]', err);
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
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
