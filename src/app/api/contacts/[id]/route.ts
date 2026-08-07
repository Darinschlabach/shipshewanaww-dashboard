import { jsonError, jsonOk, requireApiUser } from "@/lib/api-auth";
import { syncContactToQuickBooks } from "@/lib/integrations/quickbooks-sync";
import type { ContactType } from "@/lib/types";

type ContactBody = {
  name?: string;
  email?: string | null;
  phone?: string | null;
  fax?: string | null;
  address?: string | null;
  birthday?: string | null;
  contact_type?: ContactType;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as ContactBody | null;
  if (!body) return jsonError("Invalid request body.");

  const patch: Record<string, unknown> = {
    qb_sync_status: "pending",
    qb_sync_error: null,
  };
  if (body.name !== undefined) patch.name = body.name.trim();
  if (body.email !== undefined) patch.email = body.email?.trim() || null;
  if (body.phone !== undefined) patch.phone = body.phone?.trim() || null;
  if (body.fax !== undefined) patch.fax = body.fax?.trim() || null;
  if (body.address !== undefined) patch.address = body.address?.trim() || null;
  if (body.birthday !== undefined) patch.birthday = body.birthday || null;
  if (body.contact_type !== undefined) patch.contact_type = body.contact_type;

  if (typeof patch.name === "string" && !patch.name) {
    return jsonError("Name is required.");
  }

  const { data, error } = await auth.supabase
    .from("contacts")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    return jsonError(error?.message || "Could not update contact.", 500);
  }

  const sync = await syncContactToQuickBooks(id);
  const { data: refreshed } = await auth.supabase
    .from("contacts")
    .select("*")
    .eq("id", id)
    .single();

  return jsonOk({
    data: refreshed ?? data,
    syncError: sync.status === "failed" ? sync.error : null,
    syncStatus: sync.status,
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;

  const { id } = await params;
  const { error } = await auth.supabase.from("contacts").delete().eq("id", id);
  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonOk({ ok: true });
}
