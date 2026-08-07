import { NextResponse } from "next/server";
import {
  deleteQuickBooksConnection,
  requireOwnerUser,
} from "@/lib/integrations/quickbooks";

export async function POST() {
  const auth = await requireOwnerUser();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    await deleteQuickBooksConnection();
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not disconnect QuickBooks.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
