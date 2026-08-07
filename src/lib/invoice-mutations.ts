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
  const balance = Math.max(0, amount - paid);

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
