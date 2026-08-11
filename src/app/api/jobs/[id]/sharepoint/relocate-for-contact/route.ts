import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { MicrosoftGraphAuthError } from "@/lib/integrations/microsoft-graph";
import { relocateJobSharePointFolderForContact } from "@/lib/integrations/microsoft-graph-job-folders";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** POST /api/jobs/[id]/sharepoint/relocate-for-contact */
export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const jobId = id?.trim();
  if (!jobId) {
    return NextResponse.json({ ok: false, error: "Job id is required." }, { status: 400 });
  }

  try {
    const folder = await relocateJobSharePointFolderForContact(jobId);
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
            : "Could not relocate SharePoint job folder.",
      },
      { status: 500 }
    );
  }
}
