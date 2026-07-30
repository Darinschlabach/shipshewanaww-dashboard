"use client";

import { useMemo } from "react";
import { IconConfetti } from "@tabler/icons-react";
import ScheduleBubbleChip, {
  scheduleBubbleFromMeta,
} from "@/components/calendar/ScheduleBubbleChip";
import { useProductionSchedule } from "@/components/calendar/CalendarEmbedContext";
import {
  buildMonthGrid,
  formatDateKey,
  formatEventStartTime,
  getCategoryStyles,
  hexToRgba,
  isShopClosedEvent,
  parseCustomCategoryDescription,
  type CustomCalendarCategory,
  type EnrichedCalendarEvent,
} from "@/lib/calendar";
import { parseScheduleBubbleDescription } from "@/lib/job-schedule";
import {
  buildJobScheduleBubbles,
  type ScheduleBubble,
  type ScheduleColor,
} from "@/lib/schedule-phase-drag";

function splitDayNumberClass(inMonth: boolean, isToday: boolean) {
  if (isToday) return "rounded-full bg-burgundy px-1 text-white";
  return inMonth ? "text-gray-900" : "text-gray-300";
}

function MonthEventChip({
  event,
  selected,
  onSelect,
  customCategories = [],
}: {
  event: EnrichedCalendarEvent;
  selected?: boolean;
  onSelect: () => void;
  customCategories?: CustomCalendarCategory[];
}) {
  const styles = getCategoryStyles(event.category);
  const timeLabel = formatEventStartTime(event);
  const customMeta = parseCustomCategoryDescription(event.description);
  const custom = customMeta
    ? customCategories.find((category) => category.id === customMeta.category_id)
    : null;
  const customStyle = custom
    ? {
        backgroundColor: hexToRgba(custom.color, 0.12),
        color: custom.color,
      }
    : undefined;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      className={`pointer-events-auto block w-full rounded px-1 py-1.5 text-left ${
        custom ? "" : styles.bg
      } ${selected ? "ring-1 ring-burgundy/40 ring-inset" : "hover:brightness-[0.98]"}`}
      style={customStyle}
    >
      <div className="flex items-center gap-1">
        <p
          className={`min-w-0 flex-1 truncate text-[10px] font-semibold leading-tight ${
            custom ? "" : styles.text
          }`}
        >
          {event.title}
        </p>
        {timeLabel ? (
          <span
            className={`shrink-0 text-[9px] leading-tight ${
              custom ? "opacity-80" : styles.muted
            }`}
          >
            {timeLabel}
          </span>
        ) : null}
      </div>
    </button>
  );
}

