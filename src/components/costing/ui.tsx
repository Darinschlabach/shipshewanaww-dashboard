"use client";

import type { ReactNode } from "react";

export const inputClass =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-burgundy focus:outline-none focus:ring-1 focus:ring-burgundy";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm text-gray-700">
      {label}
      <div className="mt-1">{children}</div>
      {hint ? <p className="mt-1 text-xs text-red-600">{hint}</p> : null}
    </label>
  );
}

export function LibraryToolbar({
  search,
  onSearch,
  placeholder,
  addLabel,
  onAdd,
  showInactive,
  onShowInactive,
  extra,
}: {
  search: string;
  onSearch: (value: string) => void;
  placeholder: string;
  addLabel: string;
  onAdd: () => void;
  showInactive?: boolean;
  onShowInactive?: (value: boolean) => void;
  extra?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <input
        value={search}
        onChange={(event) => onSearch(event.target.value)}
        placeholder={placeholder}
        className={`${inputClass} max-w-xs`}
      />
      {onShowInactive ? (
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(event) => onShowInactive(event.target.checked)}
          />
          Show inactive
        </label>
      ) : null}
      {extra}
      <button
        type="button"
        onClick={onAdd}
        className="ml-auto rounded-md bg-burgundy px-3 py-2 text-sm font-medium text-white hover:bg-burgundy/90"
      >
        {addLabel}
      </button>
    </div>
  );
}

export function matchesSearch(query: string, values: Array<string | number | null | undefined>) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return values.join(" ").toLowerCase().includes(needle);
}

export function sortByName<T extends { name: string }>(rows: T[], direction: "asc" | "desc") {
  const copy = [...rows].sort((a, b) => a.name.localeCompare(b.name));
  return direction === "asc" ? copy : copy.reverse();
}

export function EmptyRow({ cols, label }: { cols: number; label: string }) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-8 text-center text-sm text-gray-500">
        {label}
      </td>
    </tr>
  );
}

export function parseRequiredNumber(value: string, label: string): number | string {
  const parsed = Number(value);
  if (!value.trim() || !Number.isFinite(parsed)) return `Enter a ${label}`;
  return parsed;
}
