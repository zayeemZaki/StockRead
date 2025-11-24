import { createBrowserClient } from '@supabase/ssr';

// Environment variables are validated at runtime, not build time

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  return createBrowserClient(url, key);
}
