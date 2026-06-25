"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconSettings,
} from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/client";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import {
  CALENDAR_CATEGORIES,
  CALENDAR_LEGEND,
  WEEK_HOURS,
  addDays,
  enrichCalendarEvent,
  eventMatchesFilters,
  filterByCalendarTab,
  formatDateKey,
  formatHourLabel,
  formatTimeRange,
  formatWeekRange,
  getBusyDaysThisMonth,
  getCategoryStyles,
  getEventHeightPercent,
  getEventTopPercent,
  getUpcomingByDate,
  startOfWeek,
  type CalendarCategory,
  type EnrichedCalendarEvent,
} from "@/lib/calendar";
import type { CalendarEvent, CalendarEventType } from "@/lib/types";

type CalendarTab = "overview" | "production" | "personal";
type ViewMode = "week" | "month" | "list";

const DAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const defaultFilters = Object.fromEntries(
  CALENDAR_CATEGORIES.map((c) => [c.id, true])
) as Record<CalendarCategory, boolean>;

function EventBlock({
  event,
  compact,
}: {
  event: EnrichedCalendarEvent;
  compact?: boolean;
}) {
  const styles = getCategoryStyles(event.category);
  const content = (
    <>
      {!event.isAllDay && (
        <p className={`text-[10px] font-medium ${styles.text}`}>
          {formatTimeRange(event.startMinutes, event.endMinutes)}
        </p>
      )}
      <p className={`text-xs font-semibold ${styles.text}`}>{event.taskName}</p>
      {!compact && (
        <>
          <p className={`text-[10px] ${styles.text} opacity-80`}>
            {event.clientName}
          </p>
          {event.jobNumber && (
            <p className={`text-[10px] ${styles.text} opacity-70`}>
              ({event.jobNumber})
            </p>
          )}
        </>
      )}
    </>
  );

  const className = `block rounded-md border-l-4 px-2 py-1.5 ${styles.bg} ${styles.border} ${
    compact ? "truncate" : ""
  }`;

  if (event.job_id) {
    return (
      <Link href={`/jobs/${event.job_id}`} className={`${className} hover:opacity-90`}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}

export default function CalendarPage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [calendarTab, setCalendarTab] = useState<CalendarTab>("overview");
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [filters, setFilters] =
    useState<Record<CalendarCategory, boolean>>(defaultFilters);
  const [events, setEvents] = useState<EnrichedCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    title: "",
    event_type: "production" as CalendarEventType,
    event_date: formatDateKey(new Date()),
    job_id: "",
    is_all_day: false,
  });

  const monthDate = weekStart;

  const load = useCallback(async () => {
    const supabase = createClient();
    const rangeStart = formatDateKey(addDays(weekStart, -7));
    const rangeEnd = formatDateKey(addDays(weekStart, 37));

    const { data } = await supabase
      .from("calendar_events")
      .select("*, jobs(id, name, created_at, contacts(name))")
      .gte("event_date", rangeStart)
      .lte("event_date", rangeEnd)
      .order("event_date");

    const enriched = ((data as CalendarEvent[]) ?? []).map((e, i) =>
      enrichCalendarEvent(e, i)
    );
    setEvents(enriched);
    setLoading(false);
  }, [weekStart]);

  useEffect(() => {
    load();
  }, [load]);

  const tabbed = useMemo(
    () => filterByCalendarTab(events, calendarTab),
    [events, calendarTab]
  );

  const visible = useMemo(
    () => tabbed.filter((e) => eventMatchesFilters(e, filters)),
    [tabbed, filters]
  );

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const eventsByDay = useMemo(() => {
    const map = new Map<string, EnrichedCalendarEvent[]>();
    for (const day of weekDays) {
      map.set(formatDateKey(day), []);
    }
    for (const event of visible) {
      const list = map.get(event.event_date);
      if (list) list.push(event);
    }
    return map;
  }, [visible, weekDays]);

  const upcoming = useMemo(
    () => getUpcomingByDate(visible, new Date(), 7),
    [visible]
  );

  const busyDays = useMemo(
    () => getBusyDaysThisMonth(tabbed, monthDate),
    [tabbed, monthDate]
  );

  const todayKey = formatDateKey(new Date());

  function goToday() {
    setWeekStart(startOfWeek(new Date()));
  }

  function shiftWeek(delta: number) {
    setWeekStart((prev) => addDays(prev, delta * 7));
  }

  function toggleFilter(category: CalendarCategory) {
    setFilters((prev) => ({ ...prev, [category]: !prev[category] }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    await supabase.from("calendar_events").insert({
      title: form.title,
      event_type: form.event_type,
      event_date: form.event_date,
      job_id: form.job_id || null,
      is_all_day: form.is_all_day,
    });
    setShowModal(false);
    load();
  }

  const miniMonth = monthDate.getMonth();
  const miniYear = monthDate.getFullYear();
  const miniFirstDay = new Date(miniYear, miniMonth, 1).getDay();
  const miniDaysInMonth = new Date(miniYear, miniMonth + 1, 0).getDate();
  const miniCells: (number | null)[] = [
    ...Array(miniFirstDay === 0 ? 6 : miniFirstDay - 1).fill(null),
    ...Array.from({ length: miniDaysInMonth }, (_, i) => i + 1),
  ];

  return (
    <>
      <PageHeader
        title="Calendar"
        rightSlot={
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="shrink-0 rounded-md bg-burgundy px-4 py-2 text-sm font-medium text-white hover:bg-burgundy/90"
          >
            + New Event
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            { id: "overview", label: "Overview" },
            { id: "production", label: "Production Calendar" },
            { id: "personal", label: "Personal Calendar" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setCalendarTab(tab.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              calendarTab === tab.id
                ? "bg-burgundy text-white"
                : "border border-gray-300 bg-white text-gray-600 hover:border-gray-400"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goToday}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => shiftWeek(-1)}
            className="rounded-md border border-gray-300 p-1.5 hover:bg-gray-50"
            aria-label="Previous week"
          >
            <IconChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => shiftWeek(1)}
            className="rounded-md border border-gray-300 p-1.5 hover:bg-gray-50"
            aria-label="Next week"
          >
            <IconChevronRight size={18} />
          </button>
          <button
            type="button"
            className="flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-900 hover:bg-gray-50"
          >
            {formatWeekRange(weekStart)}
            <IconChevronDown size={16} className="text-gray-400" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-gray-300 bg-white p-0.5">
            {(["week", "month", "list"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`rounded px-3 py-1 text-sm capitalize ${
                  viewMode === mode
                    ? "bg-gray-900 text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="rounded-md border border-gray-300 p-2 text-gray-600 hover:bg-gray-50"
            aria-label="Calendar settings"
          >
            <IconSettings size={18} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_260px]">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-4 text-sm">
            <span className="font-medium text-gray-700">Show:</span>
            {CALENDAR_CATEGORIES.map((cat) => (
              <label
                key={cat.id}
                className="flex cursor-pointer items-center gap-1.5"
              >
                <input
                  type="checkbox"
                  checked={filters[cat.id]}
                  onChange={() => toggleFilter(cat.id)}
                  className="rounded border-gray-300"
                />
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-sm ${cat.border.replace("border-l-", "bg-")}`}
                />
                <span className="text-gray-600">{cat.label}</span>
              </label>
            ))}
          </div>

          {loading ? (
            <p className="text-gray-500">Loading…</p>
          ) : viewMode === "week" ? (
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-gray-200 bg-gray-50">
                <div className="border-r border-gray-200 px-2 py-2 text-xs text-gray-400">
                  all-day
                </div>
                {weekDays.map((day, dayIndex) => {
                  const key = formatDateKey(day);
                  const isToday = key === todayKey;
                  return (
                    <div
                      key={key}
                      className={`border-r border-gray-200 px-2 py-2 text-center last:border-r-0 ${
                        isToday ? "bg-burgundy/5" : ""
                      }`}
                    >
                      <p className="text-xs font-medium text-gray-500">
                        {DAY_HEADERS[dayIndex]}
                      </p>
                      <p
                        className={`text-sm font-semibold ${
                          isToday ? "text-burgundy" : "text-gray-900"
                        }`}
                      >
                        {day.getMonth() + 1}/{day.getDate()}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-gray-200">
                <div className="border-r border-gray-200" />
                {weekDays.map((day) => {
                  const dayEvents = (eventsByDay.get(formatDateKey(day)) ?? []).filter(
                    (e) => e.isAllDay
                  );
                  return (
                    <div
                      key={formatDateKey(day)}
                      className="min-h-[52px] space-y-1 border-r border-gray-200 p-1 last:border-r-0"
                    >
                      {dayEvents.map((ev) => (
                        <EventBlock key={ev.id} event={ev} compact />
                      ))}
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-[56px_repeat(7,1fr)]">
                <div className="border-r border-gray-200">
                  {WEEK_HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="flex h-14 items-start justify-end border-b border-gray-100 pr-2 pt-1 text-[10px] text-gray-400"
                    >
                      {formatHourLabel(hour)}
                    </div>
                  ))}
                </div>
                {weekDays.map((day) => {
                  const key = formatDateKey(day);
                  const timedEvents = (eventsByDay.get(key) ?? []).filter(
                    (e) => !e.isAllDay
                  );
                  return (
                    <div
                      key={key}
                      className="relative border-r border-gray-200 last:border-r-0"
                    >
                      {WEEK_HOURS.map((hour) => (
                        <div
                          key={hour}
                          className="h-14 border-b border-gray-100"
                        />
                      ))}
                      {timedEvents.map((ev) => (
                        <div
                          key={ev.id}
                          className="absolute left-0.5 right-0.5 z-10 overflow-hidden"
                          style={{
                            top: `${getEventTopPercent(ev.startMinutes)}%`,
                            height: `${getEventHeightPercent(ev.startMinutes, ev.endMinutes)}%`,
                            minHeight: "2.5rem",
                          }}
                        >
                          <EventBlock event={ev} />
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : viewMode === "month" ? (
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-900">
                {monthDate.toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </h3>
              <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500">
                {DAY_HEADERS.map((d) => (
                  <div key={d} className="py-1 font-medium">
                    {d}
                  </div>
                ))}
                {miniCells.map((day, i) => {
                  if (!day) return <div key={`empty-${i}`} />;
                  const dateStr = `${miniYear}-${String(miniMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const dayEvents = visible.filter((e) => e.event_date === dateStr);
                  const isToday =
                    day === new Date().getDate() &&
                    miniMonth === new Date().getMonth() &&
                    miniYear === new Date().getFullYear();
                  return (
                    <button
                      key={dateStr}
                      type="button"
                      onClick={() => {
                        setWeekStart(
                          startOfWeek(new Date(`${dateStr}T12:00:00`))
                        );
                        setViewMode("week");
                      }}
                      className={`min-h-[72px] rounded border p-1 text-left ${
                        isToday
                          ? "border-burgundy bg-burgundy/5"
                          : "border-gray-100 hover:bg-gray-50"
                      }`}
                    >
                      <span
                        className={`text-xs font-medium ${
                          isToday ? "text-burgundy" : "text-gray-700"
                        }`}
                      >
                        {day}
                      </span>
                      <div className="mt-0.5 space-y-0.5">
                        {dayEvents.slice(0, 2).map((ev) => {
                          const s = getCategoryStyles(ev.category);
                          return (
                            <div
                              key={ev.id}
                              className={`truncate rounded px-1 text-[9px] ${s.bg} ${s.text}`}
                            >
                              {ev.taskName}
                            </div>
                          );
                        })}
                        {dayEvents.length > 2 && (
                          <p className="text-[9px] text-gray-400">
                            +{dayEvents.length - 2} more
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
              {visible.length === 0 ? (
                <p className="p-6 text-sm text-gray-500">No events to show.</p>
              ) : (
                visible.map((ev) => (
                  <div key={ev.id} className="flex items-center gap-4 px-4 py-3">
                    <div
                      className={`w-1 self-stretch rounded-full ${getCategoryStyles(ev.category).border.replace("border-l-", "bg-")}`}
                    />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{ev.taskName}</p>
                      <p className="text-sm text-gray-500">
                        {ev.clientName}
                        {ev.jobNumber && ` · ${ev.jobNumber}`}
                      </p>
                    </div>
                    <div className="text-right text-sm text-gray-600">
                      <p>{ev.event_date}</p>
                      {!ev.isAllDay && (
                        <p className="text-xs">
                          {formatTimeRange(ev.startMinutes, ev.endMinutes)}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">
              Calendar Types
            </h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {CALENDAR_LEGEND.map(({ category, description }) => {
                const s = getCategoryStyles(category);
                return (
                  <div key={category} className="flex items-start gap-2 text-sm">
                    <span
                      className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-sm ${s.border.replace("border-l-", "bg-")}`}
                    />
                    <div>
                      <span className="font-medium text-gray-900">
                        {CALENDAR_CATEGORIES.find((c) => c.id === category)?.label}
                      </span>
                      <span className="text-gray-500"> — {description}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() =>
                  setWeekStart(
                    new Date(miniYear, miniMonth - 1, 1)
                  )
                }
                className="text-gray-400 hover:text-gray-600"
              >
                <IconChevronLeft size={16} />
              </button>
              <p className="text-sm font-semibold text-gray-900">
                {monthDate.toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </p>
              <button
                type="button"
                onClick={() =>
                  setWeekStart(
                    new Date(miniYear, miniMonth + 1, 1)
                  )
                }
                className="text-gray-400 hover:text-gray-600"
              >
                <IconChevronRight size={16} />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] text-gray-400">
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                <div key={`${d}-${i}`}>{d}</div>
              ))}
              {miniCells.map((day, i) => {
                if (!day) return <div key={`m-empty-${i}`} />;
                const isToday =
                  day === new Date().getDate() &&
                  miniMonth === new Date().getMonth() &&
                  miniYear === new Date().getFullYear();
                const inWeek =
                  weekDays.some(
                    (wd) =>
                      wd.getDate() === day && wd.getMonth() === miniMonth
                  );
                return (
                  <button
                    key={`m-${day}`}
                    type="button"
                    onClick={() => {
                      setWeekStart(
                        startOfWeek(
                          new Date(miniYear, miniMonth, day)
                        )
                      );
                    }}
                    className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs ${
                      isToday
                        ? "bg-burgundy font-semibold text-white"
                        : inWeek
                          ? "bg-burgundy/10 font-medium text-burgundy"
                          : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">
              Upcoming (Next 7 Days)
            </h3>
            {upcoming.length === 0 ? (
              <p className="text-sm text-gray-500">No upcoming events.</p>
            ) : (
              <div className="space-y-4">
                {upcoming.map(({ date, events: dayEvents }) => (
                  <div key={formatDateKey(date)}>
                    <p className="mb-2 text-xs font-medium text-gray-500">
                      {date.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      ({DAY_HEADERS[(date.getDay() + 6) % 7]})
                    </p>
                    <ul className="space-y-2">
                      {dayEvents.map((ev) => {
                        const s = getCategoryStyles(ev.category);
                        return (
                          <li key={ev.id} className="flex items-start gap-2">
                            <span
                              className={`mt-1 h-8 w-1 shrink-0 rounded-full ${s.border.replace("border-l-", "bg-")}`}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-gray-500">
                                {ev.isAllDay
                                  ? "All day"
                                  : formatTimeRange(
                                      ev.startMinutes,
                                      ev.endMinutes
                                    )}
                              </p>
                              <p className="truncate text-sm text-gray-900">
                                {ev.taskName}
                                {ev.clientName !== "—" && ` — ${ev.clientName}`}
                              </p>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className="mt-3 text-sm font-medium text-burgundy hover:underline"
            >
              View all upcoming →
            </button>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">
              Busy Days (This Month)
            </h3>
            {busyDays.length === 0 ? (
              <p className="text-sm text-gray-500">No busy days this month.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {busyDays.map(({ date, count }) => (
                  <li
                    key={formatDateKey(date)}
                    className="flex items-center justify-between"
                  >
                    <span className="text-gray-700">
                      {date.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    <span className="font-medium text-red-600">
                      {count} event{count !== 1 ? "s" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => setViewMode("month")}
              className="mt-3 text-sm font-medium text-burgundy hover:underline"
            >
              View full calendar →
            </button>
          </div>
        </aside>
      </div>

      {showModal && (
        <Modal title="New event" onClose={() => setShowModal(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Title</label>
              <input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Type</label>
              <select
                value={form.event_type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    event_type: e.target.value as CalendarEventType,
                  })
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="production">Production</option>
                <option value="delivery">Delivery</option>
                <option value="installation">Installation</option>
                <option value="quote">Quote / Deadline</option>
                <option value="personal">Personal</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Date</label>
              <input
                type="date"
                required
                value={form.event_date}
                onChange={(e) =>
                  setForm({ ...form, event_date: e.target.value })
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_all_day}
                onChange={(e) =>
                  setForm({ ...form, is_all_day: e.target.checked })
                }
                className="rounded border-gray-300"
              />
              All-day event
            </label>
            <div className="flex justify-end gap-3">
              <Button type="button" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Create event
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
