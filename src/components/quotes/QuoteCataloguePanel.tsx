"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { IconGripVertical, IconSearch } from "@tabler/icons-react";
import {
  buildCatalogueDragPayload,
  CATALOGUE_DRAG_MIME,
  type CatalogueItemSource,
} from "@/lib/quote-catalogue-drag";
import {
  fetchPricingCabinetTypes,
  fetchPricingComponents,
  type PricingCatalogueItem,
} from "@/lib/pricing-catalogue";
import { formatCurrencyFull } from "@/lib/utils";

const CATALOGUE_TABS = [
  { id: "cabinets" as const, label: "Cabinets" },
  { id: "components" as const, label: "Components" },
];

interface QuoteCataloguePanelProps {
  canDrop: boolean;
  selectedRoomName?: string | null;
}

function DraggableCatalogueRow({
  item,
  source,
}: {
  item: PricingCatalogueItem;
  source: CatalogueItemSource;
}) {
  const payload = buildCatalogueDragPayload(item, source);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(CATALOGUE_DRAG_MIME, JSON.stringify(payload));
        e.dataTransfer.effectAllowed = "copy";
      }}
      className="flex cursor-grab items-start gap-2 border-b border-gray-100 px-3 py-2.5 active:cursor-grabbing hover:bg-white"
      title="Drag into the room to add this item"
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
        {formatCurrencyFull(Number(item.base_price))}
      </span>
    </div>
  );
}

export default function QuoteCataloguePanel({
  canDrop,
  selectedRoomName,
}: QuoteCataloguePanelProps) {
  const [tab, setTab] = useState<(typeof CATALOGUE_TABS)[number]["id"]>("cabinets");
  const [search, setSearch] = useState("");
  const [cabinets, setCabinets] = useState<PricingCatalogueItem[]>([]);
  const [components, setComponents] = useState<PricingCatalogueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [cabinetRes, componentRes] = await Promise.all([
      fetchPricingCabinetTypes(),
      fetchPricingComponents(),
    ]);
    setCabinets(cabinetRes.items);
    setComponents(componentRes.items);
    setLoadError(cabinetRes.error ?? componentRes.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeList = tab === "cabinets" ? cabinets : components;
  const source: CatalogueItemSource = tab === "cabinets" ? "cabinet" : "component";

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return activeList;
    return activeList.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
  }, [activeList, search]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-gray-200 px-3 py-3">
        <span className="text-xs font-semibold tracking-wide text-gray-500">
          CATALOGUE
        </span>
        <div className="mt-2 flex gap-1 rounded-md bg-gray-200/60 p-0.5">
          {CATALOGUE_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                tab === t.id
                  ? "bg-white text-burgundy shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {t.label}
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
            placeholder={`Search ${tab}…`}
            className="w-full rounded-md border border-gray-300 bg-white py-1.5 pl-8 pr-2 text-xs focus:border-burgundy focus:outline-none focus:ring-1 focus:ring-burgundy"
          />
        </div>
      </div>

      {!canDrop && (
        <p className="shrink-0 border-b border-amber-100 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
          Select a room, then drag items into the room panel.
        </p>
      )}
      {canDrop && selectedRoomName && (
        <p className="shrink-0 border-b border-gray-100 bg-white px-3 py-2 text-[11px] text-gray-600">
          Adding to: <span className="font-medium text-gray-900">{selectedRoomName}</span>
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <p className="px-3 py-6 text-center text-xs text-gray-500">Loading…</p>
        ) : loadError ? (
          <p className="px-3 py-4 text-xs text-amber-800">{loadError}</p>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-gray-500">
            {search
              ? "No matches."
              : tab === "cabinets"
                ? "No cabinets in catalogue yet."
                : "No components in catalogue yet."}
          </p>
        ) : (
          filtered.map((item) => (
            <DraggableCatalogueRow key={item.id} item={item} source={source} />
          ))
        )}
      </div>

      <div className="shrink-0 border-t border-gray-200 px-3 py-2 text-[10px] text-gray-500">
        {filtered.length} {tab === "cabinets" ? "cabinet" : "component"}
        {filtered.length !== 1 ? "s" : ""} · drag to room
      </div>
    </div>
  );
}
