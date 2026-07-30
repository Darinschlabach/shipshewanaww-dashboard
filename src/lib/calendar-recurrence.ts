export type RecurrenceFrequency = "daily" | "weekly" | "monthly" | "yearly";
export type RecurrenceEndMode = "by_date" | "after_count" | "none";
export type MonthlyMode = "day_of_month" | "weekday";

export type RecurrenceRule = {
  frequency: RecurrenceFrequency;
  interval: number;
  /** 0=Sun … 6=Sat, used for weekly */
  weekdays: number[];
  monthlyMode: MonthlyMode;
  /** 1–31 when monthlyMode is day_of_month */
  monthDay: number;
  /** 1–4 or -1 (last) when monthlyMode is weekday */
  weekOfMonth: number;
  /** 0=Sun … 6=Sat when monthlyMode is weekday */
  monthWeekday: number;
  /** 1–12 for yearly */
  yearMonth: number;
  /** 1–31 for yearly */
  yearDay: number;
  startDate: string;
  endMode: RecurrenceEndMode;
  endDate: string | null;
  occurrenceCount: number;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
};

export function defaultRecurrenceRule(
  eventDate: string,
  startTime: string,
  endTime: string,
  isAllDay: boolean
): RecurrenceRule {
  const start = new Date(`${eventDate}T12:00:00`);
  const weekday = Number.isNaN(start.getTime()) ? 1 : start.getDay();
  const monthDay = Number.isNaN(start.getTime()) ? 1 : start.getDate();
  const yearMonth = Number.isNaN(start.getTime())
    ? 1
    : start.getMonth() + 1;

  const endBy = new Date(start);
  if (!Number.isNaN(endBy.getTime())) {
    endBy.setMonth(endBy.getMonth() + 6);
  }

  return {
    frequency: "weekly",
    interval: 1,
    weekdays: [weekday === 0 ? 1 : weekday],
    monthlyMode: "day_of_month",
    monthDay,
    weekOfMonth: Math.min(4, Math.ceil(monthDay / 7)),
    monthWeekday: weekday,
    yearMonth,
    yearDay: monthDay,
    startDate: eventDate,
    endMode: "by_date",
    endDate: Number.isNaN(endBy.getTime())
      ? eventDate
      : formatLocalDateKey(endBy),
    occurrenceCount: 10,
    startTime,
    endTime,
    isAllDay,
  };
}

export function formatLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function nthWeekdayOfMonth(
  year: number,
  monthIndex: number,
  weekday: number,
  weekOfMonth: number
): Date | null {
  if (weekOfMonth === -1) {
    const lastDay = daysInMonth(year, monthIndex);
    for (let day = lastDay; day >= 1; day--) {
      const candidate = new Date(year, monthIndex, day, 12, 0, 0, 0);
      if (candidate.getDay() === weekday) return candidate;
    }
    return null;
  }

  let count = 0;
  const lastDay = daysInMonth(year, monthIndex);
  for (let day = 1; day <= lastDay; day++) {
    const candidate = new Date(year, monthIndex, day, 12, 0, 0, 0);
    if (candidate.getDay() !== weekday) continue;
    count += 1;
    if (count === weekOfMonth) return candidate;
  }
  return null;
}

function matchesWeekly(date: Date, rule: RecurrenceRule, seriesStart: Date): boolean {
  if (!rule.weekdays.includes(date.getDay())) return false;
  const startWeek = startOfWeekSunday(seriesStart);
  const currentWeek = startOfWeekSunday(date);
  const weeks =
    Math.round(
      (currentWeek.getTime() - startWeek.getTime()) / (7 * 24 * 60 * 60 * 1000)
    );
  return weeks >= 0 && weeks % Math.max(1, rule.interval) === 0;
}

