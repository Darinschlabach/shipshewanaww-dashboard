"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  IconChevronDown,
  IconChevronUp,
  IconDots,
  IconGripVertical,
  IconSearch,
  IconX,
  type Icon,
} from "@tabler/icons-react";

const TONES = {
  burgundy: "bg-[#F3E4E7] text-[#6B1A2A]",
  sand: "bg-[#F6E8D4] text-[#7A4B12]",
  sage: "bg-[#E5F0E4] text-[#2C5A34]",
  ink: "bg-[#E7E6F4] text-[#3C3A6B]",
  rose: "bg-[#F8E6E2] text-[#8C3B32]",
  slate: "bg-[#EEEAE6] text-[#5C564F]",
  inactive: "bg-gray-100 text-gray-500",
} as const;

export type BadgeTone = keyof typeof TONES;

const TONE_ORDER: BadgeTone[] = ["burgundy", "sand", "sage", "ink", "rose", "slate"];

export function toneForLabel(label: string): BadgeTone {
  let hash = 0;
  for (let index = 0; index < label.length; index += 1) {
    hash = (hash * 31 + label.charCodeAt(index)) >>> 0;
  }
  return TONE_ORDER[hash % TONE_ORDER.length];
}

export function Badge({ tone = "slate", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 text-[10px] font-medium leading-4 ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">{value}</p>
      {detail ? <p className="mt-0.5 text-sm text-gray-500">{detail}</p> : null}
    </div>
  );
}

export function FormulaPill({ value }: { value: string }) {
  return (
    <span
      title={value}
      className="inline-block max-w-[160px] truncate rounded-md bg-[#F1EEEA] px-1.5 py-0.5 align-middle font-mono text-[12px] leading-5 text-gray-700"
    >
      {value}
    </span>
  );
}

export function DragHandle({ label = "Drag to reorder" }: { label?: string }) {
  return (
    <span aria-hidden className="inline-flex cursor-grab text-gray-300" title={label}>
      <IconGripVertical size={16} />
    </span>
  );
}

