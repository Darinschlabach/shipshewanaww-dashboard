import { computeInvoiceStatus, type InvoiceStatus } from "@/lib/invoices";
import type { SupabaseClient } from "@supabase/supabase-js";

export type LineItemInput = {
  description?: string;
  qty?: number;
  unit_price?: number;
  price?: number;
};

export function lineAmount(line: LineItemInput): number {
  const qty = Number(line.qty) || 0;
  const unit =
    line.unit_price !== undefined
      ? Number(line.unit_price)
      : Number(line.price) || 0;
  return qty * (Number.isFinite(unit) ? unit : 0);
}

export async function replaceInvoiceLineItems(
  supabase: SupabaseClient,
  invoiceId: string,
  lines: LineItemInput[]
): Promise<{ amount: number; error: string | null }> {
  const { error: deleteError } = await supabase
    .from("invoice_line_items")
    .delete()
    .eq("invoice_id", invoiceId);

  if (deleteError) {
    return { amount: 0, error: deleteError.message };
  }

  const rows = lines.map((line, index) => ({
    invoice_id: invoiceId,
    description: (line.description || "").trim() || "Line item",
    qty: Number(line.qty) || 1,
    unit_price:
      line.unit_price !== undefined
        ? Number(line.unit_price) || 0
        : Number(line.price) || 0,
    sort_order: index,
  }));

  const amount = rows.reduce(
    (sum, row) => sum + Number(row.qty) * Number(row.unit_price),
    0
  );

  if (rows.length > 0) {
    const { error: insertError } = await supabase
      .from("invoice_line_items")
      .insert(rows);
    if (insertError) {
      return { amount: 0, error: insertError.message };
    }
  }

  return { amount, error: null };
}

export function invoiceBalanceFromPaid(amount: number, paid: number): number {
  const total = Math.floor(Number(amount) || 0);
  return Math.max(0, Math.round((total - paid) * 100) / 100);
}

export async function syncInvoiceBalanceFromPayments(
  supabase: SupabaseClient,
  invoiceId: string
): Promise<{ balance: number; status: InvoiceStatus; error: string | null }> {
  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("amount")
    .eq("id", invoiceId)
    .single();

  if (error || !invoice) {
    return { balance: 0, status: "open", error: error?.message ?? "Invoice not found." };
  }

  return recalculateInvoiceBalance(supabase, invoiceId, Number(invoice.amount) || 0);
}

export async function recalculateInvoiceBalance(
  supabase: SupabaseClient,
  invoiceId: string,
  amount: number,
  explicitStatus?: InvoiceStatus
): Promise<{ balance: number; status: InvoiceStatus; error: string | null }> {
  const { data: payments, error: payError } = await supabase
    .from("invoice_payments")
    .select("amount")
    .eq("invoice_id", invoiceId);

  if (payError) {
    return { balance: amount, status: "open", error: payError.message };
  }

  const paid = (payments ?? []).reduce(
    (sum, row) => sum + (Number(row.amount) || 0),
    0
  );
  const balance = invoiceBalanceFromPaid(amount, paid);

  const { data: invoice } = await supabase
    .from("invoices")
    .select("due_date, status")
    .eq("id", invoiceId)
    .maybeSingle();

  const status = computeInvoiceStatus(
    balance,
    invoice?.due_date ?? null,
    explicitStatus ?? (invoice?.status as InvoiceStatus | undefined)
  );

  const { error } = await supabase
    .from("invoices")
    .update({ amount, balance, status })
    .eq("id", invoiceId);

  return { balance, status, error: error?.message ?? null };
}
