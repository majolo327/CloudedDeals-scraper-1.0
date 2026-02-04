import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Public client — safe for browser / client components.
// Uses the anon key which is restricted by RLS policies.
//
// Lazily initialised so the module can be imported at build time without
// crashing when NEXT_PUBLIC_SUPABASE_URL is not yet set.
// ---------------------------------------------------------------------------

let _supabase: SupabaseClient | null = null;

/** True when Supabase env vars are configured. */
export const isSupabaseConfigured =
  typeof process !== "undefined" &&
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return _supabase;
}

/** Convenience alias — lazily creates the public client on first access.
 *  Returns `undefined` for any property when env vars are missing. */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getSupabase();
    if (!client) return undefined;
    return Reflect.get(client, prop, receiver);
  },
});

// ---------------------------------------------------------------------------
// Service client — server-side only (API routes, server components).
// Uses the service-role key which bypasses RLS.  NEVER expose to the browser.
// ---------------------------------------------------------------------------

export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set"
    );
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}
