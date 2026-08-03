"use client";

import {
  IconArrowLeft,
  IconArrowRight,
  IconFileTypePdf,
  IconMail,
  IconMapPin,
  IconPencil,
  IconPhone,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import Button from "@/components/Button";
import ConfirmModal from "@/components/ConfirmModal";
import Modal from "@/components/Modal";
import { COMPANY } from "@/lib/company";
import { downloadInvoicePdf } from "@/lib/download-invoice-pdf";
import {
  buildInvoiceDetail,
  formatInvoiceDisplayNumber,
  invoiceDueDateClass,
  type InvoiceDetailMeta,
  type InvoiceDetailRow,
} from "@/lib/invoice-detail";
import {
  formatInvoiceNumber,
  isSyntheticInvoiceId,
  type InvoicePayment,
} from "@/lib/invoices";
import {
  buildQuoteRoomSummaries,
  fetchQuoteRoomsWithItems,
} from "@/lib/quote-rooms";
import {
  DELIVERY_SERVICE_NAME,
  fetchQuoteServices,
  quoteDeliveryTotal,
} from "@/lib/quote-services";
import { createClient } from "@/lib/supabase/client";
import { formatCurrencyFull, formatCurrencyPrecise, formatDateLong } from "@/lib/utils";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "billing", label: "Billing" },
  { id: "payments", label: "Payments" },
];

interface InvoiceLineItem {
  id: string;
  description: string;
  qty: number;
  price: number;
}

function isQuoteSourcedLineItem(id: string): boolean {
  return id.startsWith("quote-room-") || id === "quote-delivery";
}

function getInvoiceLineItems(invoice: InvoiceDetailRow): InvoiceLineItem[] {
  const amount = Number(invoice.amount) || 0;
  if (amount <= 0) return [];

  return [
    {
      id: "1",
      description: invoice.jobs?.name?.trim() || "Invoice",
      qty: 1,
      price: amount,
    },
  ];
}

interface BillingEditForm {
  name: string;
  phone: string;
  email: string;
  address: string;
  dueDate: string;
}

function blankBillingForm(invoice: InvoiceDetailRow): BillingEditForm {
  const contact = invoice.contacts;
  return {
    name: contact?.name?.trim() || invoice.customer_name || "",
    phone: contact?.phone?.trim() || "",
    email: contact?.email?.trim() || "",
    address: contact?.address?.trim() || "",
    dueDate: invoice.due_date || "",
  };
}

