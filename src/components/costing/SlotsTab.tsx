"use client";

import { useEffect, useState } from "react";
import Button from "@/components/Button";
import ConfirmModal from "@/components/ConfirmModal";
import Modal from "@/components/Modal";
import {
  SLOT_TYPE_LABEL,
  deleteRow,
  fetchSlots,
  saveSlot,
  slotUsage,
  swapSlotOrder,
  type CostingSlot,
  type SlotType,
} from "@/lib/costing/db";
import { Field, inputClass } from "@/components/costing/ui";

const TYPES: SlotType[] = ["material", "door", "drawer_box", "exterior_finish", "interior_finish"];

export default function SlotsTab() {
  const [rows, setRows] = useState<CostingSlot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<{ id?: string; name: string; slot_type: SlotType } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CostingSlot | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);

  async function load() {
    const result = await fetchSlots();
    setRows(result.rows);
    setError(result.error);
  }

  useEffect(() => {
    void load();
  }, []);

  const visible = rows.filter((row) =>
    `${row.name} ${SLOT_TYPE_LABEL[row.slot_type]}`.toLowerCase().includes(search.trim().toLowerCase())
  );

  async function submit() {
    if (!form || !form.name.trim()) return setFormError("Enter a name");
    const nextOrder = form.id ? undefined : (rows.at(-1)?.sort_order ?? 0) + 1;
    const message = await saveSlot({ ...form, sort_order: nextOrder });
    if (message) return setFormError(message);
    setForm(null);
    await load();
  }

  async function move(index: number, direction: -1 | 1) {
    const current = visible[index];
    const neighbor = visible[index + direction];
    if (!current || !neighbor) return;
    const message = await swapSlotOrder(current, neighbor);
    if (message) setError(message);
    else await load();
  }

  return (
    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="flex flex-wrap items-center gap-3 p-4">
        <input className={`${inputClass} max-w-xs`} placeholder="Search slots" value={search} onChange={(event) => setSearch(event.target.value)} />
        <button type="button" className="ml-auto rounded-md bg-burgundy px-3 py-2 text-sm font-medium text-white" onClick={() => { setFormError(null); setForm({ name: "", slot_type: "material" }); }}>
          Add slot
        </button>
      </div>
      {error ? <p className="px-4 pb-3 text-sm text-red-600">{error}</p> : null}
      <table className="w-full text-left text-sm">
        <tbody>
          {visible.map((row, index) => (
            <tr key={row.id} className="border-t border-gray-100">
              <td className="px-4 py-2">{row.name}</td>
              <td className="px-4 py-2 text-gray-500">{SLOT_TYPE_LABEL[row.slot_type]}</td>
              <td className="px-4 py-2 text-right">
                <button type="button" className="mr-2 text-gray-500" onClick={() => void move(index, -1)} disabled={index === 0}>Up</button>
                <button type="button" className="mr-3 text-gray-500" onClick={() => void move(index, 1)} disabled={index === visible.length - 1}>Down</button>
                <button type="button" className="mr-3 text-burgundy" onClick={() => { setFormError(null); setForm(row); }}>Edit</button>
                <button type="button" className="text-red-600" onClick={() => void slotUsage(row.id).then((used) => used.length ? setBlocked(`${row.name} is used by ${used.join(", ")}.`) : setPendingDelete(row))}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {form ? (
        <Modal title={form.id ? "Edit slot" : "Add slot"} onClose={() => setForm(null)}>
          <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
            {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
            <Field label="Name"><input className={inputClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
            <Field label="Type">
              <select className={inputClass} value={form.slot_type} onChange={(event) => setForm({ ...form, slot_type: event.target.value as SlotType })}>
                {TYPES.map((type) => <option key={type} value={type}>{SLOT_TYPE_LABEL[type]}</option>)}
              </select>
            </Field>
            <div className="flex justify-end gap-2"><Button type="button" onClick={() => setForm(null)}>Cancel</Button><Button type="submit" variant="primary">Save</Button></div>
          </form>
        </Modal>
      ) : null}
      {pendingDelete ? <ConfirmModal title="Delete slot" body={`Remove ${pendingDelete.name}?`} confirmLabel="Delete" onCancel={() => setPendingDelete(null)} onConfirm={() => { void deleteRow("costing_slots", pendingDelete.id).then((message) => { setPendingDelete(null); if (message) setError(message); else void load(); }); }} /> : null}
      {blocked ? <Modal title="This slot is in use" onClose={() => setBlocked(null)}><p className="text-sm text-gray-600">{blocked}</p><div className="mt-4 flex justify-end"><Button onClick={() => setBlocked(null)}>Close</Button></div></Modal> : null}
    </section>
  );
}
