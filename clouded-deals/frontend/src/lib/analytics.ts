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
  | 'error'
  | 'slow_load'
  | 'onboarding_completed'
  | 'onboarding_skipped'
  | 'onboarding_screen_viewed'
  | 'onboarding_email_captured'
  | 'zip_email_capture'
  | 'zip_interest_logged';

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
 * Initialize anonymous user on app load. Sets up the anon_id,
 * registers/updates the session, and starts heartbeat tracking.
 */
export function initializeAnonUser(): void {
  const anonId = getOrCreateAnonId();
  if (!anonId) return;
  _sessionStartTime = Date.now();
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
 * Called once on page load.
 */
export function touchSession(): void {
  const anonId = getOrCreateAnonId();
  if (!anonId) return;

  const zip = localStorage.getItem('clouded_zip') ?? null;

  fireAndForget(() =>
    supabase?.from('user_sessions')?.upsert(
      {
        user_id: anonId,
        zip_code: zip,
        last_seen: new Date().toISOString(),
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
