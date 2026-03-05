'use client';

import { supabase } from './supabase';

const ANON_ID_KEY = 'clouded_anon_id';

/**
 * Generate a random anonymous user ID (UUID v4-like).
 */
function generateAnonId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Retrieve the existing anonymous user ID from localStorage, or
 * generate and persist a new one.
 */
export function getOrCreateAnonId(): string {
  if (typeof window === 'undefined') return '';

  let anonId = localStorage.getItem(ANON_ID_KEY);
  if (!anonId) {
    anonId = generateAnonId();
    localStorage.setItem(ANON_ID_KEY, anonId);
  }
  return anonId;
}

// Keep backward-compatible alias
export const getOrCreateUserId = getOrCreateAnonId;

/** Wrap Supabase PromiseLike into a real Promise for safe fire-and-forget. */
function fireAndForget(fn: () => PromiseLike<unknown> | undefined): void {
  try {
    const result = fn();
    if (result) Promise.resolve(result).catch(() => {});
  } catch {
    // ignore
  }
}

export type EventType =
  | 'app_loaded'
  | 'page_view'
  | 'deal_viewed'
  | 'deal_saved'
  | 'deal_shared'
  | 'deal_dismissed'
  | 'deal_modal_open'
  | 'get_deal_click'
  | 'search_performed'
  | 'category_filtered'
  | 'deal_view'
  | 'deal_save'
  | 'deal_dismiss'
  | 'deal_click'
  | 'search'
  | 'filter_change'
  | 'referral_click'
  | 'referral_conversion'
  | 'daily_visit'
  | 'session_heartbeat'
  | 'challenge_completed'
  | 'error'
  | 'slow_load'
  | 'onboarding_completed'
  | 'onboarding_skipped'
  | 'onboarding_screen_viewed'
  | 'onboarding_email_captured'
  | 'zip_email_capture'
  | 'zip_interest_logged'
  | 'share_saves'
  | 'shared_page_view'
  | 'shared_get_deal_click'
  | 'shared_page_cta'
  | 'user_feedback'
  | 'dispensary_deals_expanded'
  | 'campaign_landing';

/**
 * Collect device and context metadata (non-PII) for analytics enrichment.
 */
function getDeviceContext(): Record<string, unknown> {
  if (typeof window === 'undefined') return {};
  return {
    screen: `${window.screen.width}x${window.screen.height}`,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    device_type: window.innerWidth < 768 ? 'mobile' : window.innerWidth < 1024 ? 'tablet' : 'desktop',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
  };
}

let _sessionStartTime = 0;
let _heartbeatInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Parse UTM parameters from the current URL.
 * Returns null if no UTM params are present.
 */
function parseUtmParams(): Record<string, string> | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  for (const key of keys) {
    const val = params.get(key);
    if (val) utm[key] = val;
  }
  return Object.keys(utm).length > 0 ? utm : null;
}

/**
 * Detect acquisition source from document.referrer when no UTM params are present.
 * Maps known referrer domains to human-readable channel names.
 */
function detectReferrerSource(): Record<string, string> | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  const ref = document.referrer;
  if (!ref) return null; // Direct visit — no referrer

  try {
    const hostname = new URL(ref).hostname.toLowerCase();

    // Twitter / X
    if (hostname === 't.co' || hostname === 'x.com' || hostname.endsWith('.x.com') ||
        hostname === 'twitter.com' || hostname.endsWith('.twitter.com')) {
      return { utm_source: 'twitter', utm_medium: 'social', utm_campaign: 'x_profile' };
    }
    // Facebook / Instagram / Meta
    if (hostname === 'l.facebook.com' || hostname === 'lm.facebook.com' ||
        hostname.endsWith('facebook.com') || hostname.endsWith('fb.com') ||
        hostname.endsWith('instagram.com')) {
      return { utm_source: 'facebook', utm_medium: 'social', utm_campaign: 'meta' };
    }
    // Google (organic search)
    if (hostname.endsWith('google.com') || hostname.endsWith('google.co')) {
      return { utm_source: 'google', utm_medium: 'organic', utm_campaign: 'search' };
    }
    // Reddit
    if (hostname.endsWith('reddit.com') || hostname === 'old.reddit.com') {
      return { utm_source: 'reddit', utm_medium: 'social', utm_campaign: 'reddit' };
    }
    // Known referrer but not a major platform — track the domain
    return { utm_source: hostname, utm_medium: 'referral', utm_campaign: 'referral' };
  } catch {
    return null;
  }
}

/**
 * Persist acquisition source to localStorage on first visit.
 * Only the FIRST non-empty source wins (first-touch attribution).
 * Priority: UTM params > referrer detection > "direct"
 */
function persistAcquisitionSource(utm: Record<string, string>): void {
  if (typeof window === 'undefined') return;
  const existing = localStorage.getItem('clouded_acquisition_source');
  if (existing) return; // first-touch: never overwrite

  const source = utm.utm_source || 'direct';
  const medium = utm.utm_medium || '';
  const campaign = utm.utm_campaign || '';

  const acq = JSON.stringify({ source, medium, campaign, ts: new Date().toISOString() });
  localStorage.setItem('clouded_acquisition_source', acq);
}

/**
 * Get the stored acquisition source (for attaching to session upserts).
 */
