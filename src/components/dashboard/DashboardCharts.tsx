"use client";

import { formatCurrencyFull } from "@/lib/utils";

export function PipelineFunnel({
  stages,
  total,
}: {
  stages: { label: string; count: number; value: number; color: string }[];
  total: number;
}) {
  const maxCount = Math.max(...stages.map((s) => s.count), 1);

  return (
    <div className="flex gap-4">
      <div className="flex flex-1 flex-col items-center gap-0.5 py-2">
        {stages.map((stage) => {
          const widthPct = 40 + (stage.count / maxCount) * 55;
          return (
            <div
              key={stage.label}
              className="flex items-center justify-center rounded-sm py-2 text-center text-[10px] font-medium text-white transition-all"
              style={{
                width: `${widthPct}%`,
                backgroundColor: stage.color,
                minHeight: "28px",
              }}
            >
              {stage.count > 0 ? stage.count : ""}
            </div>
          );
        })}
      </div>
      <div className="w-36 shrink-0 space-y-1.5 text-xs">
        {stages.map((stage) => (
          <div key={stage.label} className="flex items-center justify-between gap-2">
            <span className="text-gray-600">{stage.label}</span>
            <span className="shrink-0 font-medium text-gray-900">
              {stage.count} · {formatCurrencyFull(stage.value)}
            </span>
          </div>
        ))}
        <div className="mt-3 border-t border-gray-200 pt-2">
          <p className="text-gray-500">Total Pipeline</p>
          <p className="font-semibold text-gray-900">{formatCurrencyFull(total)}</p>
        </div>
      </div>
    </div>
  );
}

export function ProductionDonut({
  segments,
  total,
}: {
  segments: { label: string; count: number; color: string }[];
  total: number;
}) {
  const sum = segments.reduce((s, seg) => s + seg.count, 0) || 1;
  let offset = 0;
  const r = 40;
  const c = 2 * Math.PI * r;

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-32 w-32 shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r={r} fill="none" stroke="#f3f4f6" strokeWidth="12" />
          {segments.map((seg) => {
            const pct = seg.count / sum;
            const dash = pct * c;
            const circle = (
              <circle
                key={seg.label}
                cx="50"
                cy="50"
                r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth="12"
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-offset}
              />
            );
            offset += dash;
            return circle;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-semibold text-gray-900">{total}</span>
          <span className="text-[10px] text-gray-500">Jobs</span>
        </div>
      </div>
      <div className="flex-1 space-y-1.5 text-xs">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: seg.color }}
            />
            <span className="flex-1 text-gray-600">{seg.label}</span>
            <span className="font-medium text-gray-900">{seg.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function InvoiceBars({
  open,
  overdue,
  paidMonth,
  paidYtd,
}: {
  open: number;
  overdue: number;
  paidMonth: number;
  paidYtd: number;
}) {
  const max = Math.max(open, overdue, paidMonth, paidYtd, 1);
  const bars = [
    { label: "Open Invoices", value: open, color: "bg-burgundy" },
    { label: "Overdue", value: overdue, color: "bg-red-500" },
    { label: "Paid (This Month)", value: paidMonth, color: "bg-green-500" },
    { label: "Paid (This Year)", value: paidYtd, color: "bg-emerald-700" },
  ];

  return (
    <div className="space-y-3">
      {bars.map((bar) => (
        <div key={bar.label}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-gray-600">{bar.label}</span>
            <span className="font-medium text-gray-900">
              {formatCurrencyFull(bar.value)}
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full rounded-full ${bar.color}`}
              style={{ width: `${(bar.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
