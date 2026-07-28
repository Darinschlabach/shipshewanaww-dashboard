"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IconAdjustmentsHorizontal,
  IconCalendar,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconFilter,
  IconHome,
  IconPaperclip,
  IconPencil,
  IconPlus,
  IconRepeat,
  IconTrash,
  IconTruck,
  IconUser,
} from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/client";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import MiniCalendar from "@/components/calendar/MiniCalendar";
import {
  WEEK_HOURS,
  addDays,
  buildMonthGrid,
  CALENDAR_CATEGORIES,
  CALENDAR_COLOR_PALETTE,
  defaultCategoryFilters,
  enrichCalendarEvent,
  eventMatchesFilters,
  filterByCalendarTab,
  formatDateKey,
  formatEventStartTime,
  formatFullDate,
  formatHourLabel,
  formatMinutesLabel,
  formatTimeRange,
  getCategoryStyles,
  getCurrentTimePercent,
  getEventHeightPercent,
  getEventTopPercent,
  MONTH_DAY_HEADERS,
  startOfWeek,
  type CalendarCategory,
  type CustomCalendarCategory,
  type EnrichedCalendarEvent,
} from "@/lib/calendar";
import type { CalendarEvent, CalendarEventType } from "@/lib/types";

type ViewMode = "day" | "week" | "month";
type CalendarScope = "production" | "personal";

/** Set to true when ready to show Day/Week/Month + Add/Filter controls again. */
const SHOW_CALENDAR_CHROME = false;

const DAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Native Windows selects draw an extra separator next to the chevron; this removes it. */
const SELECT_CLASS =
  "appearance-none rounded-md border border-gray-300 bg-white pr-8 text-sm";

function SelectChevron() {
  return (
    <IconChevronDown
      size={16}
      className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"
      aria-hidden
    />
  );
}

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const minutes = i * 30;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  const label =
    m === 0
      ? `${hour12}:00 ${period}`
      : `${hour12}:${String(m).padStart(2, "0")} ${period}`;
  return { value, label };
});

function toTimeInputValue(time: string | null | undefined): string {
  if (!time) return "09:00";
  return time.slice(0, 5);
}

function defaultEventForm(
  dateKey = formatDateKey(new Date()),
  scope: CalendarScope = "production"
) {
  return {
    title: "",
    event_type: (scope === "personal"
      ? "personal"
      : "production") as CalendarEventType,
    event_date: dateKey,
    end_date: dateKey,
    start_time: "09:00",
    end_time: "10:00",
    job_id: "",
    is_all_day: false,
    location: "",
    description: "",
  };
}

function eventIcon(category: EnrichedCalendarEvent["category"]) {
  switch (category) {
    case "deliveries":
      return IconTruck;
    case "drafting":
      return IconUser;
    case "shop_closed":
      return IconHome;
    default:
      return IconCalendar;
  }
}

