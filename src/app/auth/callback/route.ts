import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/dashboard";
  const error = searchParams.get("error_description") ?? searchParams.get("error");

  if (error) {
    const url = new URL("/login", origin);
    url.searchParams.set("error", error);
    return NextResponse.redirect(url);
  }

  const supabase = await createClient();

  // Clear any pre-existing session so a link-based action (invite / recovery)
  // can never be applied to the wrong account.
  await supabase.auth.signOut();

  if (tokenHash && type) {
    const { error: verifyError } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (verifyError) {
      const url = new URL("/login", origin);
      url.searchParams.set("error", verifyError.message);
      return NextResponse.redirect(url);
    }
    return NextResponse.redirect(`${origin}${next}`);
  }

  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      const url = new URL("/login", origin);
      url.searchParams.set("error", exchangeError.message);
      return NextResponse.redirect(url);
    }
    return NextResponse.redirect(`${origin}${next}`);
  }

  const url = new URL("/login", origin);
  url.searchParams.set("error", "Invalid or expired link. Please request a new one.");
  return NextResponse.redirect(url);
}
