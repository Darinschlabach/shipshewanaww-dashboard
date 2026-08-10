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

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;

  const body = (await request.json().catch(() => null)) as ContactBody | null;
  if (!body?.name?.trim()) {
    return jsonError("Name is required.");
  }

  const basePayload = {
    name: body.name.trim(),
    email: body.email?.trim() || null,
    phone: body.phone?.trim() || null,
    fax: body.fax?.trim() || null,
    address: body.address?.trim() || null,
    birthday: body.birthday || null,
    contact_type: body.contact_type || "Customers",
  };

  let { data, error } = await auth.supabase
    .from("contacts")
    .insert({
      ...basePayload,
      qb_sync_status: "pending" as const,
      qb_sync_error: null,
    })
    .select("*")
    .single();

  if (error && isMissingQbColumnError(error.message)) {
    const fallback = await auth.supabase
      .from("contacts")
      .insert(basePayload)
      .select("*")
      .single();
    data = fallback.data;
    error = fallback.error;
  }

  if (error || !data) {
    return jsonError(error?.message || "Could not create contact.", 500);
  }

  const sync = await syncContactSafe(data.id);
  const sharePoint =
    data.contact_type === "Contractors"
      ? await ensureContractorFoldersSafe(data.id)
      : { sharePointError: null };

  const { data: refreshed } = await auth.supabase
    .from("contacts")
    .select("*")
    .eq("id", data.id)
    .single();

  return jsonOk({
    data: refreshed ?? data,
    syncError: sync.syncError,
    syncStatus: sync.syncStatus,
    sharePointError: sharePoint.sharePointError,
  });
}
