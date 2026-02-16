'use client';

import { supabase } from './supabase';
import { getOrCreateAnonId } from './analytics';

/**
 * Send a magic link email via Supabase Auth.
 */
export async function sendMagicLink(email: string): Promise<{ error: string | null }> {
  const client = supabase;
  if (!client?.auth) return { error: 'Supabase not configured' };

  const { error } = await client.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  if (error) return { error: error.message };
  return { error: null };
}

/**
 * Get the current authenticated user (if any).
 */
export async function getAuthUser() {
  const client = supabase;
  if (!client?.auth) return null;

  const { data } = await client.auth.getUser();
  return data?.user ?? null;
}

/**
 * Sign out the current user.
 */
export async function signOut() {
  const client = supabase;
  if (!client?.auth) return;
  await client.auth.signOut();
}

/**
 * Merge anonymous tracking data to the authenticated user account.
 * Updates analytics_events, user_saved_deals, user_events, and user_sessions
 * so the anon_id data is linked to the real user_id.
 */
export async function mergeAnonData(userId: string): Promise<void> {
  const client = supabase;
  if (!client) return;

  const anonId = getOrCreateAnonId();
  if (!anonId) return;

  try {
    // Link analytics_events to authenticated user
    await client
      .from('analytics_events')
      .update({ user_id: userId })
      .eq('anon_id', anonId)
      .is('user_id', null);

    // Migrate user_saved_deals from anon_id to auth user_id
    await client
      .from('user_saved_deals')
      .update({ user_id: userId })
      .eq('user_id', anonId);

    // Migrate user_events
    await client
      .from('user_events')
      .update({ user_id: userId })
      .eq('user_id', anonId);

    // Migrate user_sessions
    await client
      .from('user_sessions')
      .update({ user_id: userId })
      .eq('user_id', anonId);

    // Also sync current localStorage saved deals to the DB
    const savedRaw = localStorage.getItem('clouded_saved_v1');
    if (savedRaw) {
      const savedIds: string[] = JSON.parse(savedRaw);
      for (const dealId of savedIds) {
        await client
          .from('user_saved_deals')
          .upsert(
            { user_id: userId, deal_id: dealId },
            { onConflict: 'user_id,deal_id' }
          );
      }
    }
  } catch {
    // Best effort — don't block the user flow
  }
}

