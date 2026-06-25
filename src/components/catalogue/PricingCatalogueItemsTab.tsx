"use client";

import { useMemo, useState } from "react";
import {
  IconChevronLeft,
  IconChevronRight,
  IconDotsVertical,
  IconFilter,
  IconInfoCircle,
  IconSearch,
} from "@tabler/icons-react";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import { formatCurrencyFull } from "@/lib/utils";
import type {
  PricingCatalogueItem,
  PricingCatalogueItemsLabels,
} from "@/lib/pricing-catalogue";

const PAGE_SIZE_OPTIONS = [10, 25, 50];

const selectClass =
  "rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-burgundy focus:outline-none focus:ring-1 focus:ring-burgundy";

const headClass =
  "px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500";

interface PricingCatalogueItemsTabProps {
  labels: PricingCatalogueItemsLabels;
  items: PricingCatalogueItem[];
  loading: boolean;
  onReload: () => Promise<void>;
  onSave: (
    payload: {
      name: string;
      category: string;
      base_price: number;
      sq_ft_price: number;
    },
    editingId: string | null
  ) => Promise<string | null>;
  onDelete: (id: string) => Promise<void>;
}

export default function PricingCatalogueItemsTab({
  labels,
  items,
  loading,
  onReload,
  onSave,
  onDelete,
}: PricingCatalogueItemsTabProps) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    category: "",
    base_price: "",
    sq_ft_price: "",
  });

  const categories = useMemo(
    () => [...new Set(items.map((c) => c.category))].sort(),
    [items]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return items.filter((c) => {
      if (categoryFilter && c.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q)
      );
    });
  }, [items, search, categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageItems = filtered.slice(pageStart, pageStart + pageSize);

  function openCreate() {
    setEditingId(null);
    setForm({
      name: "",
      category: categories[0] ?? labels.defaultCategory,
      base_price: "",
      sq_ft_price: "",
    });
    setShowModal(true);
  }

  function openEdit(item: PricingCatalogueItem) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      category: item.category,
      base_price: String(item.base_price),
      sq_ft_price: String(item.sq_ft_price),
    });
    setShowModal(true);
    setMenuId(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const id = await onSave(
      {
        name: form.name.trim(),
        category: form.category.trim(),
        base_price: parseFloat(form.base_price) || 0,
        sq_ft_price: parseFloat(form.sq_ft_price) || 0,
      },
      editingId
    );
    if (id) setSelectedId(id);
    setShowModal(false);
    await onReload();
  }

  async function handleDelete(id: string) {
    if (!confirm(labels.deleteConfirm)) return;
    setMenuId(null);
    await onDelete(id);
    if (selectedId === id) setSelectedId(null);
    await onReload();
  }

  const countLabel =
    filtered.length === 1 ? labels.countSingular : labels.countPlural;

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{labels.title}</h2>
          <p className="mt-0.5 text-sm text-gray-500">{labels.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <IconSearch
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={labels.searchPlaceholder}
              className="w-52 rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-burgundy focus:outline-none focus:ring-1 focus:ring-burgundy"
            />
          </div>
          <div className="relative">
            <IconFilter
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className={`${selectClass} w-44 appearance-none pl-9 pr-8`}
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="rounded-md bg-burgundy px-4 py-2 text-sm font-medium text-white hover:bg-burgundy/90"
          >
            {labels.addButton}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="px-5 py-12 text-sm text-gray-500">{labels.loadingMessage}</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className={headClass}>{labels.nameColumn}</th>
                  <th className={headClass}>Category</th>
                  <th className={headClass}>
                    <span className="inline-flex items-center gap-1">
                      Base Price
                      <span title={labels.basePriceHint}>
                        <IconInfoCircle size={14} className="text-gray-400" />
                      </span>
                    </span>
                  </th>
                  <th className={headClass}>
                    <span className="inline-flex items-center gap-1">
                      Cubic ft price
                      <span title="Price per cubic foot">
                        <IconInfoCircle size={14} className="text-gray-400" />
                      </span>
                    </span>
                  </th>
                  <th className="w-12 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {pageItems.map((row) => {
                  const selected = row.id === selectedId;
                  return (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedId(row.id)}
                      className={`cursor-pointer border-b border-gray-100 transition-colors ${
                        selected
                          ? "bg-burgundy/5 text-burgundy"
                          : "text-gray-900 hover:bg-gray-50"
                      }`}
                    >
                      <td className="px-4 py-3 font-medium">{row.name}</td>
                      <td
                        className={`px-4 py-3 ${
                          selected ? "text-burgundy/80" : "text-gray-600"
                        }`}
                      >
                        {row.category}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {formatCurrencyFull(Number(row.base_price))}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {formatCurrencyFull(Number(row.sq_ft_price))}
                      </td>
                      <td className="relative px-4 py-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuId(menuId === row.id ? null : row.id);
                          }}
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                          aria-label="Actions"
                        >
                          <IconDotsVertical size={16} />
                        </button>
                        {menuId === row.id && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => setMenuId(null)}
                            />
                            <div className="absolute right-4 top-10 z-20 w-32 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEdit(row);
                                }}
                                className="block w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleDelete(row.id);
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
                {pageItems.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-10 text-center text-sm text-gray-500"
                    >
                      {labels.emptySearch}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-5 py-3 text-sm text-gray-600">
            <p>
              {filtered.length === 0
                ? labels.emptyList
                : `Showing ${pageStart + 1} to ${Math.min(pageStart + pageSize, filtered.length)} of ${filtered.length} ${countLabel}`}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="rounded-md border border-gray-300 p-1.5 hover:bg-gray-50 disabled:opacity-40"
                aria-label="Previous page"
              >
                <IconChevronLeft size={16} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(
                  (n) =>
                    n === 1 ||
                    n === totalPages ||
                    Math.abs(n - safePage) <= 1
                )
                .map((n, idx, arr) => {
                  const prev = arr[idx - 1];
                  const showEllipsis = prev != null && n - prev > 1;
                  return (
                    <span key={n} className="flex items-center gap-1">
                      {showEllipsis && (
                        <span className="px-1 text-gray-400">…</span>
                      )}
                      <button
                        type="button"
                        onClick={() => setPage(n)}
                        className={`min-w-[2rem] rounded-md px-2 py-1 text-sm ${
                          n === safePage
                            ? "bg-burgundy text-white"
                            : "border border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        {n}
                      </button>
                    </span>
                  );
                })}
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="rounded-md border border-gray-300 p-1.5 hover:bg-gray-50 disabled:opacity-40"
                aria-label="Next page"
              >
                <IconChevronRight size={16} />
              </button>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className={selectClass}
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size} / page
                  </option>
                ))}
              </select>
            </div>
          </div>
        </>
      )}

      {showModal && (
        <Modal
          title={editingId ? labels.modalEditTitle : labels.modalAddTitle}
          onClose={() => setShowModal(false)}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">
                {labels.formNameLabel}
              </label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
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
                list={labels.categoryListId}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <datalist id={labels.categoryListId}>
                {categories.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Base Price
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={form.base_price}
                  onChange={(e) =>
                    setForm({ ...form, base_price: e.target.value })
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Cubic ft price
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={form.sq_ft_price}
                  onChange={(e) =>
                    setForm({ ...form, sq_ft_price: e.target.value })
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                {editingId ? "Save" : "Add"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
