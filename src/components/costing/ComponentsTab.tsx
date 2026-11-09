"use client";

import { useEffect, useMemo, useState } from "react";
import { IconPuzzle } from "@tabler/icons-react";
import Button from "@/components/Button";
import ConfirmModal from "@/components/ConfirmModal";
import Modal from "@/components/Modal";
import { createClient } from "@/lib/supabase/client";
import { cabinetScope, evaluateFormula } from "@/lib/costing/formula";
import {
  componentUsage,
  deleteRow,
  fetchComponents,
  fetchSlots,
  saveComponent,
  type CostingComponent,
  type CostingSlot,
  type CostingVariable,
} from "@/lib/costing/db";
import { matchesSearch, parseRequiredNumber } from "@/components/costing/ui";
import {
  Badge,
  DataTable,
  EditorField,
  EmptyState,
  FilterSelect,
  FormulaPill,
  ListCard,
  ListHeader,
  SlideOver,
  UnitInput,
  editorInputClass,
  toneForLabel,
} from "@/components/costing/design";

type FormState = {
  id?: string;
  name: string;
  slot_id: string;
  length_formula: string;
  width_formula: string;
  height_formula: string;
  qty_formula: string;
  labor_minutes: string;
  exterior_finish_sides: string;
  interior_finish_sides: string;
  notes: string;
};

type Dims = {
  H: string;
  W: string;
  D: string;
  DOORS: string;
  DRAWERS: string;
  SHELVES: string;
  T: string;
};

const defaultDims: Dims = {
  H: "34.5",
  W: "36",
  D: "24",
  DOORS: "1",
  DRAWERS: "1",
  SHELVES: "1",
  T: "0.75",
};

const dimKeys = Object.keys(defaultDims) as Array<keyof Dims>;

