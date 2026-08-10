import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { MicrosoftGraphAuthError } from "@/lib/integrations/microsoft-graph";
import {
  isJobSharePointCategory,
  isProductionDrawingSubfolder,
} from "@/lib/integrations/microsoft-graph-job-folders";
import {
  listJobSharePointFiles,
  uploadJobSharePointFiles,
} from "@/lib/integrations/microsoft-graph-job-files";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** GET /api/jobs/[id]/sharepoint/files?category=...&subfolder=... */
export async function GET(request: Request, context: RouteContext) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const jobId = id?.trim();
  if (!jobId) {
    return NextResponse.json({ ok: false, error: "Job id is required." }, { status: 400 });
  }

  const params = new URL(request.url).searchParams;
  const categoryParam = params.get("category");
  const category =
    categoryParam && isJobSharePointCategory(categoryParam)
      ? categoryParam
      : null;
  const subfolderParam = params.get("subfolder");
  const productionSubfolder =
    subfolderParam && isProductionDrawingSubfolder(subfolderParam)
      ? subfolderParam
      : null;

  try {
    const result = await listJobSharePointFiles({
      jobId,
      category,
      productionSubfolder,
    });
    if (result.error) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, files: result.files });
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
            : "Could not list SharePoint job files.",
      },
      { status: 500 }
    );
  }
}

/** POST /api/jobs/[id]/sharepoint/files multipart */
export async function POST(request: Request, context: RouteContext) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const jobId = id?.trim();
  if (!jobId) {
    return NextResponse.json({ ok: false, error: "Job id is required." }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Expected multipart form data." },
      { status: 400 }
    );
  }

  const categoryRaw =
    typeof form.get("category") === "string"
      ? String(form.get("category"))
      : "";
  if (!isJobSharePointCategory(categoryRaw)) {
    return NextResponse.json(
      { ok: false, error: "Invalid SharePoint job file category." },
      { status: 400 }
    );
  }

  const subfolderRaw =
    typeof form.get("subfolder") === "string"
      ? String(form.get("subfolder"))
      : "";
  const productionSubfolder = isProductionDrawingSubfolder(subfolderRaw)
    ? subfolderRaw
    : null;

  const files = form
    .getAll("files")
    .filter((value): value is File => value instanceof File);

  if (files.length === 0) {
    return NextResponse.json(
      { ok: false, error: "At least one file is required." },
      { status: 400 }
    );
  }

  const uploadedByName =
    (typeof form.get("uploadedByName") === "string"
      ? String(form.get("uploadedByName")).trim()
      : "") || "User";

  try {
    const result = await uploadJobSharePointFiles({
      jobId,
      category: categoryRaw,
      productionSubfolder,
      files,
      uploadedByName,
    });
    if (result.error) {
      return NextResponse.json(
        { ok: false, error: result.error, files: result.files },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, files: result.files });
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
            : "Could not upload SharePoint job files.",
      },
      { status: 500 }
    );
  }
}
