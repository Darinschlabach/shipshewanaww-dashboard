"use client";

import { useEffect, useMemo, useState } from "react";
import { IconBox } from "@tabler/icons-react";
import Button from "@/components/Button";
import ConfirmModal from "@/components/ConfirmModal";
import Modal from "@/components/Modal";
import { createClient } from "@/lib/supabase/client";
import { formatCurrencyPrecise } from "@/lib/utils";
import {
  deleteRow,
  drawerBoxUsage,
  fetchDrawerBoxes,
  saveDrawerBox,
  type CostingDrawerBox,
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
} from "@/components/costing/design";

type FormState = {
  id?: string;
  name: string;
  price_per_cuft: string;
  supplier: string;
  notes: string;
  active: boolean;
};

const blank: FormState = { name: "", price_per_cuft: "", supplier: "", notes: "", active: true };

export default function DrawerBoxesTab({ onChanged }: { onChanged?: () => void }) {
  const [rows, setRows] = useState<CostingDrawerBox[]>([]);
  const [usage, setUsage] = useState<Map<string, number>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CostingDrawerBox | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);

  async function load() {
    const supabase = createClient();
    const [result, links] = await Promise.all([
      fetchDrawerBoxes(),
      supabase.from("costing_schedule_items").select("drawer_box_style_id, schedule_id"),
    ]);
    setRows(result.rows);
    const counts = new Map<string, Set<string>>();
    for (const link of links.data ?? []) {
      if (!link.drawer_box_style_id || !link.schedule_id) continue;
      const schedules = counts.get(link.drawer_box_style_id) ?? new Set<string>();
      schedules.add(link.schedule_id);
      counts.set(link.drawer_box_style_id, schedules);
    }
    setUsage(new Map([...counts].map(([id, schedules]) => [id, schedules.size])));
    setError(result.error ?? links.error?.message ?? null);
    setLoaded(true);
  }

  useEffect(() => {
    void load();
  }, []);

  const visible = useMemo(
    () =>
      rows.filter(
        (row) => (showInactive || row.active) && matchesSearch(search, [row.name, row.supplier, row.notes])
      ),
    [rows, search, showInactive]
  );

  function openNew() {
    setFormError(null);
    setForm(blank);
  }

  function openEdit(row: CostingDrawerBox) {
    setFormError(null);
    setForm({
      id: row.id,
      name: row.name,
      price_per_cuft: String(row.price_per_cuft),
      supplier: row.supplier,
      notes: row.notes,
      active: row.active,
    });
  }

  async function submit() {
    if (!form || saving) return;
    const price = parseRequiredNumber(form.price_per_cuft, "price per cu ft");
    if (!form.name.trim()) return setFormError("Enter a name");
    if (typeof price === "string") return setFormError(price);
    setSaving(true);
    try {
      const message = await saveDrawerBox({
        id: form.id,
        name: form.name,
        price_per_cuft: price,
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

  async function duplicate(row: CostingDrawerBox) {
    const message = await saveDrawerBox({
      name: `${row.name} copy`,
      price_per_cuft: row.price_per_cuft,
      supplier: row.supplier,
      notes: row.notes,
      active: row.active,
    });
    if (message) return setError(message);
    await load();
    onChanged?.();
  }

  async function setActive(row: CostingDrawerBox, active: boolean) {
    const message = await saveDrawerBox({ ...row, active });
    if (message) return setError(message);
    await load();
    onChanged?.();
  }

  async function askDelete(row: CostingDrawerBox) {
    const used = await drawerBoxUsage(row.id);
    if (used.length) setBlocked(`${row.name} is used by ${used.join(", ")}.`);
    else setPendingDelete(row);
  }

  const nameError = formError === "Enter a name" ? formError : undefined;
  const priceError = formError?.includes("price") ? formError : undefined;
  const generalError = formError && !nameError && !priceError ? formError : undefined;

  return (
    <>
      {error ? <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <ListCard>
        <ListHeader
          title="Drawer Boxes"
          count={loaded ? visible.length : 0}
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search drawer boxes"
          actionLabel="Add drawer box"
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
        {!loaded ? (
          <p className="px-6 py-10 text-sm text-gray-500">Loading drawer boxes…</p>
        ) : rows.length === 0 && !error ? (
          <EmptyState
            icon={IconBox}
            title="No drawer boxes yet"
            body="Add a drawer box style and its price per cubic foot."
            actionLabel="Add drawer box"
            onAction={openNew}
          />
        ) : (
          <DataTable
            rows={visible}
            activeId={form?.id}
            initialSort={{ id: "name", dir: "asc" }}
            onRowClick={openEdit}
            empty={<p className="px-6 py-10 text-center text-sm text-gray-500">No drawer boxes match.</p>}
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
                id: "price",
                header: "Price",
                align: "right",
                sortValue: (row) => row.price_per_cuft,
                cell: (row) => (
                  <span className="whitespace-nowrap">
                    <span className="tabular-nums text-gray-900">{formatCurrencyPrecise(row.price_per_cuft)}</span>
                    <span className="ml-1 text-gray-400">/ cu ft</span>
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
      {form ? (
        <SlideOver
          title={form.id ? "Edit drawer box" : "Add drawer box"}
          onClose={() => {
            if (!saving) setForm(null);
          }}
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
            <EditorField label="Price per cu ft" hint={priceError}>
              <div className="inline-flex h-9 items-center rounded-md border border-[#E4D9CC] bg-white focus-within:border-burgundy focus-within:ring-1 focus-within:ring-burgundy">
                <span className="pl-2 text-sm text-gray-400">$</span>
                <input
                  aria-label="Price per cu ft"
                  inputMode="decimal"
                  value={form.price_per_cuft}
                  onChange={(event) => setForm({ ...form, price_per_cuft: event.target.value })}
                  className="w-24 bg-transparent px-2 py-1.5 text-sm tabular-nums outline-none"
                />
                <span className="pr-2 text-xs text-gray-400">/ cu ft</span>
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
          title="Delete drawer box"
          body={`Remove ${pendingDelete.name}?`}
          confirmLabel="Delete"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            void deleteRow("costing_drawer_box_styles", pendingDelete.id).then((message) => {
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
        <Modal title="This drawer box is in use" onClose={() => setBlocked(null)}>
          <p className="text-sm text-gray-600">{blocked}</p>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => setBlocked(null)}>Close</Button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
