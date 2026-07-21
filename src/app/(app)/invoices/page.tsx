"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IconChevronLeft,
  IconChevronRight,
  IconColumns3,
  IconFileInvoice,
  IconSearch,
  IconTrash,
} from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/client";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import ConfirmModal from "@/components/ConfirmModal";
import ContactSearchSelect from "@/components/ContactSearchSelect";
import {
  buildInvoicesFromJobs,
  filterInvoices,
  formatInvoiceNumber,
  getInvoiceDetailPath,
  invoiceOutstandingTotal,
  isSyntheticInvoiceId,
  nextInvoiceNumber,
  type InvoiceRow,
} from "@/lib/invoices";
import {
  formatCurrencyFull,
  formatDateLong,
  formatRelativeTime,
} from "@/lib/utils";
import type { Contact, Job } from "@/lib/types";

const DATE_RANGES = [
  { value: "", label: "Date Range" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "year", label: "This year" },
];

const PAGE_SIZE_OPTIONS = [10, 25, 50];

const selectClass =
  "rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-burgundy focus:outline-none focus:ring-1 focus:ring-burgundy";

type InvoiceCreateType = "job" | "standalone";

type JobRow = Job & { contacts: Contact | null };

const emptyInvoiceForm = {
  job_id: "",
  customer_id: null as string | null,
};

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [invoiceType, setInvoiceType] = useState<InvoiceCreateType>("job");
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteInvoice, setDeleteInvoice] = useState<InvoiceRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    job: true,
    customer: true,
    amount: true,
    dueDate: true,
    balance: true,
    updated: true,
  });
  const [form, setForm] = useState(emptyInvoiceForm);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [
      { data: invoiceData, error: invoiceError },
      { data: jobsData },
      { data: contactsData },
    ] = await Promise.all([
      supabase
        .from("invoices")
        .select("*, jobs(id, name, created_at)")
        .order("invoice_date", { ascending: false }),
      supabase.from("jobs").select("*, contacts(*)").order("name"),
      supabase.from("contacts").select("*").order("name"),
    ]);

    let rows = (invoiceData as InvoiceRow[]) ?? [];

    if (invoiceError) {
      const { data: plainInvoices, error: plainError } = await supabase
        .from("invoices")
        .select("*")
        .order("invoice_date", { ascending: false });

      if (!plainError && plainInvoices) {
        rows = plainInvoices as InvoiceRow[];
      } else {
        rows = buildInvoicesFromJobs(
          (jobsData as (Job & { contacts: Contact | null })[]) ?? []
        );
      }
    }

    setInvoices(rows);
    setJobs((jobsData as JobRow[]) ?? []);
    setContacts((contactsData as Contact[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const availableJobs = useMemo(
    () => jobs.filter((job) => job.stage !== "quote"),
    [jobs]
  );

  const stats = useMemo(
    () => ({
      total: invoices.length,
      outstanding: invoiceOutstandingTotal(invoices),
    }),
    [invoices]
  );

  const filtered = useMemo(() => {
    const base = filterInvoices(invoices, {
      tab: "all",
      search,
      customerId: "",
      jobId: "",
      statusFilter: "",
    });

    if (!dateRange) return base;

    return base.filter((inv) => {
      const refDate = new Date(`${inv.invoice_date}T12:00:00`);
      const now = new Date();
      if (dateRange === "year") {
        return refDate.getFullYear() === now.getFullYear();
      }
      const days = parseInt(dateRange, 10);
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - days);
      return refDate >= cutoff;
    });
  }, [invoices, search, dateRange]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageRows = filtered.slice(pageStart, pageStart + pageSize);

  useEffect(() => {
    setPage(1);
  }, [search, dateRange, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function toggleColumn(key: keyof typeof visibleColumns) {
    setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function openNewInvoiceModal() {
    setCreateError(null);
    setInvoiceType("job");
    setForm(emptyInvoiceForm);
    setShowModal(true);
  }

  function setInvoiceTypeAndReset(next: InvoiceCreateType) {
    setInvoiceType(next);
    setCreateError(null);
    setForm((prev) => ({
      ...prev,
      job_id: "",
      customer_id: null,
    }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);

    if (invoiceType === "job") {
      if (!form.job_id) {
        setCreateError("Select a job to attach this invoice.");
        return;
      }
    } else if (!form.customer_id) {
      setCreateError("Select a contact for this invoice.");
      return;
    }

    setCreating(true);
    const supabase = createClient();

    let jobId: string | null = null;
    let customerId: string | null = null;
    let customerName = "Unknown Customer";
    let amount = 0;
    let dueDate: string | null = null;

    if (invoiceType === "job") {
      const job = jobs.find((j) => j.id === form.job_id);
      if (!job) {
        setCreateError("Selected job could not be found.");
        setCreating(false);
        return;
      }
      jobId = job.id;
      customerId = job.customer_id;
      customerName =
        job.contacts?.name ??
        contacts.find((c) => c.id === job.customer_id)?.name ??
        "Unknown Customer";
    } else {
      const contact = contacts.find((c) => c.id === form.customer_id);
      if (!contact) {
        setCreateError("Selected contact could not be found.");
        setCreating(false);
        return;
      }
      customerId = contact.id;
      customerName = contact.name;
    }

    const { data: created, error } = await supabase
      .from("invoices")
      .insert({
        invoice_number: nextInvoiceNumber(invoices),
        job_id: jobId,
        customer_id: customerId,
        customer_name: customerName,
        invoice_date: new Date().toISOString().slice(0, 10),
        due_date: dueDate,
        amount,
        balance: amount,
        status: "open",
      })
      .select("id")
      .single();

    if (error || !created) {
      setCreateError(error?.message || "Could not create invoice.");
      setCreating(false);
      return;
    }

    setShowModal(false);
    setForm(emptyInvoiceForm);
    setCreating(false);
    router.push(`/invoices/${created.id}`);
  }

  async function handleDeleteInvoice() {
    if (!deleteInvoice) return;
    setDeleting(true);
    const supabase = createClient();

    let error: { message: string } | null = null;

    if (isSyntheticInvoiceId(deleteInvoice.id)) {
      if (deleteInvoice.job_id) {
        const result = await supabase
          .from("invoices")
          .delete()
          .eq("job_id", deleteInvoice.job_id);
        error = result.error;
      }
    } else {
      const result = await supabase
        .from("invoices")
        .delete()
        .eq("id", deleteInvoice.id);
      error = result.error;
    }

    if (error) {
      setDeleting(false);
      return;
    }

    setDeleteInvoice(null);
    setDeleting(false);
    await load();
  }

  const statItems = [
    {
      icon: IconFileInvoice,
      value: stats.total,
      label: "Total Invoices",
      sub: null,
    },
  ];

  return (
    <>
      <PageHeader
        title="Invoices"
        rightSlot={
          <button
            type="button"
            onClick={openNewInvoiceModal}
            className="shrink-0 rounded-md bg-burgundy px-4 py-2 text-sm font-medium text-white hover:bg-burgundy/90"
          >
            + New Invoice
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap overflow-hidden rounded-lg border border-gray-200 bg-cream">
        {statItems.map(({ icon: Icon, value, label, sub }, idx) => (
          <div
            key={label}
            className={`flex min-w-[150px] flex-1 items-center gap-3 px-5 py-4 ${
              idx < statItems.length - 1 ? "border-r border-gray-200" : ""
            }`}
          >
            <Icon size={20} className="shrink-0 text-gray-400" stroke={1.5} />
            <div>
              <p className="text-lg font-semibold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
              {sub && <p className="text-xs font-medium text-gray-700">{sub}</p>}
            </div>
          </div>
        ))}
        <div className="flex min-w-[160px] flex-1 flex-col justify-center border-l border-gray-200 px-5 py-4">
          <p className="text-xs text-gray-500">Outstanding Balance</p>
          <p className="text-lg font-semibold text-gray-900">
            {formatCurrencyFull(stats.outstanding)}
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[260px] flex-1">
          <IconSearch
            size={18}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="search"
            placeholder="Search invoices by customer, invoice #, job name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-burgundy focus:outline-none focus:ring-1 focus:ring-burgundy"
          />
        </div>

        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className={selectClass}
        >
          {DATE_RANGES.map((r) => (
            <option key={r.value || "all-dates"} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowColumns((v) => !v)}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <IconColumns3 size={16} />
            Columns
          </button>
          {showColumns && (
            <div className="absolute right-0 z-10 mt-1 w-44 rounded-md border border-gray-200 bg-white py-2 shadow-lg">
              {(
                [
                  ["job", "Job Name"],
                  ["customer", "Customer"],
                  ["amount", "Amount"],
                  ["dueDate", "Due Date"],
                  ["balance", "Balance"],
                  ["updated", "Updated"],
                ] as const
              ).map(([key, label]) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={visibleColumns[key]}
                    onChange={() => toggleColumn(key)}
                    className="rounded border-gray-300"
                  />
                  {label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                    Invoice #
                  </th>
                  {visibleColumns.job && (
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                      Job Name
                    </th>
                  )}
                  {visibleColumns.customer && (
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                      Customer
                    </th>
                  )}
                  {visibleColumns.amount && (
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                      Amount
                    </th>
                  )}
                  {visibleColumns.dueDate && (
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                      Due Date
                    </th>
                  )}
                  {visibleColumns.balance && (
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                      Balance
                    </th>
                  )}
                  {visibleColumns.updated && (
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                      Updated
                    </th>
                  )}
                  <th className="w-10 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {pageRows.map((inv) => (
                  <tr
                    key={inv.id}
                    onClick={() => router.push(getInvoiceDetailPath(inv))}
                    className="group cursor-pointer border-b border-gray-100 transition-colors hover:bg-gray-50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={getInvoiceDetailPath(inv)}
                        className="flex items-center gap-2 font-medium text-gray-900 hover:text-burgundy"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <IconFileInvoice
                          size={18}
                          className="shrink-0 text-burgundy"
                          stroke={1.5}
                        />
                        {formatInvoiceNumber(inv)}
                      </Link>
                    </td>
                    {visibleColumns.job && (
                      <td className="px-4 py-3 text-sm font-normal text-gray-900">
                        {inv.jobs?.name ?? "—"}
                      </td>
                    )}
                    {visibleColumns.customer && (
                      <td className="px-4 py-3 text-sm font-normal text-gray-900">
                        {inv.customer_name}
                      </td>
                    )}
                    {visibleColumns.amount && (
                      <td className="px-4 py-3 text-gray-900">
                        {formatCurrencyFull(Number(inv.amount))}
                      </td>
                    )}
                    {visibleColumns.dueDate && (
                      <td className="px-4 py-3 text-gray-600">
                        {inv.due_date ? formatDateLong(inv.due_date) : "—"}
                      </td>
                    )}
                    {visibleColumns.balance && (
                      <td className="px-4 py-3 text-gray-900">
                        {formatCurrencyFull(Number(inv.balance))}
                      </td>
                    )}
                    {visibleColumns.updated && (
                      <td className="px-4 py-3 text-gray-600">
                        {formatRelativeTime(inv.updated_at)}
                      </td>
                    )}
                    <td className="w-10 px-4 py-3">
                      <div className="relative ml-auto h-[18px] w-[18px]">
                        <IconChevronRight
                          size={18}
                          className="absolute inset-0 text-gray-400 transition-opacity group-hover:opacity-0"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteInvoice(inv);
                          }}
                          className="absolute inset-0 inline-flex items-center justify-center text-red-500 opacity-0 transition-opacity pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto hover:text-red-600"
                          aria-label={`Delete ${formatInvoiceNumber(inv)}`}
                        >
                          <IconTrash size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {pageRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-8 text-center text-sm text-gray-500"
                    >
                      No invoices match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
            <p>
              {filtered.length === 0
                ? "No invoices to show"
                : `Showing ${pageStart + 1} to ${Math.min(pageStart + pageSize, filtered.length)} of ${filtered.length} invoice${filtered.length !== 1 ? "s" : ""}`}
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="rounded-md border border-gray-300 p-1.5 hover:bg-gray-50 disabled:opacity-40"
                aria-label="Previous page"
              >
                <IconChevronLeft size={16} />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(
                  (p) =>
                    p === 1 ||
                    p === totalPages ||
                    Math.abs(p - safePage) <= 1
                )
                .reduce<(number | "ellipsis")[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1) {
                    acc.push("ellipsis");
                  }
                  acc.push(p);
                  return acc;
                }, [])
                .map((item, idx) =>
                  item === "ellipsis" ? (
                    <span key={`ellipsis-${idx}`} className="px-1 text-gray-400">
                      …
                    </span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setPage(item)}
                      className={`min-w-[2rem] rounded-md border px-2 py-1 ${
                        item === safePage
                          ? "border-gray-900 bg-gray-900 text-white"
                          : "border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {item}
                    </button>
                  )
                )}

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="rounded-md border border-gray-300 p-1.5 hover:bg-gray-50 disabled:opacity-40"
                aria-label="Next page"
              >
                <IconChevronRight size={16} />
              </button>

              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className={selectClass}
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size} / page
                  </option>
                ))}
              </select>
            </div>
          </div>
        </>
      )}

      {showModal && (
        <Modal
          onClose={() => {
            if (!creating) setShowModal(false);
          }}
          title="New Invoice"
        >
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-gray-200 p-1">
              <button
                type="button"
                onClick={() => setInvoiceTypeAndReset("job")}
                className={`rounded-md px-3 py-2 text-sm transition-colors ${
                  invoiceType === "job"
                    ? "bg-burgundy text-white"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                Job Invoice
              </button>
              <button
                type="button"
                onClick={() => setInvoiceTypeAndReset("standalone")}
                className={`rounded-md px-3 py-2 text-sm transition-colors ${
                  invoiceType === "standalone"
                    ? "bg-burgundy text-white"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                Standalone Invoice
              </button>
            </div>

            {invoiceType === "job" ? (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Job
                </label>
                <select
                  required
                  value={form.job_id}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, job_id: e.target.value }))
                  }
                  className={selectClass + " w-full"}
                >
                  <option value="">Select job</option>
                  {availableJobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.name}
                      {job.contacts?.name ? ` — ${job.contacts.name}` : ""}
                    </option>
                  ))}
                </select>
                {availableJobs.length === 0 && (
                  <p className="mt-1 text-xs text-gray-500">
                    No active jobs available to attach.
                  </p>
                )}
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Contact
                </label>
                <ContactSearchSelect
                  contacts={contacts}
                  value={form.customer_id}
                  required
                  placeholder="Search contacts…"
                  onChange={(contactId) =>
                    setForm((f) => ({ ...f, customer_id: contactId }))
                  }
                />
              </div>
            )}

            {createError && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {createError}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                type="button"
                disabled={creating}
                onClick={() => setShowModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  creating ||
                  (invoiceType === "job" ? !form.job_id : !form.customer_id)
                }
              >
                {creating ? "Creating…" : "Create Invoice"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {deleteInvoice && (
        <ConfirmModal
          title="Delete invoice?"
          body={`Are you sure you want to delete ${formatInvoiceNumber(deleteInvoice)}? This cannot be undone.`}
          confirmLabel="Yes"
          cancelLabel="No"
          loading={deleting}
          onConfirm={handleDeleteInvoice}
          onCancel={() => setDeleteInvoice(null)}
        />
      )}
    </>
  );
}
