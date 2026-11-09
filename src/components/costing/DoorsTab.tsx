"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "@/components/Button";
import ConfirmModal from "@/components/ConfirmModal";
import Modal from "@/components/Modal";
import { formatCurrencyPrecise } from "@/lib/utils";
import { deleteRow, doorUsage, fetchDoors, saveDoor, type CostingDoor } from "@/lib/costing/db";
import { EmptyRow, Field, LibraryToolbar, inputClass, matchesSearch, parseRequiredNumber } from "@/components/costing/ui";

type FormState = {
  id?: string;
  name: string;
  price_per_sqft: string;
  supplier: string;
  notes: string;
  active: boolean;
};

const blank: FormState = { name: "", price_per_sqft: "", supplier: "", notes: "", active: true };

export default function DoorsTab() {
  const [rows, setRows] = useState<CostingDoor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CostingDoor | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);

  async function load() {
    const result = await fetchDoors();
    setRows(result.rows);
    setError(result.error);
  }

  useEffect(() => {
    void load();
  }, []);

  const visible = useMemo(
    () =>
      rows
        .filter((row) => (showInactive || row.active) && matchesSearch(search, [row.name, row.supplier, row.notes]))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [rows, search, showInactive]
  );

  async function submit() {
    if (!form) return;
    const price = parseRequiredNumber(form.price_per_sqft, "price per sq ft");
    if (!form.name.trim()) return setFormError("Enter a name");
    if (typeof price === "string") return setFormError(price);
    const message = await saveDoor({
      id: form.id,
      name: form.name,
      price_per_sqft: price,
      supplier: form.supplier,
      notes: form.notes,
      active: form.active,
    });
    if (message) return setFormError(message);
    setForm(null);
    await load();
  }

  return (
    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="p-4">
        {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
        <LibraryToolbar
          search={search}
          onSearch={setSearch}
          placeholder="Search door styles"
          addLabel="Add door style"
          onAdd={() => { setFormError(null); setForm(blank); }}
          showInactive={showInactive}
          onShowInactive={setShowInactive}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-y border-gray-100 text-[10px] uppercase tracking-wider text-gray-400">
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">$ / sq ft</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id} className="border-b border-gray-50">
                <td className="px-4 py-2">{row.name}</td>
                <td className="px-4 py-2">{formatCurrencyPrecise(row.price_per_sqft)}</td>
                <td className="px-4 py-2">{row.active ? "Active" : "Inactive"}</td>
                <td className="px-4 py-2 text-right">
                  <button type="button" className="mr-3 text-burgundy" onClick={() => { setFormError(null); setForm({ id: row.id, name: row.name, price_per_sqft: String(row.price_per_sqft), supplier: row.supplier, notes: row.notes, active: row.active }); }}>Edit</button>
                  <button type="button" className="text-red-600" onClick={() => void doorUsage(row.id).then((used) => used.length ? setBlocked(`${row.name} is used by ${used.join(", ")}.`) : setPendingDelete(row))}>Delete</button>
                </td>
              </tr>
            ))}
            {visible.length === 0 ? <EmptyRow cols={4} label="No door styles" /> : null}
          </tbody>
        </table>
      </div>
      {form ? (
        <Modal title={form.id ? "Edit door style" : "Add door style"} onClose={() => setForm(null)}>
          <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
            {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
            <Field label="Name"><input className={inputClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
            <Field label="Price per sq ft"><input className={inputClass} inputMode="decimal" value={form.price_per_sqft} onChange={(event) => setForm({ ...form, price_per_sqft: event.target.value })} /></Field>
            <Field label="Supplier"><input className={inputClass} value={form.supplier} onChange={(event) => setForm({ ...form, supplier: event.target.value })} /></Field>
            <Field label="Notes"><textarea className={inputClass} rows={2} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Active</label>
            <div className="flex justify-end gap-2"><Button type="button" onClick={() => setForm(null)}>Cancel</Button><Button type="submit" variant="primary">Save</Button></div>
          </form>
        </Modal>
      ) : null}
      {pendingDelete ? (
        <ConfirmModal title="Delete door style" body={`Remove ${pendingDelete.name}?`} confirmLabel="Delete" onCancel={() => setPendingDelete(null)} onConfirm={() => { void deleteRow("costing_door_styles", pendingDelete.id).then((message) => { setPendingDelete(null); if (message) setError(message); else void load(); }); }} />
      ) : null}
      {blocked ? <Modal title="This door style is in use" onClose={() => setBlocked(null)}><p className="text-sm text-gray-600">{blocked}</p><div className="mt-4 flex justify-end"><Button onClick={() => setBlocked(null)}>Close</Button></div></Modal> : null}
    </section>
  );
}
