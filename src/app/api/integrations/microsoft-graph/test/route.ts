import {
  MicrosoftGraphAuthError,
  getMicrosoftGraphAccessToken,
  microsoftGraphGet,
} from "@/lib/integrations/microsoft-graph";
import { jsonError, jsonOk, requireApiUser } from "@/lib/api-auth";

/**
 * Temporary protected endpoint to verify Microsoft Graph app credentials.
 * GET /api/integrations/microsoft-graph/test
 *
 * Requires a signed-in Supabase user. Does not expose tokens or secrets.
 */
export async function GET() {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;

  try {
    await getMicrosoftGraphAccessToken();
  } catch (err) {
    if (err instanceof MicrosoftGraphAuthError) {
      return jsonError(err.message, err.status >= 400 ? err.status : 500);
    }
    return jsonError(
      err instanceof Error
        ? err.message
        : "Could not obtain a Microsoft Graph access token.",
      500
    );
  }

  try {
    const { data, status } = await microsoftGraphGet<{
      value?: Array<{
        id?: string;
        displayName?: string;
        verifiedDomains?: Array<{ name?: string; isDefault?: boolean }>;
      }>;
    }>("/organization");

    const org = data.value?.[0];
    const defaultDomain =
      org?.verifiedDomains?.find((d) => d.isDefault)?.name ??
      org?.verifiedDomains?.[0]?.name ??
      null;

    return jsonOk({
      ok: true,
      message: "Microsoft Graph connection is working.",
      tokenAcquired: true,
      graphStatus: status,
      organization: {
        id: org?.id ?? null,
        displayName: org?.displayName ?? null,
        defaultDomain,
      },
    });
  } catch (err) {
    if (err instanceof MicrosoftGraphAuthError) {
      // Token worked; Graph call failed (often missing application permission).
      return jsonOk({
        ok: false,
        message:
          "Access token was acquired, but the Graph API call failed. Check app permissions (e.g. Organization.Read.All) and admin consent.",
        tokenAcquired: true,
        graphError: err.message,
        graphStatus: err.status,
      });
    }
    return jsonError(
      err instanceof Error
        ? err.message
        : "Microsoft Graph connection test failed.",
      500
    );
  }
}
