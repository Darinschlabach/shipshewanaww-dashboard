"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import Button from "@/components/Button";
import ConfirmModal from "@/components/ConfirmModal";
import Modal from "@/components/Modal";
import {
  calculateCabinet,
  roundMoney,
  type CabinetCost,
  type CostingMaterial as PricedMaterial,
  type QuantityUnit,
} from "@/lib/costing/calculate";
import {
  addTemplateHardware,
  addTemplatePart,
  categoryUsage,
  deleteRow,
  duplicateTemplate,
  fetchCategories,
  fetchComponents,
  fetchDoors,
  fetchDrawerBoxes,
  fetchFinishes,
  fetchHardware,
  fetchMaterials,
  fetchScheduleItems,
  fetchScheduleOverrides,
  fetchSchedules,
  fetchSettings,
  fetchSlots,
  fetchTemplateHardware,
  fetchTemplateParts,
  fetchTemplates,
  fetchVariables,
  saveCategory,
  saveTemplate,
  templateUsage,
  updateTemplateHardware,
  updateTemplatePart,
  type CostingCategory,
  type CostingComponent,
  type CostingDoor,
  type CostingDrawerBox,
  type CostingFinish,
  type CostingHardware,
  type CostingMaterial,
  type CostingSchedule,
  type CostingScheduleComponentOverride,
  type CostingScheduleItem,
  type CostingSettings,
  type CostingSlot,
  type CostingTemplate,
  type CostingVariable,
  type TemplateHardwareRow,
  type TemplatePart,
} from "@/lib/costing/db";
import { ensureSampleCabinet } from "@/lib/costing/seed";
import { choiceIdForSlot } from "@/lib/costing/schedule-choice";
import { formatCurrencyPrecise } from "@/lib/utils";
import { Field, LibraryToolbar, inputClass, matchesSearch, parseRequiredNumber } from "@/components/costing/ui";

type EditorMode = { kind: "list" } | { kind: "edit"; template: CostingTemplate | null };

const UNIT_LABEL: Record<QuantityUnit, string> = {
  sqft: "sq ft",
  board_ft: "bf",
  linear_ft: "lin ft",
  each: "ea",
  cuft: "cu ft",
};

