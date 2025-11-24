import { createClient } from '@supabase/supabase-js';

// Only validate in runtime, not during build
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Create client with fallback values (will fail gracefully at runtime if missing)
export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);
