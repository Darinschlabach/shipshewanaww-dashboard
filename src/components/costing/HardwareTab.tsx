"use client";

import { useEffect, useMemo, useState } from "react";
import { IconTool } from "@tabler/icons-react";
import Button from "@/components/Button";
import ConfirmModal from "@/components/ConfirmModal";
import FilterPills from "@/components/FilterPills";
import Modal from "@/components/Modal";
import { formatCurrencyPrecise } from "@/lib/utils";
import {
  HARDWARE_CATEGORIES,
  deleteRow,
  fetchHardware,
  hardwareUsage,
  saveHardware,
  type CostingHardware,
} from "@/lib/costing/db";
import { matchesSearch, parseRequiredNumber } from "@/components/costing/ui";
import {
  Badge,
  DataTable,
  EditorField,
  EmptyState,
  ListCard,
  ListHeader,
  SlideOver,
  editorInputClass,
  toneForLabel,
} from "@/components/costing/design";

type FormState = {
  id?: string;
  name: string;
  category: string;
  customCategory: string;
  unit_cost: string;
  install_minutes: string;
  markup_pct: string;
  supplier: string;
  sku: string;
  notes: string;
  active: boolean;
};

const blank: FormState = {
  name: "",
  category: "Hinges",
  customCategory: "",
  unit_cost: "",
  install_minutes: "0",
  markup_pct: "0",
  supplier: "",
  sku: "",
  notes: "",
  active: true,
};

function formFromRow(row: CostingHardware): FormState {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    customCategory: "",
    unit_cost: String(row.unit_cost),
    install_minutes: String(row.install_minutes),
    markup_pct: String(row.markup_pct),
    supplier: row.supplier,
    sku: row.sku,
    notes: row.notes,
    active: row.active,
  };
}

