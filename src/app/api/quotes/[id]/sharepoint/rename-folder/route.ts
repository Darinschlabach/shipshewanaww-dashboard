import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { MicrosoftGraphAuthError } from "@/lib/integrations/microsoft-graph";
import { renameQuoteSharePointFolder } from "@/lib/integrations/microsoft-graph-quote-folders";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/quotes/[id]/sharepoint/rename-folder
 * Body: { jobName: string }
 */
export async function POST(request: Request, context: RouteContext) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const quoteId = id?.trim();
  if (!quoteId) {
    return NextResponse.json({ ok: false, error: "Quote id is required." }, { status: 400 });
  }

  let body: { jobName?: string };
  try {
    body = (await request.json()) as { jobName?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const jobName = body.jobName?.trim();
  if (!jobName) {
    return NextResponse.json({ ok: false, error: "jobName is required." }, { status: 400 });
  }

  try {
    const folder = await renameQuoteSharePointFolder({
      quoteId,
      newJobName: jobName,
    });
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
            : "Could not rename SharePoint quote folder.",
      },
      { status: 500 }
    );
  }
}
