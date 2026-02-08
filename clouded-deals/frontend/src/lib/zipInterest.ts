'use client';

import { supabase } from './supabase';
import { getCannabisStatus } from '@/utils/cannabisLegality';
import { trackEvent } from './analytics';

/**
 * Log a zip code interest entry to the zip_interest_log table.
 * Fire-and-forget — failures are silently ignored.
 */
export function logZipInterest(
  zip: string,
  stateCode: string,
  email?: string
): void {
  const status = getCannabisStatus(stateCode);

  trackEvent('zip_interest_logged', undefined, {
    zip,
    state: stateCode,
    cannabis_status: status,
    has_email: !!email,
  });

  try {
    const row: Record<string, unknown> = {
      zip_code: zip,
      state_code: stateCode,
      cannabis_status: status,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      referrer: typeof document !== 'undefined' ? document.referrer || null : null,
    };
    if (email) row.email = email;

    const result = supabase?.from('zip_interest_log')?.insert(row);
    if (result) Promise.resolve(result).catch(() => {});
  } catch {
    // silently ignore
  }
}
