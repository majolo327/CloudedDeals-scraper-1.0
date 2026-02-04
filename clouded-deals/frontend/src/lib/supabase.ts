import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Public client — safe for browser / client components.
// Uses the anon key which is restricted by RLS policies.
//
// Lazily initialised so the module can be imported at build time without
// crashing when NEXT_PUBLIC_SUPABASE_URL is not yet set.
// ---------------------------------------------------------------------------

let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error(
        "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set"
      );
    }
    _supabase = createClient(url, key);
  }
  return _supabase;
}

/** Convenience alias — lazily creates the public client on first access. */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getSupabase(), prop, receiver);
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
