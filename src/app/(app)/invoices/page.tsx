"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  IconAlertCircle,
  IconBuildingBank,
  IconCalendar,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconCircleCheck,
  IconClock,
  IconDotsVertical,
  IconFileInvoice,
  IconFilter,
  IconSearch,
  IconUpload,
} from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/client";
import PageHeader from "@/components/PageHeader";
import InvoiceStatusBadge from "@/components/InvoiceStatusBadge";
import InvoiceAgingDonut from "@/components/invoices/InvoiceAgingDonut";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import {
  buildInvoicesFromJobs,
  buildPaymentsFromInvoices,
  filterInvoices,
  formatInvoiceNumber,
  formatJobLabel,
  getAgingBuckets,
  getInvoiceMetrics,
  getTopCustomersByBalance,
  isDueDateOverdue,
  nextInvoiceNumber,
  type InvoicePayment,
  type InvoiceRow,
  type InvoiceTab,
} from "@/lib/invoices";
import {
  formatCurrencyFull,
  formatDateLong,
} from "@/lib/utils";
import type { Contact, Job } from "@/lib/types";

const TABS: { value: InvoiceTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "overdue", label: "Overdue" },
  { value: "paid", label: "Paid" },
  { value: "draft", label: "Draft" },
];

const PAGE_SIZE_OPTIONS = [10, 25, 50];

const selectClass =
  "rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-burgundy focus:outline-none focus:ring-1 focus:ring-burgundy";

function InvoiceMetricCard({
  icon: Icon,
  iconClass,
  label,
  value,
  sublabel,
  href,
  linkLabel,
}: {
  icon: React.ComponentType<{ size?: number; className?: string; stroke?: number }>;
  iconClass: string;
  label: string;
  value: string;
  sublabel: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-start justify-between">
        <Icon size={22} className={iconClass} stroke={1.5} />
        <Link href={href} className="text-xs font-medium text-burgundy hover:underline">
          {linkLabel}
        </Link>
      </div>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{sublabel}</p>
    </div>
  );
}

function InvoicesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusParam = searchParams.get("status") as InvoiceTab | null;

  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [payments, setPayments] = useState<InvoicePayment[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [tab, setTab] = useState<InvoiceTab>(statusParam ?? "all");
  const [search, setSearch] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [jobFilter, setJobFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    job_id: "",
    customer_name: "",
    amount: "",
    invoice_date: new Date().toISOString().slice(0, 10),
    due_date: "",
  });

  const load = useCallback(async () => {
    const supabase = createClient();
    const [
      { data: invoiceData, error: invoiceError },
      { data: paymentData },
      { data: jobsData },
      { data: contactsData },
    ] = await Promise.all([
      supabase
        .from("invoices")
        .select("*, jobs(id, name, created_at)")
        .order("invoice_date", { ascending: false }),
      supabase
        .from("invoice_payments")
        .select("*, invoices(invoice_number, customer_name)")
        .order("paid_at", { ascending: false })
        .limit(8),
      supabase.from("jobs").select("*, contacts(*)").order("name"),
      supabase.from("contacts").select("*").order("name"),
    ]);

    let rows = (invoiceData as InvoiceRow[]) ?? [];

    if (invoiceError || rows.length === 0) {
      rows = buildInvoicesFromJobs(
        (jobsData as (Job & { contacts: Contact | null })[]) ?? []
      );
      setPayments(buildPaymentsFromInvoices(rows));
    } else {
      setPayments((paymentData as InvoicePayment[]) ?? []);
    }

    setInvoices(rows);
    setJobs((jobsData as Job[]) ?? []);
    setContacts((contactsData as Contact[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (statusParam && TABS.some((t) => t.value === statusParam)) {
      setTab(statusParam);
    }
  }, [statusParam]);

  const filtered = useMemo(
    () =>
      filterInvoices(invoices, {
        tab,
        search,
        customerId: customerFilter,
        jobId: jobFilter,
        statusFilter,
      }),
    [invoices, tab, search, customerFilter, jobFilter, statusFilter]
  );

  const metrics = useMemo(() => getInvoiceMetrics(invoices), [invoices]);
  const aging = useMemo(() => getAgingBuckets(invoices), [invoices]);
  const topCustomers = useMemo(
    () => getTopCustomersByBalance(invoices),
    [invoices]
  );
  const agingTotal = aging.reduce((s, b) => s + b.amount, 0);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageRows = filtered.slice(pageStart, pageStart + pageSize);

  const recentPayments = useMemo(
    () => payments.slice(0, 4),
    [payments]
  );

  useEffect(() => {
    setPage(1);
  }, [tab, search, customerFilter, jobFilter, statusFilter, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function setTabWithUrl(next: InvoiceTab) {
    setTab(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === "all") params.delete("status");
    else params.set("status", next);
    router.replace(`/invoices?${params.toString()}`, { scroll: false });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    const amount = parseFloat(form.amount) || 0;
    const job = jobs.find((j) => j.id === form.job_id);
    const customer =
      contacts.find((c) => c.id === job?.customer_id)?.name ??
      form.customer_name;

    const { error } = await supabase.from("invoices").insert({
      invoice_number: nextInvoiceNumber(invoices),
      job_id: form.job_id || null,
      customer_id: job?.customer_id ?? null,
      customer_name: customer || "Unknown Customer",
      invoice_date: form.invoice_date,
      due_date: form.due_date || null,
      amount,
      balance: amount,
      status: "open",
    });

    if (!error) {
      setShowModal(false);
      setForm({
        job_id: "",
        customer_name: "",
        amount: "",
        invoice_date: new Date().toISOString().slice(0, 10),
        due_date: "",
      });
      load();
    }
  }

  if (loading) {
    return <p className="text-gray-500">Loading invoices…</p>;
  }

  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle="Manage customer invoices and payments"
        rightSlot={
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <IconUpload size={16} />
              Export
            </button>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1 rounded-md bg-burgundy px-4 py-2 text-sm font-medium text-white hover:bg-burgundy/90"
            >
              + New Invoice
              <IconChevronDown size={16} />
            </button>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <InvoiceMetricCard
          icon={IconFileInvoice}
          iconClass="text-green-600"
          label="Open Invoices"
          value={formatCurrencyFull(metrics.openTotal)}
          sublabel={`${metrics.openCount} invoices`}
          href="/invoices?status=open"
          linkLabel="View open →"
        />
        <InvoiceMetricCard
          icon={IconAlertCircle}
          iconClass="text-red-500"
          label="Overdue"
          value={formatCurrencyFull(metrics.overdueTotal)}
          sublabel={`${metrics.overdueCount} invoices`}
          href="/invoices?status=overdue"
          linkLabel="View overdue →"
        />
        <InvoiceMetricCard
          icon={IconBuildingBank}
          iconClass="text-blue-500"
          label="Collected This Month"
          value={formatCurrencyFull(metrics.collectedMonth)}
          sublabel={`${metrics.collectedMonthCount} invoices`}
          href="/invoices?status=paid"
          linkLabel="View payments →"
        />
        <InvoiceMetricCard
          icon={IconCalendar}
          iconClass="text-purple-500"
          label="Collected This Year"
          value={formatCurrencyFull(metrics.collectedYear)}
          sublabel={`${metrics.collectedYearCount} invoices`}
          href="/invoices?status=paid"
          linkLabel="View report →"
        />
        <InvoiceMetricCard
          icon={IconClock}
          iconClass="text-orange-500"
          label="Average Days to Pay"
          value={`${metrics.avgDaysToPay} Days`}
          sublabel="Goal: 30 days"
          href="/invoices?status=paid"
          linkLabel="View report →"
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTabWithUrl(t.value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t.value
                ? "bg-gray-900 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <IconSearch
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="search"
            placeholder="Search invoices..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-burgundy focus:outline-none focus:ring-1 focus:ring-burgundy"
          />
        </div>
        <select
          value={customerFilter}
          onChange={(e) => setCustomerFilter(e.target.value)}
          className={selectClass}
        >
          <option value="">All Customers</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={jobFilter}
          onChange={(e) => setJobFilter(e.target.value)}
          className={selectClass}
        >
          <option value="">All Jobs</option>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.name}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={selectClass}
        >
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="overdue">Overdue</option>
          <option value="paid">Paid</option>
          <option value="draft">Draft</option>
        </select>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <IconFilter size={16} />
          More Filters
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_300px]">
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">Invoice #</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Job</th>
                  <th className="px-4 py-3">Invoice Date</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                      No invoices match your filters.
                    </td>
                  </tr>
                ) : (
                  pageRows.map((inv) => (
                    <tr
                      key={inv.id}
                      className="border-b border-gray-100 hover:bg-gray-50/80"
                    >
                      <td className="px-4 py-3 font-medium text-burgundy">
                        {formatInvoiceNumber(inv)}
                      </td>
                      <td className="px-4 py-3 text-gray-900">{inv.customer_name}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {formatJobLabel(inv.jobs ?? null)}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {formatDateLong(inv.invoice_date)}
                      </td>
                      <td
                        className={`px-4 py-3 ${
                          isDueDateOverdue(inv.due_date) && inv.balance > 0
                            ? "font-medium text-red-600"
                            : "text-gray-700"
                        }`}
                      >
                        {inv.due_date ? formatDateLong(inv.due_date) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900">
                        {formatCurrencyFull(Number(inv.amount))}
                      </td>
                      <td className="px-4 py-3">
                        <InvoiceStatusBadge status={inv.status} />
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900">
                        {formatCurrencyFull(Number(inv.balance))}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                          aria-label="Invoice actions"
                        >
                          <IconDotsVertical size={18} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-4 py-3">
            <p className="text-sm text-gray-600">
              Showing {filtered.length === 0 ? 0 : pageStart + 1} to{" "}
              {Math.min(pageStart + pageSize, filtered.length)} of {filtered.length}{" "}
              invoices
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded border border-gray-300 px-2 py-1 text-sm disabled:opacity-40"
              >
                <IconChevronLeft size={16} />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(
                (n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    className={`min-w-[2rem] rounded px-2 py-1 text-sm ${
                      n === safePage
                        ? "bg-burgundy text-white"
                        : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {n}
                  </button>
                )
              )}
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded border border-gray-300 px-2 py-1 text-sm disabled:opacity-40"
              >
                <IconChevronRight size={16} />
              </button>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="rounded border border-gray-300 px-2 py-1 text-sm"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n} / page
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h3 className="mb-4 text-sm font-semibold text-gray-900">
              Aging of Open Invoices
            </h3>
            <InvoiceAgingDonut
              segments={aging.map((b) => ({
                label: b.label,
                amount: b.amount,
                color: b.color,
              }))}
              total={agingTotal || metrics.openTotal + metrics.overdueTotal}
            />
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Recent Payments</h3>
              <Link
                href="/invoices?status=paid"
                className="text-xs font-medium text-burgundy hover:underline"
              >
                View all
              </Link>
            </div>
            {recentPayments.length === 0 ? (
              <p className="text-sm text-gray-500">No payments recorded yet.</p>
            ) : (
              <ul className="space-y-3">
                {recentPayments.map((pay) => (
                  <li key={pay.id} className="flex items-start gap-2 text-sm">
                    <IconCircleCheck
                      size={18}
                      className="mt-0.5 shrink-0 text-green-600"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900">
                        {pay.invoices?.invoice_number ?? "Payment"} —{" "}
                        {pay.invoices?.customer_name ?? ""}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatCurrencyFull(Number(pay.amount))} ·{" "}
                        {formatDateLong(pay.paid_at.slice(0, 10))}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h3 className="mb-4 text-sm font-semibold text-gray-900">
              Top Customers (Open Balance)
            </h3>
            {topCustomers.length === 0 ? (
              <p className="text-sm text-gray-500">No open balances.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {topCustomers.map((row) => (
                  <li
                    key={row.name}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="text-gray-700">{row.name}</span>
                    <span className="font-medium text-gray-900">
                      {formatCurrencyFull(row.balance)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/contacts"
              className="mt-4 inline-block text-xs font-medium text-burgundy hover:underline"
            >
              View all customers →
            </Link>
          </div>
        </div>
      </div>

      {showModal && (
      <Modal onClose={() => setShowModal(false)} title="New Invoice">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Job
            </label>
            <select
              required
              value={form.job_id}
              onChange={(e) => {
                const job = jobs.find((j) => j.id === e.target.value);
                setForm((f) => ({
                  ...f,
                  job_id: e.target.value,
                  customer_name:
                    contacts.find((c) => c.id === job?.customer_id)?.name ?? "",
                }));
              }}
              className={selectClass + " w-full"}
            >
              <option value="">Select job</option>
              {jobs
                .filter((j) => j.stage !== "quote")
                .map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.name}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Amount
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={form.amount}
              onChange={(e) =>
                setForm((f) => ({ ...f, amount: e.target.value }))
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Invoice Date
              </label>
              <input
                type="date"
                required
                value={form.invoice_date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, invoice_date: e.target.value }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Due Date
              </label>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, due_date: e.target.value }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Invoice</Button>
          </div>
        </form>
      </Modal>
      )}
    </>
  );
}

export default function InvoicesPage() {
  return (
    <Suspense fallback={<p className="text-gray-500">Loading invoices…</p>}>
      <InvoicesPageContent />
    </Suspense>
  );
}
