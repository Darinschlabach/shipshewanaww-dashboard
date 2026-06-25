import {
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_STYLES,
  type InvoiceStatus,
} from "@/lib/invoices";

export default function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${INVOICE_STATUS_STYLES[status]}`}
    >
      {INVOICE_STATUS_LABELS[status]}
    </span>
  );
}
