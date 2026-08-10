import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { MicrosoftGraphAuthError } from "@/lib/integrations/microsoft-graph";
import { convertQuoteSharePointFolderToJob } from "@/lib/integrations/microsoft-graph-job-folders";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/quotes/[id]/sharepoint/convert-to-job
 * Body: { jobId: string }
 * Moves the quote SharePoint folder into Jobs and ensures job subfolders.
 */
export async function POST(request: Request, context: RouteContext) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const quoteId = id?.trim();
  if (!quoteId) {
    return NextResponse.json({ ok: false, error: "Quote id is required." }, { status: 400 });
  }

  let body: { jobId?: string };
  try {
    body = (await request.json()) as { jobId?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const jobId = body.jobId?.trim();
  if (!jobId) {
    return NextResponse.json({ ok: false, error: "jobId is required." }, { status: 400 });
  }

  try {
    const folder = await convertQuoteSharePointFolderToJob({ quoteId, jobId });
    return NextResponse.json({
      ok: true,
      folder: {
        driveId: folder.graph_drive_id,
        folderItemId: folder.graph_folder_item_id,
        webUrl: folder.graph_web_url,
      },
    });
  } catch (err) {
    if (err instanceof MicrosoftGraphAuthError) {
      return NextResponse.json(
        { ok: false, error: err.message, graphStatus: err.status },
        { status: err.status >= 400 ? err.status : 500 }
      );
    }
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Could not convert SharePoint quote folder to job.",
      },
      { status: 500 }
    );
  }
}
