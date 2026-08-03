import type {
  InvoiceDetailMeta,
  InvoiceDetailRow,
} from "@/lib/invoice-detail";
import { formatInvoiceNumber } from "@/lib/invoices";
import type { QuoteDocumentData, QuoteDocumentRoom } from "@/lib/quote-document";

export type InvoiceDocumentLineItem = {
  id: string;
  description: string;
  qty: number;
  price: number;
};

function daysBetween(start: string, end: string): number {
  const a = new Date(`${start}T12:00:00`);
  const b = new Date(`${end}T12:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 30;
  const diff = Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 30;
}

function isDeliveryLine(item: InvoiceDocumentLineItem): boolean {
  return (
    item.id === "quote-delivery" ||
    /delivery/i.test(item.description.trim())
  );
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
    itemCount: Math.max(1, item.qty),
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

  const deliveryItem = lineItems.find(isDeliveryLine);
  const deliveryTotal = deliveryItem
    ? deliveryItem.qty * deliveryItem.price
    : 0;
  const projectItems = lineItems.filter((item) => !isDeliveryLine(item));
  const rooms = lineItemsToRooms(projectItems);
  const roomsTotal = rooms.reduce((sum, room) => sum + room.roomTotal, 0);
  const servicesTotal = deliveryTotal;
  const quoteTotal = roomsTotal + servicesTotal;

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
    servicesTotal,
    deliveryTotal,
    quoteTotal,
    customerMessage: "",
  };
}
