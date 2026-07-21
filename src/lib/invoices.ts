import { formatProductionJobNumber } from "@/lib/production";
import type { Contact, Job } from "@/lib/types";

export type InvoiceStatus = "draft" | "open" | "overdue" | "paid";

export type InvoiceTab = "all" | InvoiceStatus;

export interface Invoice {
  id: string;
  invoice_number: string;
  job_id: string | null;
  customer_id: string | null;
  customer_name: string;
  invoice_date: string;
  due_date: string | null;
  amount: number;
  balance: number;
  status: InvoiceStatus;
  created_at: string;
  updated_at: string;
}

export type InvoiceRow = Invoice & {
  jobs?: Pick<Job, "id" | "name" | "created_at"> | null;
};

export interface InvoicePayment {
  id: string;
  invoice_id: string;
  amount: number;
  paid_at: string;
  method: string | null;
  invoices?: Pick<Invoice, "invoice_number" | "customer_name"> | null;
}

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  open: "Open",
  overdue: "Overdue",
  paid: "Paid",
};

export const INVOICE_STATUS_STYLES: Record<InvoiceStatus, string> = {
  draft: "bg-gray-100 text-gray-700",
  open: "bg-amber-50 text-amber-800",
  overdue: "bg-red-50 text-red-700",
  paid: "bg-green-50 text-green-800",
};

const AGING_BUCKETS = [
  { id: "0-30", label: "0–30 Days", color: "#3b82f6", maxDays: 30 },
  { id: "31-60", label: "31–60 Days", color: "#f97316", maxDays: 60 },
  { id: "61-90", label: "61–90 Days", color: "#eab308", maxDays: 90 },
  { id: "90+", label: "90+ Days", color: "#ef4444", maxDays: Infinity },
] as const;

export function formatInvoiceNumber(
  invoice: Pick<Invoice, "id" | "invoice_number" | "created_at">
): string {
  if (invoice.invoice_number) return invoice.invoice_number;
  const year = new Date(invoice.created_at).getFullYear() % 100;
  const seq = invoice.id.replace(/\D/g, "").slice(-4).padStart(4, "0");
  return `INV-${year}${seq}`;
}

export function nextInvoiceNumber(invoices: Invoice[]): string {
  const nums = invoices
    .map((i) => i.invoice_number.match(/INV-(\d+)/)?.[1])
    .filter(Boolean)
    .map((n) => parseInt(n!, 10));
  const next = (nums.length ? Math.max(...nums) : 24000) + 1;
  return `INV-${next}`;
}

export function computeInvoiceStatus(
  balance: number,
  dueDate: string | null,
  explicit?: InvoiceStatus
): InvoiceStatus {
  if (explicit === "draft") return "draft";
  if (balance <= 0) return "paid";
  if (dueDate) {
    const due = new Date(`${dueDate}T12:00:00`);
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    if (due < today) return "overdue";
  }
  return "open";
}

export function formatJobLabel(
  job: Pick<Job, "id" | "name" | "created_at"> | null | undefined
): string {
  if (!job) return "—";
  return `${job.name} (${formatProductionJobNumber(job)})`;
}

export function buildInvoicesFromJobs(
  jobs: (Job & { contacts?: Contact | null })[]
): InvoiceRow[] {
  return jobs
    .filter((j) => j.stage !== "quote" && Number(j.total_value) > 0)
    .map((job, index) => {
      const balance = Math.max(
        Number(job.total_value) - Number(job.billing_collected),
        0
      );
      const invoiceDate =
        job.quote_approved_at ?? job.created_at.slice(0, 10);
      const status = computeInvoiceStatus(balance, job.due_date);
      return {
        id: `job-${job.id}`,
        invoice_number: `INV-${24001 + index}`,
        job_id: job.id,
        customer_id: job.customer_id,
        customer_name: job.contacts?.name ?? "Unknown Customer",
        invoice_date: invoiceDate,
        due_date: job.due_date,
        amount: Number(job.total_value),
        balance,
        status,
        created_at: job.created_at,
        updated_at: job.updated_at,
        jobs: {
          id: job.id,
          name: job.name,
          created_at: job.created_at,
        },
      };
    });
}

