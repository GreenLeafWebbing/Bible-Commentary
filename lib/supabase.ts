import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type Commentary = {
  id: string;
  book: string;
  chapter: number;
  verse_start: number | null;
  verse_end: number | null;
  title: string | null;
  body: string;
  cross_refs: string[];
  created_at: string;
  updated_at: string;
};

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Server-side, read-only (anon) client. RLS allows public reads only. */
export function serverClient(): SupabaseClient {
  return createClient(url, key, { auth: { persistSession: false } });
}

let browser: SupabaseClient | undefined;
/** Browser client used by the admin page; keeps your login session. */
export function browserClient(): SupabaseClient {
  browser ??= createClient(url, key);
  return browser;
}
