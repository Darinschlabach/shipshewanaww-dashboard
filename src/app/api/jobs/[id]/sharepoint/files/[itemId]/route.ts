import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { MicrosoftGraphAuthError } from "@/lib/integrations/microsoft-graph";
import {
  deleteJobSharePointFile,
  getJobSharePointFileOpenUrl,
  renameJobSharePointFile,
} from "@/lib/integrations/microsoft-graph-job-files";

type RouteContext = {
  params: Promise<{ id: string; itemId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;

  const { id, itemId: rawItemId } = await context.params;
  const jobId = id?.trim();
  const itemId = decodeURIComponent(rawItemId || "").trim();
  if (!jobId || !itemId) {
    return NextResponse.json(
      { ok: false, error: "Job id and item id are required." },
      { status: 400 }
    );
  }

  try {
    const result = await getJobSharePointFileOpenUrl({ jobId, itemId });
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

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;

  const { id, itemId: rawItemId } = await context.params;
  const jobId = id?.trim();
  const itemId = decodeURIComponent(rawItemId || "").trim();
  if (!jobId || !itemId) {
    return NextResponse.json(
      { ok: false, error: "Job id and item id are required." },
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
    const result = await renameJobSharePointFile({
      jobId,
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

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;

  const { id, itemId: rawItemId } = await context.params;
  const jobId = id?.trim();
  const itemId = decodeURIComponent(rawItemId || "").trim();
  if (!jobId || !itemId) {
    return NextResponse.json(
      { ok: false, error: "Job id and item id are required." },
      { status: 400 }
    );
  }

  try {
    const result = await deleteJobSharePointFile({ jobId, itemId });
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
