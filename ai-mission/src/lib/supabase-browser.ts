import { createClient } from "@supabase/supabase-js";

// Client-side Supabase client (uses anon/publishable key)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export const supabaseBrowser = createClient(supabaseUrl, supabaseAnonKey);
