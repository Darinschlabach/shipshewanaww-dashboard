import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { MicrosoftGraphAuthError } from "@/lib/integrations/microsoft-graph";
import { ensureQuoteSharePointFolders } from "@/lib/integrations/microsoft-graph-quote-folders";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/quotes/[id]/sharepoint/ensure-folder
 * Idempotently creates Quotes/{Job Name} + category subfolders.
 */
export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const quoteId = id?.trim();
  if (!quoteId) {
    return NextResponse.json({ ok: false, error: "Quote id is required." }, { status: 400 });
  }

  try {
    const folder = await ensureQuoteSharePointFolders(quoteId);
    return NextResponse.json({
      ok: true,
      folder: {
        driveId: folder.graph_drive_id,
        folderItemId: folder.graph_folder_item_id,
        webUrl: folder.graph_web_url,
        providedDrawingsItemId: folder.graph_provided_drawings_item_id,
        quoteFormsItemId: folder.graph_quote_forms_item_id,
        miscItemId: folder.graph_misc_item_id,
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
            : "Could not ensure SharePoint quote folder.",
      },
      { status: 500 }
    );
  }
}
