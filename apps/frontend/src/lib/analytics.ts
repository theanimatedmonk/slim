import mixpanel from 'mixpanel-browser';

const TOKEN = import.meta.env.VITE_MIXPANEL_TOKEN as string | undefined;
/** Slim SVG project uses EU data residency — must not use the default US ingestion host. */
const API_HOST = 'https://api-eu.mixpanel.com';
const RECORD_SESSIONS_PERCENT = parseReplayPercent(
  import.meta.env.VITE_MIXPANEL_RECORD_SESSIONS_PERCENT
);
const ENABLED = import.meta.env.PROD && Boolean(TOKEN);

function parseReplayPercent(raw: string | undefined): number {
  const value = raw === undefined || raw === '' ? 25 : Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 100) return 25;
  return value;
}

let initialized = false;

export function initAnalytics(): void {
  if (!ENABLED || initialized) return;

  mixpanel.init(TOKEN!, {
    api_host: API_HOST,
    autocapture: false,
    track_pageview: false,
    persistence: 'localStorage',
    ignore_dnt: false,
    /** Session Replay — % of sessions recorded (0–100). Default 25 to stay within free allowance. */
    record_sessions_percent: RECORD_SESSIONS_PERCENT,
    record_mask_all_text: true,
    record_mask_all_inputs: true,
    record_console: true,
  });

  initialized = true;
}

export function isAnalyticsEnabled(): boolean {
  return ENABLED && initialized;
}

export function track(
  event: string,
  properties?: Record<string, string | number | boolean | undefined>
): void {
  if (!isAnalyticsEnabled()) return;
  mixpanel.track(event, properties);
}

export function trackPageView(path: string): void {
  track('Page View', { path });
}

/** Links anonymous events to the signed-in Supabase user id. */
export function identifyUser(userId: string): void {
  if (!isAnalyticsEnabled()) return;
  mixpanel.identify(userId);
}

export function resetAnalytics(): void {
  if (!isAnalyticsEnabled()) return;
  mixpanel.reset();
}
