import { NextResponse } from "next/server";
import {
  consumeOAuthStateCookie,
  exchangeQuickBooksAuthorizationCode,
  getRequestOrigin,
  requireOwnerUser,
  saveQuickBooksConnection,
} from "@/lib/integrations/quickbooks";

export async function GET(request: Request) {
  const origin = getRequestOrigin(request);
  const integrationsUrl = new URL("/settings/integrations", origin);

  const auth = await requireOwnerUser();
  if ("error" in auth) {
    integrationsUrl.searchParams.set("error", auth.error);
    return NextResponse.redirect(integrationsUrl);
  }

  const url = new URL(request.url);
  const errorParam = url.searchParams.get("error");
  if (errorParam) {
    integrationsUrl.searchParams.set(
      "error",
      url.searchParams.get("error_description") || errorParam
    );
    return NextResponse.redirect(integrationsUrl);
  }

  const code = url.searchParams.get("code");
  const realmId = url.searchParams.get("realmId");
  const state = url.searchParams.get("state");
  const expectedState = await consumeOAuthStateCookie();

  if (!code || !realmId) {
    integrationsUrl.searchParams.set(
      "error",
      "QuickBooks did not return an authorization code."
    );
    return NextResponse.redirect(integrationsUrl);
  }

  if (!state || !expectedState || state !== expectedState) {
    integrationsUrl.searchParams.set("error", "Invalid OAuth state. Try again.");
    return NextResponse.redirect(integrationsUrl);
  }

  try {
    const tokens = await exchangeQuickBooksAuthorizationCode({
      code,
      origin,
    });

    await saveQuickBooksConnection({
      realmId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accessTokenExpiresAt: tokens.accessTokenExpiresAt,
      refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
      connectedBy: auth.userId,
    });

    integrationsUrl.searchParams.set("connected", "1");
    return NextResponse.redirect(integrationsUrl);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "QuickBooks connection failed.";
    integrationsUrl.searchParams.set("error", message);
    return NextResponse.redirect(integrationsUrl);
  }
}
