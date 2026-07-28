import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// import.meta.env only exists under Vite; node scripts (tsx) get demo mode
const env = (import.meta as { env?: Record<string, string> }).env ?? {};
const url = env.VITE_SUPABASE_URL as string | undefined;
const anonKey = env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Null when env vars are missing — the app then runs in local demo mode. */
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;
