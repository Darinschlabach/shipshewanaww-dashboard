"use client";

import { useCallback, useEffect, useState } from "react";
import {
  IconBrush,
  IconChevronDown,
  IconDotsVertical,
  IconLayoutGrid,
  IconLeaf,
  IconPlus,
  IconUpload,
} from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/client";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import PricingCatalogueItemsTab from "@/components/catalogue/PricingCatalogueItemsTab";
import {
  CABINET_CATALOGUE_LABELS,
  COMPONENT_CATALOGUE_LABELS,
  formatMultiplier,
  type PricingCatalogueItem,
  type PricingDoorStyle,
  type PricingFinishType,
  type PricingWoodSpecies,
} from "@/lib/pricing-catalogue";

const PRIMARY_TABS = [
  { id: "variables", label: "Variables" },
  { id: "cabinets", label: "Cabinets" },
  { id: "components", label: "Components" },
] as const;

type PrimaryTab = (typeof PRIMARY_TABS)[number]["id"];

type VariableKind = "wood" | "finish" | "door";

type SelectedVariable = {
  kind: VariableKind;
  id: string;
};

type MultiplierRow = {
  id: string;
  name: string;
  multiplier: number;
};

function MultiplierCard({
  icon: Icon,
  iconClassName,
  title,
  subtitle,
  addLabel,
  nameColumnLabel,
  rows,
  footerLabel,
  selectedId,
  onSelect,
  onAdd,
  onEditRow,
  onDeleteRow,
}: {
  icon: typeof IconLeaf;
  iconClassName: string;
  title: string;
  subtitle: string;
  addLabel: string;
  nameColumnLabel: string;
  rows: MultiplierRow[];
  footerLabel: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onEditRow: (id: string) => void;
  onDeleteRow: (id: string) => void;
}) {
  const [menuId, setMenuId] = useState<string | null>(null);

  return (
    <div className="flex min-h-[420px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 gap-3">
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconClassName}`}
            >
              <Icon size={20} stroke={1.5} />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
              <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <IconPlus size={14} />
            {addLabel}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-gray-400">
                {nameColumnLabel}
              </th>
              <th className="px-4 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-gray-400">
                Multiplier
              </th>
              <th className="w-10 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const selected = row.id === selectedId;
              return (
                <tr
                  key={row.id}
                  onClick={() => onSelect(row.id)}
                  className={`cursor-pointer border-b border-gray-50 transition-colors ${
                    selected ? "bg-burgundy/5" : "hover:bg-gray-50"
                  }`}
                >
                  <td className="px-4 py-2.5 text-sm font-medium text-gray-900">
                    {row.name}
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm tabular-nums text-gray-700">
                    {formatMultiplier(row.multiplier)}
                  </td>
                  <td className="relative px-2 py-2.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuId(menuId === row.id ? null : row.id);
                      }}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      aria-label="Row actions"
                    >
                      <IconDotsVertical size={16} />
                    </button>
                    {menuId === row.id && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setMenuId(null)}
                        />
                        <div className="absolute right-2 top-8 z-20 w-32 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuId(null);
                              onEditRow(row.id);
                            }}
                            className="block w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuId(null);
                              onDeleteRow(row.id);
                            }}
                            className="block w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="shrink-0 border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
        {rows.length} {footerLabel}
      </p>
    </div>
  );
}

export default function PricingCataloguePage() {
  const [primaryTab, setPrimaryTab] = useState<PrimaryTab>("variables");
  const [woodSpecies, setWoodSpecies] = useState<PricingWoodSpecies[]>([]);
  const [finishTypes, setFinishTypes] = useState<PricingFinishType[]>([]);
  const [doorStyles, setDoorStyles] = useState<PricingDoorStyle[]>([]);
  const [cabinetTypes, setCabinetTypes] = useState<PricingCatalogueItem[]>([]);
  const [components, setComponents] = useState<PricingCatalogueItem[]>([]);
  const [selection, setSelection] = useState<SelectedVariable | null>(null);
  const [loading, setLoading] = useState(true);
  const [cabinetsLoading, setCabinetsLoading] = useState(true);
  const [componentsLoading, setComponentsLoading] = useState(true);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [woodModal, setWoodModal] = useState(false);
  const [finishModal, setFinishModal] = useState(false);
  const [doorModal, setDoorModal] = useState(false);
  const [editingWood, setEditingWood] = useState<PricingWoodSpecies | null>(null);
  const [editingFinish, setEditingFinish] = useState<PricingFinishType | null>(
    null
  );
  const [editingDoor, setEditingDoor] = useState<PricingDoorStyle | null>(null);
  const [woodForm, setWoodForm] = useState({
    name: "",
    description: "",
    multiplier: "1",
    status: "active" as "active" | "inactive",
  });
  const [simpleForm, setSimpleForm] = useState({ name: "", multiplier: "1" });

  const load = useCallback(async () => {
    const supabase = createClient();
    const [woodRes, finishRes, doorRes, cabinetRes, componentRes] =
      await Promise.all([
        supabase.from("pricing_wood_species").select("*").order("sort_order"),
        supabase.from("pricing_finish_types").select("*").order("sort_order"),
        supabase.from("pricing_door_styles").select("*").order("sort_order"),
        supabase.from("pricing_cabinet_types").select("*").order("sort_order"),
        supabase.from("pricing_components").select("*").order("sort_order"),
      ]);

    const wood = (woodRes.data as PricingWoodSpecies[]) ?? [];
    const finish = (finishRes.data as PricingFinishType[]) ?? [];
    const door = (doorRes.data as PricingDoorStyle[]) ?? [];
    setWoodSpecies(wood);
    setFinishTypes(finish);
    setDoorStyles(door);
    setCabinetTypes((cabinetRes.data as PricingCatalogueItem[]) ?? []);
    setComponents((componentRes.data as PricingCatalogueItem[]) ?? []);
    setCabinetsLoading(false);
    setComponentsLoading(false);

    setSelection((prev) => {
      if (prev) {
        const lists = {
          wood,
          finish,
          door,
        } as const;
        const list = lists[prev.kind];
        if (list.some((item) => item.id === prev.id)) return prev;
      }
      if (wood[0]) return { kind: "wood", id: wood[0].id };
      if (finish[0]) return { kind: "finish", id: finish[0].id };
      if (door[0]) return { kind: "door", id: door[0].id };
      return null;
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openAddWood() {
    setEditingWood(null);
    setWoodForm({
      name: "",
      description: "",
      multiplier: "1",
      status: "active",
    });
    setWoodModal(true);
    setShowAddMenu(false);
  }

  function openAddFinish() {
    setEditingFinish(null);
    setSimpleForm({ name: "", multiplier: "1" });
    setFinishModal(true);
    setShowAddMenu(false);
  }

  function openAddDoor() {
    setEditingDoor(null);
    setSimpleForm({ name: "", multiplier: "1" });
    setDoorModal(true);
    setShowAddMenu(false);
  }

  function openEditWood(item: PricingWoodSpecies) {
    setEditingWood(item);
    setWoodForm({
      name: item.name,
      description: item.description,
      multiplier: String(item.multiplier),
      status: item.status,
    });
    setWoodModal(true);
  }

  async function saveWood(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    const payload = {
      name: woodForm.name.trim(),
      description: woodForm.description.trim(),
      multiplier: parseFloat(woodForm.multiplier) || 1,
      status: woodForm.status,
    };
    if (editingWood) {
      const { data } = await supabase
        .from("pricing_wood_species")
        .update(payload)
        .eq("id", editingWood.id)
        .select("id")
        .single();
      if (data) setSelection({ kind: "wood", id: data.id });
    } else {
      const maxOrder = woodSpecies.reduce((m, w) => Math.max(m, w.sort_order), 0);
      const { data } = await supabase
        .from("pricing_wood_species")
        .insert({ ...payload, sort_order: maxOrder + 1 })
        .select("id")
        .single();
      if (data) setSelection({ kind: "wood", id: data.id });
    }
    setWoodModal(false);
    await load();
  }

  async function saveFinish(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    const payload = {
      name: simpleForm.name.trim(),
      multiplier: parseFloat(simpleForm.multiplier) || 1,
    };
    if (editingFinish) {
      const { data } = await supabase
        .from("pricing_finish_types")
        .update(payload)
        .eq("id", editingFinish.id)
        .select("id")
        .single();
      if (data) setSelection({ kind: "finish", id: data.id });
    } else {
      const maxOrder = finishTypes.reduce((m, f) => Math.max(m, f.sort_order), 0);
      const { data } = await supabase
        .from("pricing_finish_types")
        .insert({ ...payload, sort_order: maxOrder + 1 })
        .select("id")
        .single();
      if (data) setSelection({ kind: "finish", id: data.id });
    }
    setFinishModal(false);
    await load();
  }

  async function saveDoor(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    const payload = {
      name: simpleForm.name.trim(),
      multiplier: parseFloat(simpleForm.multiplier) || 1,
    };
    if (editingDoor) {
      const { data } = await supabase
        .from("pricing_door_styles")
        .update(payload)
        .eq("id", editingDoor.id)
        .select("id")
        .single();
      if (data) setSelection({ kind: "door", id: data.id });
    } else {
      const maxOrder = doorStyles.reduce((m, d) => Math.max(m, d.sort_order), 0);
      const { data } = await supabase
        .from("pricing_door_styles")
        .insert({ ...payload, sort_order: maxOrder + 1 })
        .select("id")
        .single();
      if (data) setSelection({ kind: "door", id: data.id });
    }
    setDoorModal(false);
    await load();
  }

  async function deleteVariable(kind: VariableKind, id: string) {
    const labels = {
      wood: "wood species",
      finish: "finish type",
      door: "door style",
    };
    if (!confirm(`Delete this ${labels[kind]}?`)) return;

    const supabase = createClient();
    const table =
      kind === "wood"
        ? "pricing_wood_species"
        : kind === "finish"
          ? "pricing_finish_types"
          : "pricing_door_styles";
    await supabase.from(table).delete().eq("id", id);
    if (selection?.kind === kind && selection.id === id) {
      setSelection(null);
    }
    await load();
  }

  function makeCatalogueHandlers(
    table: "pricing_cabinet_types" | "pricing_components",
    items: PricingCatalogueItem[],
    setItems: (items: PricingCatalogueItem[]) => void
  ) {
    const load = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from(table)
        .select("*")
        .order("sort_order");
      setItems((data as PricingCatalogueItem[]) ?? []);
    };

    const save = async (
      payload: {
        name: string;
        category: string;
        base_price: number;
        sq_ft_price: number;
      },
      editingId: string | null
    ): Promise<string | null> => {
      const supabase = createClient();
      if (editingId) {
        const { data } = await supabase
          .from(table)
          .update(payload)
          .eq("id", editingId)
          .select("id")
          .single();
        return data?.id ?? null;
      }
      const maxOrder = items.reduce((m, c) => Math.max(m, c.sort_order), 0);
      const { data } = await supabase
        .from(table)
        .insert({ ...payload, sort_order: maxOrder + 1 })
        .select("id")
        .single();
      return data?.id ?? null;
    };

    const remove = async (id: string) => {
      const supabase = createClient();
      await supabase.from(table).delete().eq("id", id);
      await load();
    };

    return { load, save, remove };
  }

  const cabinetHandlers = makeCatalogueHandlers(
    "pricing_cabinet_types",
    cabinetTypes,
    setCabinetTypes
  );
  const componentHandlers = makeCatalogueHandlers(
    "pricing_components",
    components,
    setComponents
  );

  function editVariableRow(kind: VariableKind, id: string) {
    setSelection({ kind, id });
    if (kind === "wood") {
      const item = woodSpecies.find((w) => w.id === id);
      if (item) openEditWood(item);
    } else if (kind === "finish") {
      const item = finishTypes.find((f) => f.id === id);
      if (item) {
        setEditingFinish(item);
        setSimpleForm({ name: item.name, multiplier: String(item.multiplier) });
        setFinishModal(true);
      }
    } else {
      const item = doorStyles.find((d) => d.id === id);
      if (item) {
        setEditingDoor(item);
        setSimpleForm({ name: item.name, multiplier: String(item.multiplier) });
        setDoorModal(true);
      }
    }
  }

  return (
    <>
      <PageHeader
        title="Pricing Catalogue"
        subtitle="Manage pricing variables, cabinet types and components used in quotes."
        rightSlot={
          <div className="flex shrink-0 items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowAddMenu((v) => !v)}
                className="inline-flex items-center gap-1 rounded-md bg-burgundy px-4 py-2 text-sm font-medium text-white hover:bg-burgundy/90"
              >
                + Add New
                <IconChevronDown size={16} />
              </button>
              {showAddMenu && (
                <div className="absolute right-0 z-20 mt-1 w-48 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                  <button
                    type="button"
                    onClick={openAddWood}
                    className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Wood Species
                  </button>
                  <button
                    type="button"
                    onClick={openAddFinish}
                    className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Finish Type
                  </button>
                  <button
                    type="button"
                    onClick={openAddDoor}
                    className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Door Style
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <IconUpload size={16} />
              Import / Export
            </button>
          </div>
        }
      />

      <div className="mb-4 border-b border-gray-200">
        <div className="flex gap-6">
          {PRIMARY_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setPrimaryTab(tab.id)}
              className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
                primaryTab === tab.id
                  ? "border-burgundy text-burgundy"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {primaryTab === "cabinets" && (
        <PricingCatalogueItemsTab
          labels={CABINET_CATALOGUE_LABELS}
          items={cabinetTypes}
          loading={cabinetsLoading}
          onReload={cabinetHandlers.load}
          onSave={cabinetHandlers.save}
          onDelete={cabinetHandlers.remove}
        />
      )}

      {primaryTab === "components" && (
        <PricingCatalogueItemsTab
          labels={COMPONENT_CATALOGUE_LABELS}
          items={components}
          loading={componentsLoading}
          onReload={componentHandlers.load}
          onSave={componentHandlers.save}
          onDelete={componentHandlers.remove}
        />
      )}

      {primaryTab === "variables" && (
        <>
          {loading ? (
            <p className="text-gray-500">Loading…</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <MultiplierCard
                icon={IconLeaf}
                iconClassName="bg-amber-100 text-amber-800"
                title="Wood Species Multipliers"
                subtitle="Set the multiplier for each wood species."
                addLabel="Add Species"
                nameColumnLabel="Wood Species"
                rows={woodSpecies.map((r) => ({
                  id: r.id,
                  name: r.name,
                  multiplier: Number(r.multiplier),
                }))}
                footerLabel="species"
                selectedId={
                  selection?.kind === "wood" ? selection.id : null
                }
                onSelect={(id) => setSelection({ kind: "wood", id })}
                onAdd={openAddWood}
                onEditRow={(id) => editVariableRow("wood", id)}
                onDeleteRow={(id) => void deleteVariable("wood", id)}
              />

              <MultiplierCard
                icon={IconBrush}
                iconClassName="bg-emerald-100 text-emerald-800"
                title="Finish Type Multipliers"
                subtitle="Set the multiplier for each finish type."
                addLabel="Add Finish"
                nameColumnLabel="Finish Type"
                rows={finishTypes.map((r) => ({
                  id: r.id,
                  name: r.name,
                  multiplier: Number(r.multiplier),
                }))}
                footerLabel={
                  finishTypes.length === 1 ? "finish type" : "finish types"
                }
                selectedId={
                  selection?.kind === "finish" ? selection.id : null
                }
                onSelect={(id) => setSelection({ kind: "finish", id })}
                onAdd={openAddFinish}
                onEditRow={(id) => editVariableRow("finish", id)}
                onDeleteRow={(id) => void deleteVariable("finish", id)}
              />

              <MultiplierCard
                icon={IconLayoutGrid}
                iconClassName="bg-violet-100 text-violet-800"
                title="Door Style Multipliers"
                subtitle="Set the multiplier for each door style."
                addLabel="Add Style"
                nameColumnLabel="Door Style"
                rows={doorStyles.map((r) => ({
                  id: r.id,
                  name: r.name,
                  multiplier: Number(r.multiplier),
                }))}
                footerLabel={
                  doorStyles.length === 1 ? "door style" : "door styles"
                }
                selectedId={
                  selection?.kind === "door" ? selection.id : null
                }
                onSelect={(id) => setSelection({ kind: "door", id })}
                onAdd={openAddDoor}
                onEditRow={(id) => editVariableRow("door", id)}
                onDeleteRow={(id) => void deleteVariable("door", id)}
              />
            </div>
          )}
        </>
      )}

      {woodModal && (
        <Modal
          title={editingWood ? "Edit wood species" : "Add wood species"}
          onClose={() => setWoodModal(false)}
        >
          <form onSubmit={saveWood} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Species</label>
              <input
                required
                value={woodForm.name}
                onChange={(e) =>
                  setWoodForm({ ...woodForm, name: e.target.value })
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Description
              </label>
              <textarea
                value={woodForm.description}
                onChange={(e) =>
                  setWoodForm({ ...woodForm, description: e.target.value })
                }
                rows={2}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Multiplier
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={woodForm.multiplier}
                onChange={(e) =>
                  setWoodForm({ ...woodForm, multiplier: e.target.value })
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Status</label>
              <select
                value={woodForm.status}
                onChange={(e) =>
                  setWoodForm({
                    ...woodForm,
                    status: e.target.value as "active" | "inactive",
                  })
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" onClick={() => setWoodModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                {editingWood ? "Save" : "Add"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {finishModal && (
        <Modal
          title={editingFinish ? "Edit finish type" : "Add finish type"}
          onClose={() => setFinishModal(false)}
        >
          <form onSubmit={saveFinish} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Name</label>
              <input
                required
                value={simpleForm.name}
                onChange={(e) =>
                  setSimpleForm({ ...simpleForm, name: e.target.value })
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Multiplier
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={simpleForm.multiplier}
                onChange={(e) =>
                  setSimpleForm({ ...simpleForm, multiplier: e.target.value })
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" onClick={() => setFinishModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                {editingFinish ? "Save" : "Add"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {doorModal && (
        <Modal
          title={editingDoor ? "Edit door style" : "Add door style"}
          onClose={() => setDoorModal(false)}
        >
          <form onSubmit={saveDoor} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Name</label>
              <input
                required
                value={simpleForm.name}
                onChange={(e) =>
                  setSimpleForm({ ...simpleForm, name: e.target.value })
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Multiplier
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={simpleForm.multiplier}
                onChange={(e) =>
                  setSimpleForm({ ...simpleForm, multiplier: e.target.value })
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" onClick={() => setDoorModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                {editingDoor ? "Save" : "Add"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