export function buildPaymentsFromInvoices(invoices: Invoice[]): InvoicePayment[] {
  return invoices
    .filter((inv) => inv.balance < inv.amount)
    .map((inv) => ({
      id: `pay-${inv.id}`,
      invoice_id: inv.id,
      amount: inv.amount - inv.balance,
      paid_at: inv.updated_at,
      method: "Check",
      invoices: {
        invoice_number: inv.invoice_number,
        customer_name: inv.customer_name,
      },
    }))
    .sort(
      (a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime()
    );
}

export function filterInvoices(
  invoices: InvoiceRow[],
  opts: {
    tab: InvoiceTab;
    search: string;
    customerId: string;
    jobId: string;
    statusFilter: string;
  }
): InvoiceRow[] {
  const q = opts.search.toLowerCase().trim();
  return invoices.filter((inv) => {
    if (opts.tab !== "all" && inv.status !== opts.tab) return false;
    if (opts.statusFilter && inv.status !== opts.statusFilter) return false;
    if (opts.customerId && inv.customer_id !== opts.customerId) return false;
    if (opts.jobId && inv.job_id !== opts.jobId) return false;
    if (
      q &&
      !inv.invoice_number.toLowerCase().includes(q) &&
      !inv.customer_name.toLowerCase().includes(q) &&
      !(inv.jobs?.name.toLowerCase().includes(q) ?? false)
    ) {
      return false;
    }
    return true;
  });
}

export function getInvoiceMetrics(invoices: Invoice[]) {
  const open = invoices.filter((i) => i.status === "open");
  const overdue = invoices.filter((i) => i.status === "overdue");
  const paid = invoices.filter((i) => i.status === "paid");

  const sum = (list: Invoice[], field: "balance" | "amount") =>
    list.reduce((s, i) => s + Number(i[field]), 0);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const paidThisMonth = paid.filter(
    (i) => new Date(i.updated_at) >= monthStart
  );
  const paidThisYear = paid.filter(
    (i) => new Date(i.updated_at) >= yearStart
  );

  const collectedMonth = sum(
    paidThisMonth.length ? paidThisMonth : paid.slice(0, 8),
    "amount"
  );
  const collectedYear = sum(
    paidThisYear.length ? paidThisYear : paid,
    "amount"
  );

  const avgDays =
    paid.length > 0
      ? Math.round(
          paid.reduce((s, inv) => {
            const start = new Date(`${inv.invoice_date}T12:00:00`);
            const end = new Date(inv.updated_at);
            return (
              s +
              Math.max(
                0,
                Math.floor((end.getTime() - start.getTime()) / 86400000)
              )
            );
          }, 0) / paid.length
        )
      : 22;

  return {
    openTotal: sum(open, "balance"),
    openCount: open.length,
    overdueTotal: sum(overdue, "balance"),
    overdueCount: overdue.length,
    collectedMonth,
    collectedMonthCount: paidThisMonth.length || Math.min(paid.length, 8),
    collectedYear,
    collectedYearCount: paidThisYear.length || paid.length,
    avgDaysToPay: avgDays,
  };
}

export function getAgingBuckets(invoices: Invoice[]) {
  const now = new Date();
  now.setHours(12, 0, 0, 0);

  const open = invoices.filter(
    (i) => i.status === "open" || i.status === "overdue"
  );

  return AGING_BUCKETS.map((bucket, index) => {
    const prevMax = index === 0 ? 0 : AGING_BUCKETS[index - 1].maxDays;
    const amount = open.reduce((sum, inv) => {
      const ref = inv.due_date
        ? new Date(`${inv.due_date}T12:00:00`)
        : new Date(`${inv.invoice_date}T12:00:00`);
      const days = Math.floor((now.getTime() - ref.getTime()) / 86400000);
      if (days > prevMax && days <= bucket.maxDays) {
        return sum + Number(inv.balance);
      }
      if (bucket.maxDays === Infinity && days > prevMax) {
        return sum + Number(inv.balance);
      }
      return sum;
    }, 0);
    return { ...bucket, amount };
  });
}

export function getTopCustomersByBalance(
  invoices: Invoice[],
  limit = 5
): { name: string; balance: number }[] {
  const map = new Map<string, number>();
  for (const inv of invoices) {
    if (inv.balance <= 0) continue;
    map.set(
      inv.customer_name,
      (map.get(inv.customer_name) ?? 0) + Number(inv.balance)
    );
  }
  return [...map.entries()]
    .map(([name, balance]) => ({ name, balance }))
    .sort((a, b) => b.balance - a.balance)
    .slice(0, limit);
}

export function isSyntheticInvoiceId(id: string): boolean {
  return id.startsWith("job-");
}

export function getSyntheticJobId(id: string): string | null {
  if (!isSyntheticInvoiceId(id)) return null;
  const jobId = id.slice(4);
  return jobId || null;
}

export function getInvoiceDetailPath(invoice: Pick<InvoiceRow, "id">): string {
  return `/invoices/${invoice.id}`;
}

export function isDueDateOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  const due = new Date(`${dueDate}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return due < today;
}

export function countByInvoiceStatus(
  invoices: Invoice[],
  status: InvoiceStatus
): number {
  return invoices.filter((i) => i.status === status).length;
}

export function sumInvoiceBalanceByStatus(
  invoices: Invoice[],
  status: InvoiceStatus
): number {
  return invoices
    .filter((i) => i.status === status)
    .reduce((sum, i) => sum + Number(i.balance), 0);
}

export function sumInvoiceAmountByStatus(
  invoices: Invoice[],
  status: InvoiceStatus
): number {
  return invoices
    .filter((i) => i.status === status)
    .reduce((sum, i) => sum + Number(i.amount), 0);
}

export function invoiceOutstandingTotal(invoices: Invoice[]): number {
  return invoices
    .filter((i) => i.status === "open" || i.status === "overdue")
    .reduce((sum, i) => sum + Number(i.balance), 0);
}
