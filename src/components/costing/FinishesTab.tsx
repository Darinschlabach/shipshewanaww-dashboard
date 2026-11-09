"use client";

import { useEffect, useMemo, useState } from "react";
import { IconBrush } from "@tabler/icons-react";
import Button from "@/components/Button";
import ConfirmModal from "@/components/ConfirmModal";
import FilterPills from "@/components/FilterPills";
import Modal from "@/components/Modal";
import { createClient } from "@/lib/supabase/client";
import { formatCurrencyPrecise } from "@/lib/utils";
import {
  deleteRow,
  fetchFinishes,
  finishUsage,
  saveFinish,
  type CostingFinish,
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

type UseFilter = "all" | "exterior" | "interior";

type FormState = {
  id?: string;
  name: string;
  use_exterior: boolean;
  use_interior: boolean;
  price_per_sqft: string;
  notes: string;
  active: boolean;
};

function blankForm(): FormState {
  return {
    name: "",
    use_exterior: true,
    use_interior: false,
    price_per_sqft: "",
    notes: "",
    active: true,
  };
}

function formFromRow(row: CostingFinish): FormState {
  return {
    id: row.id,
    name: row.name,
    use_exterior: row.use_exterior,
    use_interior: row.use_interior,
    price_per_sqft: String(row.price_per_sqft),
    notes: row.notes,
    active: row.active,
  };
}

function matchesUse(row: CostingFinish, filter: UseFilter) {
  if (filter === "exterior") return row.use_exterior;
  if (filter === "interior") return row.use_interior;
  return true;
}

export default function FinishesTab({ onChanged }: { onChanged?: () => void }) {
  const [rows, setRows] = useState<CostingFinish[]>([]);
  const [usage, setUsage] = useState<Map<string, number>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [useFilter, setUseFilter] = useState<UseFilter>("all");
  const [form, setForm] = useState<FormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CostingFinish | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);

  async function load() {
    const supabase = createClient();
    const [result, links] = await Promise.all([
      fetchFinishes(),
      supabase.from("costing_schedule_items").select("finish_id, schedule_id"),
    ]);
    setRows(result.rows);
    const counts = new Map<string, Set<string>>();
    for (const link of links.data ?? []) {
      if (!link.finish_id || !link.schedule_id) continue;
      const schedules = counts.get(link.finish_id) ?? new Set<string>();
      schedules.add(link.schedule_id);
      counts.set(link.finish_id, schedules);
    }
    setUsage(new Map([...counts].map(([id, schedules]) => [id, schedules.size])));
    setError(result.error ?? links.error?.message ?? null);
    setLoaded(true);
  }

  useEffect(() => {
    void load();
  }, []);

  const pillOptions = useMemo(() => {
    const counted = (side: "use_exterior" | "use_interior") =>
      rows.filter((row) => row[side] && (showInactive || row.active)).length;
    const options: { value: Exclude<UseFilter, "all">; label: string }[] = [];
    const exterior = counted("use_exterior");
    const interior = counted("use_interior");
    if (exterior > 0 || showInactive) options.push({ value: "exterior", label: `Exterior (${exterior})` });
    if (interior > 0 || showInactive) options.push({ value: "interior", label: `Interior (${interior})` });
    return options;
  }, [rows, showInactive]);

  useEffect(() => {
    if (useFilter !== "all" && !pillOptions.some((option) => option.value === useFilter)) {
      setUseFilter("all");
    }
  }, [pillOptions, useFilter]);

  const visible = useMemo(
    () =>
      rows.filter((row) => {
        if (!showInactive && !row.active) return false;
        if (!matchesUse(row, useFilter)) return false;
        return matchesSearch(search, [
          row.name,
          row.notes,
          row.use_exterior ? "exterior" : "",
          row.use_interior ? "interior" : "",
        ]);
      }),
    [rows, search, showInactive, useFilter]
  );

  function openNew() {
    setFormError(null);
    setForm(blankForm());
  }

  function openEdit(row: CostingFinish) {
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
    const price = parseRequiredNumber(form.price_per_sqft, "price per sq ft");
    if (!form.name.trim()) return setFormError("Enter a name");
    if (!form.use_exterior && !form.use_interior) return setFormError("Choose exterior, interior, or both");
    if (typeof price === "string") return setFormError(price);
    setFormError(null);
    setSaving(true);
    try {
      const message = await saveFinish({
        id: form.id,
        name: form.name,
        use_exterior: form.use_exterior,
        use_interior: form.use_interior,
        price_per_sqft: price,
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

  async function setActive(row: CostingFinish, active: boolean) {
    const message = await saveFinish({ ...row, active });
    if (message) {
      setError(message);
      return;
    }
    if (form?.id === row.id) setForm({ ...formFromRow(row), active });
    await load();
    onChanged?.();
  }

  async function duplicate(row: CostingFinish) {
    const message = await saveFinish({
      name: `${row.name} copy`,
      use_exterior: row.use_exterior,
      use_interior: row.use_interior,
      price_per_sqft: row.price_per_sqft,
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

  async function askDelete(row: CostingFinish) {
    const used = await finishUsage(row.id);
    if (used.length) setBlocked(`${row.name} is used by ${used.join(", ")}.`);
    else setPendingDelete(row);
  }

  const nameError = formError === "Enter a name" ? formError : undefined;
  const useError = formError === "Choose exterior, interior, or both" ? formError : undefined;
  const priceError = formError?.includes("price") ? formError : undefined;
  const generalError = formError && !nameError && !useError && !priceError ? formError : undefined;
  const libraryEmpty = loaded && rows.length === 0 && !error;

  return (
    <>
      {error ? <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <ListCard>
        <ListHeader
          title="Finishes"
          count={loaded ? visible.length : 0}
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search finishes"
          actionLabel="New finish"
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
        {pillOptions.length > 0 ? (
          <div className="border-b border-[#F0EBE3] px-6 py-3">
            <FilterPills
              options={pillOptions}
              value={useFilter}
              onChange={(value) => setUseFilter(value === useFilter ? "all" : (value as UseFilter))}
            />
          </div>
        ) : null}
        {!loaded ? (
          <p className="px-6 py-10 text-sm text-gray-500">Loading finishes…</p>
        ) : libraryEmpty ? (
          <EmptyState
            icon={IconBrush}
            title="No finishes yet"
            body="Add a finish and mark it for the exterior, the interior, or both."
            actionLabel="New finish"
            onAction={openNew}
          />
        ) : (
          <DataTable
            rows={visible}
            activeId={form?.id}
            initialSort={{ id: "name", dir: "asc" }}
            onRowClick={openEdit}
            empty={<p className="px-6 py-10 text-center text-sm text-gray-500">No finishes match.</p>}
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
                id: "used-on",
                header: "Used on",
                sortValue: (row) => `${row.use_exterior ? "1" : "0"}${row.use_interior ? "1" : "0"}`,
                cell: (row) => (
                  <div className="flex flex-wrap gap-1">
                    {row.use_exterior ? <Badge tone="sand">Exterior</Badge> : null}
                    {row.use_interior ? <Badge tone="sage">Interior</Badge> : null}
                  </div>
                ),
              },
              {
                id: "price",
                header: "Price",
                align: "right",
                sortValue: (row) => row.price_per_sqft,
                cell: (row) => (
                  <span className="whitespace-nowrap">
                    <span className="tabular-nums text-gray-900">{formatCurrencyPrecise(row.price_per_sqft)}</span>
                    <span className="ml-1 text-gray-400">/ sq ft</span>
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

      {form ? (
        <SlideOver
          title={form.id ? "Edit finish" : "New finish"}
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
            <div>
              <span className="text-xs font-medium text-gray-500">Used on</span>
              <div className="mt-2 space-y-2">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.use_exterior}
                    onChange={(event) => setForm({ ...form, use_exterior: event.target.checked })}
                  />
                  Use on exterior
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.use_interior}
                    onChange={(event) => setForm({ ...form, use_interior: event.target.checked })}
                  />
                  Use on interior
                </label>
              </div>
              {useError ? <p className="mt-1 text-xs text-red-600">{useError}</p> : null}
            </div>
            <EditorField label="Price per sq ft" hint={priceError}>
              <div className="inline-flex h-9 items-center rounded-md border border-[#E4D9CC] bg-white focus-within:border-burgundy focus-within:ring-1 focus-within:ring-burgundy">
                <span className="pl-2 text-sm text-gray-400">$</span>
                <input
                  aria-label="Price per sq ft"
                  inputMode="decimal"
                  value={form.price_per_sqft}
                  onChange={(event) => setForm({ ...form, price_per_sqft: event.target.value })}
                  className="w-20 bg-transparent px-2 py-1.5 text-sm tabular-nums text-gray-900 outline-none"
                />
                <span className="pr-2 text-xs text-gray-400">/ sq ft</span>
              </div>
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
          title="Delete finish"
          body={`Remove ${pendingDelete.name}?`}
          confirmLabel="Delete"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            void deleteRow("costing_finishes", pendingDelete.id).then((message) => {
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
        <Modal title="This finish is in use" onClose={() => setBlocked(null)}>
          <p className="text-sm text-gray-600">{blocked}</p>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => setBlocked(null)}>Close</Button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
