"use client";

import { formatCurrencyFull } from "@/lib/utils";

export default function InvoiceAgingDonut({
  segments,
  total,
}: {
  segments: { label: string; amount: number; color: string }[];
  total: number;
}) {
  const sum = segments.reduce((s, seg) => s + seg.amount, 0) || 1;
  let offset = 0;
  const r = 40;
  const c = 2 * Math.PI * r;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <div className="relative h-28 w-28 shrink-0">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            <circle cx="50" cy="50" r={r} fill="none" stroke="#f3f4f6" strokeWidth="12" />
            {segments.map((seg) => {
              const pct = seg.amount / sum;
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
        </div>
        <div className="flex-1 space-y-2 text-xs">
          {segments.map((seg) => (
            <div key={seg.label} className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: seg.color }}
              />
              <span className="flex-1 text-gray-600">{seg.label}</span>
              <span className="font-medium text-gray-900">
                {formatCurrencyFull(seg.amount)}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-gray-100 pt-3">
        <p className="text-xs text-gray-500">Total Open</p>
        <p className="font-semibold text-gray-900">{formatCurrencyFull(total)}</p>
      </div>
    </div>
  );
}
