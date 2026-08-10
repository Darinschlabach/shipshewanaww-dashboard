import { NextResponse } from "next/server";
import { requireOwnerUser } from "@/lib/integrations/quickbooks";
import { MicrosoftGraphAuthError } from "@/lib/integrations/microsoft-graph";
import { createTestQuoteFolder } from "@/lib/integrations/microsoft-graph-test-folder";

/**
 * Temporary owner-only test: create "GRAPH TEST QUOTE - DELETE ME" in Quotes folder.
 * POST /api/integrations/microsoft-graph/create-test-quote-folder
 */
export async function POST() {
  const auth = await requireOwnerUser();
  if ("error" in auth) {
    return NextResponse.json(
      { ok: false, error: auth.error, graphStatus: auth.status },
      { status: auth.status }
    );
  }

  try {
    const folder = await createTestQuoteFolder();
    return NextResponse.json({
      ok: true,
      message: "Test folder created inside MICROSOFT_QUOTES_FOLDER_ID.",
      folder: {
        name: folder.name,
        id: folder.id,
        driveId: folder.driveId,
        parentFolderId: folder.parentFolderId,
        webUrl: folder.webUrl,
      },
    });
  } catch (err) {
    if (err instanceof MicrosoftGraphAuthError) {
      return NextResponse.json(
        {
          ok: false,
          error: err.message,
          graphStatus: err.status,
        },
        { status: err.status >= 400 ? err.status : 500 }
      );
    }
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Could not create the Microsoft Graph test folder.",
        graphStatus: 500,
      },
      { status: 500 }
    );
  }
}
