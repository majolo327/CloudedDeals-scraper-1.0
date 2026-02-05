'use client';

import { supabase } from './supabase';

const USER_ID_KEY = 'clouded_user_id';

/**
 * Generate a random anonymous user ID (UUID v4-like).
 */
function generateUserId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Retrieve the existing anonymous user ID from localStorage, or
 * generate and persist a new one.
 */
export function getOrCreateUserId(): string {
  if (typeof window === 'undefined') return '';

  let userId = localStorage.getItem(USER_ID_KEY);
  if (!userId) {
    userId = generateUserId();
    localStorage.setItem(USER_ID_KEY, userId);
  }
  return userId;
}

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
  | 'deal_view'
  | 'deal_save'
  | 'deal_dismiss'
  | 'deal_click'
  | 'search'
  | 'filter_change';

/**
 * Fire-and-forget event tracking. Inserts a row into user_events via
 * the Supabase anon client. Failures are silently ignored.
 */
export function trackEvent(
  eventType: EventType,
  dealId?: string,
  metadata?: Record<string, unknown>
): void {
  const userId = getOrCreateUserId();
  if (!userId) return;

  fireAndForget(() =>
    supabase?.from('user_events')?.insert({
      user_id: userId,
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
  const userId = getOrCreateUserId();
  if (!userId) return;

  fireAndForget(() =>
    supabase?.from('user_saved_deals')?.insert({ user_id: userId, deal_id: dealId })
  );
}

/**
 * Remove a deal from user_saved_deals (unsave).
 */
export function trackUnsavedDeal(dealId: string): void {
  const userId = getOrCreateUserId();
  if (!userId) return;

  fireAndForget(() =>
    supabase?.from('user_saved_deals')?.delete()?.eq('user_id', userId)?.eq('deal_id', dealId)
  );
}

/**
 * Record a dismissed deal.
 */
export function trackDismissedDeal(dealId: string): void {
  const userId = getOrCreateUserId();
  if (!userId) return;

  fireAndForget(() =>
    supabase?.from('user_dismissed_deals')?.insert({ user_id: userId, deal_id: dealId })
  );
}

/**
 * Register or update the user session (first_seen / last_seen).
 * Called once on page load.
 */
export function touchSession(): void {
  const userId = getOrCreateUserId();
  if (!userId) return;

  const zip = localStorage.getItem('clouded_zip') ?? null;

  fireAndForget(() =>
    supabase?.from('user_sessions')?.upsert(
      {
        user_id: userId,
        zip_code: zip,
        last_seen: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
  );
}
