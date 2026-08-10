import { NextResponse } from "next/server";
import { requireOwnerUser } from "@/lib/integrations/quickbooks";
import {
  graphErrorPayload,
  listSiteDrives,
} from "@/lib/integrations/microsoft-graph-discovery";

/**
 * Temporary owner-only site drive listing.
 * GET /api/integrations/microsoft-graph/site-drives?siteId=...
 *
 * Uses a query param because SharePoint site IDs contain commas.
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
  const siteId = url.searchParams.get("siteId")?.trim() || "";
  if (!siteId) {
    return NextResponse.json(
      { ok: false, error: "siteId is required.", graphStatus: 400 },
      { status: 400 }
    );
  }

  try {
    const drives = await listSiteDrives(siteId);
    return NextResponse.json({
      ok: true,
      siteId,
      count: drives.length,
      drives,
    });
  } catch (err) {
    const payload = graphErrorPayload(err);
    return NextResponse.json(
      {
        ok: false,
        error: payload.message,
        graphStatus: payload.graphStatus,
        siteId,
      },
      { status: payload.graphStatus >= 400 ? payload.graphStatus : 500 }
    );
  }
}
