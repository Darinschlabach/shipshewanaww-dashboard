"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconFileDescription,
  IconPlus,
  IconX,
} from "@tabler/icons-react";
import {
  CalendarEmbedProvider,
  useProductionSchedule,
} from "@/components/calendar/CalendarEmbedContext";
import ProductionScheduleFooter from "@/components/jobs/ProductionScheduleFooter";
import ProductionSchedulePanel from "@/components/jobs/ProductionSchedulePanel";
import {
  loadJobSchedule,
  phaseDatesFromRecord,
  saveJobSchedule,
  type JobScheduleRecord,
} from "@/lib/job-schedule";
import type { PhaseDates, ScheduleColor } from "@/lib/schedule-phase-drag";
import { createClient } from "@/lib/supabase/client";
const ProductionCalendarPanel = dynamic(
  () => import("@/app/(app)/calendar/page"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center p-6 text-sm text-gray-500">
        Loading production calendar…
      </div>
    ),
  }
);

const EMPTY_PHASE_DATES: PhaseDates = {
  fabricating: null,
  finishing: null,
  delivery: null,
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface SchedulePhase {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  barColor: string;
}

const BAR_COLORS: Record<ScheduleColor, string> = {
  red: "bg-red-400",
  blue: "bg-blue-400",
  purple: "bg-purple-400",
  orange: "bg-orange-400",
  yellow: "bg-yellow-400",
};

function addDaysIso(iso: string, days: number) {
  const date = parseDate(iso);
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function buildDisplayPhases(
  phaseDates: PhaseDates,
  color: ScheduleColor
): SchedulePhase[] {
  const phases: SchedulePhase[] = [];
  if (phaseDates.fabricating) {
    phases.push({
      id: "1",
      name: "Fabricating",
      startDate: phaseDates.fabricating,
      endDate: phaseDates.finishing
        ? addDaysIso(phaseDates.finishing, -1)
        : phaseDates.fabricating,
      barColor: BAR_COLORS[color],
    });
  }
  if (phaseDates.finishing) {
    phases.push({
      id: "2",
      name: "Finishing",
      startDate: phaseDates.finishing,
      endDate: phaseDates.delivery
        ? addDaysIso(phaseDates.delivery, -1)
        : phaseDates.finishing,
      barColor: BAR_COLORS[color],
    });
  }
  if (phaseDates.delivery) {
    phases.push({
      id: "3",
      name: "Delivery",
      startDate: phaseDates.delivery,
      endDate: phaseDates.delivery,
      barColor: "bg-green-400",
    });
  }
  return phases;
}

function countDaysUntil(iso: string) {
  const target = parseDate(iso);
  const start = new Date();
  start.setHours(12, 0, 0, 0);
  return Math.max(
    0,
    Math.ceil((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  );
}

function ProductionScheduleOverlayBody({
  jobId,
  jobName,
  calendarRefreshKey,
  onClose,
  onSaved,
}: {
  jobId: string;
  jobName: string;
  calendarRefreshKey: number;
  onClose: () => void;
  onSaved: (record: JobScheduleRecord) => void;
}) {
  const { phaseDates, selectedColor, resetSchedule } = useProductionSchedule();
  const supabase = useMemo(() => createClient(), []);

  const handleSave = useCallback(async () => {
    const result = await saveJobSchedule(
      supabase,
      jobId,
      jobName,
      phaseDates,
      selectedColor
    );
    if (!result.error) {
      onSaved({
        job_id: jobId,
        fabricating_start: phaseDates.fabricating,
        finishing_start: phaseDates.finishing,
        delivery_date: phaseDates.delivery,
        color: selectedColor,
      });
      onClose();
    }
    return result;
  }, [supabase, jobId, jobName, phaseDates, selectedColor, onSaved, onClose]);

  const handleCancel = useCallback(() => {
    resetSchedule();
    onClose();
  }, [resetSchedule, onClose]);

  return (
    <>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-h-0 w-1/4 flex-col border-r border-gray-200 bg-white">
          <ProductionSchedulePanel />
        </div>
        <div className="flex min-h-0 w-3/4 flex-col bg-white">
          <div className="min-h-0 flex-1 overflow-hidden [&>div]:!h-full [&>div]:max-h-full">
            <ProductionCalendarPanel key={calendarRefreshKey} />
          </div>
        </div>
      </div>
      <ProductionScheduleFooter onSave={handleSave} onCancel={handleCancel} />
    </>
  );
}

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
  jobName: string;
  autoOpenEditor?: boolean;
}

export default function ScheduleTab({
  jobId,
  jobName,
  autoOpenEditor = false,
}: ScheduleTabProps) {
  const [savedSchedule, setSavedSchedule] = useState<JobScheduleRecord | null>(null);
  const [current, setCurrent] = useState(() => new Date());
  const [showProductionCalendar, setShowProductionCalendar] = useState(false);
  const [overlayKey, setOverlayKey] = useState(0);
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    void loadJobSchedule(supabase, jobId).then((record) => {
      setSavedSchedule(record);
      if (record?.fabricating_start) {
        setCurrent(parseDate(record.fabricating_start));
      }
    });
  }, [supabase, jobId]);

  useEffect(() => {
    if (autoOpenEditor) {
      openProductionCalendar();
    }
  }, [autoOpenEditor]);

  const savedPhaseDates = useMemo(
    () => phaseDatesFromRecord(savedSchedule),
    [savedSchedule]
  );
  const savedColor = savedSchedule?.color ?? "red";
  const displayPhases = useMemo(
    () => buildDisplayPhases(savedPhaseDates, savedColor),
    [savedPhaseDates, savedColor]
  );
  const daysUntilDelivery = savedPhaseDates.delivery
    ? countDaysUntil(savedPhaseDates.delivery)
    : null;

  function openProductionCalendar() {
    setOverlayKey((key) => key + 1);
    setShowProductionCalendar(true);
  }

  function closeProductionCalendar() {
    setShowProductionCalendar(false);
  }

  function handleScheduleSaved(record: JobScheduleRecord) {
    setSavedSchedule(record);
    setCalendarRefreshKey((key) => key + 1);
    if (record.fabricating_start) {
      setCurrent(parseDate(record.fabricating_start));
    }
  }

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

  const renderCalendar = () => (
    <div className="flex min-h-0 h-full flex-col">
      <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-gray-100 px-3 py-2">
        <div />
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCurrent(new Date(year, month - 1, 1))}
            className="flex h-7 w-7 items-center justify-center rounded border border-gray-200 hover:bg-gray-50"
            aria-label="Previous month"
          >
            <IconChevronLeft size={16} />
          </button>
          <h2 className="min-w-[7rem] text-center text-sm font-semibold text-gray-900">
            {monthLabel}
          </h2>
          <button
            type="button"
            onClick={() => setCurrent(new Date(year, month + 1, 1))}
            className="flex h-7 w-7 items-center justify-center rounded border border-gray-200 hover:bg-gray-50"
            aria-label="Next month"
          >
            <IconChevronRight size={16} />
          </button>
        </div>
        <div />
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
              {displayPhases.map((phase) => {
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
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 xl:flex-row">
      <div className="flex w-full shrink-0 flex-col gap-2 xl:w-64">
        <div className="relative">
          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                Current Phase
              </span>
              <IconFileDescription size={16} className="text-gray-400" />
            </div>
            <p className="text-sm font-semibold text-gray-900">Drafting</p>
            <p className="text-xs text-gray-500">May 20 – May 24</p>
            <span className="mt-1.5 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
              In Progress
            </span>
          </div>
          <button
            type="button"
            onClick={openProductionCalendar}
            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <IconPlus size={14} />
            Add to Production Calendar
          </button>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Next Up
            </span>
            <IconCalendar size={16} className="text-gray-400" />
          </div>
          <p className="text-sm font-semibold text-gray-900">Finishing</p>
          <p className="text-xs text-gray-500">May 27 – May 31</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
          <div className="mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Schedule
            </span>
          </div>
          <div className="space-y-1.5">
            {displayPhases.length > 0 ? (
              displayPhases.map((phase) => (
                <div key={phase.id} className="flex items-center justify-between">
                  <span className="text-xs text-gray-900">{phase.name}</span>
                  <span className="text-xs text-gray-500">
                    {formatShortDate(phase.startDate)}
                  </span>
                </div>
              ))
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-900">Fabricating</span>
                  <span className="text-xs text-gray-500">—</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-900">Finishing</span>
                  <span className="text-xs text-gray-500">—</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-900">Delivery</span>
                  <span className="text-xs text-gray-500">—</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col rounded-lg border border-gray-200 bg-white px-3 py-2.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            Days Until Delivery
          </span>
          <p className="mt-0.5 text-3xl leading-none font-semibold text-gray-900">
            {daysUntilDelivery ?? "—"}
          </p>
          <p className="text-xs leading-tight text-gray-500">
            {savedPhaseDates.delivery
              ? `days remaining · ${formatShortDate(savedPhaseDates.delivery)}`
              : "No delivery date set"}
          </p>
          <div className="mt-3">
            <div className="mb-0.5 flex justify-between text-[10px] leading-none text-gray-500">
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

      <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white">
        {renderCalendar()}
      </div>

      {showProductionCalendar ? (
        <div className="fixed top-[0.5in] right-[1in] bottom-[0.5in] left-[1in] z-[100] flex flex-col overflow-hidden border border-gray-200 bg-white shadow-xl">
          <button
            type="button"
            onClick={closeProductionCalendar}
            className="absolute right-3 top-3 z-10 rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            aria-label="Close production calendar"
          >
            <IconX size={18} />
          </button>
          <CalendarEmbedProvider
            key={overlayKey}
            embedded
            scheduleMode
            scheduleJobId={jobId}
            jobName={jobName}
            initialPhaseDates={EMPTY_PHASE_DATES}
            initialColor={savedColor}
          >
            <ProductionScheduleOverlayBody
              jobId={jobId}
              jobName={jobName}
              calendarRefreshKey={calendarRefreshKey}
              onClose={closeProductionCalendar}
              onSaved={handleScheduleSaved}
            />
          </CalendarEmbedProvider>
        </div>
      ) : null}
    </div>
  );
}
