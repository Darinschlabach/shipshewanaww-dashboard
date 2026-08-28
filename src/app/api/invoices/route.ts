import { jsonError, jsonOk, requireApiUser } from "@/lib/api-auth";
import { invoiceDueDateFromIssueDate } from "@/lib/invoices";
import {
  recalculateInvoiceBalance,
  replaceInvoiceLineItems,
  type LineItemInput,
} from "@/lib/invoice-mutations";
import {
  syncInvoiceToQuickBooks,
  voidInvoicesForJobInQuickBooks,
} from "@/lib/integrations/quickbooks-sync";

type CreateBody = {
  invoice_number?: string;
  job_id?: string | null;
  customer_id?: string | null;
  customer_name?: string;
  invoice_date?: string;
  due_date?: string | null;
  amount?: number;
  status?: string;
  line_items?: LineItemInput[];
};

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;

  const body = (await request.json().catch(() => null)) as CreateBody | null;
  if (!body?.invoice_number?.trim()) {
    return jsonError("invoice_number is required.");
  }
  if (!body.customer_name?.trim()) {
    return jsonError("customer_name is required.");
  }

  const invoiceDate =
    body.invoice_date?.slice(0, 10) ||
    new Date().toISOString().slice(0, 10);

  const { data, error } = await auth.supabase
    .from("invoices")
    .insert({
      invoice_number: body.invoice_number.trim(),
      job_id: body.job_id || null,
      customer_id: body.customer_id || null,
      customer_name: body.customer_name.trim(),
      invoice_date: invoiceDate,
      due_date: body.due_date || invoiceDueDateFromIssueDate(invoiceDate),
      amount: Number(body.amount) || 0,
      balance: Number(body.amount) || 0,
      status: body.status || "open",
      qb_sync_status: "pending",
      qb_sync_error: null,
    })
    .select("*")
    .single();

  if (error || !data) {
    return jsonError(error?.message || "Could not create invoice.", 500);
  }

  let amount = Number(data.amount) || 0;
  if (body.line_items) {
    const replaced = await replaceInvoiceLineItems(
      auth.supabase,
      data.id,
      body.line_items
    );
    if (replaced.error) {
      return jsonError(replaced.error, 500);
    }
    amount = replaced.amount;
    const recalc = await recalculateInvoiceBalance(
      auth.supabase,
      data.id,
      amount
    );
    if (recalc.error) {
      return jsonError(recalc.error, 500);
    }
  }

  const sync = await syncInvoiceToQuickBooks(data.id);
  const { data: refreshed } = await auth.supabase
    .from("invoices")
    .select("*, invoice_line_items(*)")
    .eq("id", data.id)
    .single();

  return jsonOk({
    data: refreshed ?? { ...data, amount },
    syncError: sync.status === "failed" ? sync.error : null,
    syncStatus: sync.status,
  });
}

export async function DELETE(request: Request) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;

  const jobId = new URL(request.url).searchParams.get("job_id");
  if (!jobId) {
    return jsonError("job_id query parameter is required.");
  }

  const voidResult = await voidInvoicesForJobInQuickBooks(jobId);
  const { error } = await auth.supabase
    .from("invoices")
    .delete()
    .eq("job_id", jobId);

  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonOk({
    ok: true,
    syncError:
      voidResult.errors.length > 0 ? voidResult.errors.join("; ") : null,
  });
}
