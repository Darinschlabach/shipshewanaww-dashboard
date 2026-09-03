import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import {
  buildQuickBooksAuthorizeUrl,
  getRequestOrigin,
  requireOwnerUser,
  setOAuthStateCookie,
} from "@/lib/integrations/quickbooks";

export async function GET(request: Request) {
  const auth = await requireOwnerUser();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const state = randomBytes(24).toString("hex");
    await setOAuthStateCookie(state);
    const origin = getRequestOrigin(request);
    const authorizeUrl = buildQuickBooksAuthorizeUrl({ origin, state });
    return NextResponse.redirect(authorizeUrl);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not start QuickBooks connect.";
    return NextResponse.redirect(
      new URL(
        `/admin?tab=integrations&error=${encodeURIComponent(message)}`,
        getRequestOrigin(request)
      )
    );
  }
}
