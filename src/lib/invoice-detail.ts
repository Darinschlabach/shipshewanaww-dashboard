import {
  formatInvoiceNumber,
  isDueDateOverdue,
  type InvoiceRow,
} from "@/lib/invoices";
import type { Contact } from "@/lib/types";

export interface InvoiceDetailMeta {
  title: string;
  customerName: string;
  phone: string;
  email: string;
  customerAddress: string;
  jobName: string;
  jobAddress: string;
}

export type InvoiceDetailRow = InvoiceRow & {
  contacts?: Contact | null;
};

export function formatInvoiceDisplayNumber(
  invoice: Pick<InvoiceRow, "id" | "invoice_number" | "created_at">
): string {
  const num = formatInvoiceNumber(invoice);
  return num.startsWith("INV-") ? `Invoice # ${num}` : num;
}

export function getInvoiceTitle(invoice: InvoiceDetailRow): string {
  const customer = invoice.customer_name.trim();
  const jobName = invoice.jobs?.name?.trim();
  if (jobName) return `${customer} — ${jobName}`;
  return customer || "Invoice";
}

export function buildInvoiceDetail(invoice: InvoiceDetailRow): InvoiceDetailMeta {
  const contact = invoice.contacts ?? null;
  const customerName = contact?.name ?? invoice.customer_name;

  return {
    title: getInvoiceTitle(invoice),
    customerName,
    phone: contact?.phone?.trim() || "—",
    email: contact?.email?.trim() || "—",
    customerAddress: contact?.address?.trim() || "—",
    jobName: invoice.jobs?.name?.trim() || "—",
    jobAddress: contact?.address?.trim() || "—",
  };
}

export function invoiceDueDateClass(
  invoice: Pick<InvoiceRow, "due_date" | "balance" | "status">
): string {
  if (
    invoice.due_date &&
    isDueDateOverdue(invoice.due_date) &&
    Number(invoice.balance) > 0
  ) {
    return "font-medium text-red-600";
  }
  return "text-gray-700";
}