export function EmptyState({
  icon: IconComponent,
  title,
  body,
  actionLabel,
  onAction,
}: {
  icon: Icon;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="px-6 py-14 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-cream text-burgundy">
        <IconComponent size={22} stroke={1.5} />
      </div>
      <h3 className="mt-3 text-sm font-semibold text-gray-900">{title}</h3>
      {body ? <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">{body}</p> : null}
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 h-9 rounded-md bg-burgundy px-3 text-sm font-medium text-white hover:bg-[#581522]"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function ListCard({ children }: { children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-[#E6D9C8] bg-white shadow-[0_1px_2px_rgba(80,40,20,0.04)]">
      {children}
    </section>
  );
}

export function ListHeader({
  title,
  count,
  search,
  onSearch,
  searchPlaceholder,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  count: number;
  search: string;
  onSearch: (value: string) => void;
  searchPlaceholder: string;
  actionLabel: string;
  onAction: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[#F0EBE3] px-6 py-4">
      <h2 className="text-[15px] font-semibold text-gray-900">
        {title}
        <span className="ml-1.5 font-medium text-gray-400">· {count}</span>
      </h2>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        <div className="relative">
          <IconSearch
            size={15}
            className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-gray-400"
          />
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="h-9 w-52 rounded-md border border-[#E4D9CC] bg-white pr-3 pl-8 text-sm text-gray-900 placeholder:text-gray-400 focus:border-burgundy focus:outline-none focus:ring-1 focus:ring-burgundy"
          />
        </div>
        {children}
        <button
          type="button"
          onClick={onAction}
          className="h-9 shrink-0 rounded-md bg-burgundy px-3 text-sm font-medium text-white hover:bg-[#581522]"
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}

export function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 rounded-md border border-[#E4D9CC] bg-white px-2 text-sm text-gray-800 focus:border-burgundy focus:outline-none focus:ring-1 focus:ring-burgundy"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function ChipFilters({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={`h-7 rounded-full px-2.5 text-xs font-medium ${
              active ? "bg-burgundy text-white" : "bg-cream text-gray-600 hover:bg-[#EBE3D6]"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export type RowMenuItem = {
  label: string;
  onSelect: () => void;
  tone?: "danger";
};

export function RowMenu({ items }: { items: RowMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, right: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function close() {
      setOpen(false);
    }
    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      close();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Row actions"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          const rect = buttonRef.current?.getBoundingClientRect();
          if (rect) {
            const menuHeight = items.length * 36 + 12;
            const below = rect.bottom + 4;
            const top = below + menuHeight > window.innerHeight ? Math.max(8, rect.top - menuHeight) : below;
            setCoords({ top, right: Math.max(8, window.innerWidth - rect.right) });
          }
          setOpen((current) => !current);
        }}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-[#F5F0E8] hover:text-gray-700"
      >
        <IconDots size={16} />
      </button>
      {open ? (
        <div
          ref={menuRef}
          style={{ position: "fixed", top: coords.top, right: coords.right }}
          className="z-40 min-w-[168px] rounded-lg border border-[#E6D9C8] bg-white py-1 shadow-lg"
          onClick={(event) => event.stopPropagation()}
        >
          {items.map((item, index) => (
            <div key={item.label}>
              {item.tone === "danger" && index > 0 ? <div className="my-1 border-t border-[#F0EBE3]" /> : null}
              <button
                type="button"
                className={`block w-full px-3 py-2 text-left text-sm ${
                  item.tone === "danger"
                    ? "text-red-700 hover:bg-red-50"
                    : "text-gray-700 hover:bg-[#FBF7F2]"
                }`}
                onClick={(event) => {
                  event.stopPropagation();
                  setOpen(false);
                  item.onSelect();
                }}
              >
                {item.label}
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}

export type TableColumn<Row> = {
  id: string;
  header: string;
  align?: "left" | "right";
  sortValue?: (row: Row) => string | number;
  cell: (row: Row) => ReactNode;
};

function compareValues(left: string | number, right: string | number) {
  if (typeof left === "number" && typeof right === "number") return left - right;
  return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" });
}

export function DataTable<Row extends { id: string }>({
  columns,
  rows,
  onRowClick,
  menu,
  activeId,
  empty,
  initialSort,
}: {
  columns: TableColumn<Row>[];
  rows: Row[];
  onRowClick?: (row: Row) => void;
  menu?: (row: Row) => RowMenuItem[];
  activeId?: string | null;
  empty?: ReactNode;
  initialSort?: { id: string; dir: "asc" | "desc" };
}) {
  const [sort, setSort] = useState(initialSort ?? { id: columns[0]?.id ?? "", dir: "asc" as const });

  const sorted = useMemo(() => {
    const column = columns.find((item) => item.id === sort.id);
    if (!column?.sortValue) return rows;
    const direction = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort(
      (left, right) => direction * compareValues(column.sortValue!(left), column.sortValue!(right))
    );
  }, [columns, rows, sort]);

  if (rows.length === 0 && empty) return <>{empty}</>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[#F0EBE3] text-[11px] font-medium uppercase tracking-wide text-gray-400">
            {columns.map((column) => {
              const sortedHere = sort.id === column.id && column.sortValue;
              return (
                <th
                  key={column.id}
                  scope="col"
                  aria-sort={
                    sortedHere ? (sort.dir === "asc" ? "ascending" : "descending") : column.sortValue ? "none" : undefined
                  }
                  className={`px-3 py-2 font-medium first:pl-6 ${column.align === "right" ? "text-right" : "text-left"}`}
                >
                  {column.sortValue ? (
                    <button
                      type="button"
                      onClick={() =>
                        setSort((current) =>
                          current.id === column.id
                            ? { id: column.id, dir: current.dir === "asc" ? "desc" : "asc" }
                            : { id: column.id, dir: "asc" }
                        )
                      }
                      className={`inline-flex items-center gap-1 hover:text-gray-700 ${
                        column.align === "right" ? "flex-row-reverse" : ""
                      }`}
                    >
                      {column.header}
                      {sortedHere ? (
                        sort.dir === "asc" ? (
                          <IconChevronUp size={12} />
                        ) : (
                          <IconChevronDown size={12} />
                        )
                      ) : null}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
            {menu ? <th className="w-12 pr-3" /> : null}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={row.id}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`h-11 border-b border-[#F3EDE6] last:border-b-0 ${
                onRowClick ? "cursor-pointer" : ""
              } ${activeId === row.id ? "bg-[#F8F1E8]" : "hover:bg-[#FBF8F4]"}`}
            >
              {columns.map((column) => (
                <td
                  key={column.id}
                  className={`px-3 py-2 first:pl-6 ${column.align === "right" ? "text-right tabular-nums" : ""}`}
                >
                  {column.cell(row)}
                </td>
              ))}
              {menu ? (
                <td className="pr-3 text-right" onClick={(event) => event.stopPropagation()}>
                  <RowMenu items={menu(row)} />
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SlideOver({
  title,
  onClose,
  onSave,
  saving,
  children,
}: {
  title: string;
  onClose: () => void;
  onSave: () => void;
  saving?: boolean;
  children: ReactNode;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-30 flex justify-end">
      <button type="button" aria-label="Close editor" className="absolute inset-0 bg-[#2A1818]/25" onClick={onClose} />
      <div className="relative flex h-full w-[min(480px,100%)] flex-col bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-[#F0EBE3] px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-[#F5F0E8] hover:text-gray-700"
          >
            <IconX size={16} />
          </button>
        </header>
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            onSave();
          }}
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          <footer className="flex justify-end gap-2 border-t border-[#F0EBE3] bg-white px-5 py-3">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-md border border-[#E4D9CC] px-3 text-sm font-medium text-gray-700 hover:bg-[#FBF7F2]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-9 rounded-md bg-burgundy px-4 text-sm font-medium text-white hover:bg-[#581522] disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

export function EditorField({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={className ?? "block"}>
      <span className="text-xs font-medium text-gray-500">{label}</span>
      <div className="mt-1">{children}</div>
      {hint ? <p className="mt-1 text-xs text-red-600">{hint}</p> : null}
    </label>
  );
}

export const editorInputClass =
  "w-full rounded-md border border-[#E4D9CC] bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:border-burgundy focus:outline-none focus:ring-1 focus:ring-burgundy";

export function UnitInput({
  value,
  onChange,
  unit,
  prefix,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  unit?: string;
  prefix?: string;
  label: string;
}) {
  return (
    <div className="inline-flex h-9 items-center rounded-md border border-[#E4D9CC] bg-white focus-within:border-burgundy focus-within:ring-1 focus-within:ring-burgundy">
      {prefix ? <span className="pl-2 text-sm text-gray-400">{prefix}</span> : null}
      <input
        aria-label={label}
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-16 bg-transparent px-2 py-1.5 text-sm tabular-nums text-gray-900 outline-none"
      />
      {unit ? <span className="pr-2 text-xs text-gray-400">{unit}</span> : null}
    </div>
  );
}