function formatPlain(value: number) {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

export default function HardwareTab({ onChanged }: { onChanged?: () => void }) {
  const [rows, setRows] = useState<CostingHardware[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [form, setForm] = useState<FormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CostingHardware | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);

  async function load() {
    const result = await fetchHardware();
    setRows(result.rows);
    setError(result.error);
    setLoaded(true);
  }

  useEffect(() => {
    void load();
  }, []);

  const categories = useMemo(() => {
    const names = new Set<string>(HARDWARE_CATEGORIES);
    for (const row of rows) names.add(row.category);
    return [...names];
  }, [rows]);

  const pillOptions = useMemo(() => {
    const options = [{ value: "all", label: "All" }];
    for (const category of categories) {
      const count = rows.filter(
        (row) => row.category === category && (showInactive || row.active)
      ).length;
      if (count === 0 && !showInactive) continue;
      options.push({ value: category, label: `${category} (${count})` });
    }
    return options;
  }, [categories, rows, showInactive]);

  useEffect(() => {
    if (categoryFilter !== "all" && !pillOptions.some((option) => option.value === categoryFilter)) {
      setCategoryFilter("all");
    }
  }, [categoryFilter, pillOptions]);

  const visible = useMemo(
    () =>
      rows.filter((row) => {
        if (!showInactive && !row.active) return false;
        if (categoryFilter !== "all" && row.category !== categoryFilter) return false;
        return matchesSearch(search, [row.name, row.category, row.supplier, row.sku, row.notes]);
      }),
    [rows, search, showInactive, categoryFilter]
  );

  function openNew() {
    setFormError(null);
    setForm(blank);
  }

  function openEdit(row: CostingHardware) {
    setFormError(null);
    setForm(formFromRow(row));
  }

  function closeEditor() {
    if (saving) return;
    setForm(null);
    setFormError(null);
  }

  async function submit() {
    if (!form || saving) return;
    const unitCost = parseRequiredNumber(form.unit_cost, "unit cost");
    const minutes = parseRequiredNumber(form.install_minutes, "install time");
    const markup = parseRequiredNumber(form.markup_pct, "markup percent");
    const category = (form.category === "__new" ? form.customCategory : form.category).trim();
    if (!form.name.trim()) return setFormError("Enter a name");
    if (!category) return setFormError("Enter a category");
    if (typeof unitCost === "string") return setFormError(unitCost);
    if (typeof minutes === "string") return setFormError(minutes);
    if (typeof markup === "string") return setFormError(markup);
    setFormError(null);
    setSaving(true);
    try {
      const message = await saveHardware({
        id: form.id,
        name: form.name,
        category,
        unit_cost: unitCost,
        install_minutes: minutes,
        markup_pct: markup,
        supplier: form.supplier,
        sku: form.sku,
        notes: form.notes,
        active: form.active,
      });
      if (message) return setFormError(message);
      setForm(null);
      await load();
      onChanged?.();
    } finally {
      setSaving(false);
    }
  }

  async function setActive(row: CostingHardware, active: boolean) {
    const message = await saveHardware({ ...row, active });
    if (message) {
      setError(message);
      return;
    }
    if (form?.id === row.id) setForm({ ...formFromRow(row), active });
    await load();
    onChanged?.();
  }

  async function duplicate(row: CostingHardware) {
    const message = await saveHardware({
      name: `${row.name} copy`,
      category: row.category,
      unit_cost: row.unit_cost,
      install_minutes: row.install_minutes,
      markup_pct: row.markup_pct,
      supplier: row.supplier,
      sku: row.sku,
      notes: row.notes,
      active: row.active,
    });
    if (message) {
      setError(message);
      return;
    }
    await load();
    onChanged?.();
  }

  async function askDelete(row: CostingHardware) {
    const used = await hardwareUsage(row.id);
    if (used.length) setBlocked(`${row.name} is used by ${used.join(", ")}.`);
    else setPendingDelete(row);
  }

  const addingCategory = form?.category === "__new";
  const nameError = formError === "Enter a name" ? formError : undefined;
  const categoryError = formError === "Enter a category" ? formError : undefined;
  const costError = formError?.includes("unit cost") ? formError : undefined;
  const minutesError = formError?.includes("install") ? formError : undefined;
  const markupError = formError?.includes("markup") ? formError : undefined;
  const generalError =
    formError && !nameError && !categoryError && !costError && !minutesError && !markupError
      ? formError
      : undefined;
  const libraryEmpty = loaded && rows.length === 0 && !error;

  return (
    <>
      {error ? <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <ListCard>
        <ListHeader
          title="Hardware"
          count={loaded ? visible.length : 0}
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search hardware"
          actionLabel="New hardware"
          onAction={openNew}
        >
          <label className="flex h-9 items-center gap-2 rounded-md border border-[#E4D9CC] bg-white px-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(event) => setShowInactive(event.target.checked)}
            />
            Show inactive
          </label>
        </ListHeader>
        <div className="border-b border-[#F0EBE3] px-6 py-3">
          <FilterPills options={pillOptions} value={categoryFilter} onChange={setCategoryFilter} />
        </div>
        {!loaded ? (
          <p className="px-6 py-10 text-sm text-gray-500">Loading hardware…</p>
        ) : libraryEmpty ? (
          <EmptyState
            icon={IconTool}
            title="No hardware yet"
            body="Add hinges, slides, pulls, and other hardware used on a cabinet."
            actionLabel="New hardware"
            onAction={openNew}
          />
        ) : (
          <DataTable
            rows={visible}
            activeId={form?.id}
            initialSort={{ id: "name", dir: "asc" }}
            onRowClick={openEdit}
            empty={<p className="px-6 py-10 text-center text-sm text-gray-500">No hardware matches.</p>}
            menu={(row) => [
              { label: "Edit", onSelect: () => openEdit(row) },
              { label: "Duplicate", onSelect: () => void duplicate(row) },
              {
                label: row.active ? "Make inactive" : "Make active",
                onSelect: () => void setActive(row, !row.active),
              },
              { label: "Delete", tone: "danger", onSelect: () => void askDelete(row) },
            ]}
            columns={[
              {
                id: "name",
                header: "Name",
                sortValue: (row) => row.name,
                cell: (row) => (
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{row.name}</span>
                    {row.active ? null : <Badge tone="inactive">Inactive</Badge>}
                  </div>
                ),
              },
              {
                id: "category",
                header: "Category",
                sortValue: (row) => row.category,
                cell: (row) => <Badge tone={toneForLabel(row.category)}>{row.category}</Badge>,
              },
              {
                id: "cost",
                header: "Cost each",
                align: "right",
                sortValue: (row) => row.unit_cost,
                cell: (row) => (
                  <span className="tabular-nums text-gray-900">{formatCurrencyPrecise(row.unit_cost)}</span>
                ),
              },
              {
                id: "install",
                header: "Install",
                align: "right",
                sortValue: (row) => row.install_minutes,
                cell: (row) => (
                  <span className="whitespace-nowrap">
                    <span className="tabular-nums text-gray-900">{formatPlain(row.install_minutes)}</span>
                    <span className="ml-1 text-gray-400">min</span>
                  </span>
                ),
              },
              {
                id: "markup",
                header: "Markup",
                align: "right",
                sortValue: (row) => row.markup_pct,
                cell: (row) => (
                  <span className="whitespace-nowrap">
                    <span className="tabular-nums text-gray-900">{formatPlain(row.markup_pct)}</span>
                    <span className="ml-0.5 text-gray-400">%</span>
                  </span>
                ),
              },
              {
                id: "supplier",
                header: "Supplier / SKU",
                sortValue: (row) => `${row.supplier} ${row.sku}`,
                cell: (row) => {
                  const supplier = row.supplier.trim();
                  const sku = row.sku.trim();
                  if (!supplier && !sku) return <span className="text-gray-400">—</span>;
                  return (
                    <span className="text-gray-700">
                      {supplier || "—"}
                      {sku ? <span className="text-gray-400"> / {sku}</span> : null}
                    </span>
                  );
                },
              },
            ]}
          />
        )}
      </ListCard>

      {form ? (
        <SlideOver
          title={form.id ? "Edit hardware" : "New hardware"}
          onClose={closeEditor}
          onSave={() => void submit()}
          saving={saving}
        >
          {generalError ? <p className="mb-3 text-sm text-red-600">{generalError}</p> : null}
          <div className="space-y-3">
            <EditorField label="Name" hint={nameError}>
              <input
                className={editorInputClass}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </EditorField>
            <EditorField label="Category" hint={addingCategory ? undefined : categoryError}>
              <select
                className={editorInputClass}
                value={form.category === "__new" || categories.includes(form.category) ? form.category : "__new"}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
                <option value="__new">+ New category</option>
              </select>
            </EditorField>
            {addingCategory ? (
              <EditorField label="New category" hint={categoryError}>
                <input
                  className={editorInputClass}
                  value={form.customCategory}
                  onChange={(event) => setForm({ ...form, customCategory: event.target.value })}
                />
              </EditorField>
            ) : null}
            <div className="flex flex-wrap items-end gap-4">
              <EditorField label="Unit cost" hint={costError}>
                <div className="inline-flex h-9 items-center rounded-md border border-[#E4D9CC] bg-white focus-within:border-burgundy focus-within:ring-1 focus-within:ring-burgundy">
                  <span className="pl-2 text-sm text-gray-400">$</span>
                  <input
                    aria-label="Unit cost"
                    inputMode="decimal"
                    value={form.unit_cost}
                    onChange={(event) => setForm({ ...form, unit_cost: event.target.value })}
                    className="w-20 bg-transparent px-2 py-1.5 text-sm tabular-nums text-gray-900 outline-none"
                  />
                </div>
              </EditorField>
              <EditorField label="Install" hint={minutesError}>
                <div className="inline-flex h-9 items-center rounded-md border border-[#E4D9CC] bg-white focus-within:border-burgundy focus-within:ring-1 focus-within:ring-burgundy">
                  <input
                    aria-label="Install minutes"
                    inputMode="decimal"
                    value={form.install_minutes}
                    onChange={(event) => setForm({ ...form, install_minutes: event.target.value })}
                    className="w-16 bg-transparent px-2 py-1.5 text-sm tabular-nums text-gray-900 outline-none"
                  />
                  <span className="pr-2 text-xs text-gray-400">min</span>
                </div>
              </EditorField>
              <EditorField label="Markup" hint={markupError}>
                <div className="inline-flex h-9 items-center rounded-md border border-[#E4D9CC] bg-white focus-within:border-burgundy focus-within:ring-1 focus-within:ring-burgundy">
                  <input
                    aria-label="Markup percent"
                    inputMode="decimal"
                    value={form.markup_pct}
                    onChange={(event) => setForm({ ...form, markup_pct: event.target.value })}
                    className="w-16 bg-transparent px-2 py-1.5 text-sm tabular-nums text-gray-900 outline-none"
                  />
                  <span className="pr-2 text-xs text-gray-400">%</span>
                </div>
              </EditorField>
            </div>
            <EditorField label="Supplier">
              <input
                className={editorInputClass}
                value={form.supplier}
                onChange={(event) => setForm({ ...form, supplier: event.target.value })}
              />
            </EditorField>
            <EditorField label="SKU">
              <input
                className={editorInputClass}
                value={form.sku}
                onChange={(event) => setForm({ ...form, sku: event.target.value })}
              />
            </EditorField>
            <EditorField label="Notes">
              <textarea
                className={editorInputClass}
                rows={2}
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
              />
            </EditorField>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => setForm({ ...form, active: event.target.checked })}
              />
              Active
            </label>
          </div>
        </SlideOver>
      ) : null}

      {pendingDelete ? (
        <ConfirmModal
          title="Delete hardware"
          body={`Remove ${pendingDelete.name}?`}
          confirmLabel="Delete"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            void deleteRow("costing_hardware", pendingDelete.id).then((message) => {
              setPendingDelete(null);
              if (message) setError(message);
              else {
                if (form?.id === pendingDelete.id) setForm(null);
                void load();
                onChanged?.();
              }
            });
          }}
        />
      ) : null}
      {blocked ? (
        <Modal title="This hardware is in use" onClose={() => setBlocked(null)}>
          <p className="text-sm text-gray-600">{blocked}</p>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => setBlocked(null)}>Close</Button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
