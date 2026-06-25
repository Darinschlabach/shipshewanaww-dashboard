"use client";

import { useState } from "react";
import {
  IconArrowNarrowRight,
  IconCircleCheck,
  IconCurrencyDollar,
  IconFileDescription,
} from "@tabler/icons-react";
import Button from "@/components/Button";
import JobFinancialsQuotes from "@/components/jobs/JobFinancialsQuotes";
import { formatCurrencyFull } from "@/lib/utils";

const FINANCIALS_SUB_TABS = [
  "Overview",
  "Quotes",
  "Invoices",
  "Payments",
  "Change Orders",
] as const;

type FinancialsSubTab = (typeof FINANCIALS_SUB_TABS)[number];

const CONTRACT_TOTAL = 28050;
const INVOICED = 15300;
const REMAINING = 12750;
const INVOICED_PERCENT = 55;

const CONTRACT_BREAKDOWN = [
  { category: "Cabinets", amount: 18500, dot: "bg-burgundy" },
  { category: "Countertops", amount: 4200, dot: "bg-blue-500" },
  { category: "Hardware", amount: 1150, dot: "bg-amber-500" },
  { category: "Installation", amount: 2000, dot: "bg-green-500" },
  { category: "Delivery", amount: 500, dot: "bg-purple-500" },
  { category: "Change Orders", amount: 1700, dot: "bg-orange-500" },
];

const RECENT_PAYMENTS = [
  { date: "2024-05-20", type: "Progress Payment", amount: 7300, method: "Check" },
  { date: "2024-04-15", type: "Deposit", amount: 8000, method: "Check" },
];

const QUOTE_HISTORY = [
  { version: "Quote V3", date: "2024-05-14", amount: 28050, status: "Current" as const },
  { version: "Quote V2", date: "2024-05-08", amount: 24850, status: "Superseded" as const },
  { version: "Quote V1", date: "2024-04-02", amount: 22400, status: "Superseded" as const },
];

const CHANGE_ORDERS = [
  {
    change: "Added pantry pullouts",
    date: "2024-05-06",
    amount: 950,
    status: "Approved" as const,
  },
  {
    change: "Added island panels",
    date: "2024-05-09",
    amount: 750,
    status: "Approved" as const,
  },
  {
    change: "Added laundry cabinets",
    date: "2024-05-13",
    amount: 1500,
    status: "Pending" as const,
  },
];

const RECENT_INVOICES = [
  {
    number: "INV-1001",
    type: "Deposit",
    date: "2024-04-15",
    amount: 8000,
    status: "Paid" as const,
  },
  {
    number: "INV-1008",
    type: "Progress",
    date: "2024-05-20",
    amount: 7300,
    status: "Paid" as const,
  },
  {
    number: "INV-1014",
    type: "Final",
    date: "2024-06-24",
    amount: 12750,
    status: "Outstanding" as const,
  },
];

function formatTableDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function StatusBadge({
  label,
  variant,
}: {
  label: string;
  variant: "current" | "superseded" | "approved" | "pending" | "paid" | "outstanding";
}) {
  const styles = {
    current: "bg-green-50 text-green-700",
    superseded: "bg-gray-100 text-gray-600",
    approved: "bg-green-50 text-green-700",
    pending: "bg-amber-50 text-amber-700",
    paid: "bg-green-50 text-green-700",
    outstanding: "bg-orange-50 text-orange-700",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${styles[variant]}`}
    >
      {label}
    </span>
  );
}

function DonutChart({ percent }: { percent: number }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const invoicedOffset = circumference * (1 - percent / 100);

  return (
    <div className="relative mx-auto h-28 w-28">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="14"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="#22c55e"
          strokeWidth="14"
          strokeDasharray={circumference}
          strokeDashoffset={invoicedOffset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-lg font-semibold text-gray-900">{percent}%</span>
        <span className="text-[10px] text-gray-500">Invoiced</span>
      </div>
    </div>
  );
}

function CardLink({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-0.5 text-xs text-burgundy hover:underline"
    >
      {label}
      <IconArrowNarrowRight size={14} />
    </button>
  );
}

function FinancialsOverview() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="grid shrink-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
          <div className="mb-1 flex items-start justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Total Contract Value
            </span>
            <IconFileDescription size={18} className="text-burgundy" />
          </div>
          <p className="text-xl font-semibold text-gray-900">
            {formatCurrencyFull(CONTRACT_TOTAL)}
          </p>
          <p className="text-[10px] text-gray-500">Including approved changes</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
          <div className="mb-1 flex items-start justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Total Invoiced
            </span>
            <IconCurrencyDollar size={18} className="text-green-600" />
          </div>
          <p className="text-xl font-semibold text-green-600">
            {formatCurrencyFull(INVOICED)}
          </p>
          <p className="text-[10px] text-gray-500">
            {INVOICED_PERCENT}% of contract value
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
          <div className="mb-1 flex items-start justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Balance Remaining
            </span>
            <IconCurrencyDollar size={18} className="text-burgundy/70" />
          </div>
          <p className="text-xl font-semibold text-gray-900">
            {formatCurrencyFull(REMAINING)}
          </p>
          <p className="text-[10px] text-gray-500">
            {100 - INVOICED_PERCENT}% remaining
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
          <div className="mb-1 flex items-start justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Overdue Amount
            </span>
            <IconCircleCheck size={18} className="text-green-600" />
          </div>
          <p className="text-xl font-semibold text-gray-900">
            {formatCurrencyFull(0)}
          </p>
          <p className="text-[10px] text-gray-500">All invoices up to date</p>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 xl:grid-cols-3">
        <div className="flex min-h-0 flex-col gap-2">
          <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white">
            <div className="shrink-0 border-b border-gray-100 px-3 py-2">
              <h3 className="text-sm font-semibold text-gray-900">
                Contract Breakdown
              </h3>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-1">
              <table className="w-full text-xs">
                <tbody>
                  {CONTRACT_BREAKDOWN.map((row) => (
                    <tr
                      key={row.category}
                      className="border-b border-gray-50 last:border-0"
                    >
                      <td className="py-1.5">
                        <span className="flex items-center gap-2 text-gray-800">
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${row.dot}`}
                          />
                          {row.category}
                        </span>
                      </td>
                      <td className="py-1.5 text-right font-medium text-gray-900">
                        {formatCurrencyFull(row.amount)}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-gray-200">
                    <td className="py-2 font-semibold text-gray-900">Total</td>
                    <td className="py-2 text-right font-semibold text-burgundy">
                      {formatCurrencyFull(CONTRACT_TOTAL)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white">
            <div className="shrink-0 border-b border-gray-100 px-3 py-2">
              <h3 className="text-sm font-semibold text-gray-900">
                Recent Payments
              </h3>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-[10px] uppercase text-gray-500">
                    <th className="px-3 py-1.5 text-left font-medium">Date</th>
                    <th className="px-3 py-1.5 text-left font-medium">Type</th>
                    <th className="px-3 py-1.5 text-left font-medium">Amount</th>
                    <th className="px-3 py-1.5 text-left font-medium">Method</th>
                  </tr>
                </thead>
                <tbody>
                  {RECENT_PAYMENTS.map((p) => (
                    <tr
                      key={p.date + p.type}
                      className="border-b border-gray-50 last:border-0"
                    >
                      <td className="px-3 py-1.5 text-gray-600">
                        {formatTableDate(p.date)}
                      </td>
                      <td className="px-3 py-1.5 text-gray-800">{p.type}</td>
                      <td className="px-3 py-1.5 font-medium text-gray-900">
                        {formatCurrencyFull(p.amount)}
                      </td>
                      <td className="px-3 py-1.5 text-gray-600">{p.method}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="shrink-0 border-t border-gray-100 px-3 py-1.5">
              <CardLink label="View all payments" />
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-2">
          <div className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-2">
            <h3 className="mb-2 text-sm font-semibold text-gray-900">
              Quote Summary
            </h3>
            <dl className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <dt className="text-gray-600">Original Quote</dt>
                <dd className="font-medium text-gray-900">
                  {formatCurrencyFull(24850)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">Approved Change Orders</dt>
                <dd className="font-medium text-green-600">
                  +{formatCurrencyFull(3200)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-gray-100 pt-1.5">
                <dt className="font-semibold text-gray-900">Total Contract Value</dt>
                <dd className="font-semibold text-burgundy">
                  {formatCurrencyFull(CONTRACT_TOTAL)}
                </dd>
              </div>
            </dl>
          </div>

          <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white">
            <div className="shrink-0 border-b border-gray-100 px-3 py-2">
              <h3 className="text-sm font-semibold text-gray-900">Quote History</h3>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-[10px] uppercase text-gray-500">
                    <th className="px-3 py-1.5 text-left font-medium">Version</th>
                    <th className="px-3 py-1.5 text-left font-medium">Date</th>
                    <th className="px-3 py-1.5 text-left font-medium">Amount</th>
                    <th className="px-3 py-1.5 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {QUOTE_HISTORY.map((q) => (
                    <tr
                      key={q.version}
                      className="border-b border-gray-50 last:border-0"
                    >
                      <td className="px-3 py-1.5 font-medium text-gray-900">
                        {q.version}
                      </td>
                      <td className="px-3 py-1.5 text-gray-600">
                        {formatTableDate(q.date)}
                      </td>
                      <td className="px-3 py-1.5 text-gray-900">
                        {formatCurrencyFull(q.amount)}
                      </td>
                      <td className="px-3 py-1.5">
                        <StatusBadge
                          label={q.status}
                          variant={q.status === "Current" ? "current" : "superseded"}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="shrink-0 border-t border-gray-100 px-3 py-1.5">
              <CardLink label="View all quotes" />
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white">
            <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-3 py-2">
              <h3 className="text-sm font-semibold text-gray-900">Change Orders</h3>
              <Button variant="primary" className="!px-2 !py-0.5 !text-[10px]">
                + Add change order
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-[10px] uppercase text-gray-500">
                    <th className="px-3 py-1.5 text-left font-medium">Change</th>
                    <th className="px-3 py-1.5 text-left font-medium">Date</th>
                    <th className="px-3 py-1.5 text-left font-medium">Amount</th>
                    <th className="px-3 py-1.5 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {CHANGE_ORDERS.map((co) => (
                    <tr
                      key={co.change}
                      className="border-b border-gray-50 last:border-0"
                    >
                      <td className="px-3 py-1.5 text-gray-900">{co.change}</td>
                      <td className="px-3 py-1.5 text-gray-600">
                        {formatTableDate(co.date)}
                      </td>
                      <td className="px-3 py-1.5 font-medium text-gray-900">
                        {formatCurrencyFull(co.amount)}
                      </td>
                      <td className="px-3 py-1.5">
                        <StatusBadge
                          label={co.status}
                          variant={
                            co.status === "Approved" ? "approved" : "pending"
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="shrink-0 border-t border-gray-100 px-3 py-1.5">
              <CardLink label="View all change orders" />
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-2">
          <div className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-2.5">
            <h3 className="mb-2 text-sm font-semibold text-gray-900">
              Invoice Summary
            </h3>
            <div className="flex items-center gap-4">
              <DonutChart percent={INVOICED_PERCENT} />
              <ul className="min-w-0 flex-1 space-y-1.5 text-xs">
                <li className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-gray-600">
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                    Invoiced
                  </span>
                  <span className="font-medium text-gray-900">
                    {formatCurrencyFull(INVOICED)} ({INVOICED_PERCENT}%)
                  </span>
                </li>
                <li className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-gray-600">
                    <span className="h-2 w-2 rounded-full bg-burgundy" />
                    Remaining
                  </span>
                  <span className="font-medium text-gray-900">
                    {formatCurrencyFull(REMAINING)} ({100 - INVOICED_PERCENT}%)
                  </span>
                </li>
                <li className="flex items-center justify-between gap-2 border-t border-gray-100 pt-1.5">
                  <span className="text-gray-600">Total Contract Value</span>
                  <span className="font-semibold text-burgundy">
                    {formatCurrencyFull(CONTRACT_TOTAL)}
                  </span>
                </li>
              </ul>
            </div>
            <div className="mt-3">
              <div className="mb-0.5 flex justify-between text-[10px] text-gray-500">
                <span>Payment Progress</span>
                <span>{INVOICED_PERCENT}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-burgundy"
                  style={{ width: `${INVOICED_PERCENT}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white">
            <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-3 py-2">
              <h3 className="text-sm font-semibold text-gray-900">
                Recent Invoices
              </h3>
              <Button variant="primary" className="!px-2 !py-0.5 !text-[10px]">
                + New invoice
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-[10px] uppercase text-gray-500">
                    <th className="px-3 py-1.5 text-left font-medium">Invoice #</th>
                    <th className="px-3 py-1.5 text-left font-medium">Type</th>
                    <th className="px-3 py-1.5 text-left font-medium">Date</th>
                    <th className="px-3 py-1.5 text-left font-medium">Amount</th>
                    <th className="px-3 py-1.5 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {RECENT_INVOICES.map((inv) => (
                    <tr
                      key={inv.number}
                      className="border-b border-gray-50 last:border-0"
                    >
                      <td className="px-3 py-1.5 font-medium text-gray-900">
                        {inv.number}
                      </td>
                      <td className="px-3 py-1.5 text-gray-700">{inv.type}</td>
                      <td className="px-3 py-1.5 text-gray-600">
                        {formatTableDate(inv.date)}
                      </td>
                      <td className="px-3 py-1.5 font-medium text-gray-900">
                        {formatCurrencyFull(inv.amount)}
                      </td>
                      <td className="px-3 py-1.5">
                        <StatusBadge
                          label={inv.status}
                          variant={
                            inv.status === "Paid" ? "paid" : "outstanding"
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="shrink-0 border-t border-gray-100 px-3 py-1.5">
              <CardLink label="View all invoices" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface FinancialsTabProps {
  jobId: string;
}

export default function FinancialsTab({ jobId }: FinancialsTabProps) {
  const [subTab, setSubTab] = useState<FinancialsSubTab>("Overview");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex shrink-0 flex-wrap gap-4 border-b border-gray-200 text-sm">
        {FINANCIALS_SUB_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setSubTab(tab)}
            className={`pb-2 ${
              subTab === tab
                ? "border-b-2 border-burgundy font-medium text-burgundy"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {subTab === "Overview" ? (
        <FinancialsOverview />
      ) : subTab === "Quotes" ? (
        <JobFinancialsQuotes jobId={jobId} />
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white p-8 text-sm text-gray-500">
          {subTab} coming soon.
        </div>
      )}
    </div>
  );
}
