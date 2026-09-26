import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || 'https://zstrwmdeaxhmhzsqusmy.supabase.co';
const supabaseAnonKey = import.meta.env.SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
