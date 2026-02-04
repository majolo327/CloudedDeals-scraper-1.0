import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Public client — safe for browser / client components.
// Uses the anon key which is restricted by RLS policies.
// ---------------------------------------------------------------------------

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ---------------------------------------------------------------------------
// Service client — server-side only (API routes, server components).
// Uses the service-role key which bypasses RLS.  NEVER expose to the browser.
// ---------------------------------------------------------------------------

export function createServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set — service client is server-only"
    );
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}
