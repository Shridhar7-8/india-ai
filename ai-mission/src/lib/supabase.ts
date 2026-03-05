import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Lazy-initialized server-side Supabase client (uses service role key — bypasses RLS)
// Use this in API routes only, never expose to the client
let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
    if (!_supabase) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error(
                "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables"
            );
        }

        _supabase = createClient(supabaseUrl, supabaseServiceKey);
    }
    return _supabase;
}

// Re-export as `supabase` for convenience (lazy getter via Proxy)
export const supabase = new Proxy({} as SupabaseClient, {
    get(_target, prop) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (getSupabase() as any)[prop];
    },
});