function startOfWeekSunday(date: Date): Date {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function matchesMonthly(date: Date, rule: RecurrenceRule, seriesStart: Date): boolean {
  const months =
    (date.getFullYear() - seriesStart.getFullYear()) * 12 +
    (date.getMonth() - seriesStart.getMonth());
  if (months < 0 || months % Math.max(1, rule.interval) !== 0) return false;

  if (rule.monthlyMode === "day_of_month") {
    const dim = daysInMonth(date.getFullYear(), date.getMonth());
    const target = Math.min(rule.monthDay, dim);
    return date.getDate() === target;
  }

  const nth = nthWeekdayOfMonth(
    date.getFullYear(),
    date.getMonth(),
    rule.monthWeekday,
    rule.weekOfMonth
  );
  return Boolean(nth && formatLocalDateKey(nth) === formatLocalDateKey(date));
}

function matchesYearly(date: Date, rule: RecurrenceRule, seriesStart: Date): boolean {
  const years = date.getFullYear() - seriesStart.getFullYear();
  if (years < 0 || years % Math.max(1, rule.interval) !== 0) return false;
  if (date.getMonth() + 1 !== rule.yearMonth) return false;
  const dim = daysInMonth(date.getFullYear(), rule.yearMonth - 1);
  return date.getDate() === Math.min(rule.yearDay, dim);
}

function matchesDaily(date: Date, rule: RecurrenceRule, seriesStart: Date): boolean {
  const days = Math.round(
    (date.getTime() - seriesStart.getTime()) / (24 * 60 * 60 * 1000)
  );
  return days >= 0 && days % Math.max(1, rule.interval) === 0;
}

const MAX_OCCURRENCES = 366;
const MAX_SCAN_DAYS = 370 * 3;

/** Expand a recurrence rule into concrete occurrence date keys. */
export function expandRecurrenceDates(rule: RecurrenceRule): string[] {
  const seriesStart = new Date(`${rule.startDate}T12:00:00`);
  if (Number.isNaN(seriesStart.getTime())) return [];

  const interval = Math.max(1, Math.floor(rule.interval) || 1);
  const normalized: RecurrenceRule = { ...rule, interval };

  let hardEnd: Date | null = null;
  let maxCount = MAX_OCCURRENCES;

  if (normalized.endMode === "by_date" && normalized.endDate) {
    hardEnd = new Date(`${normalized.endDate}T12:00:00`);
    if (Number.isNaN(hardEnd.getTime())) hardEnd = null;
  } else if (normalized.endMode === "after_count") {
    maxCount = Math.min(
      MAX_OCCURRENCES,
      Math.max(1, Math.floor(normalized.occurrenceCount) || 1)
    );
  } else {
    // No end date: cap at ~2 years of daily-ish density
    hardEnd = addDays(seriesStart, 730);
    maxCount = Math.min(MAX_OCCURRENCES, 104);
  }

  const dates: string[] = [];
  let cursor = new Date(seriesStart);

  for (let i = 0; i < MAX_SCAN_DAYS && dates.length < maxCount; i++) {
    if (hardEnd && cursor > hardEnd) break;

    let matches = false;
    switch (normalized.frequency) {
      case "daily":
        matches = matchesDaily(cursor, normalized, seriesStart);
        break;
      case "weekly":
        matches = matchesWeekly(cursor, normalized, seriesStart);
        break;
      case "monthly":
        matches = matchesMonthly(cursor, normalized, seriesStart);
        break;
      case "yearly":
        matches = matchesYearly(cursor, normalized, seriesStart);
        break;
    }

    if (matches) {
      dates.push(formatLocalDateKey(cursor));
    }
    cursor = addDays(cursor, 1);
  }

  return dates;
}

export function describeRecurrence(rule: RecurrenceRule): string {
  const interval = Math.max(1, rule.interval);
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  let pattern = "";
  if (rule.frequency === "daily") {
    pattern = interval === 1 ? "Daily" : `Every ${interval} days`;
  } else if (rule.frequency === "weekly") {
    const days = rule.weekdays
      .slice()
      .sort((a, b) => a - b)
      .map((d) => dayNames[d])
      .join(", ");
    pattern =
      interval === 1
        ? `Weekly on ${days || "—"}`
        : `Every ${interval} weeks on ${days || "—"}`;
  } else if (rule.frequency === "monthly") {
    if (rule.monthlyMode === "day_of_month") {
      pattern =
        interval === 1
          ? `Monthly on day ${rule.monthDay}`
          : `Every ${interval} months on day ${rule.monthDay}`;
    } else {
      const nth =
        rule.weekOfMonth === -1
          ? "last"
          : ["first", "second", "third", "fourth"][rule.weekOfMonth - 1] ??
            `${rule.weekOfMonth}th`;
      pattern = `Monthly on the ${nth} ${dayNames[rule.monthWeekday]}`;
    }
  } else {
    pattern =
      interval === 1
        ? `Yearly on ${rule.yearMonth}/${rule.yearDay}`
        : `Every ${interval} years on ${rule.yearMonth}/${rule.yearDay}`;
  }

  if (rule.endMode === "by_date" && rule.endDate) {
    return `${pattern} until ${rule.endDate}`;
  }
  if (rule.endMode === "after_count") {
    return `${pattern}, ${rule.occurrenceCount} times`;
  }
  return pattern;
}

function formatTime12h(time: string): string {
  const [hRaw, mRaw] = time.slice(0, 5).split(":").map(Number);
  const h = hRaw ?? 0;
  const m = mRaw ?? 0;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

/** Short schedule line for the event form, e.g. "Every Friday from 10:00 AM to 10:30 AM". */
export function summarizeRecurrenceSchedule(rule: RecurrenceRule): string {
  const interval = Math.max(1, rule.interval);
  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  let when = "";
  if (rule.frequency === "daily") {
    when = interval === 1 ? "Every day" : `Every ${interval} days`;
  } else if (rule.frequency === "weekly") {
    const days = rule.weekdays
      .slice()
      .sort((a, b) => a - b)
      .map((d) => dayNames[d]);
    if (interval === 1 && days.length === 1) {
      when = `Every ${days[0]}`;
    } else if (interval === 1) {
      when = `Every ${days.join(", ") || "week"}`;
    } else {
      when = `Every ${interval} weeks on ${days.join(", ") || "—"}`;
    }
  } else if (rule.frequency === "monthly") {
    if (rule.monthlyMode === "day_of_month") {
      when =
        interval === 1
          ? `Monthly on day ${rule.monthDay}`
          : `Every ${interval} months on day ${rule.monthDay}`;
    } else {
      const nth =
        rule.weekOfMonth === -1
          ? "last"
          : ["first", "second", "third", "fourth"][rule.weekOfMonth - 1] ??
            `${rule.weekOfMonth}th`;
      when = `Monthly on the ${nth} ${dayNames[rule.monthWeekday]}`;
    }
  } else {
    when =
      interval === 1
        ? `Yearly on ${rule.yearMonth}/${rule.yearDay}`
        : `Every ${interval} years on ${rule.yearMonth}/${rule.yearDay}`;
  }

  if (rule.isAllDay) {
    return `${when}, all day`;
  }

  return `${when} from ${formatTime12h(rule.startTime)} to ${formatTime12h(rule.endTime)}`;
}
