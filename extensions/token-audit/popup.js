const STORAGE_KEY = 'tokenAuditEnabled';

function isLocalDevUrl(url) {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
    );
  } catch {
    return false;
  }
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function ensureContentScript(tab) {
  if (!tab?.id || !isLocalDevUrl(tab.url ?? '')) return false;

  try {
    const pong = await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
    if (pong?.ok) return true;
  } catch {
    // Content script not loaded yet — inject below.
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.bundle.js'],
    });
    await new Promise((resolve) => setTimeout(resolve, 200));
    return true;
  } catch (err) {
    console.error('[Token Audit] inject failed', err);
    return false;
  }
}

async function sendToTab(message) {
  const tab = await getActiveTab();
  if (!tab?.id) return { error: 'no-tab' };

  if (!isLocalDevUrl(tab.url ?? '')) {
    return { error: 'not-localhost', url: tab.url ?? '' };
  }

  const ready = await ensureContentScript(tab);
  if (!ready) return { error: 'inject-failed' };

  try {
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch (err) {
    console.error('[Token Audit] message failed', err);
    return { error: 'message-failed' };
  }
}

function setStatus(text) {
  document.getElementById('status').textContent = text;
}

function setCounts(errors, warnings) {
  document.getElementById('error-count').textContent = String(errors);
  document.getElementById('warn-count').textContent = String(warnings);
}

async function refresh() {
  const { [STORAGE_KEY]: enabled = false } = await chrome.storage.local.get(STORAGE_KEY);
  const toggleBtn = document.getElementById('toggle-btn');
  toggleBtn.textContent = enabled ? 'Disable overlay' : 'Enable overlay';
  toggleBtn.classList.toggle('active', enabled);

  const tab = await getActiveTab();
  if (!tab?.url || !isLocalDevUrl(tab.url)) {
    setCounts('—', '—');
    setStatus('Open http://localhost:5173 (your dev app), then click the extension again.');
    return;
  }

  const result = await sendToTab({ type: enabled ? 'SCAN' : 'GET_SUMMARY' });

  if (!result || result.error) {
    setCounts('—', '—');
    if (result?.error === 'inject-failed') {
      setStatus('Could not inject on this page — refresh the tab and try again.');
    } else {
      setStatus('Refresh the dev page, then click Rescan page.');
    }
    return;
  }

  setCounts(result.errors ?? 0, result.warnings ?? 0);
  setStatus(
    enabled
      ? `${result.total ?? 0} finding(s) — use ← → on page to step through`
      : 'Overlay off — enable to walk through violations'
  );
}

document.getElementById('toggle-btn').addEventListener('click', async () => {
  const { [STORAGE_KEY]: enabled = false } = await chrome.storage.local.get(STORAGE_KEY);
  const next = !enabled;
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  await sendToTab({ type: next ? 'ENABLE' : 'DISABLE' });
  await refresh();
});

document.getElementById('rescan-btn').addEventListener('click', async () => {
  await sendToTab({ type: 'SCAN' });
  await refresh();
});

refresh();
