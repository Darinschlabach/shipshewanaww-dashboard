import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { MicrosoftGraphAuthError } from "@/lib/integrations/microsoft-graph";
import {
  deleteQuoteSharePointFile,
  getQuoteSharePointFileOpenUrl,
  renameQuoteSharePointFile,
} from "@/lib/integrations/microsoft-graph-quote-files";

type RouteContext = {
  params: Promise<{ id: string; itemId: string }>;
};

/**
 * GET /api/quotes/[id]/sharepoint/files/[itemId]
 * Resolves an open/download URL for a DriveItem.
 */
export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;

  const { id, itemId: rawItemId } = await context.params;
  const quoteId = id?.trim();
  const itemId = decodeURIComponent(rawItemId || "").trim();
  if (!quoteId || !itemId) {
    return NextResponse.json(
      { ok: false, error: "Quote id and item id are required." },
      { status: 400 }
    );
  }

  try {
    const result = await getQuoteSharePointFileOpenUrl({ quoteId, itemId });
    if (result.error || !result.url) {
      return NextResponse.json(
        { ok: false, error: result.error ?? "No URL available." },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true, url: result.url });
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
            : "Could not resolve SharePoint file URL.",
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/quotes/[id]/sharepoint/files/[itemId]
 * Body: { name: string }
 */
export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;

  const { id, itemId: rawItemId } = await context.params;
  const quoteId = id?.trim();
  const itemId = decodeURIComponent(rawItemId || "").trim();
  if (!quoteId || !itemId) {
    return NextResponse.json(
      { ok: false, error: "Quote id and item id are required." },
      { status: 400 }
    );
  }

  let body: { name?: string };
  try {
    body = (await request.json()) as { name?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const newName = body.name?.trim();
  if (!newName) {
    return NextResponse.json({ ok: false, error: "name is required." }, { status: 400 });
  }

  try {
    const result = await renameQuoteSharePointFile({
      quoteId,
      itemId,
      newName,
    });
    if (result.error || !result.file) {
      return NextResponse.json(
        { ok: false, error: result.error ?? "Rename failed." },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, file: result.file });
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
            : "Could not rename SharePoint file.",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/quotes/[id]/sharepoint/files/[itemId]
 */
export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;

  const { id, itemId: rawItemId } = await context.params;
  const quoteId = id?.trim();
  const itemId = decodeURIComponent(rawItemId || "").trim();
  if (!quoteId || !itemId) {
    return NextResponse.json(
      { ok: false, error: "Quote id and item id are required." },
      { status: 400 }
    );
  }

  try {
    const result = await deleteQuoteSharePointFile({ quoteId, itemId });
    if (result.error) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true });
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
            : "Could not delete SharePoint file.",
      },
      { status: 500 }
    );
  }
}
