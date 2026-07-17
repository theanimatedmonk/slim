import { disableInspect, enableInspect, getStatus, initFromStorage } from './inspector.js';

if (!globalThis.__slimvgTokenInspectLoaded) {
  globalThis.__slimvgTokenInspectLoaded = true;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const handle = async () => {
      switch (message.type) {
        case 'PING':
          return { ok: true };
        case 'ENABLE':
          return enableInspect();
        case 'DISABLE':
          return disableInspect();
        case 'GET_STATUS':
          return getStatus();
        default:
          return null;
      }
    };

    handle()
      .then(sendResponse)
      .catch((err) => {
        console.error('[Token Inspect]', err);
        sendResponse({ error: String(err) });
      });
    return true;
  });

  initFromStorage();
}
