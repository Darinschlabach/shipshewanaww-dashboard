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
  customCategoryChipStyle,
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

type SavedScheduleItem = {
  id: string;
  jobId: string | null;
  bubble: ScheduleBubble;
  color: ScheduleColor;
};

function scheduleJobLaneKey(jobId: string | null, jobName: string) {
  return jobId ?? `name:${jobName}`;
}

function sortScheduleItemsByLane(
  items: SavedScheduleItem[],
  laneKeys: string[]
): SavedScheduleItem[] {
  const laneIndex = new Map(laneKeys.map((key, index) => [key, index]));
  return [...items].sort((a, b) => {
    const indexA =
      laneIndex.get(scheduleJobLaneKey(a.jobId, a.bubble.jobName)) ?? 999;
    const indexB =
      laneIndex.get(scheduleJobLaneKey(b.jobId, b.bubble.jobName)) ?? 999;
    return indexA - indexB;
  });
}

function extractSavedScheduleEvents(
  events: EnrichedCalendarEvent[]
): SavedScheduleItem[] {
  return events
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
    .filter(Boolean) as SavedScheduleItem[];
}

function countDayItems(
  dateKey: string,
  eventsByDay: Map<string, EnrichedCalendarEvent[]>,
  birthdayByDate?: Map<string, { firstName: string; age: number }[]>
): number {
  const events = eventsByDay.get(dateKey) ?? [];
  const birthdays = birthdayByDate?.get(dateKey)?.length ?? 0;
  return events.length + birthdays;
}

const MAX_SCHEDULE_BUBBLES_PER_DAY = 2;

type ScheduleRowItem =
  | { kind: "saved"; item: SavedScheduleItem }
  | { kind: "preview"; bubble: ScheduleBubble; color: ScheduleColor };

