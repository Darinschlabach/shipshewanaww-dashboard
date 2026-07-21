"use client";

import { useState } from "react";
import {
  IconCalendar,
  IconCurrencyDollar,
  IconFileDescription,
} from "@tabler/icons-react";
import JobFinancialsInvoices from "@/components/jobs/JobFinancialsInvoices";
import JobFinancialsQuotes from "@/components/jobs/JobFinancialsQuotes";
import { formatCurrencyFull } from "@/lib/utils";

const FINANCIALS_SUB_TABS = [
  "Overview",
  "Quotes",
  "Invoices",
] as const;

type FinancialsSubTab = (typeof FINANCIALS_SUB_TABS)[number];

const CONTRACT_TOTAL = 28050;
const INVOICED = 15300;
const REMAINING = 12750;
const INVOICED_PERCENT = 55;
const NEXT_PAYMENT_DUE = "2026-08-14";

function formatTableDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysUntil(isoDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${isoDate.slice(0, 10)}T12:00:00`);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDaysUntil(isoDate: string): string {
  const days = daysUntil(isoDate);
  if (days === 0) return "Due today";
  if (days === 1) return "1 day";
  if (days > 1) return `${days} days`;
  if (days === -1) return "1 day overdue";
  return `${Math.abs(days)} days overdue`;
}

function DonutChart({ percent }: { percent: number }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const invoicedOffset = circumference * (1 - percent / 100);

  return (
    <div className="relative mx-auto h-[8.75rem] w-[8.75rem]">
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
        <span className="text-[1.40625rem] font-semibold text-gray-900">{percent}%</span>
        <span className="text-[0.78125rem] text-gray-500">Invoiced</span>
      </div>
    </div>
  );
}

function FinancialsOverview() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="grid shrink-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
          <div className="mb-1 flex items-start justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Project Value
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
              Amount Paid
            </span>
            <IconCurrencyDollar size={18} className="text-green-600" />
          </div>
          <p className="text-xl font-semibold text-green-600">
            {formatCurrencyFull(INVOICED)}
          </p>
          <p className="text-[10px] text-gray-500">
            {INVOICED_PERCENT}% of project value
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
              Next Payment Due
            </span>
            <IconCalendar size={18} className="text-burgundy/70" />
          </div>
          <p className="text-xl font-semibold text-gray-900">
            {NEXT_PAYMENT_DUE ? formatTableDate(NEXT_PAYMENT_DUE) : "—"}
          </p>
          <p className="text-[10px] text-gray-500">
            {NEXT_PAYMENT_DUE
              ? formatDaysUntil(NEXT_PAYMENT_DUE)
              : "No upcoming payments"}
          </p>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 lg:grid-cols-2">
        <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white px-2.5 py-2.5">
          <h3 className="mb-2.5 shrink-0 text-[1.09375rem] font-semibold text-gray-900">
            Quote Summary
          </h3>
          <dl className="space-y-[0.46875rem] text-[0.9375rem]">
            <div className="flex justify-between">
              <dt className="text-gray-600">Original Quote</dt>
              <dd className="font-medium text-gray-900">
                {formatCurrencyFull(24850)}
              </dd>
            </div>
          </dl>
          <div className="mt-auto flex justify-between border-t border-gray-100 pt-[0.46875rem] text-[0.9375rem]">
            <span className="font-semibold text-gray-900">Total Contract Value</span>
            <span className="font-semibold text-burgundy">
              {formatCurrencyFull(CONTRACT_TOTAL)}
            </span>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white px-2.5 py-2.5">
          <h3 className="mb-2.5 shrink-0 text-[1.09375rem] font-semibold text-gray-900">
            Invoice Summary
          </h3>
          <div className="flex items-center gap-[0.9375rem]">
            <DonutChart percent={INVOICED_PERCENT} />
            <ul className="min-w-0 flex-1 space-y-[0.46875rem] text-[0.9375rem]">
              <li className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-gray-600">
                  <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                  Invoiced
                </span>
                <span className="font-medium text-gray-900">
                  {formatCurrencyFull(INVOICED)} ({INVOICED_PERCENT}%)
                </span>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-gray-600">
                  <span className="h-2.5 w-2.5 rounded-full bg-burgundy" />
                  Remaining
                </span>
                <span className="font-medium text-gray-900">
                  {formatCurrencyFull(REMAINING)} ({100 - INVOICED_PERCENT}%)
                </span>
              </li>
            </ul>
          </div>
          <div className="mt-2.5">
            <div className="mb-0.5 flex justify-between text-[0.78125rem] text-gray-500">
              <span>Payment Progress</span>
              <span>{INVOICED_PERCENT}%</span>
            </div>
            <div className="h-[0.46875rem] overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-burgundy"
                style={{ width: `${INVOICED_PERCENT}%` }}
              />
            </div>
          </div>
          <div className="mt-auto flex justify-between border-t border-gray-100 pt-[0.46875rem] text-[0.9375rem]">
            <span className="font-semibold text-gray-900">Remaining Balance</span>
            <span className="font-semibold text-burgundy">
              {formatCurrencyFull(REMAINING)}
            </span>
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
        <JobFinancialsInvoices jobId={jobId} />
      )}
    </div>
  );
}
