"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
} from "react";
import {
  IconAdjustmentsHorizontal,
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconArrowsMove,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconDotsVertical,
  IconPaperclip,
  IconPencil,
  IconPlus,
  IconRepeat,
  IconSettings,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/client";
import Modal from "@/components/Modal";
import ConfirmModal from "@/components/ConfirmModal";
import Button from "@/components/Button";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import MiniCalendar from "@/components/calendar/MiniCalendar";
import MonthGridView from "@/components/calendar/MonthGridView";
import ScheduleBubbleChip, {
  scheduleBubbleFromMeta,
} from "@/components/calendar/ScheduleBubbleChip";
import {
  CalendarEmbedProvider,
  useCalendarEmbed,
  useProductionSchedule,
} from "@/components/calendar/CalendarEmbedContext";
import { ensureNotificationPermission } from "@/lib/calendar-reminders";
import {
  defaultRecurrenceRule,
  expandRecurrenceDates,
  summarizeRecurrenceSchedule,
  type RecurrenceRule,
} from "@/lib/calendar-recurrence";
import RecurrenceModal from "@/components/calendar/RecurrenceModal";
import ProductionScheduleFooter from "@/components/jobs/ProductionScheduleFooter";
import ProductionSchedulePanel from "@/components/jobs/ProductionSchedulePanel";
import {
  isScheduleStartOrDeliveryEvent,
  loadJobSchedule,
  phaseDatesFromRecord,
  parseScheduleBubbleDescription,
  removeJobSchedule,
  saveJobSchedule,
} from "@/lib/job-schedule";
import {
  WEEK_HOURS,
  addDays,
  CALENDAR_CATEGORIES,
  CALENDAR_COLOR_PALETTE,
  customCategoriesForScope,
  defaultCategoryFilters,
  defaultPersonalCategoryFilters,
  encodeCustomCategoryDescription,
  enrichCalendarEvent,
  eventMatchesFilters,
  filterByCalendarTab,
  PERSONAL_CALENDAR_CATEGORIES,
  formatDateKey,
  formatFullDate,
  formatHourLabel,
  formatMinutesLabel,
  formatTimeRange,
  getCategoryStyles,
  getCurrentTimePercent,
  getEventDisplayDescription,
  getEventHeightPercent,
  getEventTopPercent,
  customCategoryChipStyle,
  isShopClosedEvent,
  MONTH_DAY_HEADERS,
  parseCustomCategoryDescription,
  startOfWeek,
  type CalendarCategory,
  type CustomCalendarCategory,
  type EnrichedCalendarEvent,
} from "@/lib/calendar";
import type { CalendarEvent, CalendarEventType } from "@/lib/types";
import type {
  ScheduleBubbleKind,
  ScheduleColor,
} from "@/lib/schedule-phase-drag";

type ViewMode = "day" | "week" | "month";
type CalendarScope = "production" | "personal";

const CUSTOM_CATEGORIES_STORAGE_KEY = "calendar:customCategories";
const CUSTOM_CATEGORIES_MIGRATED_KEY = "calendar:customCategoriesMigrated";

function loadStoredCustomCategories(): CustomCalendarCategory[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_CATEGORIES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<
      Partial<CustomCalendarCategory> & {
        id?: string;
        label?: string;
        color?: string;
      }
    >;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item) =>
          item &&
          typeof item.id === "string" &&
          typeof item.label === "string" &&
          typeof item.color === "string"
      )
      .map((item) => ({
        id: item.id!,
        label: item.label!,
        color: item.color!,
        scope:
          item.scope === "production" || item.scope === "personal"
            ? item.scope
            : "personal",
      }));
  } catch {
    return [];
  }
}

function mapCategoryRows(
  rows: Array<{
    id: string;
    label: string;
    color: string;
    scope: string;
  }>
): CustomCalendarCategory[] {
  return rows
    .filter(
      (row) => row.scope === "personal" || row.scope === "production"
    )
    .map((row) => ({
      id: row.id,
      label: row.label,
      color: row.color,
      scope: row.scope as "personal" | "production",
    }));
}

function categorySelectValue(
  form: {
    event_type: CalendarEventType;
    custom_category_id: string;
  },
  scope: CalendarScope
): string {
  if (form.custom_category_id) return `custom:${form.custom_category_id}`;
  if (scope === "personal") return "";
  return form.event_type;
}

/** When the live DB enum is behind migrations, save with a legacy type that maps to the same category. */
const EVENT_TYPE_ENUM_FALLBACK: Partial<
  Record<CalendarEventType, CalendarEventType>
> = {
  finishing: "quote",
  shop_closed: "other",
};

const CALENDAR_ENUM_SETUP_SQL =
  "ALTER TYPE calendar_event_type ADD VALUE IF NOT EXISTS 'drafting'; ALTER TYPE calendar_event_type ADD VALUE IF NOT EXISTS 'shop_closed';";

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

function toTimeInputValue(time: string | null | undefined): string {
  if (!time) return "09:00";
  return time.slice(0, 5);
}

function buildRuleFromSeries(
  event: EnrichedCalendarEvent,
  allEvents: EnrichedCalendarEvent[]
): RecurrenceRule {
  const rule = defaultRecurrenceRule(
    event.event_date,
    toTimeInputValue(event.start_time),
    toTimeInputValue(event.end_time),
    event.is_all_day ?? false
  );
  if (!event.recurrence_series_id) return rule;

  const dates = allEvents
    .filter((ev) => ev.recurrence_series_id === event.recurrence_series_id)
    .map((ev) => ev.event_date)
    .sort();
  if (dates.length === 0) return rule;

  return {
    ...rule,
    startDate: dates[0]!,
    endMode: "by_date",
    endDate: dates[dates.length - 1]!,
    occurrenceCount: dates.length,
  };
}

function defaultEventForm(
  dateKey = formatDateKey(new Date()),
  scope: CalendarScope = "production",
  customCategories: CustomCalendarCategory[] = []
) {
  const firstCustom = customCategories[0];
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
    remind_me: false,
    reminder_minutes: "",
    custom_category_id:
      scope === "personal" && firstCustom ? firstCustom.id : "",
  };
}

