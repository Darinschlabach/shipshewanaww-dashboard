import { formatProductionJobNumber } from "@/lib/production";
import type { CalendarEvent, CalendarEventType, Job } from "@/lib/types";

export type CalendarCategory =
  | "drafting"
  | "production"
  | "deliveries"
  | "shop_closed";

export const CALENDAR_CATEGORIES: {
  id: CalendarCategory;
  label: string;
  bg: string;
  border: string;
  text: string;
  dot: string;
  muted: string;
}[] = [
  {
    id: "drafting",
    label: "Drafting",
    bg: "bg-orange-50",
    border: "border-l-orange-500",
    text: "text-orange-900",
    dot: "bg-orange-500",
    muted: "text-orange-800/80",
  },
  {
    id: "production",
    label: "Production",
    bg: "bg-red-50",
    border: "border-l-red-500",
    text: "text-red-900",
    dot: "bg-red-500",
    muted: "text-red-800/80",
  },
  {
    id: "deliveries",
    label: "Deliveries",
    bg: "bg-green-50",
    border: "border-l-green-500",
    text: "text-green-900",
    dot: "bg-green-500",
    muted: "text-green-800/80",
  },
  {
    id: "shop_closed",
    label: "Shop closed",
    bg: "bg-gray-100",
    border: "border-l-gray-400",
    text: "text-gray-800",
    dot: "bg-gray-400",
    muted: "text-gray-600",
  },
];

export const CALENDAR_COLOR_PALETTE = [
  "#f97316",
  "#ef4444",
  "#22c55e",
  "#6b7280",
  "#3b82f6",
  "#a855f7",
  "#eab308",
  "#ec4899",
  "#14b8a6",
  "#64748b",
] as const;

export type CustomCalendarCategory = {
  id: string;
  label: string;
  color: string;
};

export const CALENDAR_LEGEND = [
  { category: "drafting" as const, description: "Drafting and design work" },
  { category: "production" as const, description: "Shop tasks and job work" },
  { category: "deliveries" as const, description: "Deliveries to customers" },
  { category: "shop_closed" as const, description: "Shop closed days" },
];

export const WEEK_HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

export const MONTH_DAY_HEADERS = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;

/** Six-week grid starting on Sunday, including adjacent-month days. */
export function buildMonthGrid(monthDate: Date): Date[] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstOfMonth = new Date(year, month, 1, 12, 0, 0, 0);
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    return day;
  });
}

const CATEGORY_MAP: Record<string, CalendarCategory> = {
  drafting: "drafting",
  production: "production",
  delivery: "deliveries",
  shop_closed: "shop_closed",
  quote: "drafting",
  deadline: "drafting",
  installation: "production",
  personal: "drafting",
  other: "production",
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

export function formatEventStartTime(
  event: Pick<EnrichedCalendarEvent, "isAllDay" | "startMinutes">
): string | null {
  if (event.isAllDay) return null;
  return formatMinutesLabel(event.startMinutes);
}

export function getEventCategory(
  eventType: CalendarEventType | string
): CalendarCategory {
  return CATEGORY_MAP[eventType] ?? "other";
}

export function getCategoryStyles(category: CalendarCategory) {
  return (
    CALENDAR_CATEGORIES.find((c) => c.id === category) ?? CALENDAR_CATEGORIES[1]
  );
}

export function defaultCategoryFilters(): Record<CalendarCategory, boolean> {
  return Object.fromEntries(
    CALENDAR_CATEGORIES.map((category) => [category.id, true])
  ) as Record<CalendarCategory, boolean>;
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

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function formatMonthYear(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
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
  tab: "overview" | "production" | "personal",
  currentUserId?: string | null
): EnrichedCalendarEvent[] {
  if (tab === "production") {
    return events.filter((e) => e.calendar_scope !== "personal");
  }
  if (tab === "personal") {
    // Strict ownership: never show another user's personal events,
    // and never show personal rows with no owner.
    if (!currentUserId) return [];
    return events.filter(
      (e) =>
        e.calendar_scope === "personal" && e.user_id === currentUserId
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

export function formatMinutesLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0
    ? `${hour12}:00 ${period}`
    : `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

export function formatFullDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function getCurrentTimePercent(now: Date): number | null {
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes < GRID_START_MINUTES || minutes > GRID_END_MINUTES) return null;
  return ((minutes - GRID_START_MINUTES) / GRID_TOTAL_MINUTES) * 100;
}

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