function CategoryCheckboxRow({
  label,
  checked,
  dotClassName,
  dotColor,
  onToggle,
}: {
  label: string;
  checked: boolean;
  dotClassName?: string;
  dotColor?: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-3 text-left"
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
          checked && dotClassName
            ? `${dotClassName} border-transparent text-white`
            : checked
              ? "border-transparent text-white"
              : "border-gray-300 bg-white"
        }`}
        style={
          checked && dotColor
            ? { backgroundColor: dotColor, borderColor: dotColor }
            : undefined
        }
      >
        {checked ? <IconCheck size={14} stroke={3} /> : null}
      </span>
      <span className="text-sm font-medium text-gray-900">{label}</span>
    </button>
  );
}

function AddCategoryModal({
  name,
  color,
  onNameChange,
  onColorChange,
  onClose,
  onCreate,
}: {
  name: string;
  color: string;
  onNameChange: (name: string) => void;
  onColorChange: (color: string) => void;
  onClose: () => void;
  onCreate: () => void;
}) {
  const canCreate = name.trim().length > 0;

  return (
    <Modal title="Add category" className="w-full max-w-sm" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Category name
          </label>
          <input
            autoFocus
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Enter category name"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Color
          </label>
          <div className="grid grid-cols-5 gap-2">
            {CALENDAR_COLOR_PALETTE.map((paletteColor) => {
              const selected = color === paletteColor;
              return (
                <button
                  key={paletteColor}
                  type="button"
                  onClick={() => onColorChange(paletteColor)}
                  className={`flex h-8 w-8 items-center justify-center rounded-md border-2 ${
                    selected ? "border-gray-900" : "border-transparent"
                  }`}
                  aria-label={`Select color ${paletteColor}`}
                >
                  <span
                    className="h-6 w-6 rounded"
                    style={{ backgroundColor: paletteColor }}
                  />
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={!canCreate}
            onClick={onCreate}
          >
            Add category
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function CalendarToolsPanel({
  filters,
  customCategories,
  customFilters,
  onToggle,
  onToggleCustom,
  showOnlyStartDates,
  onToggleStartDates,
  onOpenAddCategory,
}: {
  filters: Record<CalendarCategory, boolean>;
  customCategories: CustomCalendarCategory[];
  customFilters: Record<string, boolean>;
  onToggle: (category: CalendarCategory) => void;
  onToggleCustom: (categoryId: string) => void;
  showOnlyStartDates: boolean;
  onToggleStartDates: () => void;
  onOpenAddCategory: () => void;
}) {
  return (
    <aside className="flex min-h-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white">
      <div className="flex shrink-0 items-center gap-2 px-5 py-3">
        <IconAdjustmentsHorizontal
          size={16}
          className="shrink-0 text-gray-500"
          aria-hidden
        />
        <h3 className="text-sm font-semibold text-gray-900">Calendar Tools</h3>
      </div>
      <div className="min-h-0 flex-1" aria-hidden />
      <div className="shrink-0 border-t border-gray-100 p-5">
        <div className="flex gap-4">
          <ul className="min-w-0 flex-1 space-y-3">
            {CALENDAR_CATEGORIES.map((category) => (
              <li key={category.id}>
                <CategoryCheckboxRow
                  label={category.label}
                  checked={filters[category.id]}
                  dotClassName={category.dot}
                  onToggle={() => onToggle(category.id)}
                />
              </li>
            ))}
          </ul>
          {customCategories.length > 0 ? (
            <ul className="min-w-0 flex-1 space-y-3">
              {customCategories.map((category) => (
                <li key={category.id}>
                  <CategoryCheckboxRow
                    label={category.label}
                    checked={customFilters[category.id] ?? true}
                    dotColor={category.color}
                    onToggle={() => onToggleCustom(category.id)}
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
          <button
            type="button"
            onClick={onToggleStartDates}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            <span
              className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border ${
                showOnlyStartDates
                  ? "border-burgundy bg-burgundy text-white"
                  : "border-gray-300 bg-white"
              }`}
            >
              {showOnlyStartDates ? <IconCheck size={10} stroke={3} /> : null}
            </span>
            <span className="text-xs text-gray-600">Show only Start Dates</span>
          </button>
          <button
            type="button"
            onClick={onOpenAddCategory}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <IconPlus size={14} />
            Add category
          </button>
        </div>
      </div>
    </aside>
  );
}

function MonthEventChip({
  event,
  selected,
  onSelect,
}: {
  event: EnrichedCalendarEvent;
  selected?: boolean;
  onSelect: () => void;
}) {
  const styles = getCategoryStyles(event.category);
  const subtitle =
    event.jobs?.name ??
    (event.clientName !== "—" ? event.clientName : null);
  const timeLabel = formatEventStartTime(event);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`block w-full rounded-md px-1.5 py-1 text-left ${styles.bg} ${
        selected ? "ring-2 ring-burgundy/40" : "hover:brightness-[0.98]"
      }`}
    >
      <div className="flex items-start gap-1">
        <span
          className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${styles.dot}`}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className={`truncate text-[11px] font-semibold leading-tight ${styles.text}`}>
            {event.title}
          </p>
          {subtitle ? (
            <p className={`truncate text-[10px] leading-snug ${styles.muted}`}>
              {subtitle}
            </p>
          ) : null}
          {timeLabel ? (
            <p className={`text-[10px] leading-snug ${styles.muted}`}>{timeLabel}</p>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function EventBlock({
  event,
  selected,
  onSelect,
  compact,
}: {
  event: EnrichedCalendarEvent;
  selected?: boolean;
  onSelect: () => void;
  compact?: boolean;
}) {
  const styles = getCategoryStyles(event.category);
  const Icon = eventIcon(event.category);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`block w-full rounded-md border-l-4 px-2 py-1.5 text-left transition-shadow ${styles.bg} ${styles.border} ${
        selected ? "ring-2 ring-burgundy ring-offset-1" : "hover:opacity-90"
      } ${compact ? "truncate" : ""}`}
    >
      {!event.isAllDay && (
        <p className={`text-[10px] font-medium ${styles.text}`}>
          {formatTimeRange(event.startMinutes, event.endMinutes)}
        </p>
      )}
      <p className={`text-xs font-semibold ${styles.text}`}>{event.taskName}</p>
      {!compact && event.clientName !== "—" && (
        <p className={`text-[10px] ${styles.text} opacity-80`}>
          {event.clientName}
        </p>
      )}
      {!compact && (
        <Icon size={14} className={`mt-0.5 ${styles.text} opacity-60`} />
      )}
    </button>
  );
}

function AddEventButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="primary"
      className="inline-flex w-full items-center justify-center gap-1.5"
      onClick={onClick}
    >
      Add event
      <IconPlus size={16} />
    </Button>
  );
}

function DatePreviewEventRow({
  event,
  selected,
  onEdit,
  onDelete,
}: {
  event: EnrichedCalendarEvent;
  selected?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const styles = getCategoryStyles(event.category);
  const Icon = eventIcon(event.category);

  return (
    <div
      className={`group flex items-start gap-2 rounded-md border-l-4 px-2 py-1.5 ${styles.bg} ${styles.border} ${
        selected ? "ring-2 ring-burgundy ring-offset-1" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        {!event.isAllDay && (
          <p className={`text-[10px] font-medium ${styles.text}`}>
            {formatTimeRange(event.startMinutes, event.endMinutes)}
          </p>
        )}
        <p className={`text-xs font-semibold ${styles.text}`}>{event.taskName}</p>
        {event.clientName !== "—" && (
          <p className={`text-[10px] ${styles.text} opacity-80`}>
            {event.clientName}
          </p>
        )}
        <Icon size={14} className={`mt-0.5 ${styles.text} opacity-60`} />
      </div>
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={onEdit}
          className="rounded p-1.5 text-gray-500 hover:bg-white/80 hover:text-gray-800"
          aria-label="Edit event"
        >
          <IconPencil size={16} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded p-1.5 text-gray-500 hover:bg-white/80 hover:text-red-600"
          aria-label="Delete event"
        >
          <IconTrash size={16} />
        </button>
      </div>
    </div>
  );
}

