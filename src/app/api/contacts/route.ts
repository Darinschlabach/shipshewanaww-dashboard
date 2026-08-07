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

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;

  const body = (await request.json().catch(() => null)) as ContactBody | null;
  if (!body?.name?.trim()) {
    return jsonError("Name is required.");
  }

  const payload = {
    name: body.name.trim(),
    email: body.email?.trim() || null,
    phone: body.phone?.trim() || null,
    fax: body.fax?.trim() || null,
    address: body.address?.trim() || null,
    birthday: body.birthday || null,
    contact_type: body.contact_type || "Customers",
    qb_sync_status: "pending" as const,
    qb_sync_error: null,
  };

  const { data, error } = await auth.supabase
    .from("contacts")
    .insert(payload)
    .select("*")
    .single();

  if (error || !data) {
    return jsonError(error?.message || "Could not create contact.", 500);
  }

  const sync = await syncContactToQuickBooks(data.id);
  const { data: refreshed } = await auth.supabase
    .from("contacts")
    .select("*")
    .eq("id", data.id)
    .single();

  return jsonOk({
    data: refreshed ?? data,
    syncError: sync.status === "failed" ? sync.error : null,
    syncStatus: sync.status,
  });
}
