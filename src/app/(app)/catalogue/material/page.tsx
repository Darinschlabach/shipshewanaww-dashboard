"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import PageHeader from "@/components/PageHeader";
import FilterBar from "@/components/FilterBar";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import { formatCurrencyFull } from "@/lib/utils";
import type { CatalogueItem } from "@/lib/types";

export default function MaterialCataloguePage() {
  const [items, setItems] = useState<CatalogueItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<CatalogueItem | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    category: "",
  });

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("catalogue_items")
      .select("*")
      .order("name");
    const list = (data as CatalogueItem[]) ?? [];
    setItems(list);
    const cats = [...new Set(list.map((i) => i.category))].sort();
    setCategories(cats);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered =
    filter === "all" ? items : items.filter((i) => i.category === filter);

  const filterOptions = [
    { value: "all", label: "All" },
    ...categories.map((c) => ({ value: c, label: c })),
  ];

  function openCreate() {
    setEditing(null);
    setForm({
      name: "",
      description: "",
      price: "",
      category: categories[0] ?? "General",
    });
    setShowModal(true);
  }

  function openEdit(item: CatalogueItem) {
    setEditing(item);
    setForm({
      name: item.name,
      description: item.description,
      price: String(item.price),
      category: item.category,
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    const payload = {
      name: form.name,
      description: form.description,
      price: parseFloat(form.price) || 0,
      category: form.category,
    };
    if (editing) {
      await supabase.from("catalogue_items").update(payload).eq("id", editing.id);
    } else {
      await supabase.from("catalogue_items").insert(payload);
    }
    setShowModal(false);
    load();
  }

  return (
    <>
      <PageHeader
        title="Material Catalogue"
        subtitle="Manage materials, cabinet units, doors, and hardware used in jobs."
        actionLabel="+ Add item"
        onAction={openCreate}
      />

      <div className="mb-6">
        <FilterBar
          options={filterOptions}
          activeOption={filter}
          onChange={setFilter}
        />
      </div>

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => openEdit(item)}
              className="rounded-lg border border-gray-200 bg-white p-5 text-left transition-colors hover:border-gray-300 hover:shadow-sm"
            >
              <p className="font-semibold text-gray-900">{item.name}</p>
              <p className="mt-1 text-sm text-gray-500">{item.description}</p>
              <p className="mt-1 text-xs text-gray-400">{item.category}</p>
              <p className="mt-3 font-semibold text-burgundy">
                {formatCurrencyFull(Number(item.price))} / unit
              </p>
            </button>
          ))}
        </div>
      )}

      {showModal && (
        <Modal
          title={editing ? "Edit item" : "Add item"}
          onClose={() => setShowModal(false)}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Name</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                rows={2}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Price</label>
              <input
                type="number"
                required
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Category</label>
              <input
                required
                value={form.category}
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value })
                }
                list="material-categories"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <datalist id="material-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                {editing ? "Save" : "Add item"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
