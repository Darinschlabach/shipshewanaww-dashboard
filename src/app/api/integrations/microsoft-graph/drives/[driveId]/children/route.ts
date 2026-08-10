import { NextResponse } from "next/server";
import { requireOwnerUser } from "@/lib/integrations/quickbooks";
import {
  graphErrorPayload,
  listDriveFolders,
} from "@/lib/integrations/microsoft-graph-discovery";

type RouteContext = {
  params: Promise<{ driveId: string }>;
};

/**
 * Temporary owner-only folder browser.
 * GET /api/integrations/microsoft-graph/drives/[driveId]/children?itemId=...
 */
export async function GET(request: Request, context: RouteContext) {
  const auth = await requireOwnerUser();
  if ("error" in auth) {
    return NextResponse.json(
      { ok: false, error: auth.error, graphStatus: auth.status },
      { status: auth.status }
    );
  }

  const { driveId: rawDriveId } = await context.params;
  const driveId = decodeURIComponent(rawDriveId || "").trim();
  if (!driveId) {
    return NextResponse.json(
      { ok: false, error: "driveId is required.", graphStatus: 400 },
      { status: 400 }
    );
  }

  const url = new URL(request.url);
  const parentItemId = url.searchParams.get("itemId");

  try {
    const folders = await listDriveFolders({
      driveId,
      parentItemId,
    });
    return NextResponse.json({
      ok: true,
      driveId,
      parentItemId: parentItemId?.trim() || null,
      count: folders.length,
      folders,
    });
  } catch (err) {
    const payload = graphErrorPayload(err);
    return NextResponse.json(
      {
        ok: false,
        error: payload.message,
        graphStatus: payload.graphStatus,
        driveId,
      },
      { status: payload.graphStatus >= 400 ? payload.graphStatus : 500 }
    );
  }
}