export default function CabinetsTab() {
  const [categories, setCategories] = useState<CostingCategory[]>([]);
  const [templates, setTemplates] = useState<CostingTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [mode, setMode] = useState<EditorMode>({ kind: "list" });
  const [categoryName, setCategoryName] = useState("");
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [blocked, setBlocked] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CostingTemplate | null>(null);
  const [pendingCategory, setPendingCategory] = useState<CostingCategory | null>(null);

  async function load() {
    const seedError = await ensureSampleCabinet();
    const [categoryResult, templateResult] = await Promise.all([
      fetchCategories(),
      fetchTemplates(),
    ]);
    setCategories(categoryResult.rows);
    setTemplates(templateResult.rows);
    setError(seedError ?? categoryResult.error ?? templateResult.error);
  }

  useEffect(() => {
    void load();
  }, []);

  const visible = useMemo(() => {
    return templates.filter((row) => {
      if (!showInactive && !row.active) return false;
      const category = categories.find((item) => item.id === row.category_id)?.name;
      return matchesSearch(search, [row.name, category, row.notes]);
    });
  }, [templates, categories, search, showInactive]);

  async function addCategory() {
    const name = categoryName.trim();
    if (!name) return;
    const sort = categories.reduce((max, row) => Math.max(max, row.sort_order), 0) + 1;
    const message = await saveCategory({ name, sort_order: sort });
    if (message) {
      setError(message);
      return;
    }
    setCategoryName("");
    await load();
  }

  async function renameCategory(category: CostingCategory) {
    const name = renameValue.trim();
    setRenameId(null);
    if (!name || name === category.name) return;
    const message = await saveCategory({ id: category.id, name, sort_order: category.sort_order });
    if (message) setError(message);
    await load();
  }

  async function removeCategory(category: CostingCategory) {
    const used = await categoryUsage(category.id);
    if (used.length) {
      setBlocked(`"${category.name}" is used by:\n${used.join("\n")}`);
      setPendingCategory(null);
      return;
    }
    const message = await deleteRow("costing_cabinet_categories", category.id);
    setPendingCategory(null);
    if (message) setError(message);
    await load();
  }

  async function copyTemplate(template: CostingTemplate) {
    const message = await duplicateTemplate(template);
    if (message) setError(message);
    await load();
  }

  async function removeTemplate(template: CostingTemplate) {
    const used = await templateUsage(template.id);
    if (used.length) {
      setBlocked(`"${template.name}" is on a quote:\n${used.join("\n")}`);
      setPendingDelete(null);
      return;
    }
    const message = await deleteRow("costing_cabinet_templates", template.id);
    setPendingDelete(null);
    if (message) setError(message);
    await load();
  }

  if (mode.kind === "edit") {
    return (
      <TemplateEditor
        initial={mode.template}
        categories={categories}
        onBack={() => {
          setMode({ kind: "list" });
          void load();
        }}
      />
    );
  }

  return (
    <section>
      <LibraryToolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search cabinets"
        addLabel="New cabinet"
        onAdd={() => setMode({ kind: "edit", template: null })}
        showInactive={showInactive}
        onShowInactive={setShowInactive}
      />
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">Categories</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {categories.map((category) =>
            renameId === category.id ? (
              <input
                key={category.id}
                value={renameValue}
                autoFocus
                onChange={(event) => setRenameValue(event.target.value)}
                onBlur={() => void renameCategory(category)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void renameCategory(category);
                }}
                className={`${inputClass} w-40`}
              />
            ) : (
              <span
                key={category.id}
                className="inline-flex items-center gap-2 rounded-full bg-cream px-3 py-1 text-sm text-gray-800"
              >
                {category.name}
                <button
                  type="button"
                  className="text-xs text-burgundy"
                  onClick={() => {
                    setRenameId(category.id);
                    setRenameValue(category.name);
                  }}
                >
                  Rename
                </button>
                <button
                  type="button"
                  className="text-xs text-gray-500"
                  onClick={() => setPendingCategory(category)}
                >
                  Delete
                </button>
              </span>
            )
          )}
        </div>
        <div className="mt-3 flex max-w-md gap-2">
          <input
            value={categoryName}
            onChange={(event) => setCategoryName(event.target.value)}
            placeholder="New category"
            className={inputClass}
          />
          <Button type="button" variant="small" onClick={() => void addCategory()}>
            Add
          </Button>
        </div>
      </div>
      <div className="space-y-6">
        {categories.map((category) => {
          const rows = visible.filter((row) => row.category_id === category.id);
          if (!rows.length) return null;
          return (
            <div key={category.id}>
              <h2 className="mb-2 rounded-md bg-cream px-3 py-2 text-sm font-semibold text-gray-900">
                {category.name}
              </h2>
              <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-2">Cabinet</th>
                      <th className="px-4 py-2">Defaults</th>
                      <th className="px-4 py-2">Base labor</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="border-t border-gray-100">
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            className="font-medium text-burgundy"
                            onClick={() => setMode({ kind: "edit", template: row })}
                          >
                            {row.name}
                          </button>
                          {!row.active ? (
                            <span className="ml-2 text-xs text-gray-500">Inactive</span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {row.default_height} × {row.default_width} × {row.default_depth}
                          <span className="ml-2 text-xs text-gray-500">
                            {row.default_doors} doors, {row.default_drawers} drawers, {row.default_shelves} shelves
                          </span>
                        </td>
                        <td className="px-4 py-3">{row.base_labor_minutes} min</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            className="mr-3 text-sm text-gray-700"
                            onClick={() => void copyTemplate(row)}
                          >
                            Duplicate
                          </button>
                          <button
                            type="button"
                            className="text-sm text-red-700"
                            onClick={() => setPendingDelete(row)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
        {!visible.length ? (
          <p className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-500">
            No cabinets yet. Add one, or reload if the sample base cabinet is still saving.
          </p>
        ) : null}
      </div>
      {pendingDelete ? (
        <ConfirmModal
          title={`Delete ${pendingDelete.name}?`}
          body="This removes the template and its part list. Components in the library stay."
          confirmLabel="Delete"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void removeTemplate(pendingDelete)}
        />
      ) : null}
      {pendingCategory ? (
        <ConfirmModal
          title={`Delete ${pendingCategory.name}?`}
          body="You can delete a category only when no cabinet uses it."
          confirmLabel="Delete"
          onCancel={() => setPendingCategory(null)}
          onConfirm={() => void removeCategory(pendingCategory)}
        />
      ) : null}
      {blocked ? (
        <Modal title="Still in use" onClose={() => setBlocked(null)}>
          <p className="whitespace-pre-wrap text-sm text-gray-700">{blocked}</p>
        </Modal>
      ) : null}
    </section>
  );
}

function TemplateEditor({
  initial,
  categories,
  onBack,
}: {
  initial: CostingTemplate | null;
  categories: CostingCategory[];
  onBack: () => void;
}) {
  const [template, setTemplate] = useState<CostingTemplate | null>(initial);
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    category_id: initial?.category_id ?? categories[0]?.id ?? "",
    height: String(initial?.default_height ?? 34.5),
    width: String(initial?.default_width ?? 24),
    depth: String(initial?.default_depth ?? 24),
    doors: String(initial?.default_doors ?? 1),
    drawers: String(initial?.default_drawers ?? 0),
    shelves: String(initial?.default_shelves ?? 1),
    labor: String(initial?.base_labor_minutes ?? 0),
    notes: initial?.notes ?? "",
    active: initial?.active ?? true,
  });
  const [preview, setPreview] = useState({
    H: String(initial?.default_height ?? 34.5),
    W: String(initial?.default_width ?? 24),
    D: String(initial?.default_depth ?? 24),
    DOORS: String(initial?.default_doors ?? 1),
    DRAWERS: String(initial?.default_drawers ?? 0),
    SHELVES: String(initial?.default_shelves ?? 1),
  });
  const [parts, setParts] = useState<TemplatePart[]>([]);
  const [hardwareRows, setHardwareRows] = useState<TemplateHardwareRow[]>([]);
  const [components, setComponents] = useState<CostingComponent[]>([]);
  const [slots, setSlots] = useState<CostingSlot[]>([]);
  const [materials, setMaterials] = useState<CostingMaterial[]>([]);
  const [doors, setDoors] = useState<CostingDoor[]>([]);
  const [drawerBoxes, setDrawerBoxes] = useState<CostingDrawerBox[]>([]);
  const [finishes, setFinishes] = useState<CostingFinish[]>([]);
  const [hardware, setHardware] = useState<CostingHardware[]>([]);
  const [schedules, setSchedules] = useState<CostingSchedule[]>([]);
  const [items, setItems] = useState<CostingScheduleItem[]>([]);
  const [overrides, setOverrides] = useState<CostingScheduleComponentOverride[]>([]);
  const [itemsFor, setItemsFor] = useState<string | null>(null);
  const [scheduleId, setScheduleId] = useState("");
  const [settings, setSettings] = useState<CostingSettings | null>(null);
  const [variables, setVariables] = useState<CostingVariable[]>([]);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [showInactiveHardware, setShowInactiveHardware] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const skipClick = useRef(false);
  const templateId = template?.id ?? null;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    let cancelled = false;
    async function loadLibrary() {
      const [
        componentResult,
        slotResult,
        materialResult,
        doorResult,
        drawerResult,
        finishResult,
        hardwareResult,
        scheduleResult,
        settingsResult,
        variableResult,
      ] = await Promise.all([
        fetchComponents(),
        fetchSlots(),
        fetchMaterials(),
        fetchDoors(),
        fetchDrawerBoxes(),
        fetchFinishes(),
        fetchHardware(),
        fetchSchedules(),
        fetchSettings(),
        fetchVariables(),
      ]);
      if (cancelled) return;
      setComponents(componentResult.rows);
      setSlots(slotResult.rows);
      setMaterials(materialResult.rows);
      setDoors(doorResult.rows);
      setDrawerBoxes(drawerResult.rows);
      setFinishes(finishResult.rows);
      setHardware(hardwareResult.rows);
      setSchedules(scheduleResult.rows);
      setSettings(settingsResult.row);
      setVariables(variableResult.rows);
      setError(
        componentResult.error ??
          slotResult.error ??
          materialResult.error ??
          doorResult.error ??
          drawerResult.error ??
          finishResult.error ??
          hardwareResult.error ??
          scheduleResult.error ??
          settingsResult.error ??
          variableResult.error
      );
      const maple = scheduleResult.rows.find(
        (row) => row.active && row.name === "SAMPLE – Maple/Maple"
      );
      const first = scheduleResult.rows.find((row) => row.active) ?? scheduleResult.rows[0];
      setScheduleId((maple ?? first)?.id ?? "");
    }
    void loadLibrary();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!templateId) return;
    let cancelled = false;
    async function loadLines() {
      const [partResult, hardwareResult] = await Promise.all([
        fetchTemplateParts(templateId as string),
        fetchTemplateHardware(templateId as string),
      ]);
      if (cancelled) return;
      setParts(partResult.rows);
      setHardwareRows(hardwareResult.rows);
      setError(partResult.error ?? hardwareResult.error);
    }
    void loadLines();
    return () => {
      cancelled = true;
    };
  }, [templateId]);

  useEffect(() => {
    if (!scheduleId) return;
    let cancelled = false;
    async function loadItems() {
      const [result, overrideResult] = await Promise.all([
        fetchScheduleItems(scheduleId),
        fetchScheduleOverrides(scheduleId),
      ]);
      if (cancelled) return;
      setItems(result.rows);
      setOverrides(overrideResult.error ? [] : overrideResult.rows);
      setItemsFor(scheduleId);
      if (result.error || overrideResult.error) setError(result.error ?? overrideResult.error);
    }
    void loadItems();
    return () => {
      cancelled = true;
    };
  }, [scheduleId]);

  const componentById = useMemo(
    () => new Map(components.map((row) => [row.id, row])),
    [components]
  );
  const slotById = useMemo(() => new Map(slots.map((row) => [row.id, row])), [slots]);
  const hardwareById = useMemo(() => new Map(hardware.map((row) => [row.id, row])), [hardware]);

  const cost = useMemo(() => {
    if (!settings || !scheduleId || itemsFor !== scheduleId) return null;
    const height = Number(preview.H);
    const width = Number(preview.W);
    const depth = Number(preview.D);
    const doorCount = Number(preview.DOORS);
    const drawerCount = Number(preview.DRAWERS);
    const shelfCount = Number(preview.SHELVES);
    if (!(height > 0) || !(width > 0) || !(depth > 0)) return null;
    if (![doorCount, drawerCount, shelfCount].every((value) => Number.isInteger(value) && value >= 0)) {
      return null;
    }
    return priceTemplate({
      height,
      width,
      depth,
      doors: doorCount,
      drawers: drawerCount,
      shelves: shelfCount,
      baseLaborMinutes: Number(form.labor) || 0,
      settings,
      variables,
      parts,
      hardwareRows,
      components,
      slots,
      items,
      overrides,
      materials,
      doorStyles: doors,
      drawerBoxes,
      finishes,
      hardware,
    });
  }, [
    settings,
    scheduleId,
    itemsFor,
    preview,
    form.labor,
    variables,
    parts,
    hardwareRows,
    components,
    slots,
    items,
    overrides,
    materials,
    doors,
    finishes,
    hardware,
  ]);

  const libraryComponents = components.filter((row) => {
    const slot = slotById.get(row.slot_id);
    return matchesSearch(libraryQuery, [row.name, slot?.name, row.length_formula]);
  });
  const libraryHardware = hardware.filter((row) => {
    if (!showInactiveHardware && !row.active) return false;
    return matchesSearch(libraryQuery, [row.name, row.category, row.sku]);
  });

  async function saveInfo() {
    const height = parseRequiredNumber(form.height, "height");
    const width = parseRequiredNumber(form.width, "width");
    const depth = parseRequiredNumber(form.depth, "depth");
    const doorCount = wholeCount(form.doors, "Doors");
    const drawerCount = wholeCount(form.drawers, "Drawers");
    const shelfCount = wholeCount(form.shelves, "Shelves");
    const labor = parseRequiredNumber(form.labor, "base labor");
    const problem = [height, width, depth, doorCount, drawerCount, shelfCount, labor].find(
      (value) => typeof value === "string"
    );
    if (!form.name.trim()) {
      setError("Enter a cabinet name");
      return;
    }
    if (!form.category_id) {
      setError("Choose a category");
      return;
    }
    if (typeof problem === "string") {
      setError(problem);
      return;
    }
    if (
      typeof height !== "number" ||
      typeof width !== "number" ||
      typeof depth !== "number" ||
      typeof labor !== "number" ||
      typeof doorCount !== "number" ||
      typeof drawerCount !== "number" ||
      typeof shelfCount !== "number"
    ) {
      return;
    }
    if (height <= 0 || width <= 0 || depth <= 0 || labor < 0) {
      setError("Height, width, and depth must be greater than 0. Labor cannot be negative.");
      return;
    }
    setSaving(true);
    const saved = await saveTemplate({
      id: template?.id,
      name: form.name,
      category_id: form.category_id,
      default_height: height,
      default_width: width,
      default_depth: depth,
      default_doors: doorCount,
      default_drawers: drawerCount,
      default_shelves: shelfCount,
      base_labor_minutes: labor,
      notes: form.notes,
      active: form.active,
    });
    setSaving(false);
    if (saved.error || !saved.id) {
      setError(saved.error ?? "Could not save the cabinet");
      return;
    }
    setError(null);
    setTemplate({
      id: saved.id,
      name: form.name.trim(),
      category_id: form.category_id,
      default_height: height,
      default_width: width,
      default_depth: depth,
      default_doors: doorCount,
      default_drawers: drawerCount,
      default_shelves: shelfCount,
      base_labor_minutes: labor,
      notes: form.notes.trim(),
      active: form.active,
    });
  }

  async function addPart(componentId: string) {
    if (!template) {
      setError("Save the cabinet before adding parts.");
      return;
    }
    const sort = parts.reduce((max, row) => Math.max(max, row.sort_order), -1) + 1;
    const message = await addTemplatePart(template.id, componentId, sort);
    if (message) {
      setError(message);
      return;
    }
    const fresh = await fetchTemplateParts(template.id);
    setParts(fresh.rows);
    setError(fresh.error);
  }

  async function addHardware(hardwareId: string) {
    if (!template) {
      setError("Save the cabinet before adding hardware.");
      return;
    }
    const sort = hardwareRows.reduce((max, row) => Math.max(max, row.sort_order), -1) + 1;
    const message = await addTemplateHardware(template.id, hardwareId, "1", sort);
    if (message) {
      setError(message);
      return;
    }
    const fresh = await fetchTemplateHardware(template.id);
    setHardwareRows(fresh.rows);
    setError(fresh.error);
  }

  function onDragEnd(event: DragEndEvent) {
    const active = String(event.active.id);
    const over = event.over ? String(event.over.id) : "";
    if (active.startsWith("lib-component:") && over === "drop-parts") {
      void addPart(active.slice("lib-component:".length));
    }
    if (active.startsWith("lib-hardware:") && over === "drop-hardware") {
      void addHardware(active.slice("lib-hardware:".length));
    }
    window.setTimeout(() => {
      skipClick.current = false;
    }, 0);
  }

  async function movePart(index: number, direction: -1 | 1) {
    const next = reorder(parts, index, direction);
    if (!next) return;
    setParts(next);
    for (const row of next) {
      const message = await updateTemplatePart(row.id, { sort_order: row.sort_order });
      if (message) {
        setError(message);
        return;
      }
    }
  }

  async function moveHardware(index: number, direction: -1 | 1) {
    const next = reorder(hardwareRows, index, direction);
    if (!next) return;
    setHardwareRows(next);
    for (const row of next) {
      const message = await updateTemplateHardware(row.id, { sort_order: row.sort_order });
      if (message) {
        setError(message);
        return;
      }
    }
  }

  function patchPart(id: string, patch: Partial<TemplatePart>) {
    setParts((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  async function duplicate() {
    if (!template) return;
    const message = await duplicateTemplate(template);
    setError(message);
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={() => {
        skipClick.current = true;
      }}
      onDragCancel={() => {
        window.setTimeout(() => {
          skipClick.current = false;
        }, 0);
      }}
      onDragEnd={onDragEnd}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button type="button" variant="small" onClick={onBack}>
          Back to cabinets
        </Button>
        {template ? (
          <Button type="button" variant="small" onClick={() => void duplicate()}>
            Duplicate
          </Button>
        ) : null}
        <h2 className="text-lg font-semibold text-gray-900">
          {template?.name || form.name || "New cabinet"}
        </h2>
      </div>
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[240px_minmax(0,1fr)_300px_240px]">
        <section className="order-1 rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-900">Template</h3>
          <div className="mt-3 space-y-3">
            <Field label="Name">
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Category">
              <select
                value={form.category_id}
                onChange={(event) => setForm({ ...form, category_id: event.target.value })}
                className={inputClass}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Default height">
              <input
                value={form.height}
                onChange={(event) => setForm({ ...form, height: event.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Default width">
              <input
                value={form.width}
                onChange={(event) => setForm({ ...form, width: event.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Default depth">
              <input
                value={form.depth}
                onChange={(event) => setForm({ ...form, depth: event.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Doors">
              <input
                value={form.doors}
                onChange={(event) => setForm({ ...form, doors: event.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Drawers">
              <input
                value={form.drawers}
                onChange={(event) => setForm({ ...form, drawers: event.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Shelves">
              <input
                value={form.shelves}
                onChange={(event) => setForm({ ...form, shelves: event.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Base labor minutes">
              <input
                value={form.labor}
                onChange={(event) => setForm({ ...form, labor: event.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Notes">
              <textarea
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                rows={3}
                className={inputClass}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => setForm({ ...form, active: event.target.checked })}
              />
              Active
            </label>
            <Button type="button" variant="primary" onClick={() => void saveInfo()} disabled={saving}>
              {saving ? "Saving…" : "Save template"}
            </Button>
          </div>
        </section>

        <section className="order-3 space-y-4 xl:order-2">
          <DropList id="drop-parts" title="Parts">
            {parts.map((row, index) => {
              const component = componentById.get(row.component_id);
              const slot = component ? slotById.get(component.slot_id) : undefined;
              return (
                <article key={row.id} className="rounded-md border border-gray-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {component?.name ?? "Missing component"}
                      </p>
                      <p className="text-xs text-gray-500">{slot?.name ?? "No slot"}</p>
                    </div>
                    <div className="flex gap-2 text-xs">
                      <button type="button" onClick={() => void movePart(index, -1)} disabled={index === 0}>
                        Up
                      </button>
                      <button
                        type="button"
                        onClick={() => void movePart(index, 1)}
                        disabled={index === parts.length - 1}
                      >
                        Down
                      </button>
                      <button
                        type="button"
                        className="text-red-700"
                        onClick={() => {
                          void deleteRow("costing_template_components", row.id).then((message) => {
                            if (message) setError(message);
                            else setParts((current) => current.filter((item) => item.id !== row.id));
                          });
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  {component ? (
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <OverrideField
                        label="Length"
                        value={row.length_formula}
                        fallback={component.length_formula}
                        onChange={(value) => patchPart(row.id, { length_formula: value })}
                        onReset={() => {
                          patchPart(row.id, { length_formula: null });
                          void updateTemplatePart(row.id, { length_formula: null });
                        }}
                        onCommit={(value) => void updateTemplatePart(row.id, { length_formula: value })}
                      />
                      <OverrideField
                        label="Width"
                        value={row.width_formula}
                        fallback={component.width_formula}
                        onChange={(value) => patchPart(row.id, { width_formula: value })}
                        onReset={() => {
                          patchPart(row.id, { width_formula: null });
                          void updateTemplatePart(row.id, { width_formula: null });
                        }}
                        onCommit={(value) => void updateTemplatePart(row.id, { width_formula: value })}
                      />
                      <OverrideField
                        label="Qty"
                        value={row.qty_formula}
                        fallback={component.qty_formula}
                        onChange={(value) => patchPart(row.id, { qty_formula: value })}
                        onReset={() => {
                          patchPart(row.id, { qty_formula: null });
                          void updateTemplatePart(row.id, { qty_formula: null });
                        }}
                        onCommit={(value) => void updateTemplatePart(row.id, { qty_formula: value })}
                      />
                      <OverrideNumber
                        label="Labor minutes"
                        value={row.labor_minutes}
                        fallback={component.labor_minutes}
                        onChange={(value) => patchPart(row.id, { labor_minutes: value })}
                        onReset={() => {
                          patchPart(row.id, { labor_minutes: null });
                          void updateTemplatePart(row.id, { labor_minutes: null });
                        }}
                        onCommit={(value) => void updateTemplatePart(row.id, { labor_minutes: value })}
                      />
                    </div>
                  ) : null}
                </article>
              );
            })}
            {!parts.length ? (
              <p className="text-sm text-gray-500">
                {template
                  ? "Drag a component here, or click one in the library."
                  : "Save the template, then add parts."}
              </p>
            ) : null}
          </DropList>
          <DropList id="drop-hardware" title="Hardware">
            {hardwareRows.map((row, index) => {
              const item = hardwareById.get(row.hardware_id);
              return (
                <article key={row.id} className="rounded-md border border-gray-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item?.name ?? "Missing hardware"}</p>
                      <p className="text-xs text-gray-500">{item?.category}</p>
                    </div>
                    <div className="flex gap-2 text-xs">
                      <button type="button" onClick={() => void moveHardware(index, -1)} disabled={index === 0}>
                        Up
                      </button>
                      <button
                        type="button"
                        onClick={() => void moveHardware(index, 1)}
                        disabled={index === hardwareRows.length - 1}
                      >
                        Down
                      </button>
                      <button
                        type="button"
                        className="text-red-700"
                        onClick={() => {
                          void deleteRow("costing_template_hardware", row.id).then((message) => {
                            if (message) setError(message);
                            else setHardwareRows((current) => current.filter((item) => item.id !== row.id));
                          });
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <label className="mt-2 block text-xs text-gray-600">
                    Qty formula
                    <input
                      value={row.qty_formula}
                      onChange={(event) =>
                        setHardwareRows((current) =>
                          current.map((item) =>
                            item.id === row.id ? { ...item, qty_formula: event.target.value } : item
                          )
                        )
                      }
                      onBlur={(event) => {
                        const value = event.target.value.trim();
                        if (!value) {
                          setError("Hardware quantity needs a formula.");
                          return;
                        }
                        void updateTemplateHardware(row.id, { qty_formula: value });
                      }}
                      className={`${inputClass} mt-1 py-1 text-xs`}
                    />
                  </label>
                </article>
              );
            })}
            {!hardwareRows.length ? (
              <p className="text-sm text-gray-500">Drag hardware here, or click one in the library.</p>
            ) : null}
          </DropList>
        </section>

        <div className="order-4 xl:order-3">
        <PreviewPanel
          schedules={schedules}
          scheduleId={scheduleId}
          onSchedule={setScheduleId}
          preview={preview}
          onPreview={setPreview}
          onUseDefaults={() =>
            setPreview({
              H: form.height,
              W: form.width,
              D: form.depth,
              DOORS: form.doors,
              DRAWERS: form.drawers,
              SHELVES: form.shelves,
            })
          }
          settings={settings}
          cost={cost}
        />

        </div>
        <aside className="order-2 rounded-lg border border-gray-200 bg-white p-3 xl:order-4">
          <h3 className="text-sm font-semibold text-gray-900">Library</h3>
          <p className="mt-1 text-xs text-gray-500">Drag onto a list, or click to add.</p>
          <input
            value={libraryQuery}
            onChange={(event) => setLibraryQuery(event.target.value)}
            placeholder="Search parts and hardware"
            className={`${inputClass} mt-2 py-1.5`}
          />
          <label className="mt-2 flex items-center gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={showInactiveHardware}
              onChange={(event) => setShowInactiveHardware(event.target.checked)}
            />
            Show inactive hardware
          </label>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Components</p>
          <div className="mt-1 max-h-64 space-y-1 overflow-y-auto">
            {libraryComponents.map((row) => (
              <LibraryItem
                key={row.id}
                id={`lib-component:${row.id}`}
                label={row.name}
                detail={slotById.get(row.slot_id)?.name ?? ""}
                onAdd={() => {
                  if (skipClick.current) return;
                  void addPart(row.id);
                }}
              />
            ))}
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Hardware</p>
          <div className="mt-1 max-h-64 space-y-1 overflow-y-auto">
            {libraryHardware.map((row) => (
              <LibraryItem
                key={row.id}
                id={`lib-hardware:${row.id}`}
                label={row.name}
                detail={row.category}
                onAdd={() => {
                  if (skipClick.current) return;
                  void addHardware(row.id);
                }}
              />
            ))}
          </div>
        </aside>
      </div>
    </DndContext>
  );
}

function DropList({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section
      ref={setNodeRef}
      className={`rounded-lg border bg-white p-3 ${isOver ? "border-burgundy ring-2 ring-burgundy" : "border-gray-200"}`}
    >
      <h3 className="mb-2 text-sm font-semibold text-gray-900">{title}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function LibraryItem({
  id,
  label,
  detail,
  onAdd,
}: {
  id: string;
  label: string;
  detail: string;
  onAdd: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });
  return (
    <button
      type="button"
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onAdd}
      className={`w-full rounded-md border border-gray-200 px-2 py-1.5 text-left ${
        isDragging ? "opacity-50" : "bg-white hover:border-burgundy"
      }`}
    >
      <span className="block text-sm text-gray-900">{label}</span>
      <span className="block text-[11px] text-gray-500">{detail}</span>
    </button>
  );
}

function OverrideField({
  label,
  value,
  fallback,
  onChange,
  onReset,
  onCommit,
}: {
  label: string;
  value: string | null;
  fallback: string;
  onChange: (value: string | null) => void;
  onReset: () => void;
  onCommit: (value: string | null) => void;
}) {
  const custom = value != null;
  return (
    <label className="block text-xs text-gray-600">
      <span className="mb-1 flex items-center gap-2">
        {label}
        {custom ? (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
            custom
          </span>
        ) : null}
      </span>
      <span className="flex gap-1">
        <input
          value={value ?? fallback}
          onChange={(event) => onChange(storedText(event.target.value, fallback))}
          onBlur={(event) => onCommit(storedText(event.target.value, fallback))}
          className={`${inputClass} py-1 text-xs ${custom ? "border-amber-400" : ""}`}
        />
        {custom ? (
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={onReset}
            className="shrink-0 text-xs text-burgundy"
          >
            Reset
          </button>
        ) : null}
      </span>
    </label>
  );
}

function OverrideNumber({
  label,
  value,
  fallback,
  onChange,
  onReset,
  onCommit,
}: {
  label: string;
  value: number | null;
  fallback: number;
  onChange: (value: number | null) => void;
  onReset: () => void;
  onCommit: (value: number | null) => void;
}) {
  const custom = value != null;
  return (
    <label className="block text-xs text-gray-600">
      <span className="mb-1 flex items-center gap-2">
        {label}
        {custom ? (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
            custom
          </span>
        ) : null}
      </span>
      <span className="flex gap-1">
        <input
          value={value ?? fallback}
          onChange={(event) => onChange(storedNumber(event.target.value, fallback))}
          onBlur={(event) => onCommit(storedNumber(event.target.value, fallback))}
          className={`${inputClass} py-1 text-xs ${custom ? "border-amber-400" : ""}`}
        />
        {custom ? (
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={onReset}
            className="shrink-0 text-xs text-burgundy"
          >
            Reset
          </button>
        ) : null}
      </span>
    </label>
  );
}

function PreviewPanel({
  schedules,
  scheduleId,
  onSchedule,
  preview,
  onPreview,
  onUseDefaults,
  settings,
  cost,
}: {
  schedules: CostingSchedule[];
  scheduleId: string;
  onSchedule: (id: string) => void;
  preview: { H: string; W: string; D: string; DOORS: string; DRAWERS: string; SHELVES: string };
  onPreview: (next: { H: string; W: string; D: string; DOORS: string; DRAWERS: string; SHELVES: string }) => void;
  onUseDefaults: () => void;
  settings: CostingSettings | null;
  cost: CabinetCost | null;
}) {
  const choices = schedules.filter((row) => row.active || row.id === scheduleId);
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-3">
      <h3 className="text-sm font-semibold text-gray-900">Live cost</h3>
      <label className="mt-2 block text-xs text-gray-600">
        Schedule
        <select
          value={scheduleId}
          onChange={(event) => onSchedule(event.target.value)}
          className={`${inputClass} mt-1 py-1.5`}
        >
          {choices.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {(
          [
            ["H", "H"],
            ["W", "W"],
            ["D", "D"],
            ["DOORS", "Doors"],
            ["DRAWERS", "Drawers"],
            ["SHELVES", "Shelves"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="text-[11px] text-gray-600">
            {label}
            <input
              value={preview[key]}
              onChange={(event) => onPreview({ ...preview, [key]: event.target.value })}
              className={`${inputClass} mt-1 px-2 py-1 text-xs`}
            />
          </label>
        ))}
      </div>
      <button type="button" onClick={onUseDefaults} className="mt-2 text-xs text-burgundy">
        Use template defaults
      </button>
      {settings ? (
        <p className="mt-2 text-[11px] text-gray-500">
          Labor rate {money(settings.shop_hourly_cost / Math.max(settings.worker_count, 1))} / hour. One cabinet.
        </p>
      ) : null}
      {!cost ? (
        <p className="mt-3 text-sm text-gray-500">Enter a size and pick a schedule to see the cost.</p>
      ) : (
        <>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="text-left text-[10px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="py-1 pr-2">Part</th>
                  <th className="py-1 pr-2">Size</th>
                  <th className="py-1 pr-2">Qty</th>
                  <th className="py-1 pr-2">Material</th>
                  <th className="py-1 pr-2">Used</th>
                  <th className="py-1 pr-2">Cost</th>
                  <th className="py-1">Min</th>
                </tr>
              </thead>
              <tbody>
                {cost.parts.map((part, index) => (
                  <tr key={`${part.name}-${index}`} className="border-t border-gray-100 align-top">
                    <td className="py-1 pr-2">
                      {part.name}
                      {part.error ? <span className="mt-0.5 block text-red-600">{part.error}</span> : null}
                    </td>
                    <td className="py-1 pr-2 whitespace-nowrap">
                      {part.slotType === "drawer_box"
                        ? `${dim(part.length)} × ${dim(part.width)} × ${dim(part.height)}`
                        : `${dim(part.length)} × ${dim(part.width)}`}
                    </td>
                    <td className="py-1 pr-2">{dim(part.qty)}</td>
                    <td className="py-1 pr-2">{part.drawerBoxName ?? part.doorName ?? part.materialName ?? "—"}</td>
                    <td className="py-1 pr-2 whitespace-nowrap">
                      {part.quantityUsed == null || !part.quantityUnit
                        ? "—"
                        : `${dim(part.quantityUsed)} ${UNIT_LABEL[part.quantityUnit]}`}
                    </td>
                    <td className="py-1 pr-2">
                      {money(part.materialCost + part.doorCost + part.drawerBoxCost + part.finishCost)}
                    </td>
                    <td className="py-1">{dim(part.laborMinutes)}</td>
                  </tr>
                ))}
                {cost.hardware.map((item, index) => (
                  <tr key={`${item.name}-${index}`} className="border-t border-gray-100 align-top">
                    <td className="py-1 pr-2">
                      {item.name}
                      {item.error ? <span className="mt-0.5 block text-red-600">{item.error}</span> : null}
                    </td>
                    <td className="py-1 pr-2">—</td>
                    <td className="py-1 pr-2">{dim(item.qty)}</td>
                    <td className="py-1 pr-2">Hardware</td>
                    <td className="py-1 pr-2">{item.qty == null ? "—" : `${dim(item.qty)} ea`}</td>
                    <td className="py-1 pr-2">{money(item.lineCost)}</td>
                    <td className="py-1">{dim(item.installMinutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="mt-3 space-y-1 text-sm">
            <Total label="Material" value={cost.each.materialCost} />
            <Total label="Labor" value={cost.each.laborCost} />
            <Total label="Doors" value={cost.each.doorCost} />
            <Total label="Drawer boxes" value={cost.each.drawerBoxCost} />
            <Total label="Finish" value={cost.each.finishCost} />
            <Total label="Hardware" value={cost.each.hardwareCost} />
            <div className="flex justify-between border-t border-gray-200 pt-1 font-semibold">
              <dt>Total</dt>
              <dd>{money(cost.each.totalCost)}</dd>
            </div>
          </dl>
          {cost.each.hardwareMarkup > 0 ? (
            <p className="mt-2 text-xs text-gray-500">
              Hardware markup {money(cost.each.hardwareMarkup)} is tracked separately and is not in the total.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

function Total({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-gray-700">
      <dt>{label}</dt>
      <dd>{money(value)}</dd>
    </div>
  );
}

function priceTemplate(input: {
  height: number;
  width: number;
  depth: number;
  doors: number;
  drawers: number;
  shelves: number;
  baseLaborMinutes: number;
  settings: CostingSettings;
  variables: CostingVariable[];
  parts: TemplatePart[];
  hardwareRows: TemplateHardwareRow[];
  components: CostingComponent[];
  slots: CostingSlot[];
  items: CostingScheduleItem[];
  overrides: CostingScheduleComponentOverride[];
  materials: CostingMaterial[];
  doorStyles: CostingDoor[];
  drawerBoxes: CostingDrawerBox[];
  finishes: CostingFinish[];
  hardware: CostingHardware[];
}): CabinetCost {
  const scope: Record<string, number> = {};
  for (const variable of input.variables) scope[variable.code] = variable.value;
  const itemBySlot = new Map(input.items.map((item) => [item.slot_id, item]));
  const overrideByComponent = new Map(input.overrides.map((row) => [row.component_id, row]));
  const materialById = new Map(input.materials.map((row) => [row.id, row]));
  const doorById = new Map(input.doorStyles.map((row) => [row.id, row]));
  const drawerBoxById = new Map(input.drawerBoxes.map((row) => [row.id, row]));
  const finishById = new Map(input.finishes.map((row) => [row.id, row]));
  const componentById = new Map(input.components.map((row) => [row.id, row]));
  const slotById = new Map(input.slots.map((row) => [row.id, row]));
  const hardwareById = new Map(input.hardware.map((row) => [row.id, row]));
  const exteriorSlot = input.slots.find((slot) => slot.slot_type === "exterior_finish");
  const interiorSlot = input.slots.find((slot) => slot.slot_type === "interior_finish");
  const exterior = finishById.get(itemBySlot.get(exteriorSlot?.id ?? "")?.finish_id ?? "");
  const interior = finishById.get(itemBySlot.get(interiorSlot?.id ?? "")?.finish_id ?? "");

  return calculateCabinet({
    height: input.height,
    width: input.width,
    depth: input.depth,
    doors: input.doors,
    drawers: input.drawers,
    shelves: input.shelves,
    quantity: 1,
    baseLaborMinutes: input.baseLaborMinutes,
    variables: scope,
    shopHourlyCost: input.settings.shop_hourly_cost,
    workerCount: input.settings.worker_count,
    exteriorFinish: exterior
      ? { name: exterior.name, pricePerSqft: exterior.price_per_sqft }
      : null,
    interiorFinish: interior
      ? { name: interior.name, pricePerSqft: interior.price_per_sqft }
      : null,
    parts: input.parts.flatMap((line) => {
      const component = componentById.get(line.component_id);
      if (!component) return [];
      const slot = slotById.get(component.slot_id);
      if (!slot) return [];
      const choice = itemBySlot.get(slot.id);
      const choiceId = choiceIdForSlot(slot.slot_type, choice, overrideByComponent.get(component.id));
      const material = slot.slot_type === "material" ? materialById.get(choiceId ?? "") : undefined;
      const door = slot.slot_type === "door" ? doorById.get(choiceId ?? "") : undefined;
      const drawerBox = slot.slot_type === "drawer_box" ? drawerBoxById.get(choiceId ?? "") : undefined;
      const partFinish = finishById.get(choiceId ?? "");
      return [
        {
          name: component.name,
          slotName: slot.name,
          slotType: slot.slot_type,
          lengthFormula: line.length_formula ?? component.length_formula,
          widthFormula: line.width_formula ?? component.width_formula,
          heightFormula: component.height_formula ?? "",
          qtyFormula: line.qty_formula ?? component.qty_formula,
          laborMinutes: line.labor_minutes ?? component.labor_minutes,
          exteriorFinishSides: component.exterior_finish_sides,
          interiorFinishSides: component.interior_finish_sides,
          material: material ? toPricedMaterial(material) : null,
          door: door ? { name: door.name, pricePerSqft: door.price_per_sqft } : null,
          drawerBox: drawerBox ? { name: drawerBox.name, pricePerCuft: drawerBox.price_per_cuft } : null,
          ...(slot.slot_type === "exterior_finish" && partFinish
            ? { exteriorFinish: { name: partFinish.name, pricePerSqft: partFinish.price_per_sqft } }
            : {}),
          ...(slot.slot_type === "interior_finish" && partFinish
            ? { interiorFinish: { name: partFinish.name, pricePerSqft: partFinish.price_per_sqft } }
            : {}),
        },
      ];
    }),
    hardware: input.hardwareRows.flatMap((line) => {
      const item = hardwareById.get(line.hardware_id);
      if (!item) return [];
      return [
        {
          name: item.name,
          qtyFormula: line.qty_formula,
          unitCost: item.unit_cost,
          markupPct: item.markup_pct,
          installMinutes: item.install_minutes,
        },
      ];
    }),
  });
}

function toPricedMaterial(row: CostingMaterial): PricedMaterial {
  return {
    name: row.name,
    materialType: row.material_type,
    unitPrice: row.unit_price,
    wastePct: row.waste_pct,
    sheetLength: row.sheet_length,
    sheetWidth: row.sheet_width,
    thickness: row.thickness,
    roughThickness: row.rough_thickness,
  };
}

function storedText(typed: string, fallback: string): string | null {
  return typed.trim() === fallback.trim() ? null : typed;
}

function storedNumber(typed: string, fallback: number): number | null {
  if (!typed.trim()) return null;
  const parsed = Number(typed);
  if (!Number.isFinite(parsed) || parsed === fallback) return null;
  return parsed;
}

function wholeCount(value: string, label: string): number | string {
  const parsed = parseRequiredNumber(value, label.toLowerCase());
  if (typeof parsed === "string") return parsed;
  if (!Number.isInteger(parsed) || parsed < 0) return `${label} must be a whole number, 0 or more`;
  return parsed;
}

function reorder<T extends { sort_order: number }>(rows: T[], index: number, direction: -1 | 1): T[] | null {
  const next = index + direction;
  if (next < 0 || next >= rows.length) return null;
  const copy = [...rows];
  const [row] = copy.splice(index, 1);
  copy.splice(next, 0, row);
  return copy.map((item, itemIndex) => ({ ...item, sort_order: itemIndex }));
}

function money(value: number) {
  return formatCurrencyPrecise(roundMoney(value));
}

function dim(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return String(Math.round(value * 1000) / 1000);
}
