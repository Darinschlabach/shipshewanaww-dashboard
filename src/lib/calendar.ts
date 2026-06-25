import { formatProductionJobNumber } from "@/lib/production";
import type { CalendarEvent, CalendarEventType, Job } from "@/lib/types";

export type CalendarCategory =
  | "production"
  | "deliveries"
  | "installations"
  | "personal"
  | "deadlines"
  | "other";

export const CALENDAR_CATEGORIES: {
  id: CalendarCategory;
  label: string;
  bg: string;
  border: string;
  text: string;
}[] = [
  {
    id: "production",
    label: "Production",
    bg: "bg-blue-50",
    border: "border-l-blue-500",
    text: "text-blue-900",
  },
  {
    id: "deliveries",
    label: "Deliveries",
    bg: "bg-green-50",
    border: "border-l-green-500",
    text: "text-green-900",
  },
  {
    id: "installations",
    label: "Installations",
    bg: "bg-purple-50",
    border: "border-l-purple-500",
    text: "text-purple-900",
  },
  {
    id: "personal",
    label: "Personal",
    bg: "bg-amber-50",
    border: "border-l-amber-500",
    text: "text-amber-900",
  },
  {
    id: "deadlines",
    label: "Deadlines",
    bg: "bg-red-50",
    border: "border-l-red-500",
    text: "text-red-900",
  },
  {
    id: "other",
    label: "Other",
    bg: "bg-gray-50",
    border: "border-l-gray-400",
    text: "text-gray-900",
  },
];

export const CALENDAR_LEGEND = [
  { category: "production" as const, description: "Shop tasks and job work" },
  { category: "deliveries" as const, description: "Deliveries to customers" },
  { category: "installations" as const, description: "On-site installations" },
  { category: "personal" as const, description: "Personal appointments" },
  { category: "deadlines" as const, description: "Quotes, approvals, due dates" },
  { category: "other" as const, description: "Meetings, calls, etc." },
];

export const WEEK_HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

const CATEGORY_MAP: Record<string, CalendarCategory> = {
  production: "production",
  delivery: "deliveries",
  quote: "deadlines",
  installation: "installations",
  personal: "personal",
  deadline: "deadlines",
  other: "other",
};

export type EnrichedCalendarEvent = CalendarEvent & {
  category: CalendarCategory;
  isAllDay: boolean;
  startMinutes: number;
  endMinutes: number;
  taskName: string;
  clientName: string;
  jobNumber: string | null;
  jobs?: (Job & { contacts?: { name: string } | null }) | null;
};

export function getEventCategory(
  eventType: CalendarEventType | string
): CalendarCategory {
  return CATEGORY_MAP[eventType] ?? "other";
}

export function getCategoryStyles(category: CalendarCategory) {
  return (
    CALENDAR_CATEGORIES.find((c) => c.id === category) ?? CALENDAR_CATEGORIES[5]
  );
}

export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(12, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatWeekRange(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const startStr = weekStart.toLocaleDateString("en-US", opts);
  const endStr = weekEnd.toLocaleDateString("en-US", {
    ...opts,
    year:
      weekEnd.getFullYear() !== weekStart.getFullYear() ? "numeric" : undefined,
  });
  return `${startStr} – ${endStr}, ${weekEnd.getFullYear()}`;
}

export function formatHourLabel(hour: number): string {
  if (hour === 12) return "12 PM";
  if (hour > 12) return `${hour - 12} PM`;
  return `${hour} AM`;
}

export function formatTimeRange(startMinutes: number, endMinutes: number): string {
  const fmt = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const period = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return m === 0 ? `${hour12}:00 ${period}` : `${hour12}:${String(m).padStart(2, "0")} ${period}`;
  };
  return `${fmt(startMinutes)} – ${fmt(endMinutes)}`;
}

function parseTaskName(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes("cutting")) return "Cutting";
  if (lower.includes("edge")) return "Edgebanding";
  if (lower.includes("assembl")) return "Assembly";
  if (lower.includes("finish")) return "Finishing";
  if (lower.includes("deliver")) return "Delivery";
  if (lower.includes("install")) return "Install";
  if (lower.includes("quote")) return "Quote Deadline";
  if (lower.includes("start")) return "Production Start";
  if (lower.includes("due")) return "Due";
  return title.split(" ")[0] ?? title;
}

