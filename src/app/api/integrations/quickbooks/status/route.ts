import { NextResponse } from "next/server";
import {
  getQuickBooksConnectionStatus,
  requireOwnerUser,
} from "@/lib/integrations/quickbooks";

export async function GET() {
  const auth = await requireOwnerUser();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const status = await getQuickBooksConnectionStatus();
    return NextResponse.json(status);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not load connection status.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