function InvoiceBillingInfoPanel({
  invoice,
  meta,
  onUpdated,
}: {
  invoice: InvoiceDetailRow;
  meta: InvoiceDetailMeta;
  onUpdated: (next: InvoiceDetailRow) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<BillingEditForm>(() =>
    blankBillingForm(invoice)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openEdit() {
    setForm(blankBillingForm(invoice));
    setError(null);
    setEditing(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      setError("Name is required.");
      return;
    }

    setSaving(true);
    setError(null);
    const supabase = createClient();
    const phone = form.phone.trim() || null;
    const email = form.email.trim() || null;
    const address = form.address.trim() || null;
    const dueDate = form.dueDate.trim() || null;

    if (invoice.customer_id) {
      const { error: contactError } = await supabase
        .from("contacts")
        .update({ name, phone, email, address })
        .eq("id", invoice.customer_id);
      if (contactError) {
        setSaving(false);
        setError(contactError.message);
        return;
      }
    }

    if (!isSyntheticInvoiceId(invoice.id)) {
      const { error: invoiceError } = await supabase
        .from("invoices")
        .update({ customer_name: name, due_date: dueDate })
        .eq("id", invoice.id);
      if (invoiceError) {
        setSaving(false);
        setError(invoiceError.message);
        return;
      }
    }

    const nextContacts = {
      id: invoice.contacts?.id || invoice.customer_id || "local",
      name,
      phone,
      email,
      address,
      fax: invoice.contacts?.fax ?? null,
      birthday: invoice.contacts?.birthday ?? null,
      contact_type: invoice.contacts?.contact_type ?? ("Customers" as const),
      created_at: invoice.contacts?.created_at ?? "",
      updated_at: invoice.contacts?.updated_at ?? "",
    };

    onUpdated({
      ...invoice,
      customer_name: name,
      due_date: dueDate,
      contacts: nextContacts,
    });
    setSaving(false);
    setEditing(false);
  }

  return (
    <>
      <div className="relative rounded-lg border border-gray-200 bg-white p-5">
        <button
          type="button"
          onClick={openEdit}
          className="absolute right-3 top-3 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-burgundy"
          aria-label="Edit billing info"
        >
          <IconPencil size={16} />
        </button>

        <div className="space-y-4 pr-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Bill To
            </p>
            <p className="mt-1 font-medium text-gray-900">{meta.customerName}</p>
            <p className="mt-1 flex items-center gap-1 text-sm text-gray-600">
              <IconPhone size={14} />
              {meta.phone}
            </p>
            <p className="flex items-center gap-1 text-sm text-gray-600">
              <IconMail size={14} />
              {meta.email}
            </p>
            <p className="mt-0.5 flex items-start gap-1 text-sm text-gray-600">
              <IconMapPin size={14} className="mt-0.5 shrink-0" />
              {meta.customerAddress}
            </p>
          </div>

          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-gray-500">Invoice #</dt>
              <dd className="font-medium text-gray-900">
                {formatInvoiceNumber(invoice)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-gray-500">Invoice Date</dt>
              <dd className="text-gray-900">
                {formatDateLong(invoice.invoice_date)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-gray-500">Due Date</dt>
              <dd className={invoiceDueDateClass(invoice)}>
                {invoice.due_date ? formatDateLong(invoice.due_date) : "—"}
              </dd>
            </div>
            {meta.jobName !== "—" && (
              <div className="flex items-center justify-between gap-4">
                <dt className="text-gray-500">Job</dt>
                <dd className="text-right text-gray-900">{meta.jobName}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {editing && (
        <Modal title="Edit Billing Info" onClose={() => !saving && setEditing(false)}>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Name
              </label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Phone
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Address
              </label>
              <AddressAutocomplete
                id="invoice-billing-address"
                value={form.address}
                onChange={(address) => setForm({ ...form, address })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Due Date
              </label>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                onClick={() => setEditing(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function InvoiceSummaryPanel({
  items,
  invoice,
}: {
  items: InvoiceLineItem[];
  invoice: InvoiceDetailRow;
}) {
  const subtotal = items.reduce((sum, item) => sum + item.qty * item.price, 0);
  const discount = 0;
  const tax = 0;
  const total = subtotal - discount + tax;
  const depositsReceived = Math.max(
    0,
    Number(invoice.amount) - Number(invoice.balance)
  );
  const balanceDue = Math.max(0, total - depositsReceived);

  function SummaryRow({
    label,
    value,
    bold,
    highlight,
  }: {
    label: string;
    value: ReactNode;
    bold?: boolean;
    highlight?: boolean;
  }) {
    const textClass = highlight
      ? "font-semibold text-burgundy"
      : bold
        ? "font-semibold text-gray-900"
        : "text-gray-700";

    return (
      <div className={`flex items-center justify-between gap-4 py-2 text-sm ${textClass}`}>
        <span>{label}</span>
        <span className="tabular-nums">{value}</span>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white p-5">
      <div className="space-y-0">
        <SummaryRow label="Subtotal" value={formatCurrencyPrecise(subtotal)} />
        <SummaryRow label="Discount" value={formatCurrencyPrecise(discount)} />
        <SummaryRow label="Tax" value={formatCurrencyPrecise(tax)} />

        <hr className="my-1 border-gray-200" />

        <SummaryRow label="Total" value={formatCurrencyPrecise(total)} bold />
        <SummaryRow
          label="Payments Received"
          value={formatCurrencyPrecise(depositsReceived)}
        />
      </div>

      <div className="mt-auto pt-2">
        <hr className="mb-1 border-gray-200" />
        <SummaryRow
          label="Balance Due"
          value={formatCurrencyPrecise(balanceDue)}
          highlight
        />
      </div>
    </div>
  );
}

function InvoiceItemsPanel({
  items,
  editingId,
  onAddLineItem,
  onAddQuoteItems,
  onEditItem,
  onDeleteItem,
  onChangeItem,
  onStopEditing,
  addingQuoteItems,
  canAddQuoteItems,
}: {
  items: InvoiceLineItem[];
  editingId: string | null;
  onAddLineItem: () => void;
  onAddQuoteItems: () => void;
  onEditItem: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onChangeItem: (
    id: string,
    field: keyof Omit<InvoiceLineItem, "id">,
    value: string
  ) => void;
  onStopEditing: () => void;
  addingQuoteItems: boolean;
  canAddQuoteItems: boolean;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white p-5">
      <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-gray-900">Invoice Items</h3>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onAddQuoteItems}
            disabled={!canAddQuoteItems || addingQuoteItems}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            title={
              canAddQuoteItems
                ? "Add rooms and delivery from the linked quote"
                : "Link this invoice to a job with a quote first"
            }
          >
            {addingQuoteItems ? "Adding…" : "Add Quote Items"}
          </button>
          <button
            type="button"
            onClick={onAddLineItem}
            className="rounded-md bg-burgundy px-3 py-1.5 text-sm font-medium text-white hover:bg-burgundy/90"
          >
            + Add Line Item
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-md border border-gray-200">
        <table className="w-full table-fixed text-sm">
          <thead className="sticky top-0 bg-gray-50">
            <tr className="border-b border-gray-200">
              <th className="w-16 px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                Qty
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                Description
              </th>
              <th className="w-28 px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                Price
              </th>
              <th className="w-20 px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-sm text-gray-500"
                >
                  No line items yet.
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const editing = editingId === item.id;
                return (
                  <tr
                    key={item.id}
                    className="group border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="w-16 px-4 py-3 text-left text-gray-900">
                      {editing ? (
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={item.qty}
                          onChange={(e) =>
                            onChangeItem(item.id, "qty", e.target.value)
                          }
                          className="w-14 rounded border border-gray-300 px-1.5 py-1 text-sm"
                          autoFocus
                        />
                      ) : (
                        item.qty
                      )}
                    </td>
                    <td className="min-w-0 px-4 py-3 text-gray-900">
                      {editing ? (
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) =>
                            onChangeItem(item.id, "description", e.target.value)
                          }
                          className="w-full min-w-0 rounded border border-gray-300 px-2 py-1 text-sm"
                        />
                      ) : (
                        item.description || "—"
                      )}
                    </td>
                    <td className="w-28 px-4 py-3 text-right text-gray-900">
                      {editing ? (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.price}
                          onChange={(e) =>
                            onChangeItem(item.id, "price", e.target.value)
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === "Escape") {
                              onStopEditing();
                            }
                          }}
                          className="ml-auto w-24 rounded border border-gray-300 px-1.5 py-1 text-right text-sm"
                        />
                      ) : (
                        formatCurrencyPrecise(item.price)
                      )}
                    </td>
                    <td className="w-20 px-3 py-3">
                      <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => onEditItem(item.id)}
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-burgundy"
                          aria-label={`Edit ${item.description || "line item"}`}
                        >
                          <IconPencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteItem(item.id)}
                          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                          aria-label={`Delete ${item.description || "line item"}`}
                        >
                          <IconTrash size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface InvoiceDetailViewProps {
  invoice: InvoiceDetailRow;
  onDelete: () => void;
  deleting: boolean;
}

const PAYMENT_METHODS = [
  "Check",
  "ACH Transfer",
  "Credit Card",
  "Cash",
  "Other",
] as const;

type PaymentRow = InvoicePayment & {
  reference?: string | null;
};

function InvoicePreviewPanel({
  invoice,
  meta,
  lineItems,
}: {
  invoice: InvoiceDetailRow;
  meta: InvoiceDetailMeta;
  lineItems: InvoiceLineItem[];
}) {
  const invoiceTotal = Number(invoice.amount) || 0;
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  async function handleDownloadPdf() {
    setDownloadingPdf(true);
    setPdfError(null);
    const { error } = await downloadInvoicePdf({
      invoice,
      meta,
      lineItems,
    });
    if (error) setPdfError(error);
    setDownloadingPdf(false);
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <h3 className="mb-2 shrink-0 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Invoice Preview
      </h3>

      <div className="mb-3 flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gradient-to-b from-gray-50 to-white p-4 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={COMPANY.logoPath}
          alt={COMPANY.name}
          className="mb-2 h-12 w-auto max-w-full object-contain"
        />
        <p className="font-serif text-sm font-semibold tracking-wide text-burgundy">
          INVOICE
        </p>
        <p className="text-[10px] uppercase tracking-wider text-gray-500">
          {COMPANY.tagline}
        </p>
        <p className="mt-2 line-clamp-2 text-xs font-medium text-gray-800">
          {meta.title}
        </p>
        <p className="mt-1 text-lg font-semibold text-gray-900">
          {formatCurrencyFull(invoiceTotal)}
        </p>
        <p className="mt-0.5 text-[10px] text-gray-500">
          {formatInvoiceNumber(invoice)}
        </p>
      </div>

      {pdfError ? (
        <p className="mb-2 shrink-0 text-center text-xs text-red-600">
          {pdfError}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => {
          void handleDownloadPdf();
        }}
        disabled={downloadingPdf}
        className="flex w-full shrink-0 items-center justify-center gap-2 rounded-md border border-gray-300 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-60"
      >
        <IconFileTypePdf size={18} />
        {downloadingPdf ? "Preparing PDF…" : "Download PDF"}
      </button>
    </div>
  );
}

function InvoicePaymentHistoryPanel({
  invoice,
  onInvoiceUpdated,
}: {
  invoice: InvoiceDetailRow;
  onInvoiceUpdated: (next: InvoiceDetailRow) => void;
}) {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPayment, setEditingPayment] = useState<PaymentRow | null>(null);
  const [recording, setRecording] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    amount: "",
    method: "Check",
    paidAt: new Date().toISOString().slice(0, 10),
    reference: "",
  });

  const modalOpen = recording || editingPayment != null;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (isSyntheticInvoiceId(invoice.id)) {
        if (!cancelled) {
          setPayments([]);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      const supabase = createClient();
      const { data, error: loadError } = await supabase
        .from("invoice_payments")
        .select("id, invoice_id, amount, paid_at, method")
        .eq("invoice_id", invoice.id)
        .order("paid_at", { ascending: false });

      if (cancelled) return;

      if (loadError) {
        setError(loadError.message);
        setPayments([]);
      } else {
        setError(null);
        setPayments((data as PaymentRow[]) ?? []);
      }
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [invoice.id]);

  function closeModal() {
    if (saving) return;
    setRecording(false);
    setEditingPayment(null);
    setError(null);
  }

  function openRecord() {
    setEditingPayment(null);
    setForm({
      amount: "",
      method: "Check",
      paidAt: new Date().toISOString().slice(0, 10),
      reference: "",
    });
    setError(null);
    setRecording(true);
  }

  function openEdit(payment: PaymentRow) {
    setRecording(false);
    setEditingPayment(payment);
    setForm({
      amount: String(Number(payment.amount)),
      method: payment.method || "Check",
      paidAt: payment.paid_at.slice(0, 10),
      reference: payment.reference?.trim() || "",
    });
    setError(null);
  }

  function applyBalanceDelta(delta: number): {
    balance: number;
    status: InvoiceDetailRow["status"];
  } {
    const balance = Math.max(0, Number(invoice.balance) + delta);
    const status =
      balance <= 0
        ? ("paid" as const)
        : invoice.status === "paid"
          ? ("open" as const)
          : invoice.status;
    return { balance, status };
  }

  async function handleSavePayment(e: FormEvent) {
    e.preventDefault();
    if (isSyntheticInvoiceId(invoice.id)) {
      setError("Save this invoice before recording payments.");
      return;
    }

    const amount = parseFloat(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid payment amount.");
      return;
    }

    setSaving(true);
    setError(null);
    const supabase = createClient();
    const paidAt = form.paidAt
      ? new Date(`${form.paidAt}T12:00:00`).toISOString()
      : new Date().toISOString();
    const reference = form.reference.trim() || null;

    if (editingPayment) {
      const amountDelta = Number(editingPayment.amount) - amount;
      const { error: updatePaymentError } = await supabase
        .from("invoice_payments")
        .update({
          amount,
          paid_at: paidAt,
          method: form.method,
        })
        .eq("id", editingPayment.id);

      if (updatePaymentError) {
        setSaving(false);
        setError(updatePaymentError.message);
        return;
      }

      const { balance, status } = applyBalanceDelta(amountDelta);
      const { error: updateInvoiceError } = await supabase
        .from("invoices")
        .update({ balance, status })
        .eq("id", invoice.id);

      if (updateInvoiceError) {
        setSaving(false);
        setError(updateInvoiceError.message);
        return;
      }

      setPayments((prev) =>
        prev.map((payment) =>
          payment.id === editingPayment.id
            ? {
                ...payment,
                amount,
                paid_at: paidAt,
                method: form.method,
                reference,
              }
            : payment
        )
      );
      onInvoiceUpdated({ ...invoice, balance, status });
      setSaving(false);
      setEditingPayment(null);
      return;
    }

    const { data, error: insertError } = await supabase
      .from("invoice_payments")
      .insert({
        invoice_id: invoice.id,
        amount,
        paid_at: paidAt,
        method: form.method,
      })
      .select("id, invoice_id, amount, paid_at, method")
      .single();

    if (insertError || !data) {
      setSaving(false);
      setError(insertError?.message || "Could not record payment.");
      return;
    }

    const { balance, status } = applyBalanceDelta(-amount);
    const { error: updateError } = await supabase
      .from("invoices")
      .update({ balance, status })
      .eq("id", invoice.id);

    if (updateError) {
      setSaving(false);
      setError(updateError.message);
      return;
    }

    setPayments((prev) => [
      {
        ...(data as PaymentRow),
        reference,
      },
      ...prev,
    ]);
    onInvoiceUpdated({ ...invoice, balance, status });
    setSaving(false);
    setRecording(false);
  }

  async function handleDeletePayment(payment: PaymentRow) {
    if (isSyntheticInvoiceId(invoice.id)) return;

    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("invoice_payments")
      .delete()
      .eq("id", payment.id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    const { balance, status } = applyBalanceDelta(Number(payment.amount));
    const { error: updateError } = await supabase
      .from("invoices")
      .update({ balance, status })
      .eq("id", invoice.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setPayments((prev) => prev.filter((row) => row.id !== payment.id));
    onInvoiceUpdated({ ...invoice, balance, status });
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white p-5">
        <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-gray-900">
            Payment History
          </h3>
          <button
            type="button"
            onClick={openRecord}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-burgundy px-3 py-1.5 text-sm font-medium text-white hover:bg-burgundy/90"
          >
            <IconPlus size={16} />
            Record Payment
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto rounded-md border border-gray-200">
          <table className="w-full min-w-[32rem] text-sm">
            <thead className="sticky top-0 bg-gray-50">
              <tr className="border-b border-gray-200">
                {["Date", "Method", "Reference", "Amount", ""].map((label) => (
                  <th
                    key={label || "actions"}
                    className={`px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-gray-500 ${
                      label === "Amount" ? "text-right" : "text-left"
                    }`}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-8 text-center text-sm text-gray-500"
                  >
                    Loading…
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-8 text-center text-sm text-gray-500"
                  >
                    No payments recorded yet.
                  </td>
                </tr>
              ) : (
                payments.map((payment) => (
                  <tr
                    key={payment.id}
                    className="group border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                  >
                    <td className="px-3 py-3 text-gray-900">
                      {formatDateLong(payment.paid_at.slice(0, 10))}
                    </td>
                    <td className="px-3 py-3 text-gray-900">
                      {payment.method || "—"}
                    </td>
                    <td className="px-3 py-3 text-gray-600">
                      {payment.reference?.trim() || "—"}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-gray-900">
                      {formatCurrencyPrecise(Number(payment.amount))}
                    </td>
                    <td className="w-20 px-2 py-3">
                      <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => openEdit(payment)}
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-burgundy"
                          aria-label="Edit payment"
                        >
                          <IconPencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeletePayment(payment)}
                          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                          aria-label="Delete payment"
                        >
                          <IconTrash size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {error && !modalOpen && (
          <p className="mt-3 shrink-0 text-sm text-red-600">{error}</p>
        )}
      </div>

      {modalOpen && (
        <Modal
          title={editingPayment ? "Edit Payment" : "Record Payment"}
          onClose={closeModal}
        >
          <form onSubmit={handleSavePayment} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Amount
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Method
              </label>
              <select
                value={form.method}
                onChange={(e) => setForm({ ...form, method: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Date
              </label>
              <input
                type="date"
                required
                value={form.paidAt}
                onChange={(e) => setForm({ ...form, paidAt: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Reference
              </label>
              <input
                type="text"
                value={form.reference}
                onChange={(e) =>
                  setForm({ ...form, reference: e.target.value })
                }
                placeholder="Check #, last 4, etc."
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-3">
              <Button type="button" onClick={closeModal} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={saving}>
                {saving
                  ? "Saving…"
                  : editingPayment
                    ? "Save Changes"
                    : "Record Payment"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

export default function InvoiceDetailView({
  invoice: initialInvoice,
  onDelete,
  deleting,
}: InvoiceDetailViewProps) {
  const [invoice, setInvoice] = useState(initialInvoice);
  const [activeTab, setActiveTab] = useState("overview");
  const [showDelete, setShowDelete] = useState(false);
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>(() =>
    getInvoiceLineItems(initialInvoice)
  );
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [addingQuoteItems, setAddingQuoteItems] = useState(false);
  const [quoteItemsError, setQuoteItemsError] = useState<string | null>(null);
  const meta = buildInvoiceDetail(invoice);
  const canAddQuoteItems = Boolean(invoice.job_id);

  function handleAddLineItem() {
    const id = `line-${Date.now()}`;
    setLineItems((prev) => [
      ...prev,
      {
        id,
        description: "",
        qty: 1,
        price: 0,
      },
    ]);
    setEditingLineId(id);
  }

  function handleEditLineItem(id: string) {
    setEditingLineId((current) => (current === id ? null : id));
  }

  function handleDeleteLineItem(id: string) {
    setLineItems((prev) => prev.filter((item) => item.id !== id));
    setEditingLineId((current) => (current === id ? null : current));
  }

  function handleChangeLineItem(
    id: string,
    field: keyof Omit<InvoiceLineItem, "id">,
    value: string
  ) {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        if (field === "description") {
          return { ...item, description: value };
        }
        const numeric = parseFloat(value);
        return {
          ...item,
          [field]: Number.isFinite(numeric) ? numeric : 0,
        };
      })
    );
  }

  async function handleAddQuoteItems() {
    if (!invoice.job_id) {
      setQuoteItemsError("This invoice is not linked to a job.");
      return;
    }

    setAddingQuoteItems(true);
    setQuoteItemsError(null);

    const supabase = createClient();
    const { data: quotes, error: quoteError } = await supabase
      .from("leads")
      .select("id")
      .or(`job_id.eq.${invoice.job_id},converted_job_id.eq.${invoice.job_id}`)
      .order("created_at", { ascending: false })
      .limit(1);

    if (quoteError || !quotes?.length) {
      setQuoteItemsError(
        quoteError?.message || "No quote found for this job."
      );
      setAddingQuoteItems(false);
      return;
    }

    const quoteId = quotes[0].id;
    const [{ rooms, error: roomsError }, { services, error: servicesError }] =
      await Promise.all([
        fetchQuoteRoomsWithItems(quoteId),
        fetchQuoteServices(quoteId),
      ]);

    if (roomsError || servicesError) {
      setQuoteItemsError(roomsError || servicesError);
      setAddingQuoteItems(false);
      return;
    }

    const roomLines = buildQuoteRoomSummaries(rooms).map((room) => ({
      id: `quote-room-${room.id}`,
      description: room.name,
      qty: 1,
      price: room.amount,
    }));

    const deliveryTotal = quoteDeliveryTotal(services);
    const quoteLines: InvoiceLineItem[] = [...roomLines];
    if (deliveryTotal > 0) {
      quoteLines.push({
        id: "quote-delivery",
        description: DELIVERY_SERVICE_NAME,
        qty: 1,
        price: deliveryTotal,
      });
    }

    if (quoteLines.length === 0) {
      setQuoteItemsError("This quote has no rooms or delivery amount to add.");
      setAddingQuoteItems(false);
      return;
    }

    setLineItems((prev) => [
      ...prev.filter((item) => !isQuoteSourcedLineItem(item.id)),
      ...quoteLines,
    ]);
    setAddingQuoteItems(false);
  }

  const fillHeight =
    activeTab === "overview" ||
    activeTab === "billing" ||
    activeTab === "payments";

  return (
    <div
      className={
        fillHeight
          ? "flex h-[calc(100vh-2.5rem)] min-h-0 flex-col overflow-hidden"
          : "pb-8"
      }
    >
      <Link
        href="/invoices"
        className="mb-2 inline-flex shrink-0 items-center gap-1 text-sm text-gray-600 hover:text-burgundy"
      >
        <IconArrowLeft size={16} />
        Back to Invoices
      </Link>

      <div className="mb-3 flex shrink-0 flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-gray-900">
            {meta.title}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            {formatInvoiceDisplayNumber(invoice)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowDelete(true)}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <IconTrash size={16} />
            Delete Invoice
          </button>
          {invoice.job_id && (
            <Link
              href={`/jobs/${invoice.job_id}`}
              className="inline-flex items-center gap-1 rounded-md bg-burgundy px-4 py-2 text-sm font-medium text-white hover:bg-burgundy/90"
            >
              View Job
              <IconArrowRight size={16} />
            </Link>
          )}
        </div>
      </div>

      <div className="mb-3 shrink-0 border-b border-gray-200">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-burgundy text-burgundy"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "overview" && (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
          <div className="grid shrink-0 grid-cols-2 gap-0 divide-x divide-gray-200 rounded-lg border border-gray-200 bg-white md:grid-cols-4">
            <div className="min-w-0 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Customer
              </p>
              <p className="mt-1 truncate font-medium text-gray-900">{meta.customerName}</p>
              <p className="mt-1 flex items-center gap-1 truncate text-xs text-gray-600">
                <IconPhone size={12} className="shrink-0" />
                {meta.phone}
              </p>
              <p className="flex items-center gap-1 truncate text-xs text-gray-600">
                <IconMail size={12} className="shrink-0" />
                {meta.email}
              </p>
              <p className="mt-0.5 flex items-start gap-1 text-xs text-gray-600">
                <IconMapPin size={12} className="mt-0.5 shrink-0" />
                <span className="min-w-0 break-words">{meta.customerAddress}</span>
              </p>
            </div>
            <div className="min-w-0 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Job Info
              </p>
              <dl className="mt-1 space-y-1 text-xs text-gray-700">
                <div className="min-w-0">
                  <span className="text-gray-500">Job Name: </span>
                  <span className="break-words">{meta.jobName}</span>
                </div>
                <div className="min-w-0">
                  <span className="text-gray-500">Address: </span>
                  <span className="break-words">{meta.jobAddress}</span>
                </div>
              </dl>
            </div>
            <div className="min-w-0 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Invoice Summary
              </p>
              <p className="mt-1 text-xs text-gray-500">Invoice Total</p>
              <p className="text-xl font-semibold text-gray-900">
                {formatCurrencyFull(Number(invoice.amount))}
              </p>
              <p className="mt-2 text-xs text-gray-500">Balance Due</p>
              <p className="text-sm font-semibold text-gray-900">
                {formatCurrencyFull(Number(invoice.balance))}
              </p>
            </div>
            <div className="min-w-0 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Dates
              </p>
              <dl className="mt-1 space-y-1 text-xs text-gray-700">
                <div>
                  <span className="text-gray-500">Created: </span>
                  {formatDateLong(invoice.invoice_date)}
                </div>
                <div>
                  <span className="text-gray-500">Due: </span>
                  <span className={invoiceDueDateClass(invoice)}>
                    {invoice.due_date ? formatDateLong(invoice.due_date) : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Last Updated: </span>
                  {formatDateLong(invoice.updated_at.slice(0, 10))}
                </div>
              </dl>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2">
            <div className="flex min-h-0 min-w-0 flex-col">
              <InvoiceSummaryPanel items={lineItems} invoice={invoice} />
            </div>
            <div className="flex min-h-0 min-w-0 flex-col">
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white p-4">
                <InvoicePreviewPanel
                  invoice={invoice}
                  meta={meta}
                  lineItems={lineItems}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "billing" && (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden lg:flex-row">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-[5]">
            <InvoiceItemsPanel
              items={lineItems}
              editingId={editingLineId}
              onAddLineItem={handleAddLineItem}
              onAddQuoteItems={handleAddQuoteItems}
              onEditItem={handleEditLineItem}
              onDeleteItem={handleDeleteLineItem}
              onChangeItem={handleChangeLineItem}
              onStopEditing={() => setEditingLineId(null)}
              addingQuoteItems={addingQuoteItems}
              canAddQuoteItems={canAddQuoteItems}
            />
            {quoteItemsError && (
              <p className="mt-2 shrink-0 text-sm text-red-600">{quoteItemsError}</p>
            )}
          </div>
          <div className="flex min-h-0 min-w-0 flex-col gap-3 lg:flex-[3]">
            <div className="shrink-0">
              <InvoiceBillingInfoPanel
                invoice={invoice}
                meta={meta}
                onUpdated={setInvoice}
              />
            </div>
            <InvoiceSummaryPanel items={lineItems} invoice={invoice} />
          </div>
        </div>
      )}

      {activeTab === "payments" && (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden lg:grid-cols-8">
          <div className="flex min-h-0 h-full flex-col lg:col-span-5">
            <InvoicePaymentHistoryPanel
              invoice={invoice}
              onInvoiceUpdated={setInvoice}
            />
          </div>
          <div className="flex min-h-0 h-full flex-col gap-3 lg:col-span-3">
            <div className="shrink-0">
              <InvoiceBillingInfoPanel
                invoice={invoice}
                meta={meta}
                onUpdated={setInvoice}
              />
            </div>
            <InvoiceSummaryPanel items={lineItems} invoice={invoice} />
          </div>
        </div>
      )}

      {activeTab !== "overview" &&
        activeTab !== "billing" &&
        activeTab !== "payments" && (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          {TABS.find((tab) => tab.id === activeTab)?.label} coming soon.
        </div>
      )}

      {showDelete && (
        <ConfirmModal
          title="Delete invoice?"
          body={`Are you sure you want to delete ${formatInvoiceDisplayNumber(invoice)}? This cannot be undone.`}
          confirmLabel="Yes"
          cancelLabel="No"
          loading={deleting}
          onConfirm={() => {
            setShowDelete(false);
            onDelete();
          }}
          onCancel={() => setShowDelete(false)}
        />
      )}
    </div>
  );
}
