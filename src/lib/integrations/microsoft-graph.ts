/**
 * Microsoft Graph authentication (server-only).
 * Uses OAuth 2.0 client credentials — never expose MICROSOFT_* to the browser.
 */

const GRAPH_SCOPE = "https://graph.microsoft.com/.default";
const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";

export class MicrosoftGraphAuthError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(message: string, status = 500, details?: unknown) {
    super(message);
    this.name = "MicrosoftGraphAuthError";
    this.status = status;
    this.details = details ?? null;
  }
}

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type CachedToken = {
  accessToken: string;
  expiresAtMs: number;
};

let cachedToken: CachedToken | null = null;

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new MicrosoftGraphAuthError(
      `Missing environment variable: ${name}`,
      500
    );
  }
  return value;
}

export function getMicrosoftGraphCredentials(): {
  tenantId: string;
  clientId: string;
  clientSecret: string;
} {
  return {
    tenantId: requireEnv("MICROSOFT_TENANT_ID"),
    clientId: requireEnv("MICROSOFT_CLIENT_ID"),
    clientSecret: requireEnv("MICROSOFT_CLIENT_SECRET"),
  };
}

function tokenEndpoint(tenantId: string): string {
  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
}

/**
 * Returns a Microsoft Graph access token via the client credentials flow.
 * Tokens are cached in memory until near expiry.
 */
export async function getMicrosoftGraphAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAtMs > now + 60_000) {
    return cachedToken.accessToken;
  }

  const { tenantId, clientId, clientSecret } = getMicrosoftGraphCredentials();

  let response: Response;
  try {
    response = await fetch(tokenEndpoint(tenantId), {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: GRAPH_SCOPE,
        grant_type: "client_credentials",
      }),
      cache: "no-store",
    });
  } catch (err) {
    throw new MicrosoftGraphAuthError(
      err instanceof Error
        ? `Microsoft token request failed: ${err.message}`
        : "Microsoft token request failed.",
      502
    );
  }

  let payload: TokenResponse;
  try {
    payload = (await response.json()) as TokenResponse;
  } catch {
    throw new MicrosoftGraphAuthError(
      "Microsoft token response was not valid JSON.",
      response.status || 502
    );
  }

  if (!response.ok || !payload.access_token) {
    const description =
      payload.error_description?.trim() ||
      payload.error?.trim() ||
      `Microsoft token request failed with status ${response.status}.`;
    throw new MicrosoftGraphAuthError(description, response.status || 401, {
      error: payload.error ?? null,
    });
  }

  const expiresInSec =
    typeof payload.expires_in === "number" && payload.expires_in > 0
      ? payload.expires_in
      : 3600;

  cachedToken = {
    accessToken: payload.access_token,
    expiresAtMs: now + expiresInSec * 1000,
  };

  return payload.access_token;
}

/** Clears the in-memory token cache (useful after credential rotation). */
export function clearMicrosoftGraphAccessTokenCache(): void {
  cachedToken = null;
}

