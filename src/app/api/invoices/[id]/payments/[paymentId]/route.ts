import { jsonError, jsonOk, requireApiUser } from "@/lib/api-auth";
import {
  computeInvoiceStatus,
  isMissingInvoicePaymentReferenceColumn,
} from "@/lib/invoices";
import {
  deletePaymentInQuickBooks,
  syncPaymentToQuickBooks,
} from "@/lib/integrations/quickbooks-sync";

type PaymentBody = {
  amount?: number;
  paid_at?: string;
  method?: string | null;
  reference?: string | null;
};

export async function PATCH(
  request: Request,
  {
    params,
  }: { params: Promise<{ id: string; paymentId: string }> }
) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;

  const { id: invoiceId, paymentId } = await params;
  const body = (await request.json().catch(() => null)) as PaymentBody | null;
  if (!body) return jsonError("Invalid request body.");

  const { data: existing, error: existingError } = await auth.supabase
    .from("invoice_payments")
    .select("*")
    .eq("id", paymentId)
    .eq("invoice_id", invoiceId)
    .single();

  if (existingError || !existing) {
    return jsonError("Payment not found.", 404);
  }

  const { data: invoice, error: invoiceError } = await auth.supabase
    .from("invoices")
    .select("id, balance, due_date, status")
    .eq("id", invoiceId)
    .single();

  if (invoiceError || !invoice) {
    return jsonError("Invoice not found.", 404);
  }

  const amount =
    body.amount !== undefined ? Number(body.amount) : Number(existing.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return jsonError("Enter a valid payment amount.");
  }

  const paidAt = body.paid_at
    ? new Date(
        body.paid_at.includes("T")
          ? body.paid_at
          : `${body.paid_at}T12:00:00`
      ).toISOString()
    : existing.paid_at;

  const patch: Record<string, unknown> = {
    amount,
    paid_at: paidAt,
    qb_sync_status: "pending",
    qb_sync_error: null,
  };
  if (body.method !== undefined) patch.method = body.method;
  if (body.reference !== undefined) {
    patch.reference = body.reference?.trim() || null;
  }

  let { data: payment, error } = await auth.supabase
    .from("invoice_payments")
    .update(patch)
    .eq("id", paymentId)
    .select("*")
    .single();

  if (error && isMissingInvoicePaymentReferenceColumn(error.message)) {
    const { reference: _reference, ...withoutReference } = patch;
    ({ data: payment, error } = await auth.supabase
      .from("invoice_payments")
      .update(withoutReference)
      .eq("id", paymentId)
      .select("*")
      .single());
  }

  if (error || !payment) {
    return jsonError(error?.message || "Could not update payment.", 500);
  }

  const amountDelta = Number(existing.amount) - amount;
  const balance = Math.max(0, Number(invoice.balance) + amountDelta);
  const status = computeInvoiceStatus(
    balance,
    invoice.due_date,
    invoice.status === "draft" ? "draft" : undefined
  );

  const { error: updateError } = await auth.supabase
    .from("invoices")
    .update({ balance, status })
    .eq("id", invoiceId);

  if (updateError) {
    return jsonError(updateError.message, 500);
  }

  const sync = await syncPaymentToQuickBooks(paymentId);
  const { data: refreshedPayment } = await auth.supabase
    .from("invoice_payments")
    .select("*")
    .eq("id", paymentId)
    .single();
  const { data: refreshedInvoice } = await auth.supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .single();

  return jsonOk({
    data: refreshedPayment ?? payment,
    invoice: refreshedInvoice,
    syncError: sync.status === "failed" ? sync.error : null,
    syncStatus: sync.status,
  });
}

export async function DELETE(
  _request: Request,
  {
    params,
  }: { params: Promise<{ id: string; paymentId: string }> }
) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;

  const { id: invoiceId, paymentId } = await params;

  const { data: existing, error: existingError } = await auth.supabase
    .from("invoice_payments")
    .select("*")
    .eq("id", paymentId)
    .eq("invoice_id", invoiceId)
    .single();

  if (existingError || !existing) {
    return jsonError("Payment not found.", 404);
  }

  const { data: invoice, error: invoiceError } = await auth.supabase
    .from("invoices")
    .select("id, balance, due_date, status")
    .eq("id", invoiceId)
    .single();

  if (invoiceError || !invoice) {
    return jsonError("Invoice not found.", 404);
  }

  // Prefer voiding in QB first when mapped; if that fails, keep local for retry.
  if (existing.qb_id) {
    const qbDelete = await deletePaymentInQuickBooks(paymentId);
    if (qbDelete.status === "failed") {
      const { data: failedPayment } = await auth.supabase
        .from("invoice_payments")
        .select("*")
        .eq("id", paymentId)
        .single();
      return jsonOk({
        ok: false,
        data: failedPayment ?? existing,
        invoice,
        syncError: qbDelete.error,
        syncStatus: qbDelete.status,
      });
    }
  }

  const { error } = await auth.supabase
    .from("invoice_payments")
    .delete()
    .eq("id", paymentId);

  if (error) {
    return jsonError(error.message, 500);
  }

  const balance = Math.max(
    0,
    Number(invoice.balance) + Number(existing.amount)
  );
  const status = computeInvoiceStatus(
    balance,
    invoice.due_date,
    invoice.status === "draft" ? "draft" : undefined
  );

  const { error: updateError } = await auth.supabase
    .from("invoices")
    .update({ balance, status })
    .eq("id", invoiceId);

  if (updateError) {
    return jsonError(updateError.message, 500);
  }

  const { data: refreshedInvoice } = await auth.supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .single();

  return jsonOk({
    ok: true,
    invoice: refreshedInvoice,
    syncError: null,
    syncStatus: "synced",
  });
}
