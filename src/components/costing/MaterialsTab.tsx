"use client";

import { useEffect, useMemo, useState } from "react";
import { IconStack2 } from "@tabler/icons-react";
import Button from "@/components/Button";
import ConfirmModal from "@/components/ConfirmModal";
import FilterPills from "@/components/FilterPills";
import Modal from "@/components/Modal";
import { formatCurrencyPrecise } from "@/lib/utils";
import {
  deleteRow,
  fetchMaterialCategories,
  fetchMaterials,
  materialUsage,
  saveMaterial,
  saveMaterialCategory,
  type CostingMaterial,
  type CostingMaterialCategory,
  type CostingSettings,
  type MaterialType,
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

const TYPES: MaterialType[] = ["sheet", "lumber", "sqft", "linear_ft", "each"];

const UNIT_LABEL: Record<MaterialType, string> = {
  sheet: "Per sheet",
  lumber: "Board foot",
  sqft: "Sq ft",
  linear_ft: "Linear ft",
  each: "Each",
};

const PRICE_SUFFIX: Record<MaterialType, string> = {
  sheet: "/ sheet",
  lumber: "/ bf",
  sqft: "/ sq ft",
  linear_ft: "/ lin ft",
  each: "ea",
};

const PRICE_LABEL: Record<MaterialType, string> = {
  sheet: "Price per sheet",
  lumber: "Price per board foot",
  sqft: "Price per sq ft",
  linear_ft: "Price per linear ft",
  each: "Price each",
};

type FormState = {
  id?: string;
  name: string;
  category_id: string;
  customCategory: string;
  material_type: MaterialType;
  unit_price: string;
  sheet_length: string;
  sheet_width: string;
  thickness: string;
  rough_thickness: string;
  waste_pct: string;
  supplier: string;
  notes: string;
  active: boolean;
};

function gcd(left: number, right: number): number {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a || 1;
}

function formatInches(value: number) {
  const denominator = 16;
  let numerator = Math.round(value * denominator);
  const divisor = gcd(numerator, denominator);
  numerator /= divisor;
  const reduced = denominator / divisor;
  if (reduced === 1) return String(numerator);
  return `${numerator}/${reduced}`;
}

function thicknessLabel(row: CostingMaterial) {
  const finished = row.thickness == null ? null : `${formatInches(row.thickness)} in`;
  if (row.material_type === "lumber" && row.rough_thickness != null) {
    const quarters = Math.round(row.rough_thickness * 4);
    const rough = `${quarters}/4`;
    return finished ? `${finished} · ${rough}` : rough;
  }
  return finished ?? "—";
}

function blank(settings: CostingSettings | null, categoryId: string): FormState {
  return {
    name: "",
    category_id: categoryId,
    customCategory: "",
    material_type: "sheet",
    unit_price: "",
    sheet_length: "96",
    sheet_width: "48",
    thickness: "0.75",
    rough_thickness: "1",
    waste_pct: String(settings?.default_waste_sheet_pct ?? 15),
    supplier: "",
    notes: "",
    active: true,
  };
}

function fromRow(row: CostingMaterial): FormState {
  return {
    id: row.id,
    name: row.name,
    category_id: row.category_id,
    customCategory: "",
    material_type: row.material_type,
    unit_price: String(row.unit_price),
    sheet_length: row.sheet_length == null ? "96" : String(row.sheet_length),
    sheet_width: row.sheet_width == null ? "48" : String(row.sheet_width),
    thickness: row.thickness == null ? "" : String(row.thickness),
    rough_thickness: row.rough_thickness == null ? "1" : String(row.rough_thickness),
    waste_pct: String(row.waste_pct),
    supplier: row.supplier,
    notes: row.notes,
    active: row.active,
  };
}

export default function MaterialsTab({
  settings,
  onChanged,
}: {
  settings: CostingSettings | null;
  onChanged?: () => void;
}) {
  const [rows, setRows] = useState<CostingMaterial[]>([]);
  const [categories, setCategories] = useState<CostingMaterialCategory[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [form, setForm] = useState<FormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CostingMaterial | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);

  async function load() {
    const [materials, categoryRows] = await Promise.all([fetchMaterials(), fetchMaterialCategories()]);
    setRows(materials.rows);
    setCategories(categoryRows.rows);
    setError(materials.error ?? categoryRows.error);
    setLoaded(true);
  }

  useEffect(() => {
    void load();
  }, []);

  const categoryName = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories]
  );

  const pillOptions = useMemo(() => {
    const options = [{ value: "all", label: "All" }];
    for (const category of categories) {
      const count = rows.filter(
        (row) => row.category_id === category.id && (showInactive || row.active)
      ).length;
      if (count === 0) continue;
      options.push({ value: category.id, label: `${category.name} (${count})` });
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
        if (categoryFilter !== "all" && row.category_id !== categoryFilter) return false;
        return matchesSearch(search, [
          row.name,
          categoryName.get(row.category_id),
          UNIT_LABEL[row.material_type],
          row.supplier,
          row.notes,
        ]);
      }),
    [rows, search, showInactive, categoryFilter, categoryName]
  );

  function defaultCategoryId() {
    return categories.find((category) => category.name === "Plywood")?.id ?? categories[0]?.id ?? "";
  }

  function openNew() {
    setFormError(null);
    setForm(blank(settings, defaultCategoryId()));
  }

  function openEdit(row: CostingMaterial) {
    setFormError(null);
    setForm(fromRow(row));
  }

  function closeEditor() {
    if (saving) return;
    setForm(null);
    setFormError(null);
  }

  function changeType(materialType: MaterialType) {
    setForm((current) => {
      if (!current) return current;
      const waste =
        materialType === "sheet"
          ? (settings?.default_waste_sheet_pct ?? 15)
          : materialType === "lumber"
            ? (settings?.default_waste_lumber_pct ?? 30)
            : 0;
      return { ...current, material_type: materialType, waste_pct: String(waste) };
    });
  }

  async function submit() {
    if (!form || saving) return;
    const unitPrice = parseRequiredNumber(form.unit_price, "price");
    const waste = parseRequiredNumber(form.waste_pct, "waste percent");
    const categoryNameInput = (form.category_id === "__new" ? form.customCategory : "").trim();
    if (!form.name.trim()) return setFormError("Enter a name");
    if (form.category_id === "__new" && !categoryNameInput) return setFormError("Enter a category");
    if (!form.category_id) return setFormError("Choose a category");
    if (typeof unitPrice === "string") return setFormError(unitPrice);
    if (typeof waste === "string") return setFormError(waste);
    const thickness = form.thickness.trim() ? Number(form.thickness) : null;
    const sheetLength = form.material_type === "sheet" ? Number(form.sheet_length) : null;
    const sheetWidth = form.material_type === "sheet" ? Number(form.sheet_width) : null;
    const rough = form.material_type === "lumber" ? Number(form.rough_thickness) : null;
    if (form.material_type === "sheet" && (!(sheetLength && sheetLength > 0) || !(sheetWidth && sheetWidth > 0))) {
      return setFormError("Enter the sheet length and width");
    }
    if (form.material_type === "lumber" && !(rough && rough > 0)) {
      return setFormError("Enter the rough thickness used for board feet");
    }
    setFormError(null);
    setSaving(true);
    try {
      let categoryId = form.category_id;
      if (form.category_id === "__new") {
        const created = await saveMaterialCategory(categoryNameInput);
        if (created.error || !created.id) return setFormError(created.error ?? "Could not save the category");
        categoryId = created.id;
      }
      const message = await saveMaterial({
        id: form.id,
        name: form.name,
        category_id: categoryId,
        material_type: form.material_type,
        unit_price: unitPrice,
        sheet_length: sheetLength,
        sheet_width: sheetWidth,
        thickness: thickness != null && Number.isFinite(thickness) ? thickness : null,
        rough_thickness: rough,
        waste_pct: waste,
        supplier: form.supplier,
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

  async function setActive(row: CostingMaterial, active: boolean) {
    const message = await saveMaterial({ ...row, active });
    if (message) {
      setError(message);
      return;
    }
    if (form?.id === row.id) setForm({ ...fromRow(row), active });
    await load();
    onChanged?.();
  }

  async function duplicate(row: CostingMaterial) {
    const message = await saveMaterial({
      name: `${row.name} copy`,
      category_id: row.category_id,
      material_type: row.material_type,
      unit_price: row.unit_price,
      sheet_length: row.sheet_length,
      sheet_width: row.sheet_width,
      thickness: row.thickness,
      rough_thickness: row.rough_thickness,
      waste_pct: row.waste_pct,
      supplier: row.supplier,
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

  async function askDelete(row: CostingMaterial) {
    const used = await materialUsage(row.id);
    if (used.length) {
      setBlocked(`${row.name} is used by ${used.join(", ")}.`);
      return;
    }
    setPendingDelete(row);
  }

  const addingCategory = form?.category_id === "__new";
  const nameError = formError === "Enter a name" ? formError : undefined;
  const categoryError =
    formError === "Enter a category" || formError === "Choose a category" ? formError : undefined;
  const priceError = formError?.includes("price") && formError !== "Enter the sheet length and width" ? formError : undefined;
  const sizeError = formError === "Enter the sheet length and width" ? formError : undefined;
  const roughError = formError?.includes("rough thickness") ? formError : undefined;
  const wasteError = formError?.includes("waste") ? formError : undefined;
  const generalError =
    formError && !nameError && !categoryError && !priceError && !sizeError && !roughError && !wasteError
      ? formError
      : undefined;
  const libraryEmpty = loaded && rows.length === 0 && !error;

  return (
    <>
      {error ? <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <ListCard>
        <ListHeader
          title="Materials"
          count={loaded ? visible.length : 0}
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search materials"
          actionLabel="Add material"
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
          <p className="px-6 py-10 text-sm text-gray-500">Loading materials…</p>
        ) : libraryEmpty ? (
          <EmptyState
            icon={IconStack2}
            title="No materials yet"
            body="Add plywood, hardwood, and the other materials the shop buys."
            actionLabel="Add material"
            onAction={openNew}
          />
        ) : (
          <DataTable
            rows={visible}
            activeId={form?.id}
            initialSort={{ id: "name", dir: "asc" }}
            onRowClick={openEdit}
            empty={<p className="px-6 py-10 text-center text-sm text-gray-500">No materials match.</p>}
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
                sortValue: (row) => categoryName.get(row.category_id) ?? "",
                cell: (row) => {
                  const name = categoryName.get(row.category_id) ?? "—";
                  return <Badge tone={toneForLabel(name)}>{name}</Badge>;
                },
              },
              {
                id: "unit",
                header: "Unit",
                sortValue: (row) => UNIT_LABEL[row.material_type],
                cell: (row) => <span className="text-gray-700">{UNIT_LABEL[row.material_type]}</span>,
              },
              {
                id: "thickness",
                header: "Thickness",
                sortValue: (row) => row.thickness ?? -1,
                cell: (row) => <span className="whitespace-nowrap tabular-nums text-gray-800">{thicknessLabel(row)}</span>,
              },
              {
                id: "price",
                header: "Price",
                align: "right",
                sortValue: (row) => row.unit_price,
                cell: (row) => (
                  <span className="whitespace-nowrap">
                    <span className="tabular-nums text-gray-900">{formatCurrencyPrecise(row.unit_price)}</span>
                    <span className="ml-1 text-gray-400">{PRICE_SUFFIX[row.material_type]}</span>
                  </span>
                ),
              },
              {
                id: "waste",
                header: "Waste",
                align: "right",
                sortValue: (row) => row.waste_pct,
                cell: (row) => (
                  <span className="whitespace-nowrap">
                    <span className="tabular-nums text-gray-900">{row.waste_pct}</span>
                    <span className="text-gray-400">%</span>
                  </span>
                ),
              },
              {
                id: "supplier",
                header: "Supplier",
                sortValue: (row) => row.supplier,
                cell: (row) =>
                  row.supplier.trim() ? (
                    <span className="text-gray-700">{row.supplier}</span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  ),
              },
            ]}
          />
        )}
      </ListCard>

      {form ? (
        <SlideOver
          title={form.id ? "Edit material" : "Add material"}
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
                value={form.category_id === "__new" || categories.some((category) => category.id === form.category_id) ? form.category_id : "__new"}
                onChange={(event) => setForm({ ...form, category_id: event.target.value })}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
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
            <EditorField label="Unit">
              <select
                className={editorInputClass}
                value={form.material_type}
                onChange={(event) => changeType(event.target.value as MaterialType)}
              >
                {TYPES.map((type) => (
                  <option key={type} value={type}>
                    {UNIT_LABEL[type]}
                  </option>
                ))}
              </select>
            </EditorField>
            <EditorField label={PRICE_LABEL[form.material_type]} hint={priceError}>
              <div className="inline-flex h-9 items-center rounded-md border border-[#E4D9CC] bg-white focus-within:border-burgundy focus-within:ring-1 focus-within:ring-burgundy">
                <span className="pl-2 text-sm text-gray-400">$</span>
                <input
                  aria-label={PRICE_LABEL[form.material_type]}
                  inputMode="decimal"
                  value={form.unit_price}
                  onChange={(event) => setForm({ ...form, unit_price: event.target.value })}
                  className="w-24 bg-transparent px-2 py-1.5 text-sm tabular-nums text-gray-900 outline-none"
                />
                <span className="pr-2 text-xs text-gray-400">{PRICE_SUFFIX[form.material_type]}</span>
              </div>
            </EditorField>
            {form.material_type === "sheet" ? (
              <div className="flex flex-wrap gap-4">
                <EditorField label="Sheet length" hint={sizeError}>
                  <div className="inline-flex h-9 items-center rounded-md border border-[#E4D9CC] bg-white focus-within:border-burgundy focus-within:ring-1 focus-within:ring-burgundy">
                    <input
                      aria-label="Sheet length"
                      inputMode="decimal"
                      value={form.sheet_length}
                      onChange={(event) => setForm({ ...form, sheet_length: event.target.value })}
                      className="w-16 bg-transparent px-2 py-1.5 text-sm tabular-nums outline-none"
                    />
                    <span className="pr-2 text-xs text-gray-400">in</span>
                  </div>
                </EditorField>
                <EditorField label="Sheet width">
                  <div className="inline-flex h-9 items-center rounded-md border border-[#E4D9CC] bg-white focus-within:border-burgundy focus-within:ring-1 focus-within:ring-burgundy">
                    <input
                      aria-label="Sheet width"
                      inputMode="decimal"
                      value={form.sheet_width}
                      onChange={(event) => setForm({ ...form, sheet_width: event.target.value })}
                      className="w-16 bg-transparent px-2 py-1.5 text-sm tabular-nums outline-none"
                    />
                    <span className="pr-2 text-xs text-gray-400">in</span>
                  </div>
                </EditorField>
              </div>
            ) : null}
            {form.material_type === "sheet" || form.material_type === "lumber" || form.material_type === "sqft" ? (
              <EditorField label="Finished thickness">
                <div className="inline-flex h-9 items-center rounded-md border border-[#E4D9CC] bg-white focus-within:border-burgundy focus-within:ring-1 focus-within:ring-burgundy">
                  <input
                    aria-label="Finished thickness"
                    inputMode="decimal"
                    value={form.thickness}
                    onChange={(event) => setForm({ ...form, thickness: event.target.value })}
                    className="w-16 bg-transparent px-2 py-1.5 text-sm tabular-nums outline-none"
                  />
                  <span className="pr-2 text-xs text-gray-400">in</span>
                </div>
              </EditorField>
            ) : null}
            {form.material_type === "lumber" ? (
              <EditorField label="Rough thickness for board feet" hint={roughError}>
                <div className="inline-flex h-9 items-center rounded-md border border-[#E4D9CC] bg-white focus-within:border-burgundy focus-within:ring-1 focus-within:ring-burgundy">
                  <input
                    aria-label="Rough thickness"
                    inputMode="decimal"
                    value={form.rough_thickness}
                    onChange={(event) => setForm({ ...form, rough_thickness: event.target.value })}
                    className="w-16 bg-transparent px-2 py-1.5 text-sm tabular-nums outline-none"
                  />
                  <span className="pr-2 text-xs text-gray-400">in</span>
                </div>
              </EditorField>
            ) : null}
            <EditorField label="Waste" hint={wasteError}>
              <div className="inline-flex h-9 items-center rounded-md border border-[#E4D9CC] bg-white focus-within:border-burgundy focus-within:ring-1 focus-within:ring-burgundy">
                <input
                  aria-label="Waste percent"
                  inputMode="decimal"
                  value={form.waste_pct}
                  onChange={(event) => setForm({ ...form, waste_pct: event.target.value })}
                  className="w-16 bg-transparent px-2 py-1.5 text-sm tabular-nums outline-none"
                />
                <span className="pr-2 text-xs text-gray-400">%</span>
              </div>
            </EditorField>
            <EditorField label="Supplier">
              <input
                className={editorInputClass}
                value={form.supplier}
                onChange={(event) => setForm({ ...form, supplier: event.target.value })}
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
          title="Delete material"
          body={`Remove ${pendingDelete.name}?`}
          confirmLabel="Delete"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            void deleteRow("costing_materials", pendingDelete.id).then((message) => {
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
        <Modal title="This material is in use" onClose={() => setBlocked(null)}>
          <p className="text-sm text-gray-600">{blocked}</p>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => setBlocked(null)}>Close</Button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
