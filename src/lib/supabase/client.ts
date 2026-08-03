import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Check your .env.local and restart the dev server."
    );
  }

  if (
    url.includes("your-project") ||
    key.includes("your-anon-key")
  ) {
    throw new Error(
      "Supabase env vars still have placeholder values from .env.local.example. Replace them with your real project URL and anon key, then restart."
    );
  }

  return createBrowserClient(url, key);
}
