const STORAGE_KEY = 'tokenInspectEnabled';

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
    // inject below
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.bundle.js'],
    });
    await new Promise((resolve) => setTimeout(resolve, 200));
    return true;
  } catch (err) {
    console.error('[Token Inspect] inject failed', err);
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
    console.error('[Token Inspect] message failed', err);
    return { error: 'message-failed' };
  }
}

function setStatus(text) {
  document.getElementById('status').textContent = text;
}

async function refresh() {
  const { [STORAGE_KEY]: enabled = false } = await chrome.storage.local.get(STORAGE_KEY);
  const toggleBtn = document.getElementById('toggle-btn');
  toggleBtn.textContent = enabled ? 'Stop inspect' : 'Start inspect';
  toggleBtn.classList.toggle('active', enabled);

  const mode = document.getElementById('mode-status');
  mode.textContent = enabled ? 'On' : 'Off';
  mode.classList.toggle('on', enabled);

  const tab = await getActiveTab();
  if (!tab?.url || !isLocalDevUrl(tab.url)) {
    document.getElementById('token-count').textContent = '—';
    setStatus('Open http://localhost:5173, then start inspect.');
    return;
  }

  const result = await sendToTab({ type: 'GET_STATUS' });
  if (!result || result.error) {
    document.getElementById('token-count').textContent = '—';
    setStatus('Refresh the dev page, then try again.');
    return;
  }

  document.getElementById('token-count').textContent = String(result.tokens ?? '—');
  setStatus(
    enabled
      ? result.selected
        ? `Selected ${result.selected} — expand tokens in the panel`
        : 'Crosshair on — click any element on the page'
      : 'Start inspect, then click an element to see its token tree'
  );
}

document.getElementById('toggle-btn').addEventListener('click', async () => {
  const { [STORAGE_KEY]: enabled = false } = await chrome.storage.local.get(STORAGE_KEY);
  const next = !enabled;
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  await sendToTab({ type: next ? 'ENABLE' : 'DISABLE' });
  // Popup closes often after click; refresh if still open
  await refresh();
});

refresh();