function formatMinutes(value: number) {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

export default function ComponentsTab({
  variables,
  onChanged,
}: {
  variables: CostingVariable[];
  onChanged?: () => void;
}) {
  const [rows, setRows] = useState<CostingComponent[]>([]);
  const [slots, setSlots] = useState<CostingSlot[]>([]);
  const [usage, setUsage] = useState<Map<string, number>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [slotFilter, setSlotFilter] = useState("all");
  const [form, setForm] = useState<FormState | null>(null);
  const [dims, setDims] = useState<Dims>(defaultDims);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CostingComponent | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);

  async function load() {
    const supabase = createClient();
    const [components, slotRows, links] = await Promise.all([
      fetchComponents(),
      fetchSlots(),
      supabase.from("costing_template_components").select("component_id, template_id"),
    ]);
    setRows(components.rows);
    setSlots(slotRows.rows);
    const counts = new Map<string, Set<string>>();
    for (const link of links.data ?? []) {
      const templates = counts.get(link.component_id) ?? new Set<string>();
      templates.add(link.template_id);
      counts.set(link.component_id, templates);
    }
    setUsage(new Map([...counts].map(([id, templates]) => [id, templates.size])));
    setError(components.error ?? slotRows.error ?? links.error?.message ?? null);
    setLoaded(true);
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    setForm((current) => {
      if (!current || current.id || current.slot_id || !slots[0]) return current;
      return { ...current, slot_id: slots[0].id };
    });
  }, [slots]);

  const slotName = useMemo(() => new Map(slots.map((slot) => [slot.id, slot.name])), [slots]);

  const slotOptions = useMemo(() => {
    const used = new Set(rows.map((row) => row.slot_id));
    return slots.filter((slot) => used.has(slot.id));
  }, [rows, slots]);

  const visible = useMemo(() => {
    return rows.filter((row) => {
      if (slotFilter !== "all" && row.slot_id !== slotFilter) return false;
      return matchesSearch(search, [
        row.name,
        slotName.get(row.slot_id),
        row.length_formula,
        row.width_formula,
        row.qty_formula,
        row.notes,
      ]);
    });
  }, [rows, search, slotFilter, slotName]);

  const preview = useMemo(() => {
    if (!form) return null;
    const scope = cabinetScope({
      H: Number(dims.H) || 0,
      W: Number(dims.W) || 0,
      D: Number(dims.D) || 0,
      DOORS: Number(dims.DOORS) || 0,
      DRAWERS: Number(dims.DRAWERS) || 0,
      SHELVES: Number(dims.SHELVES) || 0,
      T: Number(dims.T) || 0,
      variables: Object.fromEntries(variables.map((item) => [item.code, item.value])),
    });
    return {
      length: evaluateFormula(form.length_formula, scope),
      width: evaluateFormula(form.width_formula, scope),
      height: evaluateFormula(form.height_formula, scope),
      qty: evaluateFormula(form.qty_formula, scope),
    };
  }, [form, dims, variables]);

  function openNew() {
    setFormError(null);
    setDims(defaultDims);
    setForm({
      name: "",
      slot_id: slots[0]?.id ?? "",
      length_formula: "W",
      width_formula: "H",
      height_formula: "",
      qty_formula: "1",
      labor_minutes: "0",
      exterior_finish_sides: "0",
      interior_finish_sides: "0",
      notes: "",
    });
  }

  function openEdit(row: CostingComponent) {
    setFormError(null);
    setForm({
      id: row.id,
      name: row.name,
      slot_id: row.slot_id,
      length_formula: row.length_formula,
      width_formula: row.width_formula,
      height_formula: row.height_formula ?? "",
      qty_formula: row.qty_formula,
      labor_minutes: String(row.labor_minutes),
      exterior_finish_sides: String(row.exterior_finish_sides),
      interior_finish_sides: String(row.interior_finish_sides),
      notes: row.notes,
    });
  }

  function closeEditor() {
    if (saving) return;
    setForm(null);
    setFormError(null);
  }

  async function submit() {
    if (!form || saving) return;
    const labor = parseRequiredNumber(form.labor_minutes, "labor minutes");
    const exterior = parseRequiredNumber(form.exterior_finish_sides, "exterior face count");
    const interior = parseRequiredNumber(form.interior_finish_sides, "interior face count");
    if (!form.name.trim()) return setFormError("Enter a name");
    if (!form.slot_id) return setFormError("Choose a slot");
    const slot = slots.find((row) => row.id === form.slot_id);
    if (slot?.slot_type === "drawer_box" && !form.height_formula.trim()) {
      return setFormError("Enter a height formula");
    }
    if (typeof labor === "string" || typeof exterior === "string" || typeof interior === "string") {
      return setFormError(
        typeof labor === "string" ? labor : typeof exterior === "string" ? exterior : String(interior)
      );
    }
    if (![0, 1, 2].includes(exterior) || ![0, 1, 2].includes(interior)) {
      return setFormError("Finish faces must be 0, 1, or 2");
    }
    setFormError(null);
    setSaving(true);
    try {
      const message = await saveComponent({
        id: form.id,
        name: form.name,
        slot_id: form.slot_id,
        length_formula: form.length_formula,
        width_formula: form.width_formula,
        height_formula: slot?.slot_type === "drawer_box" ? form.height_formula : null,
        qty_formula: form.qty_formula,
        labor_minutes: labor,
        exterior_finish_sides: exterior,
        interior_finish_sides: interior,
        notes: form.notes,
      });
      if (message) return setFormError(message);
      setForm(null);
      await load();
      onChanged?.();
    } finally {
      setSaving(false);
    }
  }

  async function askDelete(row: CostingComponent) {
    const used = await componentUsage(row.id);
    if (used.length) setBlocked(`${row.name} is used by ${used.join(", ")}.`);
    else setPendingDelete(row);
  }

  const nameError = formError === "Enter a name" ? formError : undefined;
  const slotError = formError === "Choose a slot" ? formError : undefined;
  const laborError = formError?.includes("labor minutes") ? formError : undefined;
  const faceError =
    formError?.includes("face") || formError === "Finish faces must be 0, 1, or 2" ? formError : undefined;
  const generalError =
    formError && !nameError && !slotError && !laborError && !faceError && formError !== "Enter a height formula"
      ? formError
      : undefined;

  const libraryEmpty = loaded && rows.length === 0 && !error;

  return (
    <>
      {error ? <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <ListCard>
        <ListHeader
          title="Components"
          count={loaded ? visible.length : rows.length}
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search components"
          actionLabel="New component"
          onAction={openNew}
        >
          <FilterSelect
            label="Filter by slot"
            value={slotFilter}
            onChange={setSlotFilter}
            options={[
              { value: "all", label: "All slots" },
              ...slotOptions.map((slot) => ({ value: slot.id, label: slot.name })),
            ]}
          />
        </ListHeader>
        {!loaded ? (
          <p className="px-6 py-10 text-sm text-gray-500">Loading components…</p>
        ) : libraryEmpty ? (
          <EmptyState
            icon={IconPuzzle}
            title="No components yet"
            body="Components are the parts a cabinet is built from."
            actionLabel="New component"
            onAction={openNew}
          />
        ) : (
          <DataTable
            rows={visible}
            activeId={form?.id}
            initialSort={{ id: "name", dir: "asc" }}
            onRowClick={openEdit}
            empty={<p className="px-6 py-10 text-center text-sm text-gray-500">No components match.</p>}
            menu={(row) => [
              { label: "Edit", onSelect: () => openEdit(row) },
              { label: "Delete", tone: "danger", onSelect: () => void askDelete(row) },
            ]}
            columns={[
              {
                id: "name",
                header: "Name",
                sortValue: (row) => row.name,
                cell: (row) => {
                  const slot = slotName.get(row.slot_id) ?? "—";
                  return (
                    <div className="py-0.5">
                      <div className="font-medium text-gray-900">{row.name}</div>
                      <div className="mt-0.5">
                        <Badge tone={toneForLabel(slot)}>{slot}</Badge>
                      </div>
                    </div>
                  );
                },
              },
              {
                id: "length",
                header: "Length",
                sortValue: (row) => row.length_formula,
                cell: (row) => <FormulaPill value={row.length_formula} />,
              },
              {
                id: "width",
                header: "Width",
                sortValue: (row) => row.width_formula,
                cell: (row) => <FormulaPill value={row.width_formula} />,
              },
              {
                id: "qty",
                header: "Qty",
                sortValue: (row) => row.qty_formula,
                cell: (row) => <FormulaPill value={row.qty_formula} />,
              },
              {
                id: "labor",
                header: "Labor",
                align: "right",
                sortValue: (row) => row.labor_minutes,
                cell: (row) => (
                  <span className="whitespace-nowrap">
                    <span className="tabular-nums text-gray-900">{formatMinutes(row.labor_minutes)}</span>
                    <span className="ml-1 text-gray-400">min</span>
                  </span>
                ),
              },
              {
                id: "finish",
                header: "Finish sides",
                sortValue: (row) => row.exterior_finish_sides * 10 + row.interior_finish_sides,
                cell: (row) => (
                  <span className="whitespace-nowrap text-gray-500">
                    Ext <span className="tabular-nums text-gray-800">{row.exterior_finish_sides}</span>
                    <span className="mx-1 text-gray-300">·</span>
                    Int <span className="tabular-nums text-gray-800">{row.interior_finish_sides}</span>
                  </span>
                ),
              },
              {
                id: "used",
                header: "Used in",
                align: "right",
                sortValue: (row) => usage.get(row.id) ?? 0,
                cell: (row) => {
                  const count = usage.get(row.id) ?? 0;
                  return <span className={count === 0 ? "text-gray-400" : "text-gray-900"}>{count}</span>;
                },
              },
            ]}
          />
        )}
      </ListCard>

      {form && preview ? (
        <SlideOver
          title={form.id ? "Edit component" : "New component"}
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
            <EditorField label="Slot" hint={slotError}>
              <select
                className={editorInputClass}
                value={form.slot_id}
                onChange={(event) => setForm({ ...form, slot_id: event.target.value })}
              >
                {slots.map((slot) => (
                  <option key={slot.id} value={slot.id}>
                    {slot.name}
                  </option>
                ))}
              </select>
            </EditorField>
            <EditorField label="Length formula" hint={preview.length.ok ? undefined : preview.length.error}>
              <input
                className={`${editorInputClass} font-mono`}
                value={form.length_formula}
                onChange={(event) => setForm({ ...form, length_formula: event.target.value })}
              />
            </EditorField>
            <EditorField label="Width formula" hint={preview.width.ok ? undefined : preview.width.error}>
              <input
                className={`${editorInputClass} font-mono`}
                value={form.width_formula}
                onChange={(event) => setForm({ ...form, width_formula: event.target.value })}
              />
            </EditorField>
            {slots.find((slot) => slot.id === form.slot_id)?.slot_type === "drawer_box" ? (
              <EditorField
                label="Height formula"
                hint={
                  formError === "Enter a height formula"
                    ? formError
                    : preview.height.ok
                      ? undefined
                      : preview.height.error
                }
              >
                <input
                  className={`${editorInputClass} font-mono`}
                  value={form.height_formula}
                  onChange={(event) => setForm({ ...form, height_formula: event.target.value })}
                />
              </EditorField>
            ) : null}
            <EditorField label="Quantity formula" hint={preview.qty.ok ? undefined : preview.qty.error}>
              <input
                className={`${editorInputClass} font-mono`}
                value={form.qty_formula}
                onChange={(event) => setForm({ ...form, qty_formula: event.target.value })}
              />
            </EditorField>
            <div className="flex flex-wrap items-end gap-4">
              <EditorField label="Labor" hint={laborError} className="block">
                <UnitInput
                  label="Labor minutes"
                  unit="min"
                  value={form.labor_minutes}
                  onChange={(value) => setForm({ ...form, labor_minutes: value })}
                />
              </EditorField>
              <EditorField label="Exterior faces" hint={faceError} className="block">
                <select
                  aria-label="Exterior faces"
                  className="h-9 rounded-md border border-[#E4D9CC] bg-white px-2 text-sm focus:border-burgundy focus:outline-none focus:ring-1 focus:ring-burgundy"
                  value={form.exterior_finish_sides}
                  onChange={(event) => setForm({ ...form, exterior_finish_sides: event.target.value })}
                >
                  <option value="0">0</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                </select>
              </EditorField>
              <EditorField label="Interior faces" className="block">
                <select
                  aria-label="Interior faces"
                  className="h-9 rounded-md border border-[#E4D9CC] bg-white px-2 text-sm focus:border-burgundy focus:outline-none focus:ring-1 focus:ring-burgundy"
                  value={form.interior_finish_sides}
                  onChange={(event) => setForm({ ...form, interior_finish_sides: event.target.value })}
                >
                  <option value="0">0</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                </select>
              </EditorField>
            </div>
            <EditorField label="Notes">
              <textarea
                className={editorInputClass}
                rows={2}
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
              />
            </EditorField>
            <aside className="rounded-lg bg-cream p-3">
              <h3 className="text-sm font-semibold text-gray-900">Sample cabinet</h3>
              <p className="mt-0.5 text-xs text-gray-500">Preview only. These sizes are not saved on the component.</p>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {dimKeys.map((key) => (
                  <label key={key} className="text-[11px] text-gray-500">
                    {key}
                    <input
                      className="mt-1 w-full rounded-md border border-[#E4D9CC] bg-white px-2 py-1 text-sm tabular-nums text-gray-900 focus:border-burgundy focus:outline-none focus:ring-1 focus:ring-burgundy"
                      inputMode="decimal"
                      value={dims[key]}
                      onChange={(event) => setDims({ ...dims, [key]: event.target.value })}
                    />
                  </label>
                ))}
              </div>
              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500">Length</dt>
                  <dd className="tabular-nums">{preview.length.ok ? `${preview.length.value} in` : "—"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500">Width</dt>
                  <dd className="tabular-nums">{preview.width.ok ? `${preview.width.value} in` : "—"}</dd>
                </div>
                {slots.find((slot) => slot.id === form.slot_id)?.slot_type === "drawer_box" ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-gray-500">Height</dt>
                    <dd className="tabular-nums">{preview.height.ok ? `${preview.height.value} in` : "—"}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500">Qty</dt>
                  <dd className="tabular-nums">{preview.qty.ok ? preview.qty.value : "—"}</dd>
                </div>
              </dl>
            </aside>
          </div>
        </SlideOver>
      ) : null}

      {pendingDelete ? (
        <ConfirmModal
          title="Delete component"
          body={`Remove ${pendingDelete.name}?`}
          confirmLabel="Delete"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            void deleteRow("costing_components", pendingDelete.id).then((message) => {
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
        <Modal title="This component is in use" onClose={() => setBlocked(null)}>
          <p className="text-sm text-gray-600">{blocked}</p>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => setBlocked(null)}>Close</Button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
