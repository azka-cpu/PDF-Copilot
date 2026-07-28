import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Uses the anon key only - safe for the browser. Row Level Security in
// Supabase enforces that users can only read/write their own data.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
