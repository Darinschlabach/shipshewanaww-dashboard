"use client";

import { useMemo, useState } from "react";
import {
  IconCalendar,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconFileDescription,
  IconPackage,
} from "@tabler/icons-react";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface SchedulePhase {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  dotColor: string;
  barColor: string;
}

const SCHEDULE_PHASES: SchedulePhase[] = [
  {
    id: "1",
    name: "Site Measure",
    startDate: "2024-04-01",
    endDate: "2024-04-01",
    dotColor: "bg-green-500",
    barColor: "bg-green-400",
  },
  {
    id: "2",
    name: "Drafting",
    startDate: "2024-04-02",
    endDate: "2024-05-05",
    dotColor: "bg-blue-500",
    barColor: "bg-blue-400",
  },
  {
    id: "3",
    name: "Customer Approval",
    startDate: "2024-05-06",
    endDate: "2024-05-10",
    dotColor: "bg-orange-500",
    barColor: "bg-orange-400",
  },
  {
    id: "4",
    name: "Engineering",
    startDate: "2024-05-11",
    endDate: "2024-05-15",
    dotColor: "bg-sky-500",
    barColor: "bg-sky-400",
  },
  {
    id: "5",
    name: "Materials Ordered",
    startDate: "2024-05-16",
    endDate: "2024-05-17",
    dotColor: "bg-lime-500",
    barColor: "bg-lime-400",
  },
  {
    id: "6",
    name: "Fabricating",
    startDate: "2024-05-20",
    endDate: "2024-05-24",
    dotColor: "bg-purple-400",
    barColor: "bg-purple-300",
  },
  {
    id: "7",
    name: "Finishing",
    startDate: "2024-05-27",
    endDate: "2024-05-31",
    dotColor: "bg-yellow-500",
    barColor: "bg-yellow-400",
  },
  {
    id: "8",
    name: "Assembly",
    startDate: "2024-06-03",
    endDate: "2024-06-10",
    dotColor: "bg-teal-500",
    barColor: "bg-teal-400",
  },
  {
    id: "9",
    name: "Delivery",
    startDate: "2024-06-24",
    endDate: "2024-06-24",
    dotColor: "bg-pink-500",
    barColor: "bg-pink-400",
  },
];

function parseDate(iso: string) {
  return new Date(iso + "T12:00:00");
}

