import { jsonError, jsonOk, requireApiUser } from "@/lib/api-auth";
import { syncContactToQuickBooks } from "@/lib/integrations/quickbooks-sync";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;

  const { id } = await params;
  const sync = await syncContactToQuickBooks(id);
  const { data, error } = await auth.supabase
    .from("contacts")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return jsonError(error?.message || "Contact not found.", 404);
  }

  return jsonOk({
    data,
    syncError: sync.status === "failed" ? sync.error : null,
    syncStatus: sync.status,
  });
}
