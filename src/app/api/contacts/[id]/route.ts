import { jsonError, jsonOk, requireApiUser } from "@/lib/api-auth";
import { ensureContractorSharePointFolders } from "@/lib/integrations/microsoft-graph-contractor-folders";
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

function isMissingQbColumnError(message: string | undefined): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes("qb_sync_status") ||
    lower.includes("qb_sync_error") ||
    lower.includes("qb_id") ||
    lower.includes("qb_last_synced") ||
    lower.includes("qb_sync_token") ||
    (lower.includes("column") && lower.includes("qb_"))
  );
}

async function syncContactSafe(contactId: string): Promise<{
  syncError: string | null;
  syncStatus: string;
}> {
  try {
    const sync = await syncContactToQuickBooks(contactId);
    return {
      syncError: sync.status === "failed" ? sync.error : null,
      syncStatus: sync.status,
    };
  } catch (err) {
    console.error("Contact QuickBooks sync failed:", err);
    return {
      syncError:
        err instanceof Error ? err.message : "QuickBooks sync failed.",
      syncStatus: "failed",
    };
  }
}

async function ensureContractorFoldersSafe(contactId: string): Promise<{
  sharePointError: string | null;
}> {
  try {
    await ensureContractorSharePointFolders(contactId);
    return { sharePointError: null };
  } catch (err) {
    console.error("Contractor SharePoint folders failed:", err);
    return {
      sharePointError:
        err instanceof Error
          ? err.message
          : "Could not create contractor SharePoint folders.",
    };
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as ContactBody | null;
  if (!body) return jsonError("Invalid request body.");

  const patch: Record<string, unknown> = {};
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

  const withQb = {
    ...patch,
    qb_sync_status: "pending",
    qb_sync_error: null,
  };

  let { data, error } = await auth.supabase
    .from("contacts")
    .update(withQb)
    .eq("id", id)
    .select("*")
    .single();

  if (error && isMissingQbColumnError(error.message)) {
    const fallback = await auth.supabase
      .from("contacts")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    data = fallback.data;
    error = fallback.error;
  }

  if (error || !data) {
    return jsonError(error?.message || "Could not update contact.", 500);
  }

  const sync = await syncContactSafe(id);
  const sharePoint =
    data.contact_type === "Contractors"
      ? await ensureContractorFoldersSafe(id)
      : { sharePointError: null };

  const { data: refreshed } = await auth.supabase
    .from("contacts")
    .select("*")
    .eq("id", id)
    .single();

  return jsonOk({
    data: refreshed ?? data,
    syncError: sync.syncError,
    syncStatus: sync.syncStatus,
    sharePointError: sharePoint.sharePointError,
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
