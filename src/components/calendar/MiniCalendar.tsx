"use client";

import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { addDays, formatDateKey } from "@/lib/calendar";

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function buildMonthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const gridStart = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

export default function MiniCalendar({
  displayDate,
  focusDate,
  onSelectDate,
  onShiftMonth,
}: {
  displayDate: Date;
  focusDate: Date;
  onSelectDate: (date: Date) => void;
  onShiftMonth: (delta: number) => void;
}) {
  const year = displayDate.getFullYear();
  const month = displayDate.getMonth();
  const todayKey = formatDateKey(new Date());
  const focusKey = formatDateKey(focusDate);

  const monthLabel = displayDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const cells = buildMonthGrid(year, month);

  return (
    <div className="shrink-0 rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900">{monthLabel}</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onShiftMonth(-1)}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Previous month"
          >
            <IconChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => onShiftMonth(1)}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Next month"
          >
            <IconChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-center">
        {DAY_LABELS.map((label, i) => (
          <div
            key={`${label}-${i}`}
            className="pb-1 text-[11px] font-medium text-gray-400"
          >
            {label}
          </div>
        ))}

        {cells.map((day) => {
          const key = formatDateKey(day);
          const inMonth = day.getMonth() === month;
          const isToday = key === todayKey;
          const isSelected = key === focusKey && !isToday;

          let cellClass =
            "mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs ";
          if (isToday) {
            cellClass += "bg-burgundy font-semibold text-white ";
          } else if (isSelected) {
            cellClass += "bg-burgundy/15 font-medium text-burgundy ";
          } else if (!inMonth) {
            cellClass += "text-gray-300 ";
          } else {
            cellClass += "text-gray-700 hover:bg-gray-100 ";
          }

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDate(day)}
              className={cellClass}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
