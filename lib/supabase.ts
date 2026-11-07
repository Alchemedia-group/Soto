import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** False when no database is configured: the app then runs local-only (data stays in this browser). */
export const syncEnabled = !!(url && key);
export const supabase = syncEnabled ? createClient(url!, key!) : null;