function DatePreviewModal({
  date,
  events,
  selectedEventId,
  onAdd,
  onEdit,
  onDelete,
  onClose,
}: {
  date: Date;
  events: EnrichedCalendarEvent[];
  selectedEventId: string | null;
  onAdd: () => void;
  onEdit: (event: EnrichedCalendarEvent) => void;
  onDelete: (event: EnrichedCalendarEvent) => void;
  onClose: () => void;
}) {
  const todayKey = formatDateKey(new Date());
  const dateKey = formatDateKey(date);
  const isToday = dateKey === todayKey;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="date-preview-title"
      >
        <div className="flex items-start justify-between border-b border-gray-200 px-6 py-5">
          <div className="flex items-center gap-5">
            <div
              className={`flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-xl ${
                isToday ? "bg-burgundy text-white" : "bg-burgundy/10 text-burgundy"
              }`}
            >
              <span className="text-sm font-medium uppercase tracking-wide">
                {date.toLocaleDateString("en-US", { weekday: "short" })}
              </span>
              <span className="text-4xl font-bold leading-none">
                {date.getDate()}
              </span>
            </div>
            <div>
              <h2
                id="date-preview-title"
                className="text-2xl font-semibold text-gray-900"
              >
                {formatFullDate(date)}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {events.length === 0
                  ? "No events scheduled"
                  : `${events.length} event${events.length === 1 ? "" : "s"}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="px-6 pb-8 pt-4">
          {events.length > 0 ? (
            <div className="mb-6 space-y-2">
              {events.map((ev) => (
                <DatePreviewEventRow
                  key={ev.id}
                  event={ev}
                  selected={selectedEventId === ev.id}
                  onEdit={() => onEdit(ev)}
                  onDelete={() => onDelete(ev)}
                />
              ))}
            </div>
          ) : (
            <p className="mb-6 text-sm text-gray-500">
              Nothing scheduled for this date.
            </p>
          )}
          <div className="flex justify-end">
            <AddEventButton onClick={onAdd} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const [focusDate, setFocusDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [calendarScope, setCalendarScope] =
    useState<CalendarScope>("production");
  const [firstName, setFirstName] = useState("My");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [events, setEvents] = useState<EnrichedCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [showModal, setShowModal] = useState(false);
  const [previewDate, setPreviewDate] = useState<Date | null>(null);
  const [editingEvent, setEditingEvent] = useState<EnrichedCalendarEvent | null>(
    null
  );
  const [form, setForm] = useState(defaultEventForm);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [categoryFilters, setCategoryFilters] = useState(defaultCategoryFilters);
  const [customCategories, setCustomCategories] = useState<CustomCalendarCategory[]>(
    []
  );
  const [customCategoryFilters, setCustomCategoryFilters] = useState<
    Record<string, boolean>
  >({});
  const [showOnlyStartDates, setShowOnlyStartDates] = useState(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [addCategoryName, setAddCategoryName] = useState("");
  const [addCategoryColor, setAddCategoryColor] = useState<string>(
    CALENDAR_COLOR_PALETTE[0]
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadSeq = useRef(0);

  function resetAttachment() {
    setAttachedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  const weekStart = useMemo(() => startOfWeek(focusDate), [focusDate]);
  const todayKey = formatDateKey(new Date());
  const focusKey = formatDateKey(focusDate);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    const supabase = createClient();
    const monthStart = new Date(focusDate.getFullYear(), focusDate.getMonth(), 1);
    const monthEnd = new Date(
      focusDate.getFullYear(),
      focusDate.getMonth() + 1,
      0
    );
    const rangeStart = formatDateKey(addDays(monthStart, -7));
    const rangeEnd = formatDateKey(addDays(monthEnd, 14));

    const { data, error } = await supabase
      .from("calendar_events")
      .select("*, jobs(id, name, created_at, contacts(name))")
      .gte("event_date", rangeStart)
      .lte("event_date", rangeEnd)
      .order("event_date");

    if (seq !== loadSeq.current) return;

    if (error) {
      console.error("Failed to load calendar events:", error.message);
      setLoading(false);
      return;
    }

    const enriched = ((data as CalendarEvent[]) ?? []).map((e, i) =>
      enrichCalendarEvent(e, i)
    );
    setEvents(enriched);
    setLoading(false);
  }, [focusDate]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const supabase = createClient();
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      setCurrentUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();

      const fullName =
        profile?.full_name?.trim() ||
        (user.user_metadata?.full_name as string | undefined)?.trim() ||
        user.email?.split("@")[0] ||
        "My";
      setFirstName(fullName.split(/\s+/)[0] || "My");
    })();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const visibleEvents = useMemo(
    () => filterByCalendarTab(events, calendarScope, currentUserId),
    [events, calendarScope, currentUserId]
  );

  const filteredEvents = useMemo(
    () =>
      visibleEvents.filter((event) => eventMatchesFilters(event, categoryFilters)),
    [visibleEvents, categoryFilters]
  );

  const eventsByDay = useMemo(() => {
    const map = new Map<string, EnrichedCalendarEvent[]>();
    for (const event of filteredEvents) {
      if (!map.has(event.event_date)) map.set(event.event_date, []);
      map.get(event.event_date)!.push(event);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.startMinutes - b.startMinutes);
    }
    return map;
  }, [filteredEvents]);

  const dayEvents = useMemo(
    () => eventsByDay.get(focusKey) ?? [],
    [eventsByDay, focusKey]
  );

  useEffect(() => {
    setSelectedEventId((current) => {
      if (dayEvents.length === 0) return null;
      if (current && dayEvents.some((e) => e.id === current)) return current;
      return dayEvents[0].id;
    });
  }, [focusKey, dayEvents]);

  function toggleCategoryFilter(category: CalendarCategory) {
    setCategoryFilters((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  }

  function toggleCustomCategoryFilter(categoryId: string) {
    setCustomCategoryFilters((prev) => ({
      ...prev,
      [categoryId]: !(prev[categoryId] ?? true),
    }));
  }

  function openAddCategoryModal() {
    setAddCategoryName("");
    setAddCategoryColor(CALENDAR_COLOR_PALETTE[0]);
    setShowAddCategoryModal(true);
  }

  function handleCreateCategory() {
    const label = addCategoryName.trim();
    if (!label) return;

    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `custom-${Date.now()}`;

    setCustomCategories((prev) => [...prev, { id, label, color: addCategoryColor }]);
    setCustomCategoryFilters((prev) => ({ ...prev, [id]: true }));
    setShowAddCategoryModal(false);
    setAddCategoryName("");
    setAddCategoryColor(CALENDAR_COLOR_PALETTE[0]);
  }

  const currentTimePercent =
    focusKey === todayKey ? getCurrentTimePercent(now) : null;

  function shiftDate(delta: number) {
    if (viewMode === "month") {
      setFocusDate((prev) => {
        const d = new Date(prev);
        d.setMonth(d.getMonth() + delta);
        return d;
      });
      return;
    }
    const step = viewMode === "week" ? 7 : 1;
    setFocusDate((prev) => addDays(prev, delta * step));
  }

  function shiftMonth(delta: number) {
    setFocusDate((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + delta);
      return d;
    });
  }

  function openDatePreview(date: Date) {
    setFocusDate(date);
    setPreviewDate(date);
  }

  function openCreateModal(forDate?: Date) {
    if (forDate) {
      setFocusDate(forDate);
    }
    const dateKey = forDate ? formatDateKey(forDate) : focusKey;
    setEditingEvent(null);
    setForm(defaultEventForm(dateKey, calendarScope));
    resetAttachment();
    setSaveError(null);
    setPreviewDate(null);
    setShowModal(true);
  }

  function openEditModal(event: EnrichedCalendarEvent) {
    resetAttachment();
    setSaveError(null);
    setEditingEvent(event);
    setForm({
      title: event.title,
      event_type: event.event_type,
      event_date: event.event_date,
      end_date: event.event_date,
      start_time: toTimeInputValue(event.start_time),
      end_time: toTimeInputValue(event.end_time),
      job_id: event.job_id ?? "",
      is_all_day: event.is_all_day ?? false,
      location: event.location ?? "",
      description: event.description ?? "",
    });
    setPreviewDate(null);
    setShowModal(true);
  }

  async function handleDeleteEvent(event: EnrichedCalendarEvent) {
    const supabase = createClient();
    await supabase.from("calendar_events").delete().eq("id", event.id);
    setEvents((prev) => prev.filter((ev) => ev.id !== event.id));
    setSelectedEventId((current) => (current === event.id ? null : current));
    void load();
  }

  function updateEventDate(dateKey: string) {
    setForm((prev) => ({
      ...prev,
      event_date: dateKey,
      end_date: prev.end_date === prev.event_date ? dateKey : prev.end_date,
    }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      setSaveError("Title is required.");
      return;
    }

    setSaving(true);
    setSaveError(null);
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      setSaveError("You must be signed in to save events.");
      return;
    }

    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      event_type: form.event_type,
      event_date: form.event_date,
      job_id: form.job_id || null,
      is_all_day: form.is_all_day,
      start_time: form.is_all_day ? null : form.start_time,
      end_time: form.is_all_day ? null : form.end_time,
      location: form.location.trim() || null,
      description: form.description.trim() || null,
      // Always stamp scope from the active calendar tab.
      // Personal events must be owned by the signed-in user.
      user_id:
        calendarScope === "personal"
          ? user.id
          : (editingEvent?.user_id ?? user.id),
      calendar_scope: calendarScope,
    };

    async function persist(nextPayload: Record<string, unknown>) {
      if (editingEvent) {
        return supabase
          .from("calendar_events")
          .update(nextPayload)
          .eq("id", editingEvent.id)
          .select("*, jobs(id, name, created_at, contacts(name))")
          .single();
      }
      return supabase
        .from("calendar_events")
        .insert(nextPayload)
        .select("*, jobs(id, name, created_at, contacts(name))")
        .single();
    }

    // Never strip user_id / calendar_scope — privacy depends on them.
    const optionalFields = [
      "description",
      "location",
      "end_time",
      "start_time",
      "is_all_day",
    ] as const;

    let workingPayload = { ...payload };
    let { data, error } = await persist(workingPayload);

    // Strip unknown optional columns one-by-one if the live DB is behind migrations.
    for (let attempt = 0; attempt < optionalFields.length && error; attempt++) {
      const missing =
        error.message.match(/'([^']+)' column/i)?.[1] ??
        optionalFields.find((field) =>
          error!.message.toLowerCase().includes(field)
        );
      if (!missing || !(missing in workingPayload)) break;
      if (missing === "user_id" || missing === "calendar_scope") break;
      const { [missing]: _removed, ...rest } = workingPayload;
      workingPayload = rest;
      ({ data, error } = await persist(workingPayload));
    }

    setSaving(false);

    if (error || !data) {
      const privacyMissing =
        error?.message?.toLowerCase().includes("user_id") ||
        error?.message?.toLowerCase().includes("calendar_scope");
      setSaveError(
        privacyMissing
          ? "Personal calendar privacy columns are missing. Run 20260727000004_calendar_events_full_setup.sql in the Supabase SQL Editor, then try again."
          : (error?.message ??
            "Could not save event. Your database may be missing calendar columns — run the calendar setup SQL in Supabase.")
      );
      return;
    }

    const savedRow = data as CalendarEvent;
    // Refuse to keep a personal event that did not persist as personal/owned.
    if (
      calendarScope === "personal" &&
      (savedRow.calendar_scope !== "personal" || savedRow.user_id !== user.id)
    ) {
      setSaveError(
        "Personal event could not be saved privately. Run the calendar privacy SQL in Supabase, then try again."
      );
      // Best-effort cleanup so it doesn't linger as a public production event.
      await supabase.from("calendar_events").delete().eq("id", savedRow.id);
      return;
    }

    const saved = enrichCalendarEvent(
      {
        ...savedRow,
        calendar_scope: savedRow.calendar_scope ?? calendarScope,
        user_id: savedRow.user_id ?? user.id,
      },
      events.length
    );
    setEvents((prev) => {
      const without = prev.filter((ev) => ev.id !== saved.id);
      return [...without, saved].sort((a, b) =>
        a.event_date.localeCompare(b.event_date)
      );
    });
    setFocusDate(new Date(`${saved.event_date}T12:00:00`));
    setSelectedEventId(saved.id);
    setShowModal(false);
    setEditingEvent(null);
    resetAttachment();
    // Refresh in the background; stale responses are ignored via loadSeq.
    void     load();
  }

  const monthDate = focusDate;
  const monthGrid = useMemo(() => buildMonthGrid(monthDate), [monthDate]);
  const displayMonth = monthDate.getMonth();
  const displayYear = monthDate.getFullYear();

  const calendarHeaderLabel =
    viewMode === "day"
      ? formatFullDate(focusDate)
      : viewMode === "week"
        ? `${weekDays[0].toLocaleDateString("en-US", { month: "long", day: "numeric" })} – ${weekDays[6].toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
        : monthDate.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          });

  return (
    <div className="flex h-[calc(100vh-2.5rem)] min-h-0 flex-col overflow-hidden">
      <div className="grid min-h-0 flex-1 grid-cols-1 items-stretch gap-4 xl:grid-cols-[1fr_320px]">
        <div className="flex min-h-0 min-w-0 flex-col">
          <div className="mb-2 flex shrink-0 items-center justify-between px-1">
            <h1 className="text-2xl font-semibold text-gray-900">
              {calendarScope === "production"
                ? "Production Calendar"
                : `${firstName}'s Calendar`}
            </h1>
            <div className="flex rounded-md border border-gray-300 bg-white p-0.5">
              {(["production", "personal"] as const).map((scope) => (
                <button
                  key={scope}
                  type="button"
                  onClick={() => setCalendarScope(scope)}
                  className={`rounded px-3 py-1.5 text-sm capitalize ${
                    calendarScope === scope
                      ? "bg-burgundy text-white"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {scope}
                </button>
              ))}
            </div>
          </div>
          {loading ? (
            <p className="text-gray-500">Loading…</p>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white">
              <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-gray-200 px-4 py-2.5">
                <div className="relative justify-self-start">
                  <select
                    value={viewMode}
                    onChange={(e) => setViewMode(e.target.value as ViewMode)}
                    aria-label="Calendar view"
                    className={`${SELECT_CLASS} h-9 px-3 py-0 capitalize leading-9 text-gray-900 focus:border-burgundy focus:outline-none focus:ring-1 focus:ring-burgundy`}
                  >
                    {(["day", "week", "month"] as const).map((mode) => (
                      <option key={mode} value={mode}>
                        {mode}
                      </option>
                    ))}
                  </select>
                  <SelectChevron />
                </div>
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => shiftDate(-1)}
                    className="rounded-md border border-gray-300 p-1.5 hover:bg-gray-50"
                    aria-label="Previous"
                  >
                    <IconChevronLeft size={18} />
                  </button>
                  <h2 className="min-w-[10rem] truncate text-center text-sm font-semibold text-gray-900">
                    {calendarHeaderLabel}
                  </h2>
                  <button
                    type="button"
                    onClick={() => shiftDate(1)}
                    className="rounded-md border border-gray-300 p-1.5 hover:bg-gray-50"
                    aria-label="Next"
                  >
                    <IconChevronRight size={18} />
                  </button>
                </div>
                <div aria-hidden />
              </div>

              {viewMode === "day" ? (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="grid min-h-0 flex-1 grid-cols-[56px_1fr]">
                <div className="flex min-h-0 flex-col border-r border-gray-200">
                  {WEEK_HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="flex flex-1 items-start justify-end border-b border-gray-100 pr-2 pt-1 text-[10px] text-gray-400"
                    >
                      {formatHourLabel(hour)}
                    </div>
                  ))}
                </div>

                <div className="relative flex min-h-0 flex-col">
                  {WEEK_HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="flex-1 border-b border-gray-100"
                    />
                  ))}

                  {currentTimePercent !== null && (
                    <div
                      className="pointer-events-none absolute left-0 right-0 z-20 flex items-center"
                      style={{ top: `${currentTimePercent}%` }}
                    >
                      <span className="absolute -left-14 w-12 text-right text-[10px] font-medium text-red-500">
                        {formatMinutesLabel(
                          now.getHours() * 60 + now.getMinutes()
                        )}
                      </span>
                      <div className="h-0.5 w-full bg-red-500" />
                    </div>
                  )}

                  {dayEvents
                    .filter((e) => !e.isAllDay)
                    .map((ev) => (
                      <div
                        key={ev.id}
                        className="absolute left-1 right-1 z-10 overflow-hidden"
                        style={{
                          top: `${getEventTopPercent(ev.startMinutes)}%`,
                          height: `${getEventHeightPercent(ev.startMinutes, ev.endMinutes)}%`,
                          minHeight: "1.75rem",
                        }}
                      >
                        <EventBlock
                          event={ev}
                          selected={selectedEventId === ev.id}
                          onSelect={() => setSelectedEventId(ev.id)}
                        />
                      </div>
                    ))}
                </div>
              </div>

              {dayEvents.some((e) => e.isAllDay) && (
                <div className="shrink-0 border-t border-gray-200 px-4 py-2">
                  <p className="mb-1 text-xs font-medium text-gray-500">All day</p>
                  <div className="space-y-1">
                    {dayEvents
                      .filter((e) => e.isAllDay)
                      .map((ev) => (
                        <EventBlock
                          key={ev.id}
                          event={ev}
                          selected={selectedEventId === ev.id}
                          onSelect={() => setSelectedEventId(ev.id)}
                          compact
                        />
                      ))}
                  </div>
                </div>
              )}
              </div>
              ) : viewMode === "week" ? (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="grid shrink-0 grid-cols-[56px_repeat(7,1fr)] border-b border-gray-200 bg-gray-50">
                <div className="border-r border-gray-200" />
                {weekDays.map((day, dayIndex) => {
                  const key = formatDateKey(day);
                  const isToday = key === todayKey;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setFocusDate(day);
                        setViewMode("day");
                      }}
                      className={`border-r border-gray-200 px-2 py-2 text-center last:border-r-0 hover:bg-gray-100 ${
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
                    </button>
                  );
                })}
              </div>

              <div className="grid min-h-0 flex-1 grid-cols-[56px_repeat(7,1fr)]">
                <div className="flex min-h-0 flex-col border-r border-gray-200">
                  {WEEK_HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="flex flex-1 items-start justify-end border-b border-gray-100 pr-2 pt-1 text-[10px] text-gray-400"
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
                      className="relative flex min-h-0 flex-col border-r border-gray-200 last:border-r-0"
                    >
                      {WEEK_HOURS.map((hour) => (
                        <div
                          key={hour}
                          className="flex-1 border-b border-gray-100"
                        />
                      ))}
                      {timedEvents.map((ev) => (
                        <div
                          key={ev.id}
                          className="absolute left-0.5 right-0.5 z-10 overflow-hidden"
                          style={{
                            top: `${getEventTopPercent(ev.startMinutes)}%`,
                            height: `${getEventHeightPercent(ev.startMinutes, ev.endMinutes)}%`,
                            minHeight: "1.25rem",
                          }}
                        >
                          <EventBlock
                            event={ev}
                            selected={selectedEventId === ev.id}
                            onSelect={() => setSelectedEventId(ev.id)}
                            compact
                          />
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
              </div>
              ) : (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="grid shrink-0 grid-cols-7 border-b border-gray-200 bg-gray-50">
                  {MONTH_DAY_HEADERS.map((d) => (
                    <div
                      key={d}
                      className="border-r border-gray-200 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 last:border-r-0"
                    >
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6">
                  {monthGrid.map((day) => {
                    const dateStr = formatDateKey(day);
                    const dayEvts = eventsByDay.get(dateStr) ?? [];
                    const inMonth =
                      day.getMonth() === displayMonth &&
                      day.getFullYear() === displayYear;
                    const isToday = dateStr === todayKey;
                    const visibleEvts = dayEvts.slice(0, 2);
                    const extra = dayEvts.length - visibleEvts.length;

                    return (
                      <div
                        key={dateStr}
                        role="button"
                        tabIndex={0}
                        onClick={() => openDatePreview(day)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openDatePreview(day);
                          }
                        }}
                        className="flex min-h-0 cursor-pointer flex-col border-b border-r border-gray-200 bg-white text-left hover:bg-gray-50/80 last:border-r-0 [&:nth-child(7n)]:border-r-0"
                      >
                        <div className="flex shrink-0 items-start p-1.5 pb-1">
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
                        </div>
                        <div className="min-h-0 flex-1 space-y-0.5 overflow-hidden px-1 pb-1.5">
                          {visibleEvts.map((ev) => (
                            <MonthEventChip
                              key={ev.id}
                              event={ev}
                              selected={selectedEventId === ev.id}
                              onSelect={() => openDatePreview(day)}
                            />
                          ))}
                          {extra > 0 ? (
                            <span className="block w-full px-1 text-left text-[10px] font-medium text-gray-500">
                              +{extra} more
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              )}
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-col gap-3 xl:h-full">
          <MiniCalendar
            displayDate={viewMode === "week" ? weekStart : focusDate}
            focusDate={focusDate}
            onSelectDate={openDatePreview}
            onShiftMonth={shiftMonth}
          />
          <AddEventButton onClick={() => openCreateModal()} />
          <CalendarToolsPanel
            filters={categoryFilters}
            customCategories={customCategories}
            customFilters={customCategoryFilters}
            onToggle={toggleCategoryFilter}
            onToggleCustom={toggleCustomCategoryFilter}
            showOnlyStartDates={showOnlyStartDates}
            onToggleStartDates={() => setShowOnlyStartDates((prev) => !prev)}
            onOpenAddCategory={openAddCategoryModal}
          />
        </div>
      </div>

      {showAddCategoryModal && (
        <AddCategoryModal
          name={addCategoryName}
          color={addCategoryColor}
          onNameChange={setAddCategoryName}
          onColorChange={setAddCategoryColor}
          onClose={() => setShowAddCategoryModal(false)}
          onCreate={handleCreateCategory}
        />
      )}

      {previewDate && (
        <DatePreviewModal
          date={previewDate}
          events={eventsByDay.get(formatDateKey(previewDate)) ?? []}
          selectedEventId={selectedEventId}
          onAdd={() => openCreateModal(previewDate)}
          onEdit={openEditModal}
          onDelete={handleDeleteEvent}
          onClose={() => setPreviewDate(null)}
        />
      )}

      {showModal && (
        <Modal
          title={editingEvent ? "Edit event" : "New event"}
          className="h-[6.75in] w-[6.25in]"
          onClose={() => {
            resetAttachment();
            setShowModal(false);
          }}
        >
          <form onSubmit={handleSave} className="flex h-full min-h-0 flex-col overflow-hidden">
            <div className="scrollbar-none min-h-0 flex-1 space-y-2.5 overflow-hidden">
              <div>
                <label className="mb-0.5 block text-sm font-medium">Title</label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                />
              </div>
              <div className="flex gap-3">
                <div className="w-1/2">
                  <label className="mb-0.5 block text-sm font-medium">Date</label>
                  <input
                    type="date"
                    required
                    value={form.event_date}
                    onChange={(e) => updateEventDate(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                  />
                </div>
                <div className="w-1/2">
                  <label className="mb-0.5 block text-sm font-medium">Type</label>
                  <div className="relative">
                    <select
                      value={form.event_type}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          event_type: e.target.value as CalendarEventType,
                        })
                      }
                      className={`${SELECT_CLASS} w-full px-3 py-1.5`}
                    >
                      <option value="drafting">Drafting</option>
                      <option value="production">Production</option>
                      <option value="delivery">Delivery</option>
                      <option value="shop_closed">Shop closed</option>
                      {calendarScope === "personal" ? (
                        <option value="personal">Personal</option>
                      ) : null}
                    </select>
                    <SelectChevron />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex min-w-0 gap-3">
                  <div className="flex min-w-0 w-1/2 items-center gap-2">
                    <span className="w-16 shrink-0 text-sm text-gray-500">
                      Start time
                    </span>
                    <input
                      type="date"
                      required
                      value={form.event_date}
                      onChange={(e) => updateEventDate(e.target.value)}
                      className="min-w-0 flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div className="flex min-w-0 w-1/2 items-center gap-2">
                    <div className="relative shrink-0">
                      <select
                        value={form.start_time}
                        disabled={form.is_all_day}
                        onChange={(e) =>
                          setForm({ ...form, start_time: e.target.value })
                        }
                        className={`${SELECT_CLASS} w-28 px-2 py-1.5 disabled:bg-gray-50 disabled:text-gray-400`}
                      >
                        {TIME_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <SelectChevron />
                    </div>
                    <label className="flex shrink-0 items-center gap-1.5 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={form.is_all_day}
                        onChange={(e) =>
                          setForm({ ...form, is_all_day: e.target.checked })
                        }
                        className="rounded border-gray-300"
                      />
                      All day
                    </label>
                  </div>
                </div>

                <div className="flex min-w-0 gap-3">
                  <div className="flex min-w-0 w-1/2 items-center gap-2">
                    <span className="w-16 shrink-0 text-sm text-gray-500">
                      End time
                    </span>
                    <input
                      type="date"
                      required
                      value={form.end_date}
                      onChange={(e) =>
                        setForm({ ...form, end_date: e.target.value })
                      }
                      className="min-w-0 flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div className="flex min-w-0 w-1/2 items-center gap-2">
                    <div className="relative shrink-0">
                      <select
                        value={form.end_time}
                        disabled={form.is_all_day}
                        onChange={(e) =>
                          setForm({ ...form, end_time: e.target.value })
                        }
                        className={`${SELECT_CLASS} w-28 px-2 py-1.5 disabled:bg-gray-50 disabled:text-gray-400`}
                      >
                        {TIME_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <SelectChevron />
                    </div>
                    <button
                      type="button"
                      className="inline-flex min-w-0 shrink items-center gap-1 text-sm font-medium text-burgundy hover:text-burgundy/80"
                    >
                      <IconRepeat size={16} className="shrink-0" />
                      <span className="truncate">Make Recurring</span>
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-0.5 block text-sm font-medium">Location</label>
                <AddressAutocomplete
                  id="event-location"
                  value={form.location}
                  onChange={(location) => setForm({ ...form, location })}
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                />
              </div>

              <div>
                <label className="mb-0.5 block text-sm font-medium">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="Add a description..."
                  className="scrollbar-none h-[1.25in] w-full resize-none overflow-hidden rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                />
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-2 pt-4">
              {saveError && (
                <p className="text-sm text-red-600">{saveError}</p>
              )}
              <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) =>
                    setAttachedFile(e.target.files?.[0] ?? null)
                  }
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="inline-flex shrink-0 items-center gap-1.5"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <IconPaperclip size={16} />
                  Attach file
                </Button>
                {attachedFile && (
                  <span className="truncate text-xs text-gray-500">
                    {attachedFile.name}
                  </span>
                )}
              </div>
              <div className="flex shrink-0 gap-3">
                <Button
                  type="button"
                  onClick={() => {
                    resetAttachment();
                    setSaveError(null);
                    setShowModal(false);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={saving}>
                  {saving
                    ? "Saving…"
                    : editingEvent
                      ? "Save changes"
                      : "Create event"}
                </Button>
              </div>
              </div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
