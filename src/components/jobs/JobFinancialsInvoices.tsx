"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IconChevronLeft,
  IconChevronRight,
  IconDots,
} from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/client";
import InvoiceStatusBadge from "@/components/InvoiceStatusBadge";
import {
  formatInvoiceNumber,
  getInvoiceDetailPath,
  nextInvoiceNumber,
  type InvoiceRow,
  type InvoiceStatus,
} from "@/lib/invoices";
import { formatCurrencyFull, formatDateLong } from "@/lib/utils";
import type { Contact, Job } from "@/lib/types";

const STATUS_FILTERS = [
  { value: "all", label: "All invoices" },
  { value: "active", label: "Open invoices" },
  { value: "draft", label: "Draft" },
  { value: "open", label: "Open" },
  { value: "overdue", label: "Overdue" },
  { value: "paid", label: "Paid" },
] as const;

const PAGE_SIZE = 10;

const selectClass =
  "rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-burgundy focus:outline-none focus:ring-1 focus:ring-burgundy";

type JobWithContact = Job & { contacts: Contact | null };

function invoiceSequence(invoice: InvoiceRow, allInvoices: InvoiceRow[]): number {
  const sorted = [...allInvoices].sort((a, b) =>
    a.created_at.localeCompare(b.created_at)
  );
  const index = sorted.findIndex((inv) => inv.id === invoice.id);
  return index >= 0 ? index + 1 : 1;
}

function isActiveInvoice(status: InvoiceStatus): boolean {
  return status === "open" || status === "overdue";
}

interface JobFinancialsInvoicesProps {
  jobId: string;
}

export default function JobFinancialsInvoices({ jobId }: JobFinancialsInvoicesProps) {
  const router = useRouter();
  const [job, setJob] = useState<JobWithContact | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [allInvoices, setAllInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("active");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [{ data: jobData }, { data: invoiceData }, { data: allInvoiceData }] =
      await Promise.all([
        supabase
          .from("jobs")
          .select("*, contacts(*)")
          .eq("id", jobId)
          .maybeSingle(),
        supabase
          .from("invoices")
          .select("*, jobs(id, name, created_at)")
          .eq("job_id", jobId)
          .order("invoice_date", { ascending: false }),
        supabase.from("invoices").select("id, invoice_number, created_at"),
      ]);

    setJob((jobData as JobWithContact) ?? null);
    setInvoices((invoiceData as InvoiceRow[]) ?? []);
    setAllInvoices((allInvoiceData as InvoiceRow[]) ?? []);
    setLoading(false);
  }, [jobId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return invoices;
    if (statusFilter === "active") {
      return invoices.filter((inv) => isActiveInvoice(inv.status));
    }
    return invoices.filter((inv) => inv.status === statusFilter);
  }, [invoices, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageInvoices = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  async function handleCreateInvoice() {
    if (!job || creating) return;
    setCreateError(null);

    if (!job.customer_id) {
      setCreateError("This job has no customer assigned.");
      return;
    }

    setCreating(true);
    const supabase = createClient();

    const customerName =
      job.contacts?.name ??
      (await supabase
        .from("contacts")
        .select("name")
        .eq("id", job.customer_id)
        .maybeSingle()).data?.name ??
      "Unknown Customer";

    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoice_number: nextInvoiceNumber(allInvoices),
        job_id: jobId,
        customer_id: job.customer_id,
        customer_name: customerName,
        invoice_date: new Date().toISOString().slice(0, 10),
        due_date: job.due_date ?? null,
        amount: 0,
        status: "open",
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      error?: string;
      data?: { id: string };
    };

    if (!res.ok || !json.data) {
      setCreateError(json.error || "Could not create invoice.");
      setCreating(false);
      return;
    }

    router.push(`/invoices/${json.data.id}`);
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Loading invoices…</p>;
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Invoices</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={selectClass}
            >
              {STATUS_FILTERS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void handleCreateInvoice()}
              disabled={!job || creating}
              className="inline-flex shrink-0 items-center rounded-md bg-burgundy px-4 py-2 text-sm font-medium text-white hover:bg-burgundy/90 disabled:opacity-50"
            >
              {creating ? "Creating…" : "+ New invoice"}
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                    Invoice #
                  </th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                    Name
                  </th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                    Version
                  </th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                    Total
                  </th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                    Created
                  </th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                    Due
                  </th>
                  <th className="w-10 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {pageInvoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className="group border-b border-gray-100 transition-colors hover:bg-gray-50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={getInvoiceDetailPath(invoice)}
                        className="font-medium text-burgundy hover:underline"
                      >
                        {formatInvoiceNumber(invoice)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-900">
                      {invoice.customer_name}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {invoiceSequence(invoice, invoices)}
                    </td>
                    <td className="px-4 py-3">
                      <InvoiceStatusBadge status={invoice.status} />
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {formatCurrencyFull(Number(invoice.amount))}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatDateLong(invoice.invoice_date)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatDateLong(invoice.due_date)}
                    </td>
                    <td className="w-10 px-4 py-3">
                      <Link
                        href={getInvoiceDetailPath(invoice)}
                        className="inline-flex rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        aria-label={`Open ${formatInvoiceNumber(invoice)}`}
                      >
                        <IconDots size={18} />
                      </Link>
                    </td>
                  </tr>
                ))}
                {pageInvoices.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-12 text-center text-sm text-gray-500"
                    >
                      {invoices.length === 0
                        ? "No invoices for this job yet. Click + New invoice to create one."
                        : "No invoices match this filter."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-4 py-3 text-sm text-gray-600">
            <p>
              {filtered.length === 0
                ? "No invoices to show"
                : `Showing ${pageStart + 1} to ${Math.min(pageStart + PAGE_SIZE, filtered.length)} of ${filtered.length} invoice${filtered.length !== 1 ? "s" : ""}`}
            </p>

            {filtered.length > 0 && (
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
                <span className="min-w-[2rem] rounded-md border border-burgundy bg-burgundy px-2 py-1 text-center text-white">
                  {safePage}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="rounded-md border border-gray-300 p-1.5 hover:bg-gray-50 disabled:opacity-40"
                  aria-label="Next page"
                >
                  <IconChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {createError ? (
        <p className="mt-3 text-sm text-red-600">{createError}</p>
      ) : null}
    </>
  );
}
