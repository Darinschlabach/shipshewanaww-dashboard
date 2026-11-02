"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { IconDotsVertical, IconPencil, IconSearch } from "@tabler/icons-react";
import ConfirmModal from "@/components/ConfirmModal";
import Modal from "@/components/Modal";
import { useSessionState } from "@/components/catalogue-v2/session-state";
import { formatCurrencyPrecise } from "@/lib/utils";

const CATEGORIES = [
  "Plywood",
  "Hardwood",
  "Hardware",
  "Pullouts",
  "Finishes",
] as const;

const UNITS = ["Sq. Ft.", "Brd. Ft.", "Each", "Lin. Ft."] as const;

type Category = (typeof CATEGORIES)[number];
type Unit = (typeof UNITS)[number];

type Material = {
  id: string;
  name: string;
  category: Category;
  species: string;
  thickness: string;
  unit: Unit;
  cost: number;
  supplier: string;
};

const WOOD_SPECIES = [
  "Quarter Sawn White Oak",
  "Rift Sawn White Oak",
  "Reg. White Oak",
  "Sorted Light Hickory",
  "Sorted Dark Hickory",
  "Rift Sawn Red Oak",
  "Hard Maple",
  "Soft Maple",
  "White Oak",
  "Red Oak",
  "Maple",
  "Birch",
  "Oak",
  "Cherry",
  "Walnut",
  "Hickory",
  "Poplar",
  "Ash",
  "Alder",
  "Pine",
  "Mahogany",
  "Beech",
  "Cedar",
];

const STOCK_SPECIES = [
  "Maple",
  "Cherry",
  "Birch",
  "Reg. White Oak",
  "Quarter Sawn White Oak",
  "Rift Sawn White Oak",
  "Red Oak",
  "Rift Sawn Red Oak",
  "Hickory",
  "Walnut",
  "Sorted Light Hickory",
  "Sorted Dark Hickory",
] as const;

const STOCK_PRODUCTS: {
  label: string;
  thickness: string;
  category: Category;
  kind: string;
  unit: Unit;
}[] = [
  { label: '3/4"', thickness: '.75"', category: "Plywood", kind: "Plywood", unit: "Sq. Ft." },
  { label: '1/4"', thickness: '.25"', category: "Plywood", kind: "Plywood", unit: "Sq. Ft." },
  { label: '1/2"', thickness: '.5"', category: "Plywood", kind: "Plywood", unit: "Sq. Ft." },
  {
    label: '13/16"',
    thickness: '.8125"',
    category: "Hardwood",
    kind: "Hardwood",
    unit: "Brd. Ft.",
  },
];

function speciesFromName(name: string) {
  const lower = name.toLowerCase();
  return WOOD_SPECIES.find((species) => lower.includes(species.toLowerCase())) ?? "";
}

