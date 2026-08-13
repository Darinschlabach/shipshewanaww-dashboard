import { jsonError, jsonOk, requireApiUser } from "@/lib/api-auth";
import {
  computeInvoiceStatus,
  isMissingInvoicePaymentReferenceColumn,
} from "@/lib/invoices";
import { syncPaymentToQuickBooks } from "@/lib/integrations/quickbooks-sync";

type PaymentBody = {
  amount?: number;
  paid_at?: string;
  method?: string | null;
  reference?: string | null;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;

  const { id: invoiceId } = await params;
  const body = (await request.json().catch(() => null)) as PaymentBody | null;
  const amount = Number(body?.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return jsonError("Enter a valid payment amount.");
  }

  const { data: invoice, error: invoiceError } = await auth.supabase
    .from("invoices")
    .select("id, amount, balance, due_date, status")
    .eq("id", invoiceId)
    .single();

  if (invoiceError || !invoice) {
    return jsonError("Invoice not found.", 404);
  }

  const paidAt = body?.paid_at
    ? new Date(
        body.paid_at.includes("T")
          ? body.paid_at
          : `${body.paid_at}T12:00:00`
      ).toISOString()
    : new Date().toISOString();

  const insertPayload = {
    invoice_id: invoiceId,
    amount,
    paid_at: paidAt,
    method: body?.method || null,
    reference: body?.reference?.trim() || null,
    qb_sync_status: "pending",
    qb_sync_error: null,
  };

  let { data: payment, error } = await auth.supabase
    .from("invoice_payments")
    .insert(insertPayload)
    .select("*")
    .single();

  if (error && isMissingInvoicePaymentReferenceColumn(error.message)) {
    const { reference: _reference, ...withoutReference } = insertPayload;
    ({ data: payment, error } = await auth.supabase
      .from("invoice_payments")
      .insert(withoutReference)
      .select("*")
      .single());
  }

  if (error || !payment) {
    return jsonError(error?.message || "Could not record payment.", 500);
  }

  const balance = Math.max(0, Number(invoice.balance) - amount);
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

  const sync = await syncPaymentToQuickBooks(payment.id);
  const { data: refreshedPayment } = await auth.supabase
    .from("invoice_payments")
    .select("*")
    .eq("id", payment.id)
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
