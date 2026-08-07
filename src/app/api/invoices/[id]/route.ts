import { jsonError, jsonOk, requireApiUser } from "@/lib/api-auth";
import {
  recalculateInvoiceBalance,
  replaceInvoiceLineItems,
  type LineItemInput,
} from "@/lib/invoice-mutations";
import {
  syncInvoiceToQuickBooks,
  voidInvoiceInQuickBooks,
} from "@/lib/integrations/quickbooks-sync";

type PatchBody = {
  customer_name?: string;
  due_date?: string | null;
  invoice_date?: string;
  status?: string;
  customer_id?: string | null;
  line_items?: LineItemInput[];
  amount?: number;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as PatchBody | null;
  if (!body) return jsonError("Invalid request body.");

  const patch: Record<string, unknown> = {
    qb_sync_status: "pending",
    qb_sync_error: null,
  };
  if (body.customer_name !== undefined) {
    patch.customer_name = body.customer_name.trim();
  }
  if (body.due_date !== undefined) patch.due_date = body.due_date || null;
  if (body.invoice_date !== undefined) {
    patch.invoice_date = body.invoice_date.slice(0, 10);
  }
  if (body.status !== undefined) patch.status = body.status;
  if (body.customer_id !== undefined) patch.customer_id = body.customer_id;

  const { data, error } = await auth.supabase
    .from("invoices")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    return jsonError(error?.message || "Could not update invoice.", 500);
  }

  if (body.line_items) {
    const replaced = await replaceInvoiceLineItems(
      auth.supabase,
      id,
      body.line_items
    );
    if (replaced.error) {
      return jsonError(replaced.error, 500);
    }
    const recalc = await recalculateInvoiceBalance(
      auth.supabase,
      id,
      replaced.amount
    );
    if (recalc.error) {
      return jsonError(recalc.error, 500);
    }
  } else if (body.amount !== undefined) {
    const recalc = await recalculateInvoiceBalance(
      auth.supabase,
      id,
      Number(body.amount) || 0
    );
    if (recalc.error) {
      return jsonError(recalc.error, 500);
    }
  }

  const sync = await syncInvoiceToQuickBooks(id);
  const { data: refreshed } = await auth.supabase
    .from("invoices")
    .select("*, invoice_line_items(*)")
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

  const voidResult = await voidInvoiceInQuickBooks(id);
  if (voidResult.status === "failed") {
    const { data: failed } = await auth.supabase
      .from("invoices")
      .select("*, invoice_line_items(*)")
      .eq("id", id)
      .single();
    return jsonOk({
      ok: false,
      data: failed,
      syncError: voidResult.error,
      syncStatus: voidResult.status,
    });
  }

  const { error } = await auth.supabase.from("invoices").delete().eq("id", id);

  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonOk({
    ok: true,
    syncError: null,
    syncStatus: voidResult.status,
  });
}
