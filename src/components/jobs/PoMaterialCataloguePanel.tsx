"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { IconGripVertical, IconSearch } from "@tabler/icons-react";
import {
  buildMaterialCatalogueDragPayload,
  MATERIAL_CATALOGUE_DRAG_MIME,
  type MaterialCatalogueDragPayload,
} from "@/lib/po-material-catalogue-drag";
import { createClient } from "@/lib/supabase/client";
import { formatCurrencyFull } from "@/lib/utils";
import type { CatalogueItem } from "@/lib/types";

interface PoMaterialCataloguePanelProps {
  onAddItem: (payload: MaterialCatalogueDragPayload) => void;
}

function DraggableMaterialRow({
  item,
  onAddItem,
}: {
  item: CatalogueItem;
  onAddItem: (payload: MaterialCatalogueDragPayload) => void;
}) {
  const payload = buildMaterialCatalogueDragPayload(item);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(
          MATERIAL_CATALOGUE_DRAG_MIME,
          JSON.stringify(payload)
        );
        e.dataTransfer.effectAllowed = "copy";
      }}
      onClick={() => onAddItem(payload)}
      className="flex cursor-grab items-start gap-2 border-b border-gray-100 px-3 py-2.5 active:cursor-grabbing hover:bg-white"
      title="Click or drag into line items to add"
    >
      <IconGripVertical
        size={14}
        className="mt-0.5 shrink-0 text-gray-300"
        stroke={1.5}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">{item.name}</p>
        <p className="truncate text-[11px] text-gray-500">{item.category}</p>
      </div>
      <span className="shrink-0 text-xs font-medium tabular-nums text-gray-700">
        {formatCurrencyFull(Number(item.price))}
      </span>
    </div>
  );
}

export default function PoMaterialCataloguePanel({
  onAddItem,
}: PoMaterialCataloguePanelProps) {
  const [items, setItems] = useState<CatalogueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("catalogue_items")
      .select("*")
      .order("name");
    setItems((data as CatalogueItem[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const categories = useMemo(() => {
    return [...new Set(items.map((item) => item.category))].sort();
  }, [items]);

  const filtered = useMemo(() => {
    let list = items;
    if (category !== "all") {
      list = list.filter((item) => item.category === category);
    }
    const q = search.toLowerCase().trim();
    if (!q) return list;
    return list.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
    );
  }, [category, items, search]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-gray-200 px-3 py-3">
        <span className="text-xs font-semibold tracking-wide text-gray-500">
          MATERIAL CATALOGUE
        </span>
        <div className="mt-2 flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setCategory("all")}
            className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
              category === "all"
                ? "bg-white text-burgundy shadow-sm ring-1 ring-gray-200"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                category === cat
                  ? "bg-white text-burgundy shadow-sm ring-1 ring-gray-200"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="relative mt-2">
          <IconSearch
            size={14}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search materials…"
            className="w-full rounded-md border border-gray-300 bg-white py-1.5 pl-8 pr-2 text-xs focus:border-burgundy focus:outline-none focus:ring-1 focus:ring-burgundy"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <p className="px-3 py-6 text-center text-xs text-gray-500">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-gray-500">
            {search || category !== "all"
              ? "No matches."
              : "No materials in catalogue yet."}
          </p>
        ) : (
          filtered.map((item) => (
            <DraggableMaterialRow
              key={item.id}
              item={item}
              onAddItem={onAddItem}
            />
          ))
        )}
      </div>

      <div className="shrink-0 border-t border-gray-200 px-3 py-2 text-[10px] text-gray-500">
        {filtered.length} material{filtered.length !== 1 ? "s" : ""} · drag or
        click to add
      </div>
    </div>
  );
}