export default function MonthGridView({
  monthDate,
  eventsByDay,
  todayKey,
  selectedEventId,
  onOpenDate,
  onScheduleContextMenu,
  birthdayByDate,
  customCategories = [],
  className = "grid min-h-0 flex-1 grid-cols-7 grid-rows-5",
}: {
  monthDate: Date;
  eventsByDay: Map<string, EnrichedCalendarEvent[]>;
  todayKey: string;
  selectedEventId: string | null;
  onOpenDate: (date: Date) => void;
  onScheduleContextMenu?: (args: {
    jobId: string;
    jobName: string;
    clientName: string;
    x: number;
    y: number;
  }) => void;
  birthdayByDate?: Map<string, { firstName: string; age: number }[]>;
  customCategories?: CustomCalendarCategory[];
  className?: string;
}) {
  const {
    scheduleMode,
    jobName,
    phaseDates,
    setPhaseDate,
    activePhase,
    setActivePhase,
    selectedColor,
  } = useProductionSchedule();

  const scheduleBubbles = useMemo(
    () =>
      scheduleMode && jobName
        ? buildJobScheduleBubbles(jobName, phaseDates)
        : new Map<string, ScheduleBubble>(),
    [scheduleMode, jobName, phaseDates]
  );

  const monthGrid = buildMonthGrid(monthDate);
  const displayMonth = monthDate.getMonth();
  const displayYear = monthDate.getFullYear();

  function assignPhaseToDate(date: Date) {
    if (!scheduleMode || !activePhase) return false;
    setPhaseDate(activePhase, formatDateKey(date));
    setActivePhase(null);
    return true;
  }

  function handleDayClick(date: Date) {
    if (assignPhaseToDate(date)) return;
    if (!scheduleMode) onOpenDate(date);
  }

  return (
    <div className={className}>
      {monthGrid.map((cell) => {
        const { date: day, overflowDate } = cell;
        const dateStr = formatDateKey(day);
        const overflowStr = overflowDate ? formatDateKey(overflowDate) : null;
        const dayEvts = [
          ...(eventsByDay.get(dateStr) ?? []),
          ...(overflowStr ? (eventsByDay.get(overflowStr) ?? []) : []),
        ].filter(
          (event) =>
            !parseScheduleBubbleDescription(event.description) &&
            !isShopClosedEvent(event)
        );
        const shopClosedEvent =
          (eventsByDay.get(dateStr) ?? []).find((event) =>
            isShopClosedEvent(event)
          ) ?? null;
        const shopClosedReason = shopClosedEvent?.description?.trim() || null;
        const savedScheduleEvts = [
          ...(eventsByDay.get(dateStr) ?? []),
          ...(overflowStr ? (eventsByDay.get(overflowStr) ?? []) : []),
        ]
          .map((event) => {
            const meta = parseScheduleBubbleDescription(event.description);
            if (!meta) return null;
            return {
              id: event.id,
              jobId: event.job_id,
              bubble: scheduleBubbleFromMeta(event.title, meta),
              color: meta.color,
            };
          })
          .filter(Boolean) as {
          id: string;
          jobId: string | null;
          bubble: ScheduleBubble;
          color: ScheduleColor;
        }[];
        const scheduleBubble = scheduleBubbles.get(dateStr);
        const overflowScheduleBubble = overflowStr
          ? scheduleBubbles.get(overflowStr)
          : undefined;
        const dayBirthdays = birthdayByDate?.get(dateStr) ?? [];
        const overflowBirthdays = overflowStr
          ? (birthdayByDate?.get(overflowStr) ?? [])
          : [];
        const inMonth =
          day.getMonth() === displayMonth && day.getFullYear() === displayYear;
        const isTodayPrimary = dateStr === todayKey;
        const isTodayOverflow = overflowStr !== null && overflowStr === todayKey;
        const isToday = isTodayPrimary || isTodayOverflow;
        const visibleEvts = dayEvts.slice(0, 2);
        const extra = dayEvts.length - visibleEvts.length;
        const overflowInMonth =
          overflowDate !== undefined &&
          overflowDate.getMonth() === displayMonth &&
          overflowDate.getFullYear() === displayYear;

        return (
          <div
            key={`${displayYear}-${displayMonth}-${dateStr}`}
            role={overflowDate || scheduleMode ? undefined : "button"}
            tabIndex={overflowDate || scheduleMode ? undefined : 0}
            onClick={overflowDate ? undefined : () => handleDayClick(day)}
            onKeyDown={
              overflowDate || scheduleMode
                ? undefined
                : (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onOpenDate(day);
                    }
                  }
            }
            className={`relative flex min-h-0 flex-col border-b border-r border-gray-200 text-left last:border-r-0 [&:nth-child(7n)]:border-r-0 ${
              shopClosedReason ? "bg-gray-50" : "bg-white"
            } ${
              overflowDate
                ? ""
                : scheduleMode
                  ? activePhase
                    ? "cursor-crosshair hover:bg-gray-50/80"
                    : ""
                  : "cursor-pointer hover:bg-gray-50/80"
            }`}
          >
            {overflowDate ? (
              <>
                {dayBirthdays.length > 0 || overflowBirthdays.length > 0 ? (
                  <span className="pointer-events-none absolute right-1.5 top-1.5 z-20 text-burgundy">
                    <IconConfetti size={12} />
                  </span>
                ) : null}
                <svg
                  className="pointer-events-none absolute inset-0 z-0 h-full w-full text-gray-200"
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  <line
                    x1="100%"
                    y1="0"
                    x2="0"
                    y2="100%"
                    stroke="currentColor"
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
                <button
                  type="button"
                  aria-label={day.toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                  className="absolute inset-0 z-[5] cursor-pointer border-0 bg-transparent p-0 [clip-path:polygon(0_0,100%_0,0_100%)] hover:bg-gray-50/80"
                  onClick={() => handleDayClick(day)}
                />
                <button
                  type="button"
                  aria-label={overflowDate.toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                  className="absolute inset-0 z-[5] cursor-pointer border-0 bg-transparent p-0 [clip-path:polygon(100%_0,100%_100%,0_100%)] hover:bg-gray-50/80"
                  onClick={() => handleDayClick(overflowDate)}
                />
                <span
                  className={`pointer-events-none absolute left-1.5 top-1.5 z-10 inline-flex h-6 min-w-[1.5rem] items-center justify-center text-sm font-medium ${splitDayNumberClass(inMonth, isTodayPrimary)}`}
                >
                  {day.getDate()}
                </span>
                <span
                  className={`pointer-events-none absolute bottom-1.5 right-1.5 z-10 inline-flex h-6 min-w-[1.5rem] items-center justify-center text-sm font-medium ${splitDayNumberClass(overflowInMonth, isTodayOverflow)}`}
                >
                  {overflowDate.getDate()}
                </span>
              </>
            ) : (
              <div className="flex shrink-0 flex-col gap-0.5 p-1.5 pb-1">
                <div className="flex items-start">
                  <span
                    className={`inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-1 text-sm font-medium ${
                      isToday
                        ? "bg-burgundy text-white"
                        : inMonth
                          ? "text-gray-900"
                          : "text-gray-300"
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  {dayBirthdays.length > 0 ? (
                    <span className="ml-auto text-burgundy">
                      <IconConfetti size={12} />
                    </span>
                  ) : null}
                </div>
                {shopClosedEvent ? (
                  <p className="px-0.5 text-[10px] font-semibold leading-tight text-gray-700">
                    Shop Closed
                  </p>
                ) : null}
              </div>
            )}
            <div
              className={`relative z-10 min-h-0 flex-1 space-y-0.5 overflow-x-hidden overflow-y-hidden px-1 pb-1 ${
                overflowDate ? "pointer-events-none pt-8 pr-8" : "pt-0.5"
              }`}
            >
              {dayBirthdays.map((item, idx) => (
                <div
                  key={`${dateStr}-bday-${idx}`}
                  className="flex items-center justify-center gap-1 rounded border border-burgundy/20 bg-burgundy/5 px-1 py-[1px] text-[9px] font-semibold text-burgundy"
                >
                  <IconConfetti size={10} />
                  <span className="truncate">
                    {`${item.firstName}'s Birthday (${item.age})`}
                  </span>
                  <IconConfetti size={10} />
                </div>
              ))}
              {overflowBirthdays.map((item, idx) => (
                <div
                  key={`${overflowStr}-bday-${idx}`}
                  className="flex items-center justify-center gap-1 rounded border border-burgundy/20 bg-burgundy/5 px-1 py-[1px] text-[9px] font-semibold text-burgundy"
                >
                  <IconConfetti size={10} />
                  <span className="truncate">
                    {`${item.firstName}'s Birthday (${item.age})`}
                  </span>
                  <IconConfetti size={10} />
                </div>
              ))}
              {scheduleMode && scheduleBubble ? (
                <ScheduleBubbleChip bubble={scheduleBubble} color={selectedColor} />
              ) : null}
              {scheduleMode && overflowScheduleBubble ? (
                <ScheduleBubbleChip
                  bubble={overflowScheduleBubble}
                  color={selectedColor}
                />
              ) : null}
              {!scheduleMode
                ? savedScheduleEvts.map((item) => (
                    <div
                      key={item.id}
                      onContextMenu={(e) => {
                        if (!onScheduleContextMenu || !item.jobId) return;
                        e.preventDefault();
                        e.stopPropagation();
                        onScheduleContextMenu({
                          jobId: item.jobId,
                          jobName: item.bubble.jobName,
                          clientName:
                            dayEvts.find((event) => event.id === item.id)
                              ?.clientName ?? "—",
                          x: e.clientX,
                          y: e.clientY,
                        });
                      }}
                    >
                      <ScheduleBubbleChip
                        bubble={item.bubble}
                        color={item.color}
                      />
                    </div>
                  ))
                : null}
              {visibleEvts.map((ev) => (
                <MonthEventChip
                  key={ev.id}
                  event={ev}
                  selected={selectedEventId === ev.id}
                  customCategories={customCategories}
                  onSelect={() =>
                    onOpenDate(new Date(`${ev.event_date}T12:00:00`))
                  }
                />
              ))}
              {extra > 0 ? (
                <button
                  type="button"
                  className={`block w-full px-1 text-left text-[10px] font-medium text-gray-500 hover:text-gray-700 ${
                    overflowDate ? "pointer-events-auto" : ""
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDayClick(day);
                  }}
                >
                  +{extra} more
                </button>
              ) : null}
            </div>
            {shopClosedReason && !overflowDate ? (
              <div className="relative z-20 mt-auto border-t border-gray-100 px-1 py-1">
                <p
                  className="truncate text-center text-[9px] font-semibold leading-tight text-gray-700"
                  title={shopClosedReason}
                >
                  {shopClosedReason}
                </p>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