function decimalThickness(thickness: string) {
  const match = thickness.trim().match(/^(\d+)\s*\/\s*(\d+)\s*(?:"|″)$/);
  if (!match) return thickness;
  const value = Number(match[1]) / Number(match[2]);
  if (!Number.isFinite(value)) return thickness;
  const fixed = value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  const body = fixed.startsWith("0.") ? fixed.slice(1) : fixed;
  return `${body}"`;
}

function thicknessFromName(name: string) {
  const quoted = name.match(/(\d+\s*\/\s*\d+|\d+(?:\.\d+)?)\s*(?:"|″)/);
  if (quoted) return decimalThickness(`${quoted[1].replace(/\s+/g, "")}"`);
  const quarters = name.match(/\b(\d+\s*\/\s*4)\b/);
  if (quarters) return quarters[1].replace(/\s+/g, "");
  return "";
}

function stockId(kind: string, thickness: string, species: string) {
  return ["stock", kind, thickness, species]
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const STOCK_MATERIALS: Material[] = STOCK_PRODUCTS.flatMap((product) =>
  STOCK_SPECIES.map((species) => ({
    id: stockId(product.kind, product.thickness, species),
    name: `${product.label} ${species} ${product.kind}`,
    category: product.category,
    species,
    thickness: product.thickness,
    unit: product.unit,
    cost: 0,
    supplier: "",
  }))
);

function hasDecimalName(name: string) {
  return /\d*\.\d+/.test(name);
}

function withoutDecimalNames(list: Material[]) {
  const next = list.filter((item) => !hasDecimalName(item.name));
  return next.length === list.length ? list : next;
}

function withStock(list: Material[], removed: readonly string[] = []) {
  const removedNames = new Set(removed);
  const names = new Set(list.map((item) => item.name.trim().toLowerCase()));
  const missing = STOCK_MATERIALS.filter((item) => {
    const name = item.name.trim().toLowerCase();
    return !names.has(name) && !removedNames.has(name);
  });
  return missing.length === 0 ? list : [...list, ...missing];
}

const BASE_SEED: Material[] = [
  {
    id: "ply-map-34",
    name: '3/4" Maple Plywood',
    category: "Plywood",
    species: "Maple",
    thickness: '.75"',
    unit: "Sq. Ft.",
    cost: 68.5,
    supplier: "Columbia Forest Products",
  },
  {
    id: "ply-bir-12",
    name: '1/2" Birch Plywood',
    category: "Plywood",
    species: "Birch",
    thickness: '.5"',
    unit: "Sq. Ft.",
    cost: 42,
    supplier: "Columbia Forest Products",
  },
  {
    id: "lbr-hmp-44",
    name: "Hard Maple Lumber 4/4",
    category: "Hardwood",
    species: "Hard Maple",
    thickness: "4/4",
    unit: "Brd. Ft.",
    cost: 8.75,
    supplier: "Baillie Lumber",
  },
  {
    id: "hdw-blm-110",
    name: "Blum 110° Soft-Close Hinge",
    category: "Hardware",
    species: "",
    thickness: "",
    unit: "Each",
    cost: 4.25,
    supplier: "Blum Inc.",
  },
  {
    id: "edb-wo-78",
    name: 'White Oak Edge Banding 7/8"',
    category: "Hardwood",
    species: "White Oak",
    thickness: '.875"',
    unit: "Lin. Ft.",
    cost: 32,
    supplier: "Rehau",
  },
  {
    id: "fin-pcl-cs",
    name: "Pre-Cat Lacquer — Clear Satin",
    category: "Finishes",
    species: "",
    thickness: "",
    unit: "Each",
    cost: 54,
    supplier: "ML Campbell",
  },
];

const SEED: Material[] = withStock(BASE_SEED);

function pricePerUnit(cost: number, unit: string) {
  return `${formatCurrencyPrecise(cost)} / ${unit}`;
}

const EMPTY_REMOVED: string[] = [];

const inputClass =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-burgundy focus:outline-none focus:ring-1 focus:ring-burgundy";

export default function MaterialsTab() {
  const [materials, setMaterials, materialsReady] = useSessionState(
    "catalogue-v2-materials",
    SEED
  );
  const [removedNames, setRemovedNames, removedReady] = useSessionState(
    "catalogue-v2-materials-removed",
    EMPTY_REMOVED
  );
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category | "all">("all");
  const [selectedId, setSelectedId] = useState(SEED[0].id);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(
    null
  );
  const [pendingDelete, setPendingDelete] = useState<Material | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Material | null>(null);
  const [addForm, setAddForm] = useState({
    name: "",
    category: "Plywood" as Category,
    species: "",
    thickness: "",
    price: "",
    unit: "Sq. Ft." as Unit,
  });
  const nameRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return materials.filter((item) => {
      if (category !== "all" && item.category !== category) return false;
      if (!query) return true;
      return [item.name, item.category, item.species, item.thickness, item.unit, item.supplier]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [materials, search, category]);

  useEffect(() => {
    if (!menuId) return;
    function close() {
      setMenuId(null);
      setMenuPos(null);
    }
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menuId]);

  useEffect(() => {
    if (filtered.length === 0) return;
    if (!filtered.some((item) => item.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  useEffect(() => {
    if (!materialsReady) return;
    const legacyCategories: Record<string, Category> = {
      "Sheet Goods": "Plywood",
      Lumber: "Hardwood",
      Edgebanding: "Hardwood",
    };
    const legacyUnits: Record<string, Unit> = {
      Sheet: "Sq. Ft.",
      "Board Ft": "Brd. Ft.",
      Roll: "Lin. Ft.",
      Gallon: "Each",
    };
    setMaterials((list) => {
      let changed = false;
      const next = list.map((item) => {
        const category = legacyCategories[item.category as string] ?? item.category;
        const unit = legacyUnits[item.unit as string] ?? item.unit;
        const rawThickness =
          typeof item.thickness === "string" && item.thickness
            ? item.thickness
            : thicknessFromName(item.name);
        const thickness = decimalThickness(rawThickness);
        const species =
          typeof item.species === "string" ? item.species : speciesFromName(item.name);
        if (
          category === item.category &&
          unit === item.unit &&
          thickness === item.thickness &&
          species === item.species
        ) {
          return item;
        }
        changed = true;
        return { ...item, category, unit, thickness, species };
      });
      return changed ? next : list;
    });
  }, [materialsReady, setMaterials]);

  useEffect(() => {
    if (!materialsReady || !removedReady) return;
    setMaterials((list) => withStock(withoutDecimalNames(list), removedNames));
  }, [materialsReady, removedReady, removedNames, setMaterials]);

  const selected =
    materials.find((item) => item.id === selectedId) ?? filtered[0] ?? null;

  function updateSelected(patch: Partial<Material>) {
    if (!selected) return;
    setMaterials((list) =>
      list.map((item) => (item.id === selected.id ? { ...item, ...patch } : item))
    );
  }

  function beginEdit(item: Material) {
    setSelectedId(item.id);
    setDraft({
      ...item,
      thickness: item.thickness ?? thicknessFromName(item.name),
      species: item.species ?? speciesFromName(item.name),
    });
    setEditing(true);
  }

  function discardEdit() {
    setEditing(false);
    setDraft(null);
  }

  function saveEdit() {
    if (!draft || !selected) return;
    const name = draft.name.trim();
    if (!name) return;
    updateSelected({
      name,
      category: draft.category,
      thickness: (draft.thickness ?? "").trim(),
      species: (draft.species ?? "").trim(),
      unit: draft.unit,
      cost: Number(draft.cost) || 0,
      supplier: draft.supplier,
    });
    setEditing(false);
    setDraft(null);
  }

  useEffect(() => {
    if (editing) nameRef.current?.focus();
  }, [editing]);

  const form = (editing && draft) || selected;
  const fieldClass = `${inputClass} mt-1${
    editing
      ? ""
      : " pointer-events-none cursor-default bg-gray-100 text-gray-800 disabled:cursor-default disabled:bg-gray-100 disabled:opacity-100"
  }`;

  function openAdd() {
    setAddForm({
      name: "",
      category: "Plywood",
      species: "",
      thickness: "",
      price: "",
      unit: "Sq. Ft.",
    });
    setShowAdd(true);
  }

  function submitAdd(event: React.FormEvent) {
    event.preventDefault();
    const name = addForm.name.trim();
    if (!name) return;
    const created: Material = {
      id: crypto.randomUUID(),
      name,
      category: addForm.category,
      thickness: addForm.thickness.trim() || thicknessFromName(name),
      species: addForm.species.trim() || speciesFromName(name),
      unit: addForm.unit,
      cost: Number(addForm.price) || 0,
      supplier: "",
    };
    setMaterials((list) => [created, ...list]);
    setSelectedId(created.id);
    setSearch("");
    setCategory("all");
    setShowAdd(false);
  }

  if (!materialsReady) {
    return <p className="mt-6 text-sm text-gray-500">Loading…</p>;
  }

  return (
    <div className="mt-6 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="overflow-visible rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 bg-cream">
        <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Materials</h1>
            <p className="mt-1 text-sm text-gray-500">
              All raw materials, sheet goods, hardware and finishes used in
              production.
            </p>
          </div>
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex shrink-0 items-center rounded-md bg-burgundy px-4 py-2 text-sm font-medium text-white hover:bg-burgundy/90"
          >
            + Add Material
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-3 px-4 pb-4">
          <div className="relative min-w-[200px] flex-1">
            <IconSearch
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search materials..."
              className={`${inputClass} pl-9`}
            />
          </div>
          <label className="block text-xs text-gray-500">
            Category
            <select
              value={category}
              onChange={(event) =>
                setCategory(event.target.value as Category | "all")
              }
              className={`${inputClass} mt-1 min-w-[160px]`}
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>
        </div>

        <table className="w-full table-fixed border-collapse text-left text-sm">
          <colgroup>
            <col />
            <col className="w-[15%]" />
            <col className="w-56" />
            <col className="w-24" />
            <col className="w-40" />
            <col className="w-10" />
          </colgroup>
          <thead>
            <tr className="border-y border-gray-200 bg-gray-50">
              <th className="border-r border-gray-200 px-4 py-2.5 text-xs font-medium text-gray-500">
                Name
              </th>
              <th className="border-r border-gray-200 px-2 py-2.5 text-xs font-medium text-gray-500">
                Category
              </th>
              <th className="border-r border-gray-200 px-2 py-2.5 text-xs font-medium text-gray-500">
                Wood Species
              </th>
              <th className="border-r border-gray-200 px-2 py-2.5 text-xs font-medium text-gray-500">
                Thickness
              </th>
              <th className="border-r border-gray-200 px-2 py-2.5 text-xs font-medium text-gray-500">
                Cost Per Unit
              </th>
              <th className="w-10 px-2 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => {
              const active = item.id === selected?.id;
              const menuOpen = menuId === item.id;
              return (
                <tr
                  key={item.id}
                  onClick={() => {
                    if (item.id !== selectedId) {
                      setEditing(false);
                      setDraft(null);
                    }
                    setSelectedId(item.id);
                  }}
                  className={`relative cursor-pointer border-b border-gray-100 last:border-0 ${
                    menuOpen ? "z-30" : ""
                  } ${active ? "bg-gray-50" : "hover:bg-gray-50/70"}`}
                >
                  <td className="border-r border-gray-200 px-4 py-[5px] font-medium text-gray-900">
                    {item.name}
                  </td>
                  <td className="border-r border-gray-200 px-2 py-[5px] text-gray-700">
                    {item.category}
                  </td>
                  <td className="border-r border-gray-200 px-2 py-[5px] text-gray-700">
                    {item.species ?? speciesFromName(item.name)}
                  </td>
                  <td className="whitespace-nowrap border-r border-gray-200 px-2 py-[5px] text-gray-700">
                    {item.thickness ?? thicknessFromName(item.name)}
                  </td>
                  <td className="whitespace-nowrap border-r border-gray-200 px-2 py-[5px] text-gray-900">
                    {pricePerUnit(item.cost, item.unit)}
                  </td>
                  <td className="relative px-2 py-[5px] text-right">
                    <button
                      type="button"
                      aria-label={`Actions for ${item.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedId(item.id);
                        if (menuId === item.id) {
                          setMenuId(null);
                          setMenuPos(null);
                          return;
                        }
                        const rect = event.currentTarget.getBoundingClientRect();
                        setMenuId(item.id);
                        setMenuPos({
                          top: rect.bottom + 4,
                          right: window.innerWidth - rect.right,
                        });
                      }}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                    >
                      <IconDotsVertical size={16} />
                    </button>
                    {menuId === item.id && menuPos && (
                      <div
                        className="fixed z-50 w-36 rounded-md border border-gray-200 bg-white py-1 text-left shadow-lg"
                        style={{ top: menuPos.top, right: menuPos.right }}
                      >
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setMenuId(null);
                            setMenuPos(null);
                            beginEdit(item);
                          }}
                          className="block w-full px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setMenuId(null);
                            setMenuPos(null);
                            setPendingDelete(item);
                          }}
                          className="block w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-gray-50"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                  No materials match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <aside className="rounded-lg border border-gray-200 bg-white p-4 xl:sticky xl:top-0">
        {form ? (
          <div>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-gray-900">
                Material Details
              </h2>
              {!editing && (
                <button
                  type="button"
                  onClick={() => beginEdit(form)}
                  className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
                >
                  <IconPencil size={14} />
                  Edit
                </button>
              )}
            </div>
            <div className="space-y-3">
              <label className="block text-xs text-gray-500">
                Name
                <input
                  ref={nameRef}
                  disabled={!editing}
                  value={form.name}
                  onChange={(event) =>
                    setDraft((current) =>
                      current ? { ...current, name: event.target.value } : current
                    )
                  }
                  className={fieldClass}
                />
              </label>
              <label className="block text-xs text-gray-500">
                Category
                <select
                  disabled={!editing}
                  value={form.category}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? { ...current, category: event.target.value as Category }
                        : current
                    )
                  }
                  className={fieldClass}
                >
                  {CATEGORIES.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-gray-500">
                Wood Species
                <input
                  disabled={!editing}
                  value={form.species ?? speciesFromName(form.name)}
                  placeholder="Maple"
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? { ...current, species: event.target.value }
                        : current
                    )
                  }
                  className={fieldClass}
                />
              </label>
              <label className="block text-xs text-gray-500">
                Thickness
                <input
                  disabled={!editing}
                  value={form.thickness ?? thicknessFromName(form.name)}
                  placeholder='3/4"'
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? { ...current, thickness: event.target.value }
                        : current
                    )
                  }
                  className={fieldClass}
                />
              </label>
              <label className="block text-xs text-gray-500">
                Unit
                <select
                  disabled={!editing}
                  value={form.unit}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? { ...current, unit: event.target.value as Unit }
                        : current
                    )
                  }
                  className={fieldClass}
                >
                  {UNITS.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-gray-500">
                Cost Per Unit
                <input
                  disabled={!editing}
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.cost}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? { ...current, cost: Number(event.target.value) }
                        : current
                    )
                  }
                  className={fieldClass}
                />
              </label>
            </div>
            {editing && (
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={discardEdit}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Discard changes
                </button>
                <button
                  type="button"
                  onClick={saveEdit}
                  className="rounded-md bg-burgundy px-4 py-2 text-sm font-medium text-white hover:bg-burgundy/90"
                >
                  Save
                </button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Select a material.</p>
        )}
      </aside>

      {showAdd && (
        <Modal title="Add material" onClose={() => setShowAdd(false)}>
          <form onSubmit={submitAdd} className="space-y-4">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">Name</span>
              <input
                required
                autoFocus
                value={addForm.name}
                onChange={(event) =>
                  setAddForm({ ...addForm, name: event.target.value })
                }
                className={inputClass}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">Category</span>
              <select
                value={addForm.category}
                onChange={(event) =>
                  setAddForm({
                    ...addForm,
                    category: event.target.value as Category,
                  })
                }
                className={inputClass}
              >
                {CATEGORIES.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">
                Wood species
              </span>
              <select
                value={addForm.species}
                onChange={(event) =>
                  setAddForm({ ...addForm, species: event.target.value })
                }
                className={inputClass}
              >
                <option value="">Select species</option>
                {STOCK_SPECIES.map((species) => (
                  <option key={species} value={species}>
                    {species}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">Thickness</span>
              <input
                value={addForm.thickness}
                placeholder='3/4"'
                onChange={(event) =>
                  setAddForm({ ...addForm, thickness: event.target.value })
                }
                className={inputClass}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">
                Price per unit
              </span>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={addForm.price}
                onChange={(event) =>
                  setAddForm({ ...addForm, price: event.target.value })
                }
                className={inputClass}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">Unit type</span>
              <select
                value={addForm.unit}
                onChange={(event) =>
                  setAddForm({ ...addForm, unit: event.target.value as Unit })
                }
                className={inputClass}
              >
                {UNITS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-md bg-burgundy px-4 py-2 text-sm font-medium text-white hover:bg-burgundy/90"
              >
                Add material
              </button>
            </div>
          </form>
        </Modal>
      )}

      {pendingDelete && (
        <ConfirmModal
          title="Delete material"
          body={`Remove ${pendingDelete.name} from the materials list?`}
          confirmLabel="Delete"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            const name = pendingDelete.name.trim().toLowerCase();
            setRemovedNames((names) =>
              names.includes(name) ? names : [...names, name]
            );
            setMaterials((list) =>
              list.filter((item) => item.name.trim().toLowerCase() !== name)
            );
            setPendingDelete(null);
          }}
        />
      )}
    </div>
  );
}
