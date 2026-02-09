'use client';

import { supabase, isSupabaseConfigured } from './supabase';
import { getOrCreateAnonId } from './analytics';

/** Generate a short alphanumeric ID (8 chars). */
function shortId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

/** Get midnight Pacific Time tonight as an ISO string. */
function getMidnightPT(): string {
  const now = new Date();
  // Get current time in Pacific
  const ptStr = now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
  const pt = new Date(ptStr);
  // Set to midnight tonight
  pt.setDate(pt.getDate() + 1);
  pt.setHours(0, 0, 0, 0);
  // Convert back: compute offset between local midnight PT and UTC
  const midnightPTStr = pt.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
  const midnightPT = new Date(midnightPTStr);
  const offset = pt.getTime() - midnightPT.getTime();
  return new Date(pt.getTime() + offset).toISOString();
}

export interface CreateShareResult {
  shareId: string | null;
  shareUrl: string | null;
  error: string | null;
}

/**
 * Create a shareable saves snapshot.
 * Stores deal IDs in Supabase and returns a short share URL.
 */
export async function createShareLink(dealIds: string[]): Promise<CreateShareResult> {
  if (!isSupabaseConfigured || dealIds.length === 0) {
    return { shareId: null, shareUrl: null, error: 'No deals to share' };
  }

  const id = shortId();
  const anonId = getOrCreateAnonId();
  const expiresAt = getMidnightPT();

  try {
    const { error } = await supabase
      .from('shared_saves')
      .insert({
        id,
        anon_id: anonId,
        deal_ids: dealIds,
        expires_at: expiresAt,
      });

    if (error) throw error;

    const baseUrl = typeof window !== 'undefined'
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_SITE_URL || 'https://cloudeddeals.com');

    return {
      shareId: id,
      shareUrl: `${baseUrl}/saves/${id}`,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create share link';
    return { shareId: null, shareUrl: null, error: message };
  }
}

/**
 * Fetch a shared saves record by ID.
 */
export async function fetchSharedSaves(shareId: string) {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase
    .from('shared_saves')
    .select('*')
    .eq('id', shareId)
    .single();

  if (error || !data) return null;

  // Increment view count (fire and forget)
  supabase
    .from('shared_saves')
    .update({ view_count: (data.view_count || 0) + 1 })
    .eq('id', shareId)
    .then(() => {});

  return data as {
    id: string;
    anon_id: string;
    deal_ids: string[];
    created_at: string;
    expires_at: string;
    view_count: number;
  };
}
