import { NextResponse } from "next/server";
import { requireOwnerUser } from "@/lib/integrations/quickbooks";
import {
  graphErrorPayload,
  listSharePointSites,
} from "@/lib/integrations/microsoft-graph-discovery";

/**
 * Temporary owner-only SharePoint site discovery.
 * GET /api/integrations/microsoft-graph/sites?q=optional-search
 */
export async function GET(request: Request) {
  const auth = await requireOwnerUser();
  if ("error" in auth) {
    return NextResponse.json(
      { ok: false, error: auth.error, graphStatus: auth.status },
      { status: auth.status }
    );
  }

  const url = new URL(request.url);
  const search = url.searchParams.get("q");

  try {
    const sites = await listSharePointSites({ search });
    return NextResponse.json({
      ok: true,
      count: sites.length,
      sites,
    });
  } catch (err) {
    const payload = graphErrorPayload(err);
    return NextResponse.json(
      {
        ok: false,
        error: payload.message,
        graphStatus: payload.graphStatus,
      },
      { status: payload.graphStatus >= 400 ? payload.graphStatus : 500 }
    );
  }
}