function buildScheduleRowItems(
  saved: SavedScheduleItem[],
  preview?: ScheduleBubble,
  previewColor?: ScheduleColor
): { visible: ScheduleRowItem[]; extraCount: number } {
  const all: ScheduleRowItem[] = [];
  if (preview && previewColor) {
    all.push({ kind: "preview", bubble: preview, color: previewColor });
  }
  for (const item of saved) {
    all.push({ kind: "saved", item });
  }
  return {
    visible: all.slice(0, MAX_SCHEDULE_BUBBLES_PER_DAY),
    extraCount: Math.max(0, all.length - MAX_SCHEDULE_BUBBLES_PER_DAY),
  };
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
  const customStyle = custom ? customCategoryChipStyle(custom.color) : undefined;
  const subtitle = custom?.label ?? timeLabel ?? styles.label;
  const textClass =
    "truncate text-center text-[8px] font-semibold leading-tight";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      className={`pointer-events-auto block w-full overflow-hidden rounded border px-1 py-[1px] ${
        custom ? "border-black" : `${styles.bg} border-transparent`
      } ${selected ? "ring-1 ring-burgundy/40 ring-inset" : "hover:brightness-[0.98]"}`}
      style={customStyle}
    >
      <p className={`${textClass} ${custom ? "" : styles.text}`}>{event.title}</p>
      <p className={`${textClass} ${custom ? "" : styles.text}`}>{subtitle}</p>
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
    scheduleJobId,
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

  const monthGrid = useMemo(() => buildMonthGrid(monthDate), [monthDate]);
  const displayMonth = monthDate.getMonth();
  const displayYear = monthDate.getFullYear();

  const scheduleJobLaneKeys = useMemo(() => {
    const jobs = new Map<string, { earliestDate: string; jobName: string }>();

    for (const cell of monthGrid) {
      const dateStr = formatDateKey(cell.date);
      const overflowStr = cell.overflowDate
        ? formatDateKey(cell.overflowDate)
        : null;
      const dayEvents = [
        ...(eventsByDay.get(dateStr) ?? []),
        ...(overflowStr ? (eventsByDay.get(overflowStr) ?? []) : []),
      ];

      for (const event of dayEvents) {
        const meta = parseScheduleBubbleDescription(event.description);
        if (!meta) continue;
        const key = scheduleJobLaneKey(event.job_id, event.title);
        const existing = jobs.get(key);
        if (!existing || dateStr < existing.earliestDate) {
          jobs.set(key, { earliestDate: dateStr, jobName: event.title });
        }
      }
    }

    return Array.from(jobs.entries())
      .sort(([, a], [, b]) => {
        const byDate = a.earliestDate.localeCompare(b.earliestDate);
        if (byDate !== 0) return byDate;
        return a.jobName.localeCompare(b.jobName);
      })
      .map(([key]) => key);
  }, [monthGrid, eventsByDay]);

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
        const savedScheduleEvts = extractSavedScheduleEvents([
          ...(eventsByDay.get(dateStr) ?? []),
          ...(overflowStr ? (eventsByDay.get(overflowStr) ?? []) : []),
        ]);
        const sortedScheduleEvts = sortScheduleItemsByLane(
          savedScheduleEvts,
          scheduleJobLaneKeys
        );
        const existingScheduleEvts = scheduleMode
          ? sortedScheduleEvts.filter(
              (item) =>
                scheduleJobId
                  ? item.jobId !== scheduleJobId
                  : item.bubble.jobName !== jobName
            )
          : sortedScheduleEvts;
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
        const primaryItemCount = countDayItems(
          dateStr,
          eventsByDay,
          birthdayByDate
        );
        const overflowItemCount = overflowStr
          ? countDayItems(overflowStr, eventsByDay, birthdayByDate)
          : 0;
        const { visible: visibleScheduleRows, extraCount: extraScheduleCount } =
          buildScheduleRowItems(
            scheduleMode ? existingScheduleEvts : sortedScheduleEvts,
            scheduleMode && scheduleBubble ? scheduleBubble : undefined,
            scheduleMode && scheduleBubble ? selectedColor : undefined
          );

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
              {overflowDate ? (
                <>
                  {primaryItemCount > 0 ? (
                    <button
                      type="button"
                      className="pointer-events-auto absolute left-1.5 top-8 z-10 text-[10px] font-medium text-gray-500 hover:text-gray-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDayClick(day);
                      }}
                    >
                      +{primaryItemCount}
                    </button>
                  ) : null}
                  {overflowItemCount > 0 ? (
                    <button
                      type="button"
                      className="pointer-events-auto absolute bottom-8 right-1.5 z-10 text-[10px] font-medium text-gray-500 hover:text-gray-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDayClick(overflowDate);
                      }}
                    >
                      +{overflowItemCount}
                    </button>
                  ) : null}
                </>
              ) : (
                <>
              {dayBirthdays.map((item, idx) => (
                <div
                  key={`${dateStr}-bday-${idx}`}
                  className="flex flex-col items-center justify-center overflow-hidden rounded border border-burgundy/40 bg-burgundy/10 px-1 py-[1px] text-burgundy"
                >
                  <p className="flex w-full items-center justify-center gap-0.5 truncate text-center text-[8px] font-semibold leading-tight">
                    <IconConfetti size={8} className="shrink-0" />
                    <span className="truncate">{`${item.firstName}'s Birthday`}</span>
                    <IconConfetti size={8} className="shrink-0" />
                  </p>
                  <p className="truncate text-center text-[8px] font-semibold leading-tight">
                    {`(${item.age})`}
                  </p>
                </div>
              ))}
              {overflowBirthdays.map((item, idx) => (
                <div
                  key={`${overflowStr}-bday-${idx}`}
                  className="flex flex-col items-center justify-center overflow-hidden rounded border border-burgundy/40 bg-burgundy/10 px-1 py-[1px] text-burgundy"
                >
                  <p className="flex w-full items-center justify-center gap-0.5 truncate text-center text-[8px] font-semibold leading-tight">
                    <IconConfetti size={8} className="shrink-0" />
                    <span className="truncate">{`${item.firstName}'s Birthday`}</span>
                    <IconConfetti size={8} className="shrink-0" />
                  </p>
                  <p className="truncate text-center text-[8px] font-semibold leading-tight">
                    {`(${item.age})`}
                  </p>
                </div>
              ))}
              {scheduleMode && overflowScheduleBubble ? (
                <ScheduleBubbleChip
                  bubble={overflowScheduleBubble}
                  color={selectedColor}
                />
              ) : null}
              {visibleScheduleRows.map((row) => {
                if (row.kind === "preview") {
                  return (
                    <ScheduleBubbleChip
                      key="schedule-preview"
                      bubble={row.bubble}
                      color={row.color}
                    />
                  );
                }

                const jobId = row.item.jobId;
                return (
                  <div
                    key={row.item.id}
                    onContextMenu={
                      !scheduleMode && onScheduleContextMenu && jobId
                        ? (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onScheduleContextMenu({
                              jobId,
                              jobName: row.item.bubble.jobName,
                              clientName:
                                dayEvts.find((event) => event.id === row.item.id)
                                  ?.clientName ?? "—",
                              x: e.clientX,
                              y: e.clientY,
                            });
                          }
                        : undefined
                    }
                  >
                    <ScheduleBubbleChip
                      bubble={row.item.bubble}
                      color={row.item.color}
                    />
                  </div>
                );
              })}
              {extraScheduleCount > 0 ? (
                <button
                  type="button"
                  className="block w-full px-1 text-left text-[10px] font-medium text-gray-500 hover:text-gray-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDayClick(day);
                  }}
                >
                  +{extraScheduleCount}
                </button>
              ) : null}
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
                  className="block w-full px-1 text-left text-[10px] font-medium text-gray-500 hover:text-gray-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDayClick(day);
                  }}
                >
                  +{extra} more
                </button>
              ) : null}
                </>
              )}
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
