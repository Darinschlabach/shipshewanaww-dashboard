import type {
  InvoiceDetailMeta,
  InvoiceDetailRow,
} from "@/lib/invoice-detail";
import { formatInvoiceNumber, isSyntheticInvoiceId } from "@/lib/invoices";
import type { QuoteDocumentData, QuoteDocumentRoom } from "@/lib/quote-document";
import { createClient } from "@/lib/supabase/client";

export type InvoiceDocumentLineItem = {
  id: string;
  description: string;
  qty: number;
  price: number;
};

export type InvoiceDocumentPayment = {
  id: string;
  amount: number;
  paidAt: string;
  method: string;
  reference: string;
};

function daysBetween(start: string, end: string): number {
  const a = new Date(`${start}T12:00:00`);
  const b = new Date(`${end}T12:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 30;
  const diff = Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 30;
}

function lineItemsToRooms(
  items: InvoiceDocumentLineItem[]
): QuoteDocumentRoom[] {
  return items.map((item) => ({
    id: item.id,
    name: item.description.trim() || "—",
    woodSpecies: "—",
    finish: "—",
    doorStyle: "—",
    cabinetMultiplier: "—",
    itemCount: item.qty,
    roomTotal: item.qty * item.price,
    items: [],
  }));
}

/** Maps invoice UI data into the quote PDF document shape (quote first page). */
export function buildInvoiceDocumentData(
  invoice: InvoiceDetailRow,
  meta: InvoiceDetailMeta,
  lineItems: InvoiceDocumentLineItem[]
): QuoteDocumentData {
  const invoiceDate =
    invoice.invoice_date?.slice(0, 10) ||
    invoice.created_at.slice(0, 10);
  const dueDate = invoice.due_date?.slice(0, 10) || invoiceDate;

  const rooms = lineItemsToRooms(lineItems);
  const roomsTotal = rooms.reduce((sum, room) => sum + room.roomTotal, 0);

  return {
    quoteNumber: formatInvoiceNumber(invoice),
    quoteDate: invoiceDate,
    expirationDate: dueDate,
    validForDays: daysBetween(invoiceDate, dueDate),
    customerName: meta.customerName,
    customerAddress: meta.customerAddress,
    customerPhone: meta.phone,
    customerEmail: meta.email,
    jobName: meta.jobName,
    jobAddress: meta.jobAddress,
    notes: "",
    rooms,
    services: [],
    roomsTotal,
    servicesTotal: 0,
    deliveryTotal: 0,
    quoteTotal: roomsTotal,
    customerMessage: "",
  };
}

/** Payments for this invoice, or all invoices on the same job when linked. */
export async function fetchInvoiceDocumentPayments(
  invoice: Pick<InvoiceDetailRow, "id" | "job_id">
): Promise<InvoiceDocumentPayment[]> {
  try {
    if (isSyntheticInvoiceId(invoice.id)) return [];

    const supabase = createClient();
    let invoiceIds = [invoice.id];

    if (invoice.job_id) {
      const { data: jobInvoices, error: jobError } = await supabase
        .from("invoices")
        .select("id")
        .eq("job_id", invoice.job_id);

      if (!jobError && jobInvoices && jobInvoices.length > 0) {
        invoiceIds = jobInvoices
          .map((row) => row.id as string)
          .filter(Boolean);
      }
    }

    type PaymentQueryRow = {
      id: string;
      amount: number | string;
      paid_at: string;
      method: string | null;
      reference?: string | null;
    };

    let data: PaymentQueryRow[] | null = null;
    let error: { message: string } | null = null;

    const withReference = await supabase
      .from("invoice_payments")
      .select("id, amount, paid_at, method, reference")
      .in("invoice_id", invoiceIds)
      .order("paid_at", { ascending: true });

    if (
      withReference.error &&
      withReference.error.message.toLowerCase().includes("reference")
    ) {
      const withoutReference = await supabase
        .from("invoice_payments")
        .select("id, amount, paid_at, method")
        .in("invoice_id", invoiceIds)
        .order("paid_at", { ascending: true });
      data = (withoutReference.data as PaymentQueryRow[] | null) ?? null;
      error = withoutReference.error;
    } else {
      data = (withReference.data as PaymentQueryRow[] | null) ?? null;
      error = withReference.error;
    }

    if (error || !data) return [];

    return data.map((row) => ({
      id: row.id,
      amount: Number(row.amount) || 0,
      paidAt: String(row.paid_at).slice(0, 10),
      method: row.method?.trim() || "—",
      reference: row.reference?.trim() || "—",
    }));
  } catch {
    return [];
  }
}
