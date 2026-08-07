import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const QUICKBOOKS_PROVIDER = "quickbooks";
export const QB_OAUTH_STATE_COOKIE = "qb_oauth_state";

const AUTHORIZE_URL = "https://appcenter.intuit.com/connect/oauth2";
const TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const DEFAULT_SCOPE = "com.intuit.quickbooks.accounting";

export type QuickBooksConnectionStatus = {
  connected: boolean;
  realmId: string | null;
  connectedAt: string | null;
  accessTokenExpiresAt: string | null;
};

export type QuickBooksTokens = {
  accessToken: string;
  refreshToken: string;
  realmId: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date | null;
};

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export function getQuickBooksRedirectUri(origin: string): string {
  const configured = process.env.INTUIT_REDIRECT_URI?.trim();
  if (configured) return configured;
  return `${origin.replace(/\/$/, "")}/api/integrations/quickbooks/callback`;
}

export function getQuickBooksClientCredentials(): {
  clientId: string;
  clientSecret: string;
} {
  return {
    clientId: requireEnv("INTUIT_CLIENT_ID"),
    clientSecret: requireEnv("INTUIT_CLIENT_SECRET"),
  };
}

function basicAuthHeader(clientId: string, clientSecret: string): string {
  const raw = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  return `Basic ${raw}`;
}

export function buildQuickBooksAuthorizeUrl(opts: {
  origin: string;
  state: string;
}): string {
  const { clientId } = getQuickBooksClientCredentials();
  const redirectUri = getQuickBooksRedirectUri(opts.origin);
  const scope = process.env.INTUIT_SCOPES?.trim() || DEFAULT_SCOPE;

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    scope,
    redirect_uri: redirectUri,
    state: opts.state,
  });

  return `${AUTHORIZE_URL}?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  x_refresh_token_expires_in?: number;
  token_type?: string;
};

async function postTokenRequest(
  body: URLSearchParams
): Promise<TokenResponse> {
  const { clientId, clientSecret } = getQuickBooksClientCredentials();

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader(clientId, clientSecret),
    },
    body,
  });

  const json = (await response.json().catch(() => ({}))) as TokenResponse & {
    error?: string;
    error_description?: string;
  };

  if (!response.ok) {
    throw new Error(
      json.error_description ||
        json.error ||
        `QuickBooks token request failed (${response.status})`
    );
  }

  if (!json.access_token || !json.refresh_token || !json.expires_in) {
    throw new Error("QuickBooks token response was incomplete.");
  }

  return json;
}

export async function exchangeQuickBooksAuthorizationCode(opts: {
  code: string;
  origin: string;
}): Promise<Omit<QuickBooksTokens, "realmId"> & { realmId?: string }> {
  const redirectUri = getQuickBooksRedirectUri(opts.origin);
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: opts.code,
    redirect_uri: redirectUri,
  });

  const json = await postTokenRequest(body);
  const now = Date.now();

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    accessTokenExpiresAt: new Date(now + json.expires_in * 1000),
    refreshTokenExpiresAt: json.x_refresh_token_expires_in
      ? new Date(now + json.x_refresh_token_expires_in * 1000)
      : null,
  };
}

export async function refreshQuickBooksAccessToken(
  refreshToken: string
): Promise<Omit<QuickBooksTokens, "realmId">> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const json = await postTokenRequest(body);
  const now = Date.now();

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    accessTokenExpiresAt: new Date(now + json.expires_in * 1000),
    refreshTokenExpiresAt: json.x_refresh_token_expires_in
      ? new Date(now + json.x_refresh_token_expires_in * 1000)
      : null,
  };
}

export async function requireOwnerUser(): Promise<
  { userId: string } | { error: string; status: number }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized", status: 401 };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "owner") {
    return { error: "Forbidden", status: 403 };
  }

  return { userId: user.id };
}

export async function saveQuickBooksConnection(opts: {
  realmId: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date | null;
  connectedBy: string;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("integration_connections").upsert(
    {
      provider: QUICKBOOKS_PROVIDER,
      realm_id: opts.realmId,
      access_token: opts.accessToken,
      refresh_token: opts.refreshToken,
      access_token_expires_at: opts.accessTokenExpiresAt.toISOString(),
      refresh_token_expires_at: opts.refreshTokenExpiresAt?.toISOString() ?? null,
      connected_by: opts.connectedBy,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "provider" }
  );

  if (error) {
    throw new Error(error.message);
  }
}

async function updateQuickBooksTokens(opts: {
  realmId: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date | null;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("integration_connections")
    .update({
      realm_id: opts.realmId,
      access_token: opts.accessToken,
      refresh_token: opts.refreshToken,
      access_token_expires_at: opts.accessTokenExpiresAt.toISOString(),
      refresh_token_expires_at: opts.refreshTokenExpiresAt?.toISOString() ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("provider", QUICKBOOKS_PROVIDER);

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteQuickBooksConnection(): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("integration_connections")
    .delete()
    .eq("provider", QUICKBOOKS_PROVIDER);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getQuickBooksConnectionStatus(): Promise<QuickBooksConnectionStatus> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("integration_connections")
    .select("realm_id, connected_at, access_token_expires_at")
    .eq("provider", QUICKBOOKS_PROVIDER)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return {
      connected: false,
      realmId: null,
      connectedAt: null,
      accessTokenExpiresAt: null,
    };
  }

  return {
    connected: true,
    realmId: data.realm_id,
    connectedAt: data.connected_at,
    accessTokenExpiresAt: data.access_token_expires_at,
  };
}

/** Returns a valid access token, refreshing and persisting when needed. */
export async function getValidQuickBooksAccessToken(): Promise<QuickBooksTokens | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("integration_connections")
    .select(
      "realm_id, access_token, refresh_token, access_token_expires_at, refresh_token_expires_at"
    )
    .eq("provider", QUICKBOOKS_PROVIDER)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data?.realm_id || !data.access_token || !data.refresh_token) {
    return null;
  }

  const expiresAt = new Date(data.access_token_expires_at);
  const needsRefresh = expiresAt.getTime() - Date.now() < 5 * 60 * 1000;

  if (!needsRefresh) {
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      realmId: data.realm_id,
      accessTokenExpiresAt: expiresAt,
      refreshTokenExpiresAt: data.refresh_token_expires_at
        ? new Date(data.refresh_token_expires_at)
        : null,
    };
  }

  const refreshed = await refreshQuickBooksAccessToken(data.refresh_token);
  await updateQuickBooksTokens({
    realmId: data.realm_id,
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken,
    accessTokenExpiresAt: refreshed.accessTokenExpiresAt,
    refreshTokenExpiresAt: refreshed.refreshTokenExpiresAt,
  });

  return {
    ...refreshed,
    realmId: data.realm_id,
  };
}

export async function setOAuthStateCookie(state: string): Promise<void> {
  const jar = await cookies();
  jar.set(QB_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });
}

export async function consumeOAuthStateCookie(): Promise<string | null> {
  const jar = await cookies();
  const state = jar.get(QB_OAUTH_STATE_COOKIE)?.value ?? null;
  jar.delete(QB_OAUTH_STATE_COOKIE);
  return state;
}

export function getRequestOrigin(request: Request): string {
  const url = new URL(request.url);
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    `${url.protocol}//${url.host}`
  );
}
