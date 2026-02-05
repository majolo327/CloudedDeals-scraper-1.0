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
  | 'deal_viewed'
  | 'deal_saved'
  | 'deal_shared'
  | 'deal_dismissed'
  | 'search_performed'
  | 'category_filtered'
  | 'deal_view'
  | 'deal_save'
  | 'deal_dismiss'
  | 'deal_click'
  | 'search'
  | 'filter_change';

/**
 * Initialize anonymous user on app load. Sets up the anon_id and
 * registers/updates the session.
 */
export function initializeAnonUser(): void {
  const anonId = getOrCreateAnonId();
  if (!anonId) return;
  touchSession();
}

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
