import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { MicrosoftGraphAuthError } from "@/lib/integrations/microsoft-graph";
import {
  listQuoteSharePointFiles,
  uploadQuoteSharePointFiles,
} from "@/lib/integrations/microsoft-graph-quote-files";
import { parseQuoteSharePointCategory } from "@/lib/integrations/microsoft-graph-quote-folders";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/quotes/[id]/sharepoint/files?category=misc|provided_drawings|quote_forms
 */
export async function GET(request: Request, context: RouteContext) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const quoteId = id?.trim();
  if (!quoteId) {
    return NextResponse.json({ ok: false, error: "Quote id is required." }, { status: 400 });
  }

  const categoryParam = new URL(request.url).searchParams.get("category");
  const category = parseQuoteSharePointCategory(categoryParam);

  try {
    const result = await listQuoteSharePointFiles({
      quoteId,
      category,
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
            : "Could not list SharePoint quote files.",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/quotes/[id]/sharepoint/files
 * multipart/form-data: category, files[]
 */
export async function POST(request: Request, context: RouteContext) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const quoteId = id?.trim();
  if (!quoteId) {
    return NextResponse.json({ ok: false, error: "Quote id is required." }, { status: 400 });
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

  const category = parseQuoteSharePointCategory(
    typeof form.get("category") === "string"
      ? String(form.get("category"))
      : null
  );
  if (!category) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "category must be provided_drawings, quote_forms, or misc.",
      },
      { status: 400 }
    );
  }

  const files = form
    .getAll("files")
    .filter((value): value is File => value instanceof File && value.size >= 0);

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
    const result = await uploadQuoteSharePointFiles({
      quoteId,
      category,
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
            : "Could not upload SharePoint quote files.",
      },
      { status: 500 }
    );
  }
}