function deriveTiming(
  event: CalendarEvent,
  index: number
): { isAllDay: boolean; startMinutes: number; endMinutes: number } {
  if (event.is_all_day) {
    return { isAllDay: true, startMinutes: 0, endMinutes: 24 * 60 };
  }

  if (event.start_time && event.end_time) {
    const [sh, sm] = event.start_time.split(":").map(Number);
    const [eh, em] = event.end_time.split(":").map(Number);
    return {
      isAllDay: false,
      startMinutes: sh * 60 + (sm || 0),
      endMinutes: eh * 60 + (em || 0),
    };
  }

  const title = event.title.toLowerCase();
  if (
    title.includes("install") ||
    title.includes("deadline") ||
    title.includes("all day")
  ) {
    return { isAllDay: true, startMinutes: 0, endMinutes: 24 * 60 };
  }

  const slots = [
    { start: 8 * 60, end: 10 * 60 },
    { start: 10 * 60, end: 12 * 60 },
    { start: 13 * 60, end: 15 * 60 },
    { start: 15 * 60, end: 17 * 60 },
    { start: 9 * 60, end: 11 * 60 },
  ];
  const slot = slots[index % slots.length];
  return { isAllDay: false, startMinutes: slot.start, endMinutes: slot.end };
}

export function enrichCalendarEvent(
  event: CalendarEvent & {
    jobs?: (Job & { contacts?: { name: string } | null }) | null;
  },
  index: number
): EnrichedCalendarEvent {
  const category = getEventCategory(event.event_type);
  const timing = deriveTiming(event, index);
  const job = event.jobs;
  const clientName =
    job?.contacts?.name ??
    event.title.replace(/^(install|delivery|quote deadline):\s*/i, "").split(" ")[0] ??
    "—";

  return {
    ...event,
    category,
    ...timing,
    taskName: parseTaskName(event.title),
    clientName,
    jobNumber: job ? formatProductionJobNumber(job) : null,
    jobs: job,
  };
}

export function filterByCalendarTab(
  events: EnrichedCalendarEvent[],
  tab: "overview" | "production" | "personal"
): EnrichedCalendarEvent[] {
  if (tab === "production") {
    return events.filter((e) =>
      ["production", "deliveries", "installations", "deadlines"].includes(
        e.category
      )
    );
  }
  if (tab === "personal") {
    return events.filter((e) =>
      ["personal", "other"].includes(e.category)
    );
  }
  return events;
}

export function getUpcomingByDate(
  events: EnrichedCalendarEvent[],
  fromDate: Date,
  days = 7
): { date: Date; events: EnrichedCalendarEvent[] }[] {
  const end = addDays(fromDate, days);
  const grouped = new Map<string, EnrichedCalendarEvent[]>();

  for (const event of events) {
    const d = new Date(`${event.event_date}T12:00:00`);
    if (d < fromDate || d > end) continue;
    const key = event.event_date;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(event);
  }

  return [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateStr, evts]) => ({
      date: new Date(`${dateStr}T12:00:00`),
      events: evts.sort((a, b) => a.startMinutes - b.startMinutes),
    }));
}

export function getBusyDaysThisMonth(
  events: EnrichedCalendarEvent[],
  monthDate: Date
): { date: Date; count: number }[] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const counts = new Map<string, number>();

  for (const event of events) {
    const d = new Date(`${event.event_date}T12:00:00`);
    if (d.getMonth() !== month || d.getFullYear() !== year) continue;
    counts.set(event.event_date, (counts.get(event.event_date) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([dateStr, count]) => ({
      date: new Date(`${dateStr}T12:00:00`),
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

export function eventMatchesFilters(
  event: EnrichedCalendarEvent,
  filters: Record<CalendarCategory, boolean>
): boolean {
  return filters[event.category];
}

export const GRID_START_MINUTES = 7 * 60;
export const GRID_END_MINUTES = 18 * 60;
export const GRID_TOTAL_MINUTES = GRID_END_MINUTES - GRID_START_MINUTES;

export function getEventTopPercent(startMinutes: number): number {
  return (
    ((startMinutes - GRID_START_MINUTES) / GRID_TOTAL_MINUTES) * 100
  );
}

export function getEventHeightPercent(
  startMinutes: number,
  endMinutes: number
): number {
  const duration = Math.max(30, endMinutes - startMinutes);
  return (duration / GRID_TOTAL_MINUTES) * 100;
}