export function getAcquisitionSource(): { source: string; medium: string; campaign: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('clouded_acquisition_source');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Initialize anonymous user on app load. Sets up the anon_id,
 * registers/updates the session, and starts heartbeat tracking.
 */
export function initializeAnonUser(): void {
  const anonId = getOrCreateAnonId();
  if (!anonId) return;
  _sessionStartTime = Date.now();

  // Capture acquisition source: UTM params > referrer detection > "direct"
  const utm = parseUtmParams();
  if (utm) {
    persistAcquisitionSource(utm);
  } else {
    const referrerSource = detectReferrerSource();
    if (referrerSource) {
      persistAcquisitionSource(referrerSource);
    } else {
      // Direct visit (typed URL, bookmark, no referrer)
      persistAcquisitionSource({ utm_source: 'direct', utm_medium: 'none', utm_campaign: '' });
    }
  }

  touchSession();
  startHeartbeat();
}

const isDev = typeof process !== 'undefined' && process.env.NODE_ENV === 'development';

/**
 * Fire-and-forget event tracking. Inserts a row into analytics_events
 * and the legacy user_events table. Failures are silently ignored.
 */
export function trackEvent(
  eventType: EventType,
  dealId?: string,
  metadata?: Record<string, unknown>
): void {
  const anonId = getOrCreateAnonId();
  if (!anonId) return;

  const properties = {
    ...(metadata ?? {}),
    ...(dealId ? { deal_id: dealId } : {}),
  };

  // Dev-mode console logging for debugging
  if (isDev) {
    console.log(`[analytics] ${eventType}`, dealId ?? '', properties);
  }

  // Write to analytics_events table
  fireAndForget(() =>
    supabase?.from('analytics_events')?.insert({
      anon_id: anonId,
      event_name: eventType,
      properties,
    })
  );

  // Also write to legacy user_events for backward compat
  fireAndForget(() =>
    supabase?.from('user_events')?.insert({
      user_id: anonId,
      event_type: eventType,
      deal_id: dealId ?? null,
      metadata: metadata ?? null,
    })
  );
}

/**
 * Track a page view with device context and referrer.
 */
export function trackPageView(page: string): void {
  trackEvent('page_view', undefined, {
    page,
    referrer: typeof document !== 'undefined' ? document.referrer : '',
    url: typeof window !== 'undefined' ? window.location.href : '',
    ...getDeviceContext(),
  });
}

/**
 * Track an outbound "Get Deal" click.
 */
export function trackGetDealClick(dealId: string, dispensaryName: string, url: string): void {
  trackEvent('get_deal_click', dealId, {
    dispensary: dispensaryName,
    outbound_url: url,
  });
}

/**
 * Track when a deal modal is opened.
 */
export function trackDealModalOpen(dealId: string, source: string): void {
  trackEvent('deal_modal_open', dealId, { source });
}

/**
 * Record a saved deal in user_saved_deals.
 */
export function trackSavedDeal(dealId: string): void {
  const anonId = getOrCreateAnonId();
  if (!anonId) return;

  fireAndForget(() =>
    supabase?.from('user_saved_deals')?.insert({ user_id: anonId, deal_id: dealId })
  );
}

/**
 * Remove a deal from user_saved_deals (unsave).
 */
export function trackUnsavedDeal(dealId: string): void {
  const anonId = getOrCreateAnonId();
  if (!anonId) return;

  fireAndForget(() =>
    supabase?.from('user_saved_deals')?.delete()?.eq('user_id', anonId)?.eq('deal_id', dealId)
  );
}

/**
 * Record a dismissed deal.
 */
export function trackDismissedDeal(dealId: string): void {
  const anonId = getOrCreateAnonId();
  if (!anonId) return;

  fireAndForget(() =>
    supabase?.from('user_dismissed_deals')?.insert({ user_id: anonId, deal_id: dealId })
  );
}

/**
 * Register or update the user session (first_seen / last_seen).
 * Called once on page load. Includes acquisition source for campaign tracking.
 */
export function touchSession(): void {
  const anonId = getOrCreateAnonId();
  if (!anonId) return;

  const zip = localStorage.getItem('clouded_zip') ?? null;
  const acq = getAcquisitionSource();

  fireAndForget(() =>
    supabase?.from('user_sessions')?.upsert(
      {
        user_id: anonId,
        zip_code: zip,
        last_seen: new Date().toISOString(),
        ...(acq ? {
          acquisition_source: acq.source,
          acquisition_medium: acq.medium,
          acquisition_campaign: acq.campaign,
        } : {}),
      },
      { onConflict: 'user_id' }
    )
  );
}

/**
 * Session heartbeat — fires every 60s to track session duration.
 * Keeps session alive in user_sessions and logs duration milestones.
 */
function startHeartbeat(): void {
  if (_heartbeatInterval) return;
  _heartbeatInterval = setInterval(() => {
    touchSession();
    const durationSec = Math.round((Date.now() - _sessionStartTime) / 1000);
    // Log duration milestones: 1m, 3m, 5m, 10m
    if ([60, 180, 300, 600].includes(durationSec)) {
      trackEvent('session_heartbeat', undefined, { duration_sec: durationSec });
    }
  }, 60_000);
}