function CategoryCheckboxRow({
  label,
  checked,
  checkedClassName = "border-gray-900 bg-gray-900 text-white",
  checkedStyle,
  onToggle,
  onDelete,
}: {
  label: string;
  checked: boolean;
  checkedClassName?: string;
  checkedStyle?: CSSProperties;
  onToggle: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="group flex items-center gap-1">
      <button
        type="button"
        onClick={onToggle}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
            checked ? checkedClassName : "border-gray-300 bg-white"
          }`}
          style={checked ? checkedStyle : undefined}
        >
          {checked ? <IconCheck size={14} stroke={3} /> : null}
        </span>
        <span className="truncate text-sm font-medium text-gray-900">{label}</span>
      </button>
      {onDelete ? (
        <button
          type="button"
          onClick={onDelete}
          className="shrink-0 rounded p-1 text-gray-400 opacity-0 transition-opacity hover:bg-gray-100 hover:text-red-600 group-hover:opacity-100"
          aria-label={`Delete ${label} category`}
        >
          <IconTrash size={14} />
        </button>
      ) : null}
    </div>
  );
}

function CategoriesModal({
  categories,
  name,
  color,
  onNameChange,
  onColorChange,
  onCreate,
  onRename,
  onDelete,
  onClose,
}: {
  categories: CustomCalendarCategory[];
  name: string;
  color: string;
  onNameChange: (name: string) => void;
  onColorChange: (color: string) => void;
  onCreate: () => void;
  onRename: (categoryId: string, nextLabel: string) => void;
  onDelete: (categoryId: string) => void;
  onClose: () => void;
}) {
  const canCreate = name.trim().length > 0;
  const leftCategories = categories.slice(0, 5);
  const rightCategories = categories.slice(5, 10);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [pendingDelete, setPendingDelete] = useState<CustomCalendarCategory | null>(
    null
  );

  function startRename(category: CustomCalendarCategory) {
    setEditingId(category.id);
    setEditLabel(category.label);
  }

  function commitRename() {
    if (!editingId) return;
    const nextLabel = editLabel.trim();
    if (nextLabel) {
      onRename(editingId, nextLabel);
    }
    setEditingId(null);
    setEditLabel("");
  }

  function cancelRename() {
    setEditingId(null);
    setEditLabel("");
  }

  function renderCategoryRow(category: CustomCalendarCategory) {
    const isEditing = editingId === category.id;

    return (
      <li
        key={category.id}
        className="flex items-center gap-2 border-b border-gray-100 px-3 py-2.5"
      >
        <span
          className="h-3.5 w-3.5 shrink-0 rounded-full"
          style={{ backgroundColor: category.color }}
          aria-hidden
        />
        {isEditing ? (
          <input
            autoFocus
            value={editLabel}
            onChange={(e) => setEditLabel(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitRename();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                cancelRename();
              }
            }}
            className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-sm font-medium text-gray-900"
            aria-label={`Rename ${category.label}`}
          />
        ) : (
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">
            {category.label}
          </span>
        )}
        <button
          type="button"
          onClick={() => startRename(category)}
          className="shrink-0 rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          aria-label={`Rename ${category.label}`}
        >
          <IconPencil size={15} />
        </button>
        <button
          type="button"
          onClick={() => setPendingDelete(category)}
          className="shrink-0 rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
          aria-label={`Delete ${category.label}`}
        >
          <IconTrash size={15} />
        </button>
      </li>
    );
  }

  return (
    <>
    <Modal title="Categories" className="w-full max-w-lg" onClose={onClose}>
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Your categories
          </p>
          {categories.length === 0 ? (
            <p className="rounded-md border border-dashed border-gray-200 px-3 py-4 text-center text-sm text-gray-500">
              No custom categories yet.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-x-0 overflow-hidden rounded-md border border-gray-200">
              <ul className="min-w-0 border-r border-gray-100">
                {leftCategories.map(renderCategoryRow)}
              </ul>
              <ul className="min-w-0">
                {rightCategories.map(renderCategoryRow)}
              </ul>
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 pt-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Add category
          </p>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Name
              </label>
              <input
                autoFocus
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="Enter category name"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canCreate) {
                    e.preventDefault();
                    onCreate();
                  }
                }}
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
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" onClick={onClose}>
                Done
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={!canCreate}
                onClick={onCreate}
              >
                <span className="inline-flex items-center gap-1">
                  <IconPlus size={14} />
                  Add
                </span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
    {pendingDelete ? (
      <div className="relative z-[60]">
        <ConfirmModal
          title="Delete category"
          body="Are you sure you want to delete this category? All events under this name will be lost."
          confirmLabel="Delete"
          onConfirm={() => {
            onDelete(pendingDelete.id);
            setPendingDelete(null);
          }}
          onCancel={() => setPendingDelete(null)}
        />
      </div>
    ) : null}
    </>
  );
}

function CalendarToolsPanel({
  scope,
  filters,
  customCategories,
  customFilters,
  onToggle,
  onToggleCustom,
  onOpenCategories,
}: {
  scope: CalendarScope;
  filters: Partial<Record<CalendarCategory, boolean>>;
  customCategories: CustomCalendarCategory[];
  customFilters: Record<string, boolean>;
  onToggle: (category: CalendarCategory) => void;
  onToggleCustom: (categoryId: string) => void;
  onOpenCategories: () => void;
}) {
  const builtInCategories =
    scope === "personal" ? PERSONAL_CALENDAR_CATEGORIES : CALENDAR_CATEGORIES;

  type ToolCategoryItem =
    | {
        kind: "builtin";
        id: string;
        label: string;
        checked: boolean;
        checkedClassName: string;
        onToggle: () => void;
      }
    | {
        kind: "custom";
        id: string;
        label: string;
        checked: boolean;
        checkedStyle: CSSProperties;
        onToggle: () => void;
      };

  const builtinCheckedClassName: Partial<Record<CalendarCategory, string>> = {
    production: "border-black bg-red-200 text-red-950",
    finishing: "border-black bg-blue-200 text-blue-950",
    deliveries: "border-black bg-green-200 text-green-950",
    shop_closed: "border-black bg-gray-200 text-gray-900",
    meetings: "border-black bg-red-200 text-red-950",
  };

  const toolItems: ToolCategoryItem[] = [
    ...builtInCategories.map((category) => ({
      kind: "builtin" as const,
      id: category.id,
      label: category.label,
      checked: filters[category.id] ?? true,
      checkedClassName:
        builtinCheckedClassName[category.id] ??
        `${category.dot} border-black text-white`,
      onToggle: () => onToggle(category.id),
    })),
    ...customCategories.map((category) => ({
      kind: "custom" as const,
      id: category.id,
      label: category.label,
      checked: customFilters[category.id] ?? true,
      checkedStyle: customCategoryChipStyle(category.color),
      onToggle: () => onToggleCustom(category.id),
    })),
  ];

  const leftItems = toolItems.slice(0, 5);
  const rightItems = toolItems.slice(5, 10);

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
      <div className="flex min-h-0 flex-1 flex-col border-t border-gray-100 p-5">
        <div className="grid min-h-[11.5rem] flex-1 grid-cols-2 content-start items-start gap-x-4 gap-y-3">
          {toolItems.length === 0 ? (
            <p className="col-span-2 self-start text-sm text-gray-500">
              No categories yet. Use the settings gear to add one.
            </p>
          ) : (
            <>
              <ul className="min-w-0 space-y-3">
                {leftItems.map((item) => (
                  <li key={item.id}>
                    {item.kind === "builtin" ? (
                      <CategoryCheckboxRow
                        label={item.label}
                        checked={item.checked}
                        checkedClassName={item.checkedClassName}
                        onToggle={item.onToggle}
                      />
                    ) : (
                      <CategoryCheckboxRow
                        label={item.label}
                        checked={item.checked}
                        checkedClassName="border-black"
                        checkedStyle={item.checkedStyle}
                        onToggle={item.onToggle}
                      />
                    )}
                  </li>
                ))}
              </ul>
              <ul className="min-w-0 space-y-3">
                {rightItems.map((item) => (
                  <li key={item.id}>
                    {item.kind === "builtin" ? (
                      <CategoryCheckboxRow
                        label={item.label}
                        checked={item.checked}
                        checkedClassName={item.checkedClassName}
                        onToggle={item.onToggle}
                      />
                    ) : (
                      <CategoryCheckboxRow
                        label={item.label}
                        checked={item.checked}
                        checkedClassName="border-black"
                        checkedStyle={item.checkedStyle}
                        onToggle={item.onToggle}
                      />
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <div className="mt-4 flex items-center justify-end gap-3 border-t border-gray-100 pt-3">
          <button
            type="button"
            onClick={onOpenCategories}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            aria-label="Manage categories"
            title="Categories"
          >
            <IconSettings size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}

function eventDescriptionLabel(description: string | null | undefined): string {
  const trimmed = getEventDisplayDescription(description);
  return trimmed ? trimmed : "No description";
}

function resolveCustomCategory(
  event: EnrichedCalendarEvent,
  customCategories: CustomCalendarCategory[]
): CustomCalendarCategory | null {
  const meta = parseCustomCategoryDescription(event.description);
  if (!meta) return null;
  return customCategories.find((category) => category.id === meta.category_id) ?? null;
}

function EventBlock({
  event,
  selected,
  onSelect,
  compact,
  customCategories = [],
}: {
  event: EnrichedCalendarEvent;
  selected?: boolean;
  onSelect: () => void;
  compact?: boolean;
  customCategories?: CustomCalendarCategory[];
}) {
  const custom = resolveCustomCategory(event, customCategories);
  const styles = getCategoryStyles(event.category);
  const customStyle = custom ? customCategoryChipStyle(custom.color) : undefined;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`block w-full rounded-md px-2 py-1.5 text-left transition-shadow ${
        custom ? "border border-black" : `border-l-4 ${styles.bg} ${styles.border}`
      } ${selected ? "ring-2 ring-burgundy ring-offset-1" : "hover:opacity-90"} ${
        compact ? "truncate" : ""
      }`}
      style={customStyle}
    >
      {event.isAllDay ? (
        <p className={`text-[10px] font-medium ${custom ? "" : styles.text}`}>
          All day
        </p>
      ) : (
        <p className={`text-[10px] font-medium ${custom ? "" : styles.text}`}>
          {formatTimeRange(event.startMinutes, event.endMinutes)}
        </p>
      )}
      <p className={`text-xs font-semibold ${custom ? "" : styles.text}`}>
        {event.title}
      </p>
      {!compact && (
        <p className={`text-[10px] opacity-80 ${custom ? "" : styles.text}`}>
          {eventDescriptionLabel(event.description)}
        </p>
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
  onView,
  onEdit,
  onDelete,
  customCategories = [],
}: {
  event: EnrichedCalendarEvent;
  selected?: boolean;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  customCategories?: CustomCalendarCategory[];
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isRecurring = Boolean(event.recurrence_series_id);
  const scheduleMeta = parseScheduleBubbleDescription(event.description);
  if (scheduleMeta) {
    const bubble = scheduleBubbleFromMeta(event.title, scheduleMeta);
    return (
      <div className={selected ? "rounded ring-2 ring-burgundy ring-offset-1" : ""}>
        <ScheduleBubbleChip bubble={bubble} color={scheduleMeta.color} size="md" />
      </div>
    );
  }

  const custom = resolveCustomCategory(event, customCategories);
  const styles = getCategoryStyles(event.category);
  const customStyle = custom ? customCategoryChipStyle(custom.color) : undefined;

  return (
    <div
      className={`relative flex items-start gap-2 rounded-md px-2 py-1.5 ${
        custom ? "border border-black" : `border-l-4 ${styles.bg} ${styles.border}`
      } ${selected ? "ring-2 ring-burgundy ring-offset-1" : ""}`}
      style={customStyle}
    >
      <button
        type="button"
        onClick={onView}
        className="min-w-0 flex-1 text-left"
      >
        {event.isAllDay ? (
          <p className={`text-[10px] font-medium ${custom ? "" : styles.text}`}>
            All day
          </p>
        ) : (
          <p className={`text-[10px] font-medium ${custom ? "" : styles.text}`}>
            {formatTimeRange(event.startMinutes, event.endMinutes)}
          </p>
        )}
        <p className={`text-sm font-semibold ${custom ? "" : styles.text}`}>
          {event.title}
        </p>
        <p className={`text-xs opacity-80 ${custom ? "" : styles.text}`}>
          {eventDescriptionLabel(event.description)}
        </p>
      </button>
      {isRecurring ? (
        <span
          className={`inline-flex shrink-0 items-center gap-1 self-center text-[10px] font-medium opacity-90 ${
            custom ? "" : styles.text
          }`}
          title="Recurring event"
        >
          <IconRepeat size={12} className="shrink-0" />
          Recurring
        </span>
      ) : null}
      <div className="relative shrink-0 self-center">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((open) => !open);
          }}
          className="rounded p-1.5 text-gray-500 hover:bg-white/70 hover:text-gray-800"
          aria-label="Event options"
          aria-expanded={menuOpen}
        >
          <IconDotsVertical size={16} />
        </button>
        {menuOpen ? (
          <>
            <button
              type="button"
              className="fixed inset-0 z-[70] cursor-default"
              aria-label="Close event options"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute right-0 top-full z-[71] mt-1 w-36 overflow-hidden rounded-md border border-gray-200 bg-white py-1 shadow-lg">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onEdit();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                <IconPencil size={14} />
                Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
              >
                <IconTrash size={14} />
                Delete
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function EventViewModal({
  event,
  customCategories = [],
  onClose,
}: {
  event: EnrichedCalendarEvent;
  customCategories?: CustomCalendarCategory[];
  onClose: () => void;
}) {
  const custom = resolveCustomCategory(event, customCategories);
  const styles = getCategoryStyles(event.category);
  const eventDate = new Date(`${event.event_date}T12:00:00`);
  const categoryLabel = custom?.label ?? styles.label;
  const headerStyle = custom ? customCategoryChipStyle(custom.color) : undefined;

  return (
    <Modal title="Event details" className="w-full max-w-md" onClose={onClose}>
      <div className="space-y-5">
        <div
          className={`rounded-md px-3 py-2.5 ${
            custom ? "border border-black" : `border-l-4 ${styles.bg} ${styles.border}`
          }`}
          style={headerStyle}
        >
          <p className={`text-sm opacity-80 ${custom ? "" : styles.text}`}>
            {categoryLabel}
          </p>
          <p className={`mt-0.5 text-lg font-semibold ${custom ? "" : styles.text}`}>
            {event.title}
          </p>
        </div>

        <dl className="space-y-4 text-sm">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Date
            </dt>
            <dd className="mt-1 text-gray-900">{formatFullDate(eventDate)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Time
            </dt>
            <dd className="mt-1 text-gray-900">
              {event.isAllDay
                ? "All day"
                : formatTimeRange(event.startMinutes, event.endMinutes)}
            </dd>
          </div>
          {event.recurrence_series_id ? (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Series
              </dt>
              <dd className="mt-1 flex items-center gap-1.5 text-gray-900">
                <IconRepeat size={14} className="text-burgundy" />
                Recurring event
              </dd>
            </div>
          ) : null}
          {event.location?.trim() ? (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Location
              </dt>
              <dd className="mt-1 text-gray-900">{event.location.trim()}</dd>
            </div>
          ) : null}
          {event.reminder_minutes && event.reminder_minutes > 0 ? (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Reminder
              </dt>
              <dd className="mt-1 text-gray-900">
                {event.reminder_minutes} minute
                {event.reminder_minutes === 1 ? "" : "s"} before
              </dd>
            </div>
          ) : null}
          {event.jobNumber ? (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Job
              </dt>
              <dd className="mt-1 text-gray-900">
                {event.jobNumber}
                {event.clientName && event.clientName !== "—"
                  ? ` · ${event.clientName}`
                  : ""}
              </dd>
            </div>
          ) : null}
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Description
            </dt>
            <dd className="mt-1 whitespace-pre-wrap text-gray-900">
              {eventDescriptionLabel(event.description)}
            </dd>
          </div>
        </dl>

        <div className="flex justify-end pt-1">
          <Button type="button" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ShopClosedReasonModal({
  date,
  reason,
  saving,
  error,
  onReasonChange,
  onSave,
  onCancel,
}: {
  date: Date;
  reason: string;
  saving?: boolean;
  error?: string | null;
  onReasonChange: (reason: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const canSave = reason.trim().length > 0 && !saving;

  return (
    <Modal title="Shop Closed" className="w-full max-w-md" onClose={onCancel}>
      <div className="flex min-h-0 flex-1 flex-col">
        <p className="mb-3 text-sm text-gray-600">
          Enter the reason the shop is closed on {formatFullDate(date)}.
        </p>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Reason
        </label>
        <textarea
          autoFocus
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          rows={4}
          placeholder="e.g. Holiday, inventory day, weather…"
          className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSave) {
              e.preventDefault();
              onSave();
            }
          }}
        />
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={!canSave}
            onClick={onSave}
          >
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function DatePreviewModal({
  date,
  events,
  selectedEventId,
  shopClosedEvent,
  customCategories = [],
  onAdd,
  onView,
  onEdit,
  onDelete,
  onToggleShopClosed,
  onClose,
}: {
  date: Date;
  events: EnrichedCalendarEvent[];
  selectedEventId: string | null;
  shopClosedEvent: EnrichedCalendarEvent | null;
  customCategories?: CustomCalendarCategory[];
  onAdd: () => void;
  onView: (event: EnrichedCalendarEvent) => void;
  onEdit: (event: EnrichedCalendarEvent) => void;
  onDelete: (event: EnrichedCalendarEvent) => void;
  onToggleShopClosed: (checked: boolean) => void;
  onClose: () => void;
}) {
  const todayKey = formatDateKey(new Date());
  const dateKey = formatDateKey(date);
  const isToday = dateKey === todayKey;
  const dayEvents = events.filter((event) => !isShopClosedEvent(event));

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
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-5">
          <div className="flex min-w-0 items-center gap-5">
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
            <div className="min-w-0">
              <h2
                id="date-preview-title"
                className="text-2xl font-semibold text-gray-900"
              >
                {formatFullDate(date)}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {shopClosedEvent
                  ? "Shop closed"
                  : dayEvents.length === 0
                    ? "No events scheduled"
                    : `${dayEvents.length} event${dayEvents.length === 1 ? "" : "s"}`}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              ✕
            </button>
            <label className="flex cursor-pointer items-center gap-2 select-none">
              <input
                type="checkbox"
                checked={!!shopClosedEvent}
                onChange={(e) => onToggleShopClosed(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-burgundy focus:ring-burgundy"
              />
              <span className="text-sm font-medium text-gray-900">
                Shop Closed
              </span>
            </label>
          </div>
        </div>

        <div className="px-6 pb-8 pt-4">
          {shopClosedEvent?.description?.trim() ? (
            <div className="mb-4 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
              <span className="font-medium text-gray-900">Closure reason: </span>
              {shopClosedEvent.description.trim()}
            </div>
          ) : null}
          {dayEvents.length > 0 ? (
            <div className="mb-6 space-y-2">
              {dayEvents.map((ev) => (
                <DatePreviewEventRow
                  key={ev.id}
                  event={ev}
                  selected={selectedEventId === ev.id}
                  customCategories={customCategories}
                  onView={() => onView(ev)}
                  onEdit={() => onEdit(ev)}
                  onDelete={() => onDelete(ev)}
                />
              ))}
            </div>
          ) : (
            <p className="mb-6 text-sm text-gray-500">
              {shopClosedEvent
                ? "No other events scheduled for this date."
                : "Nothing scheduled for this date."}
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

function ScheduleEditorModal({
  jobId,
  jobName,
  clientName,
  monthDate,
  todayKey,
  eventsByDay,
  birthdayByDate,
  selectedEventId,
  onOpenDate,
  onClose,
  onSaved,
}: {
  jobId: string;
  jobName: string;
  clientName: string;
  monthDate: Date;
  todayKey: string;
  eventsByDay: Map<string, EnrichedCalendarEvent[]>;
  birthdayByDate?: Map<string, { firstName: string; age: number }[]>;
  selectedEventId: string | null;
  onOpenDate: (date: Date) => void;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { phaseDates, selectedColor } = useProductionSchedule();
  const supabase = useMemo(() => createClient(), []);
  const calendarContainerRef = useRef<HTMLDivElement>(null);
  const [editorMonth, setEditorMonth] = useState(() => {
    const iso =
      phaseDates.fabricating ??
      phaseDates.finishing ??
      phaseDates.delivery;
    return iso ? new Date(`${iso}T12:00:00`) : new Date(monthDate);
  });

  useEffect(() => {
    const el = calendarContainerRef.current;
    if (!el) return;

    let accumulatedDelta = 0;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      accumulatedDelta += event.deltaY;
      if (Math.abs(accumulatedDelta) < 48) return;

      const delta = accumulatedDelta > 0 ? 1 : -1;
      accumulatedDelta = 0;
      setEditorMonth((prev) => {
        const next = new Date(prev);
        next.setMonth(next.getMonth() + delta);
        return next;
      });
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function shiftEditorMonth(delta: number) {
    setEditorMonth((prev) => {
      const next = new Date(prev);
      next.setMonth(next.getMonth() + delta);
      return next;
    });
  }

  const monthLabel = editorMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  async function handleSave() {
    const result = await saveJobSchedule(
      supabase,
      jobId,
      jobName,
      phaseDates,
      selectedColor
    );
    if (!result.error) {
      await onSaved();
      onClose();
    }
    return result;
  }

  return (
    <div className="fixed top-[0.5in] right-[1in] bottom-[0.5in] left-[1in] z-[100] flex flex-col overflow-hidden border border-gray-200 bg-white shadow-xl">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="flex min-h-0 w-1/4 flex-col border-r border-gray-200 bg-white">
            <div className="flex h-14 shrink-0 items-center border-b border-gray-200 px-4">
              <p className="truncate text-base font-semibold text-gray-900">
                {clientName && clientName !== "—"
                  ? `${jobName}-${clientName}`
                  : jobName}
              </p>
            </div>
            <ProductionSchedulePanel />
          </div>
          <div
            ref={calendarContainerRef}
            className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white"
          >
            <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-gray-200 px-4 py-2.5">
              <h2 className="text-sm font-semibold text-gray-900">
                Production Calendar
              </h2>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => shiftEditorMonth(-1)}
                  className="rounded-md border border-gray-300 p-1.5 hover:bg-gray-50"
                  aria-label="Previous month"
                >
                  <IconChevronLeft size={18} />
                </button>
                <h2 className="min-w-[10rem] truncate text-center text-sm font-semibold text-gray-900">
                  {monthLabel}
                </h2>
                <button
                  type="button"
                  onClick={() => shiftEditorMonth(1)}
                  className="rounded-md border border-gray-300 p-1.5 hover:bg-gray-50"
                  aria-label="Next month"
                >
                  <IconChevronRight size={18} />
                </button>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="justify-self-end rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                aria-label="Close"
              >
                <IconX size={18} />
              </button>
            </div>
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
              <MonthGridView
                monthDate={editorMonth}
                eventsByDay={eventsByDay}
                birthdayByDate={birthdayByDate}
                todayKey={todayKey}
                selectedEventId={selectedEventId}
                onOpenDate={onOpenDate}
                className="grid min-h-0 flex-1 grid-cols-7 grid-rows-5"
              />
            </div>
          </div>
        </div>
        <ProductionScheduleFooter onSave={handleSave} onCancel={onClose} />
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const isEmbedded = useCalendarEmbed();
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
  const [viewingEvent, setViewingEvent] = useState<EnrichedCalendarEvent | null>(
    null
  );
  const [shopClosedReasonOpen, setShopClosedReasonOpen] = useState(false);
  const [shopClosedReason, setShopClosedReason] = useState("");
  const [shopClosedSaving, setShopClosedSaving] = useState(false);
  const [shopClosedError, setShopClosedError] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<EnrichedCalendarEvent | null>(
    null
  );
  const [form, setForm] = useState(defaultEventForm);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [recurrenceRule, setRecurrenceRule] = useState<RecurrenceRule | null>(
    null
  );
  const [showRecurrenceModal, setShowRecurrenceModal] = useState(false);
  const [reminderConfigured, setReminderConfigured] = useState(false);
  const [categoryFilters, setCategoryFilters] = useState(defaultCategoryFilters);
  const [personalCategoryFilters, setPersonalCategoryFilters] = useState(
    defaultPersonalCategoryFilters
  );
  const [customCategories, setCustomCategories] = useState<CustomCalendarCategory[]>(
    []
  );
  const [customCategoryFilters, setCustomCategoryFilters] = useState<
    Record<string, boolean>
  >({});
  const [customCategoriesReady, setCustomCategoriesReady] = useState(false);
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [isCalendarFullscreen, setIsCalendarFullscreen] = useState(false);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  const [addCategoryName, setAddCategoryName] = useState("");
  const [addCategoryColor, setAddCategoryColor] = useState<string>(
    CALENDAR_COLOR_PALETTE[0]
  );
  const [scheduleContextMenu, setScheduleContextMenu] = useState<{
    x: number;
    y: number;
    jobId: string;
    jobName: string;
    clientName: string;
    eventId: string;
    phaseKind: ScheduleBubbleKind;
    currentDate: string;
    color: ScheduleColor;
  } | null>(null);
  const [scheduleMoveTarget, setScheduleMoveTarget] = useState<{
    eventId: string;
    jobId: string;
    jobName: string;
    phaseKind: ScheduleBubbleKind;
    currentDate: string;
    color: ScheduleColor;
  } | null>(null);
  const [scheduleEditor, setScheduleEditor] = useState<{
    jobId: string;
    jobName: string;
    clientName: string;
    phaseDates: { fabricating: string | null; finishing: string | null; delivery: string | null };
    color: ScheduleColor;
  } | null>(null);
  const [employeeBirthdaysByDate, setEmployeeBirthdaysByDate] = useState<
    Map<string, { firstName: string; age: number }[]>
  >(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const calendarContainerRef = useRef<HTMLDivElement>(null);
  const loadSeq = useRef(0);
  const monthArrowHoverRef = useRef<number | null>(null);

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

    const { data: contactsData } = await supabase
      .from("contacts")
      .select("name, birthday, contact_type")
      .eq("contact_type", "Employees")
      .not("birthday", "is", null);

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

    const birthdayMap = new Map<string, { firstName: string; age: number }[]>();
    const rangeStartDate = new Date(`${rangeStart}T12:00:00`);
    const rangeEndDate = new Date(`${rangeEnd}T12:00:00`);
    const startYear = rangeStartDate.getFullYear();
    const endYear = rangeEndDate.getFullYear();
    for (const row of
      ((contactsData as { name: string; birthday: string | null }[] | null) ?? [])) {
      if (!row.birthday) continue;
      const birth = new Date(`${row.birthday}T12:00:00`);
      if (Number.isNaN(birth.getTime())) continue;
      const firstName = row.name.trim().split(/\s+/)[0] || row.name.trim();
      for (let year = startYear; year <= endYear; year++) {
        const month = String(birth.getMonth() + 1).padStart(2, "0");
        const day = String(birth.getDate()).padStart(2, "0");
        const key = `${year}-${month}-${day}`;
        if (key < rangeStart || key > rangeEnd) continue;
        const age = year - birth.getFullYear();
        const entry = birthdayMap.get(key) ?? [];
        entry.push({ firstName, age });
        birthdayMap.set(key, entry);
      }
    }
    setEmployeeBirthdaysByDate(birthdayMap);
    setLoading(false);
  }, [focusDate]);

  useEffect(() => {
    if (isEmbedded) {
      setViewMode("month");
    }
  }, [isEmbedded]);

  const applyCustomCategories = useCallback((rows: CustomCalendarCategory[]) => {
    setCustomCategories(rows);
    setCustomCategoryFilters(
      Object.fromEntries(rows.map((category) => [category.id, true]))
    );
    setCustomCategoriesReady(true);
  }, []);

  const loadCustomCategories = useCallback(
    async (userId: string) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("calendar_custom_categories")
        .select("id, label, color, scope")
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Failed to load calendar categories:", error.message);
        applyCustomCategories(loadStoredCustomCategories());
        return;
      }

      let rows = mapCategoryRows(data ?? []);

      try {
        const migrated = window.localStorage.getItem(
          CUSTOM_CATEGORIES_MIGRATED_KEY
        );
        if (!migrated) {
          const stored = loadStoredCustomCategories();
          for (const category of stored) {
            const alreadyThere = rows.some(
              (row) =>
                row.id === category.id ||
                (row.label === category.label && row.scope === category.scope)
            );
            if (alreadyThere) continue;
            const { error: insertError } = await supabase
              .from("calendar_custom_categories")
              .insert({
                id: category.id,
                label: category.label,
                color: category.color,
                scope: category.scope,
                user_id: category.scope === "personal" ? userId : null,
              });
            if (!insertError) {
              rows = [...rows, category];
            }
          }
          window.localStorage.setItem(CUSTOM_CATEGORIES_MIGRATED_KEY, "1");
        }
      } catch {
        // ignore localStorage / migrate failures
      }

      applyCustomCategories(rows);
    },
    [applyCustomCategories]
  );

  useEffect(() => {
    if (!isEmbedded || loading) return;
    const el = calendarContainerRef.current;
    if (!el) return;

    let accumulatedDelta = 0;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      accumulatedDelta += event.deltaY;
      if (Math.abs(accumulatedDelta) < 48) return;

      const delta = accumulatedDelta > 0 ? 1 : -1;
      accumulatedDelta = 0;
      setFocusDate((prev) => {
        const next = new Date(prev);
        next.setMonth(next.getMonth() + delta);
        return next;
      });
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [isEmbedded, loading]);

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
      void loadCustomCategories(user.id);

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
  }, [loadCustomCategories]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    function syncFullscreenState() {
      const el = calendarContainerRef.current;
      const isNative = Boolean(el && document.fullscreenElement === el);
      setIsNativeFullscreen(isNative);
      setIsCalendarFullscreen(isNative);
    }
    document.addEventListener("fullscreenchange", syncFullscreenState);
    return () =>
      document.removeEventListener("fullscreenchange", syncFullscreenState);
  }, []);

  useEffect(() => {
    if (!isCalendarFullscreen || isNativeFullscreen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsCalendarFullscreen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCalendarFullscreen, isNativeFullscreen]);

  async function toggleCalendarFullscreen() {
    const el = calendarContainerRef.current;
    if (!el) return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      await el.requestFullscreen();
    } catch (error) {
      console.error("Fullscreen request failed:", error);
      setIsNativeFullscreen(false);
      setIsCalendarFullscreen((prev) => !prev);
    }
  }

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const visibleEvents = useMemo(
    () => filterByCalendarTab(events, calendarScope, currentUserId),
    [events, calendarScope, currentUserId]
  );

  const scopedCustomCategories = useMemo(
    () => customCategoriesForScope(customCategories, calendarScope),
    [customCategories, calendarScope]
  );

  const activeCategoryFilters =
    calendarScope === "personal" ? personalCategoryFilters : categoryFilters;

  const filteredEvents = useMemo(
    () =>
      visibleEvents.filter((event) => {
        const customMeta = parseCustomCategoryDescription(event.description);
        if (customMeta) {
          if (!(customCategoryFilters[customMeta.category_id] ?? true)) {
            return false;
          }
        } else if (!eventMatchesFilters(event, activeCategoryFilters)) {
          return false;
        }
        if (calendarScope === "production") {
          const scheduleMeta = parseScheduleBubbleDescription(event.description);
          if (scheduleMeta) return isScheduleStartOrDeliveryEvent(event);
        }
        return true;
      }),
    [
      visibleEvents,
      activeCategoryFilters,
      customCategoryFilters,
      calendarScope,
    ]
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
    if (calendarScope === "personal") {
      setPersonalCategoryFilters((prev) => ({
        ...prev,
        [category]: !(prev[category as keyof typeof prev] ?? true),
      }));
      return;
    }
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

  function openCategoriesModal() {
    setAddCategoryName("");
    setAddCategoryColor(CALENDAR_COLOR_PALETTE[0]);
    setShowCategoriesModal(true);
  }

  async function handleCreateCategory() {
    const label = addCategoryName.trim();
    if (!label) return;

    const {
      data: { user },
    } = await createClient().auth.getUser();
    if (!user) return;

    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `custom-${Date.now()}`;

    const nextCategory: CustomCalendarCategory = {
      id,
      label,
      color: addCategoryColor,
      scope: calendarScope,
    };

    const supabase = createClient();
    const { error } = await supabase.from("calendar_custom_categories").insert({
      id,
      label,
      color: addCategoryColor,
      scope: calendarScope,
      user_id: calendarScope === "personal" ? user.id : null,
    });

    if (error) {
      console.error("Failed to create category:", error.message);
      setSaveError(error.message);
      return;
    }

    setCustomCategories((prev) => [...prev, nextCategory]);
    setCustomCategoryFilters((prev) => ({ ...prev, [id]: true }));
    setAddCategoryName("");
    setAddCategoryColor(CALENDAR_COLOR_PALETTE[0]);
  }

  async function handleDeleteCustomCategory(categoryId: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("calendar_custom_categories")
      .delete()
      .eq("id", categoryId);

    if (error) {
      console.error("Failed to delete category:", error.message);
      return;
    }

    setCustomCategories((prev) => prev.filter((category) => category.id !== categoryId));
    setCustomCategoryFilters((prev) => {
      const next = { ...prev };
      delete next[categoryId];
      return next;
    });

    const eventIds = events
      .filter((event) => {
        const meta = parseCustomCategoryDescription(event.description);
        return meta?.category_id === categoryId;
      })
      .map((event) => event.id);

    if (eventIds.length === 0) return;

    setEvents((prev) => prev.filter((event) => !eventIds.includes(event.id)));
    await supabase.from("calendar_events").delete().in("id", eventIds);
    void load();
  }

  async function handleRenameCustomCategory(categoryId: string, nextLabel: string) {
    const label = nextLabel.trim();
    if (!label) return;

    const supabase = createClient();
    const { error } = await supabase
      .from("calendar_custom_categories")
      .update({ label })
      .eq("id", categoryId);

    if (error) {
      console.error("Failed to rename category:", error.message);
      return;
    }

    setCustomCategories((prev) =>
      prev.map((category) =>
        category.id === categoryId ? { ...category, label } : category
      )
    );
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

  function clearMonthArrowHover() {
    if (monthArrowHoverRef.current) {
      window.clearTimeout(monthArrowHoverRef.current);
      monthArrowHoverRef.current = null;
    }
  }

  function monthArrowDragProps(delta: number) {
    if (!scheduleMoveTarget) return {};
    return {
      onDragOver: (e: DragEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (monthArrowHoverRef.current) return;
        monthArrowHoverRef.current = window.setTimeout(() => {
          monthArrowHoverRef.current = null;
          shiftDate(delta);
        }, 1000);
      },
      onDragLeave: (e: DragEvent<HTMLButtonElement>) => {
        const next = e.relatedTarget as Node | null;
        if (next && e.currentTarget.contains(next)) return;
        clearMonthArrowHover();
      },
      onDrop: (e: DragEvent<HTMLButtonElement>) => {
        e.preventDefault();
        clearMonthArrowHover();
      },
    };
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

  function getShopClosedForDate(date: Date): EnrichedCalendarEvent | null {
    const dateKey = formatDateKey(date);
    return (
      events.find(
        (event) => event.event_date === dateKey && isShopClosedEvent(event)
      ) ?? null
    );
  }

  function handleToggleShopClosed(checked: boolean) {
    if (!previewDate) return;
    if (checked) {
      const existing = getShopClosedForDate(previewDate);
      setShopClosedReason(existing?.description?.trim() ?? "");
      setShopClosedError(null);
      setShopClosedReasonOpen(true);
      return;
    }
    const existing = getShopClosedForDate(previewDate);
    if (existing) {
      void handleDeleteEvent(existing);
    }
  }

  async function handleSaveShopClosed() {
    if (!previewDate) return;
    const reason = shopClosedReason.trim();
    if (!reason) {
      setShopClosedError("A reason is required.");
      return;
    }

    setShopClosedSaving(true);
    setShopClosedError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setShopClosedSaving(false);
      setShopClosedError("You must be signed in to save.");
      return;
    }

    const dateKey = formatDateKey(previewDate);
    const existing = getShopClosedForDate(previewDate);
    const payload: Record<string, unknown> = {
      title: "Shop Closed",
      event_type: "shop_closed" as CalendarEventType,
      event_date: dateKey,
      job_id: null,
      is_all_day: true,
      start_time: null,
      end_time: null,
      location: null,
      description: reason,
      user_id: user.id,
      // Always production so every user sees shop closures.
      calendar_scope: "production",
    };

    async function persist(nextPayload: Record<string, unknown>) {
      if (existing) {
        return supabase
          .from("calendar_events")
          .update(nextPayload)
          .eq("id", existing.id)
          .select("*, jobs(id, name, created_at, contacts(name))")
          .single();
      }
      return supabase
        .from("calendar_events")
        .insert(nextPayload)
        .select("*, jobs(id, name, created_at, contacts(name))")
        .single();
    }

    let workingPayload = { ...payload };
    let { data, error } = await persist(workingPayload);

    if (
      error?.message?.includes("invalid input value for enum calendar_event_type")
    ) {
      const fallback = EVENT_TYPE_ENUM_FALLBACK.shop_closed;
      if (fallback) {
        workingPayload = { ...workingPayload, event_type: fallback };
        ({ data, error } = await persist(workingPayload));
      }
    }

    setShopClosedSaving(false);

    if (error || !data) {
      setShopClosedError(
        error?.message?.includes("invalid input value for enum")
          ? `Shop closed type is missing in your database. Run this in the Supabase SQL Editor: ${CALENDAR_ENUM_SETUP_SQL}`
          : (error?.message ?? "Could not save shop closed day.")
      );
      return;
    }

    const enriched = enrichCalendarEvent(data as CalendarEvent, 0);
    setEvents((prev) => {
      const without = prev.filter((event) => event.id !== enriched.id);
      return [...without, enriched];
    });
    setShopClosedReasonOpen(false);
    setShopClosedReason("");
    setPreviewDate(null);
    void load();
  }

  const handleScheduleBubbleContextMenu = useCallback(
    (args: {
      jobId: string;
      jobName: string;
      clientName: string;
      eventId: string;
      phaseKind: ScheduleBubbleKind;
      currentDate: string;
      color: ScheduleColor;
      x: number;
      y: number;
    }) => {
      setScheduleContextMenu({
        x: args.x,
        y: args.y,
        jobId: args.jobId,
        jobName: args.jobName,
        clientName: args.clientName,
        eventId: args.eventId,
        phaseKind: args.phaseKind,
        currentDate: args.currentDate,
        color: args.color,
      });
    },
    []
  );

  const handleMoveScheduleFromMenu = useCallback(() => {
    if (!scheduleContextMenu) return;
    setScheduleMoveTarget({
      eventId: scheduleContextMenu.eventId,
      jobId: scheduleContextMenu.jobId,
      jobName: scheduleContextMenu.jobName,
      phaseKind: scheduleContextMenu.phaseKind,
      currentDate: scheduleContextMenu.currentDate,
      color: scheduleContextMenu.color,
    });
    setScheduleContextMenu(null);
  }, [scheduleContextMenu]);

  const handleScheduleMoveDrop = useCallback(
    async (newDateKey: string) => {
      if (!scheduleMoveTarget) return;
      if (newDateKey === scheduleMoveTarget.currentDate) {
        setScheduleMoveTarget(null);
        return;
      }
      const supabase = createClient();
      const record = await loadJobSchedule(supabase, scheduleMoveTarget.jobId);
      const phaseDates = phaseDatesFromRecord(record);
      const updatedDates = {
        ...phaseDates,
        [scheduleMoveTarget.phaseKind]: newDateKey,
      };
      const { error } = await saveJobSchedule(
        supabase,
        scheduleMoveTarget.jobId,
        scheduleMoveTarget.jobName,
        updatedDates,
        record?.color ?? scheduleMoveTarget.color
      );
      setScheduleMoveTarget(null);
      if (error) {
        setSaveError(error);
        return;
      }
      await load();
    },
    [scheduleMoveTarget, load]
  );

  useEffect(() => {
    if (!scheduleMoveTarget) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setScheduleMoveTarget(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [scheduleMoveTarget]);

  useEffect(() => {
    if (!scheduleMoveTarget) clearMonthArrowHover();
  }, [scheduleMoveTarget]);

  const handleEditScheduleFromMenu = useCallback(async () => {
    if (!scheduleContextMenu) return;
    const supabase = createClient();
    const record = await loadJobSchedule(supabase, scheduleContextMenu.jobId);
    setScheduleEditor({
      jobId: scheduleContextMenu.jobId,
      jobName: scheduleContextMenu.jobName,
      clientName: scheduleContextMenu.clientName,
      phaseDates: phaseDatesFromRecord(record),
      color: record?.color ?? "red",
    });
    setScheduleContextMenu(null);
  }, [scheduleContextMenu]);

  const handleRemoveScheduleFromMenu = useCallback(async () => {
    if (!scheduleContextMenu) return;
    const supabase = createClient();
    const { error } = await removeJobSchedule(supabase, scheduleContextMenu.jobId);
    setScheduleContextMenu(null);
    if (error) {
      setSaveError(error);
      return;
    }
    await load();
  }, [scheduleContextMenu, load]);

  function openCreateModal(forDate?: Date) {
    if (forDate) {
      setFocusDate(forDate);
    }
    const dateKey = forDate ? formatDateKey(forDate) : focusKey;
    setEditingEvent(null);
    setForm(defaultEventForm(dateKey, calendarScope, scopedCustomCategories));
    setRecurrenceRule(null);
    setReminderConfigured(false);
    resetAttachment();
    setSaveError(null);
    setViewingEvent(null);
    setPreviewDate(null);
    setShowModal(true);
  }

  function openViewEvent(event: EnrichedCalendarEvent) {
    setViewingEvent(event);
  }

  function openEditModal(event: EnrichedCalendarEvent) {
    resetAttachment();
    setSaveError(null);
    setEditingEvent(event);
    const customMeta = parseCustomCategoryDescription(event.description);
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
      description: customMeta
        ? (customMeta.body ?? "")
        : (event.description ?? ""),
      remind_me: Boolean(event.reminder_minutes && event.reminder_minutes > 0),
      reminder_minutes:
        event.reminder_minutes && event.reminder_minutes > 0
          ? String(event.reminder_minutes)
          : "",
      custom_category_id: customMeta?.category_id ?? "",
    });
    const seriesRule = event.recurrence_series_id
      ? buildRuleFromSeries(event, events)
      : null;
    setRecurrenceRule(seriesRule);
    setReminderConfigured(
      Boolean(event.reminder_minutes && event.reminder_minutes > 0)
    );
    setViewingEvent(null);
    setPreviewDate(null);
    setShowModal(true);
    if (event.recurrence_series_id) {
      setShowRecurrenceModal(true);
    }
  }

  async function handleRemoveRecurrence() {
    const seriesId = editingEvent?.recurrence_series_id;
    if (!seriesId || !editingEvent) {
      setRecurrenceRule(null);
      setShowRecurrenceModal(false);
      return;
    }

    const supabase = createClient();
    await supabase
      .from("calendar_events")
      .delete()
      .eq("recurrence_series_id", seriesId)
      .neq("id", editingEvent.id);
    await supabase
      .from("calendar_events")
      .update({ recurrence_series_id: null })
      .eq("id", editingEvent.id);

    setEvents((prev) =>
      prev
        .filter(
          (ev) =>
            ev.recurrence_series_id !== seriesId || ev.id === editingEvent.id
        )
        .map((ev) =>
          ev.id === editingEvent.id
            ? { ...ev, recurrence_series_id: null }
            : ev
        )
    );
    setEditingEvent({ ...editingEvent, recurrence_series_id: null });
    setRecurrenceRule(null);
    setShowRecurrenceModal(false);
    void load();
  }

  async function handleDeleteEvent(event: EnrichedCalendarEvent) {
    const supabase = createClient();
    await supabase.from("calendar_events").delete().eq("id", event.id);
    setEvents((prev) => prev.filter((ev) => ev.id !== event.id));
    setSelectedEventId((current) => (current === event.id ? null : current));
    setViewingEvent((current) => (current?.id === event.id ? null : current));
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

    if (calendarScope === "personal" && !form.custom_category_id) {
      setSaveError("Choose a category for this event.");
      return;
    }

    const reminderMinutes = form.remind_me
      ? Number.parseInt(form.reminder_minutes, 10)
      : null;
    if (
      form.remind_me &&
      (!Number.isFinite(reminderMinutes) || (reminderMinutes ?? 0) <= 0)
    ) {
      setSaveError("Enter how many minutes before the event to remind you.");
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

    const description = form.custom_category_id
      ? encodeCustomCategoryDescription(
          form.custom_category_id,
          form.description
        )
      : form.description.trim() || null;

    const basePayload: Record<string, unknown> = {
      title: form.title.trim(),
      event_type: form.event_type,
      event_date: form.event_date,
      job_id: form.job_id || null,
      is_all_day: form.is_all_day,
      start_time: form.is_all_day ? null : form.start_time,
      end_time: form.is_all_day ? null : form.end_time,
      location: form.location.trim() || null,
      description,
      reminder_minutes: form.remind_me ? reminderMinutes : null,
      // Always stamp scope from the active calendar tab.
      // Personal events must be owned by the signed-in user.
      user_id:
        calendarScope === "personal"
          ? user.id
          : (editingEvent?.user_id ?? user.id),
      calendar_scope: calendarScope,
    };

    // Never strip user_id / calendar_scope — privacy depends on them.
    const optionalFields = [
      "description",
      "location",
      "end_time",
      "start_time",
      "is_all_day",
      "reminder_minutes",
      "recurrence_series_id",
    ] as const;

    function applyEnumFallback(payload: Record<string, unknown>) {
      const requested = payload.event_type as CalendarEventType;
      const fallback = EVENT_TYPE_ENUM_FALLBACK[requested];
      return fallback ? { ...payload, event_type: fallback } : payload;
    }

    function stripOptionalField(
      payload: Record<string, unknown>,
      errorMessage: string
    ): Record<string, unknown> | null {
      const missing =
        errorMessage.match(/'([^']+)' column/i)?.[1] ??
        optionalFields.find((field) =>
          errorMessage.toLowerCase().includes(field)
        );
      if (!missing || !(missing in payload)) return null;
      if (missing === "user_id" || missing === "calendar_scope") return null;
      const { [missing]: _removed, ...rest } = payload;
      return rest;
    }

    function saveErrorMessage(error: { message?: string } | null): string {
      const privacyMissing =
        error?.message?.toLowerCase().includes("user_id") ||
        error?.message?.toLowerCase().includes("calendar_scope");
      const enumMissing = error?.message?.includes(
        "invalid input value for enum calendar_event_type"
      );
      if (privacyMissing) {
        return "Personal calendar privacy columns are missing. Run 20260727000004_calendar_events_full_setup.sql in the Supabase SQL Editor, then try again.";
      }
      if (enumMissing) {
        return `Event type "${form.event_type}" is not in your database yet. Run this in the Supabase SQL Editor: ${CALENDAR_ENUM_SETUP_SQL}`;
      }
      return (
        error?.message ??
        "Could not save event. Your database may be missing calendar columns — run the calendar setup SQL in Supabase."
      );
    }

    if (recurrenceRule) {
      const dates = expandRecurrenceDates(recurrenceRule);
      if (dates.length === 0) {
        setSaving(false);
        setSaveError(
          "Recurrence produced no dates. Check the pattern and end range."
        );
        return;
      }

      const seriesId =
        editingEvent?.recurrence_series_id ??
        (typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

      const occurrencePayload = (date: string): Record<string, unknown> => ({
        ...basePayload,
        event_date: date,
        is_all_day: recurrenceRule.isAllDay,
        start_time: recurrenceRule.isAllDay ? null : recurrenceRule.startTime,
        end_time: recurrenceRule.isAllDay ? null : recurrenceRule.endTime,
        recurrence_series_id: seriesId,
      });

      async function insertMany(rows: Record<string, unknown>[]) {
        let working = rows.map((row) => ({ ...row }));
        let { data, error } = await supabase
          .from("calendar_events")
          .insert(working)
          .select("*, jobs(id, name, created_at, contacts(name))");

        if (
          error?.message?.includes(
            "invalid input value for enum calendar_event_type"
          )
        ) {
          working = working.map(applyEnumFallback);
          ({ data, error } = await supabase
            .from("calendar_events")
            .insert(working)
            .select("*, jobs(id, name, created_at, contacts(name))"));
        }

        for (let attempt = 0; attempt < optionalFields.length && error; attempt++) {
          const stripped = stripOptionalField(working[0]!, error.message);
          if (!stripped) break;
          working = working.map((row) => {
            const next = stripOptionalField(row, error!.message);
            return next ?? row;
          });
          ({ data, error } = await supabase
            .from("calendar_events")
            .insert(working)
            .select("*, jobs(id, name, created_at, contacts(name))"));
        }

        return { data, error };
      }

      async function updateOne(
        id: string,
        payload: Record<string, unknown>
      ) {
        let working = { ...payload };
        let { data, error } = await supabase
          .from("calendar_events")
          .update(working)
          .eq("id", id)
          .select("*, jobs(id, name, created_at, contacts(name))")
          .single();

        if (
          error?.message?.includes(
            "invalid input value for enum calendar_event_type"
          )
        ) {
          working = applyEnumFallback(working);
          ({ data, error } = await supabase
            .from("calendar_events")
            .update(working)
            .eq("id", id)
            .select("*, jobs(id, name, created_at, contacts(name))")
            .single());
        }

        for (let attempt = 0; attempt < optionalFields.length && error; attempt++) {
          const next = stripOptionalField(working, error.message);
          if (!next) break;
          working = next;
          ({ data, error } = await supabase
            .from("calendar_events")
            .update(working)
            .eq("id", id)
            .select("*, jobs(id, name, created_at, contacts(name))")
            .single());
        }

        return { data, error };
      }

      const anchorDate = dates.includes(form.event_date)
        ? form.event_date
        : dates[0]!;
      const insertDates = dates.filter((date) => date !== anchorDate);
      const insertRows = insertDates.map(occurrencePayload);

      let updateError: { message?: string } | null = null;
      let insertError: { message?: string } | null = null;
      let savedRows: CalendarEvent[] = [];

      if (editingEvent?.recurrence_series_id) {
        await supabase
          .from("calendar_events")
          .delete()
          .eq("recurrence_series_id", editingEvent.recurrence_series_id)
          .neq("id", editingEvent.id);
      }

      if (editingEvent) {
        const { data, error } = await updateOne(
          editingEvent.id,
          occurrencePayload(anchorDate)
        );
        updateError = error;
        if (data) savedRows = [data as CalendarEvent];
      } else {
        insertRows.unshift(occurrencePayload(anchorDate));
      }

      if (!updateError && insertRows.length > 0) {
        const { data, error } = await insertMany(insertRows);
        insertError = error;
        if (data) {
          savedRows = [...savedRows, ...(data as CalendarEvent[])];
        }
      }

      setSaving(false);

      if (updateError || insertError || savedRows.length === 0) {
        setSaveError(saveErrorMessage(updateError ?? insertError));
        return;
      }

      if (calendarScope === "personal") {
        const leaked = savedRows.filter(
          (row) => row.calendar_scope !== "personal" || row.user_id !== user.id
        );
        if (leaked.length > 0) {
          setSaveError(
            "Personal event could not be saved privately. Run the calendar privacy SQL in Supabase, then try again."
          );
          await supabase
            .from("calendar_events")
            .delete()
            .in(
              "id",
              leaked.map((row) => row.id)
            );
          return;
        }
      }

      const enriched = savedRows.map((row, index) =>
        enrichCalendarEvent(
          {
            ...row,
            calendar_scope: row.calendar_scope ?? calendarScope,
            user_id: row.user_id ?? user.id,
          },
          events.length + index
        )
      );
      setEvents((prev) => {
        const removeIds = new Set(enriched.map((ev) => ev.id));
        const oldSeries = editingEvent?.recurrence_series_id;
        const without = prev.filter((ev) => {
          if (removeIds.has(ev.id)) return false;
          if (
            oldSeries &&
            ev.recurrence_series_id === oldSeries &&
            ev.id !== editingEvent?.id
          ) {
            return false;
          }
          return true;
        });
        return [...without, ...enriched].sort((a, b) =>
          a.event_date.localeCompare(b.event_date)
        );
      });
      const focus = enriched[0]!;
      setFocusDate(new Date(`${focus.event_date}T12:00:00`));
      setSelectedEventId(focus.id);
      setShowModal(false);
      setEditingEvent(null);
      setRecurrenceRule(null);
      resetAttachment();
      void load();
      return;
    }

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

    let workingPayload = { ...basePayload };
    let { data, error } = await persist(workingPayload);

    if (
      error?.message?.includes("invalid input value for enum calendar_event_type")
    ) {
      workingPayload = applyEnumFallback(workingPayload);
      ({ data, error } = await persist(workingPayload));
    }

    // Strip unknown optional columns one-by-one if the live DB is behind migrations.
    for (let attempt = 0; attempt < optionalFields.length && error; attempt++) {
      const next = stripOptionalField(workingPayload, error.message);
      if (!next) break;
      workingPayload = next;
      ({ data, error } = await persist(workingPayload));
    }

    setSaving(false);

    if (error || !data) {
      setSaveError(saveErrorMessage(error));
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
    setRecurrenceRule(null);
    resetAttachment();
    // Refresh in the background; stale responses are ignored via loadSeq.
    void load();
  }

  const monthDate = focusDate;

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
    <div
      className={`flex min-h-0 flex-col overflow-hidden ${
        isEmbedded ? "h-full" : "h-[calc(100vh-2.5rem)]"
      }`}
    >
      <div
        className={`grid min-h-0 flex-1 items-stretch gap-4 ${
          isEmbedded ? "grid-cols-1" : "grid-cols-1 xl:grid-cols-[1fr_320px]"
        }`}
      >
        <div className="flex min-h-0 min-w-0 flex-col">
          {!isCalendarFullscreen && !isEmbedded ? (
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
          ) : null}
          {loading ? (
            <p className="text-gray-500">Loading…</p>
          ) : (
            <div
              ref={calendarContainerRef}
              className={`flex min-h-0 flex-1 flex-col overflow-hidden bg-white ${
                isCalendarFullscreen
                  ? isNativeFullscreen
                    ? "h-full w-full"
                    : "fixed inset-0 z-[100] h-full w-full"
                  : isEmbedded
                    ? "h-full"
                    : "rounded-lg border border-gray-200"
              }`}
            >
              {isEmbedded ? (
                <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-gray-200 px-4 py-2.5">
                  <h2 className="text-sm font-semibold text-gray-900">Production Calendar</h2>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => shiftDate(-1)}
                      {...monthArrowDragProps(-1)}
                      className="rounded-md border border-gray-300 p-1.5 hover:bg-gray-50"
                      aria-label="Previous month"
                    >
                      <IconChevronLeft size={18} />
                    </button>
                    <h2 className="min-w-[10rem] truncate text-center text-sm font-semibold text-gray-900">
                      {calendarHeaderLabel}
                    </h2>
                    <button
                      type="button"
                      onClick={() => shiftDate(1)}
                      {...monthArrowDragProps(1)}
                      className="rounded-md border border-gray-300 p-1.5 hover:bg-gray-50"
                      aria-label="Next month"
                    >
                      <IconChevronRight size={18} />
                    </button>
                  </div>
                  <div />
                </div>
              ) : (
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
                    {...monthArrowDragProps(-1)}
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
                    {...monthArrowDragProps(1)}
                    className="rounded-md border border-gray-300 p-1.5 hover:bg-gray-50"
                    aria-label="Next"
                  >
                    <IconChevronRight size={18} />
                  </button>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => void toggleCalendarFullscreen()}
                    className="rounded-md border border-gray-300 p-1.5 text-gray-600 hover:bg-gray-50"
                    aria-label={
                      isCalendarFullscreen ? "Exit full screen" : "Full screen"
                    }
                  >
                    {isCalendarFullscreen ? (
                      <IconArrowsMinimize size={18} />
                    ) : (
                      <IconArrowsMaximize size={18} />
                    )}
                  </button>
                </div>
              </div>
              )}

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
                          customCategories={customCategories}
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
                          customCategories={customCategories}
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
                            customCategories={customCategories}
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
                <MonthGridView
                  monthDate={monthDate}
                  eventsByDay={eventsByDay}
                  todayKey={todayKey}
                  selectedEventId={selectedEventId}
                  onOpenDate={openDatePreview}
                  onScheduleContextMenu={handleScheduleBubbleContextMenu}
                  scheduleMoveEventId={scheduleMoveTarget?.eventId ?? null}
                  onScheduleMoveDrop={(dateKey) =>
                    void handleScheduleMoveDrop(dateKey)
                  }
                  customCategories={customCategories}
                  birthdayByDate={
                    calendarScope === "production" ? employeeBirthdaysByDate : undefined
                  }
                />
              </div>
              )}
            </div>
          )}
        </div>

        {!isCalendarFullscreen && !isEmbedded ? (
        <div className="flex min-h-0 flex-col gap-3 xl:h-full">
          <MiniCalendar
            displayDate={viewMode === "week" ? weekStart : focusDate}
            focusDate={focusDate}
            onSelectDate={openDatePreview}
            onShiftMonth={shiftMonth}
          />
          <AddEventButton onClick={() => openCreateModal()} />
          <CalendarToolsPanel
            scope={calendarScope}
            filters={activeCategoryFilters}
            customCategories={scopedCustomCategories}
            customFilters={customCategoryFilters}
            onToggle={toggleCategoryFilter}
            onToggleCustom={toggleCustomCategoryFilter}
            onOpenCategories={openCategoriesModal}
          />
        </div>
        ) : null}
      </div>

      {scheduleContextMenu ? (
        <>
          <button
            type="button"
            aria-label="Close schedule menu"
            className="fixed inset-0 z-[90] cursor-default bg-transparent"
            onClick={() => setScheduleContextMenu(null)}
          />
          <div
            className="fixed z-[91] w-48 overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg"
            style={{
              left: `${scheduleContextMenu.x}px`,
              top: `${scheduleContextMenu.y}px`,
            }}
          >
            <button
              type="button"
              onClick={handleEditScheduleFromMenu}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              <IconPencil size={14} />
              Edit Schedule
            </button>
            <button
              type="button"
              onClick={handleMoveScheduleFromMenu}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              <IconArrowsMove size={14} />
              Move
            </button>
            <button
              type="button"
              onClick={() => void handleRemoveScheduleFromMenu()}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              <IconX size={14} />
              Remove from Calendar
            </button>
          </div>
        </>
      ) : null}

      {scheduleEditor ? (
        <CalendarEmbedProvider
          embedded
          scheduleMode
          scheduleJobId={scheduleEditor.jobId}
          jobName={scheduleEditor.jobName}
          initialPhaseDates={scheduleEditor.phaseDates}
          initialColor={scheduleEditor.color}
        >
          <ScheduleEditorModal
            jobId={scheduleEditor.jobId}
            jobName={scheduleEditor.jobName}
            clientName={scheduleEditor.clientName}
            monthDate={monthDate}
            todayKey={todayKey}
            eventsByDay={eventsByDay}
            birthdayByDate={employeeBirthdaysByDate}
            selectedEventId={selectedEventId}
            onOpenDate={openDatePreview}
            onClose={() => setScheduleEditor(null)}
            onSaved={load}
          />
        </CalendarEmbedProvider>
      ) : null}

      {showCategoriesModal && (
        <CategoriesModal
          categories={scopedCustomCategories}
          name={addCategoryName}
          color={addCategoryColor}
          onNameChange={setAddCategoryName}
          onColorChange={setAddCategoryColor}
          onCreate={() => void handleCreateCategory()}
          onRename={(categoryId, nextLabel) => {
            void handleRenameCustomCategory(categoryId, nextLabel);
          }}
          onDelete={(categoryId) => {
            void handleDeleteCustomCategory(categoryId);
          }}
          onClose={() => setShowCategoriesModal(false)}
        />
      )}

      {previewDate && (
        <DatePreviewModal
          date={previewDate}
          events={eventsByDay.get(formatDateKey(previewDate)) ?? []}
          selectedEventId={selectedEventId}
          shopClosedEvent={getShopClosedForDate(previewDate)}
          customCategories={customCategories}
          onAdd={() => openCreateModal(previewDate)}
          onView={openViewEvent}
          onEdit={openEditModal}
          onDelete={handleDeleteEvent}
          onToggleShopClosed={handleToggleShopClosed}
          onClose={() => setPreviewDate(null)}
        />
      )}

      {shopClosedReasonOpen && previewDate && (
        <ShopClosedReasonModal
          date={previewDate}
          reason={shopClosedReason}
          saving={shopClosedSaving}
          error={shopClosedError}
          onReasonChange={setShopClosedReason}
          onSave={() => void handleSaveShopClosed()}
          onCancel={() => {
            setShopClosedReasonOpen(false);
            setShopClosedReason("");
            setShopClosedError(null);
          }}
        />
      )}

      {viewingEvent && (
        <EventViewModal
          event={viewingEvent}
          customCategories={customCategories}
          onClose={() => setViewingEvent(null)}
        />
      )}

      {showModal && (
        <Modal
          title={editingEvent ? "Edit event" : "New event"}
          className="h-[6.75in] w-[6.25in]"
          onClose={() => {
            resetAttachment();
            setRecurrenceRule(null);
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
                      value={categorySelectValue(form, calendarScope)}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value.startsWith("custom:")) {
                          setForm({
                            ...form,
                            custom_category_id: value.slice("custom:".length),
                            event_type:
                              calendarScope === "personal"
                                ? "personal"
                                : "other",
                          });
                          return;
                        }
                        setForm({
                          ...form,
                          custom_category_id: "",
                          event_type: value as CalendarEventType,
                        });
                      }}
                      className={`${SELECT_CLASS} w-full px-3 py-1.5`}
                    >
                      {calendarScope === "personal" ? (
                        scopedCustomCategories.length > 0 ? (
                          scopedCustomCategories.map((category) => (
                            <option
                              key={category.id}
                              value={`custom:${category.id}`}
                            >
                              {category.label}
                            </option>
                          ))
                        ) : (
                          <option value="" disabled>
                            Add a category first
                          </option>
                        )
                      ) : (
                        <>
                          <option value="production">Production</option>
                          <option value="finishing">Finishing</option>
                          <option value="delivery">Delivery</option>
                          {scopedCustomCategories.map((category) => (
                            <option
                              key={category.id}
                              value={`custom:${category.id}`}
                            >
                              {category.label}
                            </option>
                          ))}
                        </>
                      )}
                    </select>
                    <SelectChevron />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {recurrenceRule ? (
                  <div className="flex min-w-0 items-center gap-3">
                    <p className="min-w-0 flex-1 text-sm text-gray-800">
                      {summarizeRecurrenceSchedule(recurrenceRule)}
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowRecurrenceModal(true)}
                      className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-burgundy hover:text-burgundy/80"
                    >
                      <IconRepeat size={16} className="shrink-0" />
                      Edit Recurrence
                    </button>
                  </div>
                ) : (
                  <>
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
                        <input
                          type="time"
                          step={60}
                          value={form.start_time.slice(0, 5)}
                          disabled={form.is_all_day}
                          onChange={(e) =>
                            setForm({ ...form, start_time: e.target.value })
                          }
                          className="w-28 rounded-md border border-gray-300 px-2 py-1.5 text-sm disabled:bg-gray-50 disabled:text-gray-400"
                        />
                        <label className="flex shrink-0 items-center gap-1.5 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={form.is_all_day}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                is_all_day: e.target.checked,
                              })
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
                        <input
                          type="time"
                          step={60}
                          value={form.end_time.slice(0, 5)}
                          disabled={form.is_all_day}
                          onChange={(e) =>
                            setForm({ ...form, end_time: e.target.value })
                          }
                          className="w-28 rounded-md border border-gray-300 px-2 py-1.5 text-sm disabled:bg-gray-50 disabled:text-gray-400"
                        />
                        <button
                          type="button"
                          onClick={() => setShowRecurrenceModal(true)}
                          className="inline-flex min-w-0 shrink items-center gap-1 text-sm font-medium text-burgundy hover:text-burgundy/80"
                        >
                          <IconRepeat size={16} className="shrink-0" />
                          <span className="truncate">Make Recurring</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
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
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <label className="flex cursor-pointer items-center gap-2 select-none">
                    <input
                      type="checkbox"
                      checked={form.remind_me}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setForm({
                          ...form,
                          remind_me: checked,
                          reminder_minutes: checked
                            ? form.reminder_minutes || "15"
                            : "",
                        });
                        setReminderConfigured(false);
                        if (checked) {
                          void ensureNotificationPermission().then(
                            (permission) => {
                              if (
                                permission === "denied" ||
                                permission === "unsupported"
                              ) {
                                setSaveError(
                                  permission === "unsupported"
                                    ? "Desktop notifications are not supported in this browser."
                                    : "Notification permission was blocked. Enable notifications in your browser settings to get reminders."
                                );
                              } else {
                                setSaveError(null);
                              }
                            }
                          );
                        }
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-burgundy focus:ring-burgundy"
                    />
                    <span className="text-sm font-medium text-gray-900">
                      Remind Me
                    </span>
                  </label>
                  {form.remind_me && reminderConfigured ? (
                    <div className="flex items-center gap-1.5 text-sm text-gray-700">
                      <span>
                        remind me {form.reminder_minutes || "15"} minute
                        {form.reminder_minutes === "1" ? "" : "s"} before
                      </span>
                      <button
                        type="button"
                        onClick={() => setReminderConfigured(false)}
                        className="rounded p-0.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                        aria-label="Edit reminder"
                        title="Edit reminder"
                      >
                        <IconPencil size={14} />
                      </button>
                    </div>
                  ) : null}
                  {form.remind_me && !reminderConfigured ? (
                    <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5">
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={form.reminder_minutes}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            reminder_minutes: e.target.value,
                          })
                        }
                        placeholder="Minutes"
                        className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm"
                        aria-label="Minutes before event"
                      />
                      <span className="text-xs text-gray-600">min before</span>
                      <Button
                        type="button"
                        variant="small"
                        onClick={() => {
                          const minutes = Number.parseInt(
                            form.reminder_minutes,
                            10
                          );
                          if (!Number.isFinite(minutes) || minutes <= 0) {
                            setSaveError(
                              "Enter how many minutes before the event to remind you."
                            );
                            return;
                          }
                          setSaveError(null);
                          setForm({
                            ...form,
                            remind_me: true,
                            reminder_minutes: String(minutes),
                          });
                          setReminderConfigured(true);
                        }}
                      >
                        Save
                      </Button>
                    </div>
                  ) : null}
                </div>
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
                      : recurrenceRule
                        ? "Create series"
                        : "Create event"}
                </Button>
              </div>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {showRecurrenceModal ? (
        <RecurrenceModal
          initialRule={
            recurrenceRule ??
            defaultRecurrenceRule(
              form.event_date,
              form.start_time,
              form.end_time,
              form.is_all_day
            )
          }
          onCancel={() => setShowRecurrenceModal(false)}
          onRemove={
            recurrenceRule || editingEvent?.recurrence_series_id
              ? () => {
                  void handleRemoveRecurrence();
                }
              : undefined
          }
          onSave={(rule) => {
            setRecurrenceRule(rule);
            setForm((prev) => ({
              ...prev,
              event_date: rule.startDate,
              end_date: rule.startDate,
              start_time: rule.startTime,
              end_time: rule.endTime,
              is_all_day: rule.isAllDay,
            }));
            setShowRecurrenceModal(false);
          }}
        />
      ) : null}
    </div>
  );
}
