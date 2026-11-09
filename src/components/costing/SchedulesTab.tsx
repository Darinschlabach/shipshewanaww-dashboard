"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { IconChevronRight } from "@tabler/icons-react";
import Button from "@/components/Button";
import ConfirmModal from "@/components/ConfirmModal";
import Modal from "@/components/Modal";
import {
  SLOT_TYPE_LABEL,
  deleteRow,
  duplicateSchedule,
  fetchDoors,
  fetchDrawerBoxes,
  fetchFinishes,
  fetchComponents,
  fetchMaterials,
  fetchScheduleItems,
  fetchScheduleOverrides,
  fetchSchedules,
  fetchSlots,
  saveSchedule,
  scheduleUsage,
  setScheduleChoice,
  setScheduleComponentOverride,
  type CostingComponent,
  type CostingDoor,
  type CostingDrawerBox,
  type CostingFinish,
  type CostingMaterial,
  type CostingSchedule,
  type CostingScheduleComponentOverride,
  type CostingScheduleItem,
  type CostingSlot,
} from "@/lib/costing/db";
import { Field, LibraryToolbar, inputClass, matchesSearch } from "@/components/costing/ui";

export default function SchedulesTab() {
  const [rows, setRows] = useState<CostingSchedule[]>([]);
  const [slots, setSlots] = useState<CostingSlot[]>([]);
  const [materials, setMaterials] = useState<CostingMaterial[]>([]);
  const [doors, setDoors] = useState<CostingDoor[]>([]);
  const [drawerBoxes, setDrawerBoxes] = useState<CostingDrawerBox[]>([]);
  const [finishes, setFinishes] = useState<CostingFinish[]>([]);
  const [items, setItems] = useState<CostingScheduleItem[]>([]);
  const [overrides, setOverrides] = useState<CostingScheduleComponentOverride[]>([]);
  const [components, setComponents] = useState<CostingComponent[]>([]);
  const [openSlots, setOpenSlots] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [form, setForm] = useState<{ id?: string; name: string; description: string; active: boolean } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CostingSchedule | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);

  async function loadLists() {
    const [scheduleRows, slotRows, materialRows, doorRows, drawerRows, finishRows, componentRows] =
      await Promise.all([
      fetchSchedules(),
      fetchSlots(),
      fetchMaterials(),
      fetchDoors(),
      fetchDrawerBoxes(),
      fetchFinishes(),
      fetchComponents(),
    ]);
    setRows(scheduleRows.rows);
    setSlots(slotRows.rows);
    setMaterials(materialRows.rows);
    setDoors(doorRows.rows);
    setDrawerBoxes(drawerRows.rows);
    setFinishes(finishRows.rows);
    setComponents(componentRows.rows);
    setError(
      scheduleRows.error ??
        slotRows.error ??
        materialRows.error ??
        doorRows.error ??
        drawerRows.error ??
        finishRows.error ??
        componentRows.error
    );
  }

  async function loadItems(scheduleId: string) {
    const [result, overrideResult] = await Promise.all([
      fetchScheduleItems(scheduleId),
      fetchScheduleOverrides(scheduleId),
    ]);
    setItems(result.rows);
    setOverrides(overrideResult.rows);
    if (result.error || overrideResult.error) setError(result.error ?? overrideResult.error);
  }

  useEffect(() => {
    void loadLists();
  }, []);

  useEffect(() => {
    if (selectedId) void loadItems(selectedId);
    else {
      setItems([]);
      setOverrides([]);
    }
    setOpenSlots(new Set());
  }, [selectedId]);

  const visible = useMemo(
    () =>
      rows
        .filter((row) => (showInactive || row.active) && matchesSearch(search, [row.name, row.description]))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [rows, search, showInactive]
  );

  const selected = rows.find((row) => row.id === selectedId) ?? null;

  function choiceFor(slot: CostingSlot): string {
    const item = items.find((row) => row.slot_id === slot.id);
    if (!item) return "";
    if (slot.slot_type === "material") return item.material_id ?? "";
    if (slot.slot_type === "door") return item.door_style_id ?? "";
    if (slot.slot_type === "drawer_box") return item.drawer_box_style_id ?? "";
    return item.finish_id ?? "";
  }

  function optionsFor(slot: CostingSlot, current: string) {
    if (slot.slot_type === "material") {
      return materials
        .filter((row) => row.active || row.id === current)
        .map((row) => ({ id: row.id, label: row.name }));
    }
    if (slot.slot_type === "door") {
      return doors
        .filter((row) => row.active || row.id === current)
        .map((row) => ({ id: row.id, label: row.name }));
    }
    if (slot.slot_type === "drawer_box") {
      return drawerBoxes
        .filter((row) => row.active || row.id === current)
        .map((row) => ({ id: row.id, label: row.name }));
    }
    return finishes
      .filter((row) => {
        const allowed = slot.slot_type === "interior_finish" ? row.use_interior : row.use_exterior;
        return allowed && (row.active || row.id === current);
      })
      .map((row) => ({ id: row.id, label: row.name }));
  }

  function defaultLabel(slot: CostingSlot): string {
    const current = choiceFor(slot);
    const name = optionsFor(slot, current).find((option) => option.id === current)?.label;
    return name ? `Slot default (${name})` : "Slot default (not set)";
  }

  function overrideFor(componentId: string): string {
    const row = overrides.find((item) => item.component_id === componentId);
    if (!row) return "";
    return row.material_id ?? row.door_style_id ?? row.drawer_box_style_id ?? row.finish_id ?? "";
  }

  function toggleSlot(slotId: string) {
    setOpenSlots((current) => {
      const next = new Set(current);
      if (next.has(slotId)) next.delete(slotId);
      else next.add(slotId);
      return next;
    });
  }

  function saveOverride(componentId: string, slot: CostingSlot, value: string) {
    if (!selected) return;
    const slotDefault = choiceFor(slot);
    const next = !value || value === slotDefault ? null : value;
    void setScheduleComponentOverride(selected.id, componentId, slot, next).then((message) => {
      if (message) setError(message);
      else void loadItems(selected.id);
    });
  }

  async function submit() {
    if (!form) return;
    if (!form.name.trim()) return setFormError("Enter a name");
    const result = await saveSchedule(form);
    if (result.error) return setFormError(result.error);
    setForm(null);
    await loadLists();
    if (result.id) setSelectedId(result.id);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
        <LibraryToolbar
          search={search}
          onSearch={setSearch}
          placeholder="Search schedules"
          addLabel="Add"
          onAdd={() => { setFormError(null); setForm({ name: "", description: "", active: true }); }}
          showInactive={showInactive}
          onShowInactive={setShowInactive}
        />
        <ul className="space-y-1">
          {visible.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => setSelectedId(row.id)}
                className={`w-full rounded-md px-3 py-2 text-left text-sm ${selectedId === row.id ? "bg-cream text-gray-900" : "hover:bg-gray-50"}`}
              >
                <span className="block font-medium">{row.name}</span>
                <span className="block text-xs text-gray-500">{row.active ? "Active" : "Inactive"}</span>
              </button>
            </li>
          ))}
          {visible.length === 0 ? <li className="px-2 py-4 text-sm text-gray-500">No schedules</li> : null}
        </ul>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        {selected ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{selected.name}</h2>
                <p className="mt-1 text-sm text-gray-500">{selected.description || "No description"}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => { setFormError(null); setForm(selected); }}>Edit</Button>
                <Button onClick={() => void duplicateSchedule(selected).then((message) => { if (message) setError(message); else void loadLists(); })}>Duplicate</Button>
                <Button
                  onClick={() =>
                    void scheduleUsage(selected.id).then((used) =>
                      used.length ? setBlocked(`${selected.name} is used by ${used.join(", ")}.`) : setPendingDelete(selected)
                    )
                  }
                >
                  Delete
                </Button>
              </div>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-[10px] uppercase tracking-wider text-gray-400">
                    <th className="py-2 font-medium">Slot</th>
                    <th className="py-2 font-medium">Type</th>
                    <th className="py-2 font-medium">Choice</th>
                  </tr>
                </thead>
                <tbody>
                  {slots.map((slot) => {
                    const current = choiceFor(slot);
                    const options = optionsFor(slot, current);
                    const slotComponents = components
                      .filter((component) => component.slot_id === slot.id)
                      .sort((a, b) => a.name.localeCompare(b.name));
                    const overrideCount = slotComponents.filter((component) => overrideFor(component.id)).length;
                    const open = openSlots.has(slot.id);
                    return (
                      <Fragment key={slot.id}>
                        <tr
                          className="cursor-pointer border-b border-gray-50"
                          onClick={() => toggleSlot(slot.id)}
                        >
                          <td className="py-2 pr-3">
                            <span className="flex items-center gap-1.5 text-left">
                              <IconChevronRight
                                size={14}
                                className={`shrink-0 text-gray-400 transition-transform ${open ? "rotate-90" : ""}`}
                              />
                              <span>
                                {slot.name}
                                <span className="text-gray-400">
                                  {" "}
                                  · {slotComponents.length} {slotComponents.length === 1 ? "part" : "parts"}
                                </span>
                              </span>
                              {overrideCount > 0 && !open ? (
                                <span className="ml-2 text-xs text-burgundy">
                                  {overrideCount} {overrideCount === 1 ? "override" : "overrides"}
                                </span>
                              ) : null}
                            </span>
                          </td>
                          <td className="py-2 pr-3 text-gray-500">{SLOT_TYPE_LABEL[slot.slot_type]}</td>
                          <td className="py-2" onClick={(event) => event.stopPropagation()}>
                            <select
                              className={inputClass}
                              value={current}
                              onChange={(event) => {
                                const value = event.target.value;
                                void setScheduleChoice(selected.id, slot, value || null).then((message) => {
                                  if (message) setError(message);
                                  else void loadItems(selected.id);
                                });
                              }}
                            >
                              <option value="">Not set</option>
                              {options.map((option) => (
                                <option key={option.id} value={option.id}>{option.label}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                        {open
                          ? slotComponents.map((component) => {
                              const chosen = overrideFor(component.id);
                              const overridden = Boolean(chosen);
                              return (
                                <tr key={component.id} className="border-b border-gray-50 bg-[#FBF8F4]">
                                  <td className="py-2 pr-3 pl-8">
                                    <span className="inline-flex items-center gap-2">
                                      {overridden ? (
                                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-burgundy" />
                                      ) : (
                                        <span className="h-1.5 w-1.5 shrink-0" />
                                      )}
                                      {component.name}
                                    </span>
                                  </td>
                                  <td />
                                  <td className="py-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <select
                                        className={`${inputClass} ${overridden ? "text-gray-900" : "text-gray-400"}`}
                                        value={chosen}
                                        onChange={(event) => saveOverride(component.id, slot, event.target.value)}
                                      >
                                        <option value="">{defaultLabel(slot)}</option>
                                        {optionsFor(slot, chosen).map((option) => (
                                          <option key={option.id} value={option.id}>
                                            {option.label}
                                          </option>
                                        ))}
                                      </select>
                                      {overridden ? (
                                        <button
                                          type="button"
                                          className="text-xs text-burgundy"
                                          onClick={() => saveOverride(component.id, slot, "")}
                                        >
                                          Reset to default
                                        </button>
                                      ) : null}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-500">Select a schedule to assign each slot.</p>
        )}
      </section>

      {form ? (
        <Modal title={form.id ? "Edit schedule" : "Add schedule"} onClose={() => setForm(null)}>
          <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
            {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
            <Field label="Name"><input className={inputClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
            <Field label="Description"><textarea className={inputClass} rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Active</label>
            <div className="flex justify-end gap-2"><Button type="button" onClick={() => setForm(null)}>Cancel</Button><Button type="submit" variant="primary">Save</Button></div>
          </form>
        </Modal>
      ) : null}
      {pendingDelete ? <ConfirmModal title="Delete schedule" body={`Remove ${pendingDelete.name}?`} confirmLabel="Delete" onCancel={() => setPendingDelete(null)} onConfirm={() => { void deleteRow("costing_schedules", pendingDelete.id).then((message) => { setPendingDelete(null); if (message) setError(message); else { if (selectedId === pendingDelete.id) setSelectedId(null); void loadLists(); } }); }} /> : null}
      {blocked ? <Modal title="This schedule is in use" onClose={() => setBlocked(null)}><p className="text-sm text-gray-600">{blocked}</p><div className="mt-4 flex justify-end"><Button onClick={() => setBlocked(null)}>Close</Button></div></Modal> : null}
    </div>
  );
}