async function microsoftGraphRequest<T = unknown>(
  path: string,
  opts?: {
    method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
    body?: unknown;
    rawBody?: BodyInit;
    headers?: Record<string, string>;
    timeoutMs?: number;
  }
): Promise<{ data: T; status: number }> {
  const accessToken = await getMicrosoftGraphAccessToken();
  const url = path.startsWith("http")
    ? path
    : `${GRAPH_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  const timeoutMs = opts?.timeoutMs ?? 20_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const method = opts?.method ?? "GET";
  const hasRawBody = opts?.rawBody !== undefined;
  const hasJsonBody = !hasRawBody && opts?.body !== undefined;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        ...(hasJsonBody ? { "Content-Type": "application/json" } : {}),
        ...opts?.headers,
      },
      body: hasRawBody
        ? opts.rawBody
        : hasJsonBody
          ? JSON.stringify(opts.body)
          : undefined,
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new MicrosoftGraphAuthError(
        `Microsoft Graph request timed out after ${timeoutMs}ms.`,
        504
      );
    }
    throw new MicrosoftGraphAuthError(
      err instanceof Error
        ? `Microsoft Graph request failed: ${err.message}`
        : "Microsoft Graph request failed.",
      502
    );
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = { raw: text };
    }
  }

  if (!response.ok) {
    const graphError =
      data &&
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof (data as { error?: { message?: string } }).error?.message ===
        "string"
        ? (data as { error: { message: string } }).error.message
        : `Microsoft Graph request failed with status ${response.status}.`;
    throw new MicrosoftGraphAuthError(graphError, response.status, data);
  }

  return { data: data as T, status: response.status };
}

/**
 * Authenticated GET against Microsoft Graph v1.0.
 * Used by temporary connection tests; expand later for job file sync.
 */
export async function microsoftGraphGet<T = unknown>(
  path: string,
  opts?: { timeoutMs?: number }
): Promise<{ data: T; status: number }> {
  return microsoftGraphRequest<T>(path, {
    method: "GET",
    timeoutMs: opts?.timeoutMs,
  });
}

/**
 * Authenticated POST against Microsoft Graph v1.0.
 */
export async function microsoftGraphPost<T = unknown>(
  path: string,
  body: unknown,
  opts?: { timeoutMs?: number; headers?: Record<string, string> }
): Promise<{ data: T; status: number }> {
  return microsoftGraphRequest<T>(path, {
    method: "POST",
    body,
    headers: opts?.headers,
    timeoutMs: opts?.timeoutMs,
  });
}

/**
 * Authenticated PATCH against Microsoft Graph v1.0.
 */
export async function microsoftGraphPatch<T = unknown>(
  path: string,
  body: unknown,
  opts?: { timeoutMs?: number; headers?: Record<string, string> }
): Promise<{ data: T; status: number }> {
  return microsoftGraphRequest<T>(path, {
    method: "PATCH",
    body,
    headers: opts?.headers,
    timeoutMs: opts?.timeoutMs,
  });
}

/**
 * Authenticated DELETE against Microsoft Graph v1.0.
 */
export async function microsoftGraphDelete(
  path: string,
  opts?: { timeoutMs?: number; headers?: Record<string, string> }
): Promise<{ status: number }> {
  const result = await microsoftGraphRequest<unknown>(path, {
    method: "DELETE",
    headers: opts?.headers,
    timeoutMs: opts?.timeoutMs,
  });
  return { status: result.status };
}

/**
 * Authenticated PUT of raw binary content against Microsoft Graph v1.0.
 * Used for small-file uploads (< 4 MB simple upload).
 */
export async function microsoftGraphPutBinary<T = unknown>(
  path: string,
  body: BodyInit,
  opts?: {
    contentType?: string;
    timeoutMs?: number;
    headers?: Record<string, string>;
  }
): Promise<{ data: T; status: number }> {
  return microsoftGraphRequest<T>(path, {
    method: "PUT",
    rawBody: body,
    headers: {
      ...(opts?.contentType ? { "Content-Type": opts.contentType } : {}),
      ...opts?.headers,
    },
    timeoutMs: opts?.timeoutMs ?? 60_000,
  });
}

export function getConfiguredJobsFolder(): {
  driveId: string;
  jobsFolderId: string;
} {
  return {
    driveId: requireEnv("MICROSOFT_DRIVE_ID"),
    jobsFolderId: requireEnv("MICROSOFT_JOBS_FOLDER_ID"),
  };
}

export function getConfiguredQuotesFolder(): {
  driveId: string;
  quotesFolderId: string;
} {
  return {
    driveId: requireEnv("MICROSOFT_DRIVE_ID"),
    quotesFolderId: requireEnv("MICROSOFT_QUOTES_FOLDER_ID"),
  };
}