function formatShortDate(iso: string) {
  return parseDate(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRange(start: string, end: string) {
  const s = parseDate(start);
  const e = parseDate(end);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (s.getTime() === e.getTime()) {
    return formatShortDate(start);
  }
  return `${s.toLocaleDateString("en-US", opts)} – ${e.toLocaleDateString("en-US", opts)}`;
}

function isDayInPhase(
  day: number,
  year: number,
  month: number,
  phase: SchedulePhase
) {
  const date = new Date(year, month, day);
  const start = parseDate(phase.startDate);
  const end = parseDate(phase.endDate);
  return date >= start && date <= end;
}

function getPhaseWeekSegment(
  weekCells: (number | null)[],
  year: number,
  month: number,
  phase: SchedulePhase
) {
  let colStart = -1;
  let colEnd = -1;

  weekCells.forEach((day, col) => {
    if (day === null) return;
    if (!isDayInPhase(day, year, month, phase)) return;
    if (colStart === -1) colStart = col;
    colEnd = col;
  });

  if (colStart === -1) return null;
  return { colStart, colEnd };
}

interface ScheduleTabProps {
  jobId: string;
}

export default function ScheduleTab({ jobId: _jobId }: ScheduleTabProps) {
  const [view, setView] = useState<"month" | "week">("month");
  const [current, setCurrent] = useState(new Date(2024, 4, 1));

  const year = current.getFullYear();
  const month = current.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const cells: (number | null)[] = useMemo(() => {
    const result: (number | null)[] = [
      ...Array(firstDay).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    while (result.length % 7 !== 0) result.push(null);
    return result;
  }, [firstDay, daysInMonth]);

  const weeks = useMemo(() => {
    const rows: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      rows.push(cells.slice(i, i + 7));
    }
    return rows;
  }, [cells]);

  const monthLabel = current.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const isToday = (day: number) =>
    today.getDate() === day &&
    today.getMonth() === month &&
    today.getFullYear() === year;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="grid shrink-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Current Phase
            </span>
            <IconFileDescription size={16} className="text-gray-400" />
          </div>
          <p className="text-sm font-semibold text-gray-900">Customer Approval</p>
          <p className="text-xs text-gray-500">May 6 – May 10</p>
          <span className="mt-1.5 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
            In Progress
          </span>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Next Up
            </span>
            <IconCalendar size={16} className="text-gray-400" />
          </div>
          <p className="text-sm font-semibold text-gray-900">Engineering</p>
          <p className="text-xs text-gray-500">May 11 – May 15</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Upcoming Milestone
            </span>
            <IconPackage size={16} className="text-gray-400" />
          </div>
          <p className="text-sm font-semibold text-gray-900">Materials Ordered</p>
          <p className="text-xs text-gray-500">May 16 – May 17</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            Days Until Delivery
          </span>
          <p className="mt-0.5 text-2xl font-semibold text-gray-900">30</p>
          <p className="text-xs text-gray-500">days remaining · Jun 24, 2024</p>
          <div className="mt-2">
            <div className="mb-0.5 flex justify-between text-[10px] text-gray-500">
              <span>Progress</span>
              <span>52%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-burgundy"
                style={{ width: "52%" }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 xl:grid-cols-12">
        <div className="flex min-h-0 flex-col rounded-lg border border-gray-200 bg-white xl:col-span-4">
          <div className="shrink-0 border-b border-gray-100 px-3 py-2">
            <h2 className="text-sm font-semibold text-gray-900">Schedule</h2>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-gray-100 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                  <th className="px-3 py-1.5 font-medium">Phase</th>
                  <th className="px-3 py-1.5 font-medium">Start</th>
                </tr>
              </thead>
              <tbody>
                {SCHEDULE_PHASES.map((phase) => (
                  <tr
                    key={phase.id}
                    className="border-b border-gray-50 last:border-0"
                  >
                    <td className="px-3 py-1.5">
                      <span className="flex items-center gap-2 text-gray-900">
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${phase.dotColor}`}
                        />
                        {phase.name}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap text-gray-600">
                      {formatShortDate(phase.startDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex min-h-0 flex-col rounded-lg border border-gray-200 bg-white xl:col-span-8">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-3 py-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-gray-900">{monthLabel}</h2>
              <div className="flex rounded border border-gray-200 text-xs">
                <button
                  type="button"
                  onClick={() => setView("month")}
                  className={`px-2 py-0.5 ${
                    view === "month"
                      ? "bg-gray-100 font-medium text-gray-900"
                      : "text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  Month
                </button>
                <button
                  type="button"
                  onClick={() => setView("week")}
                  className={`border-l border-gray-200 px-2 py-0.5 ${
                    view === "week"
                      ? "bg-gray-100 font-medium text-gray-900"
                      : "text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  Week
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrent(new Date(year, month - 1, 1))}
                className="flex h-7 w-7 items-center justify-center rounded border border-gray-200 hover:bg-gray-50"
                aria-label="Previous month"
              >
                <IconChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => setCurrent(new Date(year, month + 1, 1))}
                className="flex h-7 w-7 items-center justify-center rounded border border-gray-200 hover:bg-gray-50"
                aria-label="Next month"
              >
                <IconChevronRight size={16} />
              </button>
              <button
                type="button"
                onClick={() => setCurrent(new Date())}
                className="rounded border border-gray-200 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-50"
              >
                Today
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-0.5 rounded border border-gray-200 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-50"
              >
                All phases
                <IconChevronDown size={14} />
              </button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-2">
            <div className="grid shrink-0 grid-cols-7 border-b border-gray-100">
              {DAY_LABELS.map((d) => (
                <div
                  key={d}
                  className="py-1 text-center text-[10px] font-medium uppercase text-gray-500"
                >
                  {d}
                </div>
              ))}
            </div>

            <div className="flex min-h-0 flex-1 flex-col border-l border-gray-100">
              {weeks.map((weekCells, weekIdx) => (
                <div
                  key={weekIdx}
                  className="relative grid min-h-0 flex-1 grid-cols-7 border-b border-gray-100"
                >
                  {weekCells.map((day, colIdx) => (
                    <div
                      key={colIdx}
                      className={`relative border-r border-gray-100 p-0.5 ${
                        day && isToday(day)
                          ? "bg-burgundy/5 ring-1 ring-inset ring-burgundy"
                          : ""
                      }`}
                    >
                      {day && (
                        <span
                          className={`text-[10px] ${
                            isToday(day)
                              ? "font-semibold text-burgundy"
                              : "text-gray-500"
                          }`}
                        >
                          {day}
                        </span>
                      )}
                    </div>
                  ))}
                  {SCHEDULE_PHASES.map((phase) => {
                    const segment = getPhaseWeekSegment(
                      weekCells,
                      year,
                      month,
                      phase
                    );
                    if (!segment) return null;

                    return (
                      <div
                        key={`${weekIdx}-${phase.id}`}
                        className={`pointer-events-none absolute bottom-0.5 h-2 rounded-sm ${phase.barColor}`}
                        style={{
                          left: `calc(${(segment.colStart / 7) * 100}% + 2px)`,
                          width: `calc(${((segment.colEnd - segment.colStart + 1) / 7) * 100}% - 4px)`,
                        }}
                        title={`${phase.name} (${formatRange(phase.startDate, phase.endDate)})`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
