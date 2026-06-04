import mixpanel from 'mixpanel-browser';

const TOKEN = import.meta.env.VITE_MIXPANEL_TOKEN as string | undefined;
/** Slim SVG project uses EU data residency — must not use the default US ingestion host. */
const API_HOST = 'https://api-eu.mixpanel.com';
const ENABLED = import.meta.env.PROD && Boolean(TOKEN);

let initialized = false;

export function initAnalytics(): void {
  if (!ENABLED || initialized) return;

  mixpanel.init(TOKEN!, {
    api_host: API_HOST,
    autocapture: false,
    track_pageview: false,
    persistence: 'localStorage',
    ignore_dnt: false,
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
