"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconPencil,
  IconTrash,
} from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/client";
import {
  catalogueItemToQuoteCategory,
  CATALOGUE_DRAG_MIME,
  parseCatalogueDrag,
  type CatalogueDragPayload,
} from "@/lib/quote-catalogue-drag";
import { fetchPricingVariables } from "@/lib/pricing-catalogue";
import type {
  PricingDoorStyle,
  PricingFinishType,
  PricingWoodSpecies,
} from "@/lib/pricing-catalogue";
import {
  quoteItemNeedsDimensions,
  sortQuoteRoomItems,
} from "@/lib/quote-item-pricing";
import { resolveRoomMultipliers } from "@/lib/quote-room-multipliers";
import {
  fetchQuoteRoomsWithItems,
  QUOTE_ITEM_CATEGORIES,
  resolvedQuoteItemPrice,
  roomTotal,
  sumByCategory,
  type QuoteRoomWithItems,
} from "@/lib/quote-rooms";
import type { QuoteRoom, QuoteRoomItem, QuoteRoomItemCategory } from "@/lib/types";
import { formatCurrencyFull } from "@/lib/utils";
import Button from "@/components/Button";
import Modal from "@/components/Modal";
import QuoteCataloguePanel from "@/components/quotes/QuoteCataloguePanel";
import RoomPricingMultipliers from "@/components/quotes/RoomPricingMultipliers";
import QuoteRoomItemRow, {
  type QuoteRoomItemRowHandle,
} from "@/components/quotes/QuoteRoomItemRow";

interface QuoteRoomsTabProps {
  quoteId: string;
  onQuoteUpdated?: () => void;
}

const EMPTY_ITEM_FORM = {
  item_type: "",
  description: "",
  qty_size: "",
  price: "",
  category: "cabinets" as QuoteRoomItemCategory,
};

/** Side panels (rooms list + catalogue) share the same width; center takes the rest. */
const SIDE_PANEL_CLASS =
  "flex w-56 shrink-0 flex-col bg-gray-50/80 sm:w-64";

export default function QuoteRoomsTab({
  quoteId,
  onQuoteUpdated,
}: QuoteRoomsTabProps) {
  const [rooms, setRooms] = useState<QuoteRoomWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [showRoomForm, setShowRoomForm] = useState(false);
  const [editingRoom, setEditingRoom] = useState<QuoteRoom | null>(null);
  const [roomName, setRoomName] = useState("");
  const [savingRoom, setSavingRoom] = useState(false);
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState<QuoteRoomItem | null>(null);
  const [itemForm, setItemForm] = useState(EMPTY_ITEM_FORM);
  const [savingItem, setSavingItem] = useState(false);
  const [deletingRoom, setDeletingRoom] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [addingFromCatalogue, setAddingFromCatalogue] = useState(false);
  const rowRefs = useRef<Map<string, QuoteRoomItemRowHandle>>(new Map());
  const rootRef = useRef<HTMLDivElement>(null);
  const hasLoadedOnce = useRef(false);
  const [mounted, setMounted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandPlaceholderHeight, setExpandPlaceholderHeight] = useState<
    number | null
  >(null);
  const [woodSpecies, setWoodSpecies] = useState<PricingWoodSpecies[]>([]);
  const [finishTypes, setFinishTypes] = useState<PricingFinishType[]>([]);
  const [doorStyles, setDoorStyles] = useState<PricingDoorStyle[]>([]);

  useEffect(() => {
    void fetchPricingVariables().then((res) => {
      if (!res.error) {
        setWoodSpecies(res.woodSpecies);
        setFinishTypes(res.finishTypes);
        setDoorStyles(res.doorStyles);
      }
    });
  }, []);

  useEffect(() => {
    if (!isExpanded) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsExpanded(false);
        setExpandPlaceholderHeight(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isExpanded]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isExpanded) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isExpanded]);

  function toggleExpand() {
    if (isExpanded) {
      setIsExpanded(false);
      setExpandPlaceholderHeight(null);
      return;
    }
    const el = rootRef.current;
    if (!el) return;
    setExpandPlaceholderHeight(el.getBoundingClientRect().height);
    setIsExpanded(true);
  }

  const syncQuoteEstValue = useCallback(
    async (roomList: QuoteRoomWithItems[]) => {
      const total = roomList.reduce(
        (sum, room) => sum + roomTotal(room.items),
        0
      );
      const supabase = createClient();
      await supabase.from("leads").update({ est_value: total }).eq("id", quoteId);
      onQuoteUpdated?.();
    },
    [quoteId, onQuoteUpdated]
  );

  const load = useCallback(async () => {
    if (!hasLoadedOnce.current) {
      setLoading(true);
    }
    setLoadError(null);
    const supabase = createClient();

    const { rooms: merged, error } = await fetchQuoteRoomsWithItems(quoteId);

    if (error) {
      setLoadError(
        error.includes("quote_rooms")
          ? "Quote rooms are not set up yet. Run supabase/migrations/20250604000016_quote_rooms.sql in the Supabase SQL Editor."
          : error
      );
      setRooms([]);
      setLoading(false);
      return;
    }

    setRooms(merged);
    setSelectedRoomId((prev) => {
      if (prev && merged.some((r) => r.id === prev)) return prev;
      return merged[0]?.id ?? null;
    });

    if (merged.length > 0) {
      const total = merged.reduce((sum, room) => sum + roomTotal(room.items), 0);
      await supabase.from("leads").update({ est_value: total }).eq("id", quoteId);
      onQuoteUpdated?.();
    }

    setLoading(false);
    hasLoadedOnce.current = true;
  }, [quoteId, onQuoteUpdated]);

  useEffect(() => {
    load();
  }, [load]);

  const selectedRoom = useMemo(
    () => rooms.find((r) => r.id === selectedRoomId) ?? null,
    [rooms, selectedRoomId]
  );

  const grandTotal = useMemo(
    () => rooms.reduce((sum, room) => sum + roomTotal(room.items), 0),
    [rooms]
  );

  const cabinetMultiplier = useMemo(() => {
    if (!selectedRoom) return 1;
    return resolveRoomMultipliers(
      selectedRoom,
      woodSpecies,
      finishTypes,
      doorStyles
    ).total;
  }, [selectedRoom, woodSpecies, finishTypes, doorStyles]);

  const roomTotals = useMemo(() => {
    if (!selectedRoom) return null;
    const byCat = sumByCategory(selectedRoom.items);
    const total = roomTotal(selectedRoom.items);
    return { ...byCat, total };
  }, [selectedRoom]);

  const showDimensionColumns = useMemo(
    () =>
      selectedRoom?.items.some((item) => quoteItemNeedsDimensions(item)) ?? false,
    [selectedRoom]
  );

  async function handleSaveRoomMultipliers(patch: {
    wood_species_id: string | null;
    finish_type_id: string | null;
    door_style_id: string | null;
  }) {
    if (!selectedRoom) return;
    const supabase = createClient();

    await supabase.from("quote_rooms").update(patch).eq("id", selectedRoom.id);

    const newMult = resolveRoomMultipliers(
      { ...selectedRoom, ...patch },
      woodSpecies,
      finishTypes,
      doorStyles
    ).total;

    const updatedRoom = { ...selectedRoom, ...patch };
    const repricedItems = selectedRoom.items.map((item) => {
      if (item.category !== "cabinets") return item;
      const price = resolvedQuoteItemPrice(item, newMult);
      return { ...item, price };
    });

    for (const item of repricedItems.filter((i) => i.category === "cabinets")) {
      await supabase
        .from("quote_room_items")
        .update({ price: item.price })
        .eq("id", item.id);
    }

    setRooms((prev) => {
      const next = prev.map((room) =>
        room.id === selectedRoom.id
          ? { ...updatedRoom, items: repricedItems }
          : room
      );
      void syncQuoteEstValue(next);
      return next;
    });
  }

  function openAddRoom() {
    setEditingRoom(null);
    setRoomName("");
    setShowRoomForm(true);
  }

  function openEditRoom(room: QuoteRoom) {
    setEditingRoom(room);
    setRoomName(room.name);
    setShowRoomForm(true);
  }

  async function handleSaveRoom(e: FormEvent) {
    e.preventDefault();
    const name = roomName.trim();
    if (!name) return;

    setSavingRoom(true);
    const supabase = createClient();

    if (editingRoom) {
      await supabase.from("quote_rooms").update({ name }).eq("id", editingRoom.id);
    } else {
      const maxOrder = rooms.reduce((m, r) => Math.max(m, r.sort_order), -1);
      await supabase.from("quote_rooms").insert({
        lead_id: quoteId,
        name,
        sort_order: maxOrder + 1,
      });
    }

    setSavingRoom(false);
    setShowRoomForm(false);
    await load();
  }

  async function handleDeleteRoom() {
    if (!selectedRoom) return;
    if (!confirm(`Delete room "${selectedRoom.name}" and all its items?`)) return;

    setDeletingRoom(true);
    const supabase = createClient();
    await supabase.from("quote_rooms").delete().eq("id", selectedRoom.id);
    setDeletingRoom(false);
    await load();
  }

  function openAddItem() {
    setEditingItem(null);
    setItemForm(EMPTY_ITEM_FORM);
    setShowItemForm(true);
  }

  async function updateRoomItem(
    itemId: string,
    patch: Partial<QuoteRoomItem>
  ) {
    const room = selectedRoom;
    const item = room?.items.find((i) => i.id === itemId);
    if (!room || !item) return;

    const merged = { ...item, ...patch };
    const price = resolvedQuoteItemPrice(merged, cabinetMultiplier);

    const supabase = createClient();
    await supabase
      .from("quote_room_items")
      .update({
        qty: merged.qty,
        description: merged.description,
        width_in: merged.width_in,
        length_in: merged.length_in,
        height_in: merged.height_in,
        base_price: merged.base_price,
        price,
      })
      .eq("id", itemId);

    const updatedItem = { ...merged, price };
    setRooms((prev) => {
      const next = prev.map((r) =>
        r.id === room.id
          ? {
              ...r,
              items: r.items.map((row) =>
                row.id === itemId ? updatedItem : row
              ),
            }
          : r
      );
      void syncQuoteEstValue(next);
      return next;
    });
  }

  async function addMiscLineItem() {
    if (!selectedRoom) return;

    const supabase = createClient();
    const maxOrder = selectedRoom.items.reduce(
      (m, i) => Math.max(m, i.sort_order),
      -1
    );

    const { data, error } = await supabase
      .from("quote_room_items")
      .insert({
        room_id: selectedRoom.id,
        sort_order: maxOrder + 1,
        item_type: "Misc",
        description: null,
        qty: 1,
        width_in: null,
        length_in: null,
        height_in: null,
        catalogue_id: null,
        catalogue_source: null,
        base_price: 0,
        sq_ft_price: 0,
        price: 0,
        category: "labor",
      })
      .select("*")
      .single();

    if (error || !data) return;

    const newItem = data as QuoteRoomItem;
    setRooms((prev) => {
      const next = prev.map((room) =>
        room.id === selectedRoom.id
          ? {
              ...room,
              items: sortQuoteRoomItems([...room.items, newItem]),
            }
          : room
      );
      void syncQuoteEstValue(next);
      return next;
    });

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        rowRefs.current.get(newItem.id)?.focusQty();
      });
    });
  }

  async function handleSaveItem(e: FormEvent) {
    e.preventDefault();
    if (!selectedRoom || !itemForm.item_type.trim()) return;

    setSavingItem(true);
    const supabase = createClient();
    const manualPrice = parseFloat(itemForm.price) || 0;
    const payload = {
      item_type: itemForm.item_type.trim(),
      description: itemForm.description.trim() || null,
      qty_size: itemForm.qty_size.trim() || null,
      price: manualPrice,
      base_price: manualPrice,
      sq_ft_price: 0,
      category: itemForm.category,
    };

    if (editingItem) {
      await supabase.from("quote_room_items").update(payload).eq("id", editingItem.id);
    } else {
      const maxOrder = selectedRoom.items.reduce(
        (m, i) => Math.max(m, i.sort_order),
        -1
      );
      await supabase.from("quote_room_items").insert({
        room_id: selectedRoom.id,
        sort_order: maxOrder + 1,
        ...payload,
      });
    }

    setSavingItem(false);
    setShowItemForm(false);
    await load();
  }

  async function handleDeleteItem(item: QuoteRoomItem) {
    const supabase = createClient();
    await supabase.from("quote_room_items").delete().eq("id", item.id);
    rowRefs.current.delete(item.id);
    setRooms((prev) => {
      const next = prev.map((room) =>
        room.id === item.room_id
          ? {
              ...room,
              items: room.items.filter((row) => row.id !== item.id),
            }
          : room
      );
      void syncQuoteEstValue(next);
      return next;
    });
  }

  const handleItemEnterComplete = useCallback(
    (itemId: string) => {
      if (!selectedRoom) return;
      const idx = selectedRoom.items.findIndex((i) => i.id === itemId);
      const next = selectedRoom.items[idx + 1];
      if (next) {
        requestAnimationFrame(() => {
          rowRefs.current.get(next.id)?.focusQty();
        });
      }
    },
    [selectedRoom]
  );

  const addItemFromCatalogue = useCallback(
    async (payload: CatalogueDragPayload) => {
      if (!selectedRoom) return;

      setAddingFromCatalogue(true);
      const supabase = createClient();
      const maxOrder = selectedRoom.items.reduce(
        (m, i) => Math.max(m, i.sort_order),
        -1
      );

      const { data, error } = await supabase
        .from("quote_room_items")
        .insert({
          room_id: selectedRoom.id,
          sort_order: maxOrder + 1,
          item_type: payload.name,
          description: payload.category,
          qty: null,
          width_in: null,
          length_in: null,
          height_in: null,
          catalogue_id: payload.id,
          catalogue_source: payload.source,
          base_price: payload.base_price,
          sq_ft_price: payload.source === "component" ? 0 : payload.sq_ft_price,
          price: 0,
          category: catalogueItemToQuoteCategory(payload.source),
        })
        .select("*")
        .single();

      setAddingFromCatalogue(false);
      if (error || !data) return;

      const newItem = data as QuoteRoomItem;
      setRooms((prev) => {
        const next = prev.map((room) =>
          room.id === selectedRoom.id
            ? {
                ...room,
                items: sortQuoteRoomItems([...room.items, newItem]),
              }
            : room
        );
        void syncQuoteEstValue(next);
        return next;
      });
    },
    [selectedRoom, syncQuoteEstValue]
  );

  function handleRoomDragOver(e: DragEvent) {
    e.preventDefault();
    if (!selectedRoom) return;
    if (e.dataTransfer.types.includes(CATALOGUE_DRAG_MIME)) {
      e.dataTransfer.dropEffect = "copy";
      setIsDragOver(true);
    }
  }

  function handleRoomDragLeave(e: DragEvent) {
    const related = e.relatedTarget as Node | null;
    if (!related || !e.currentTarget.contains(related)) {
      setIsDragOver(false);
    }
  }

  async function handleRoomDrop(e: DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const payload = parseCatalogueDrag(e.dataTransfer);
    if (!payload || !selectedRoom) return;
    await addItemFromCatalogue(payload);
  }

  function renderRoomsPanel() {
    return (
      <>
        {!isExpanded && (
          <aside className={`${SIDE_PANEL_CLASS} border-r border-gray-200`}>
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <span className="text-xs font-semibold tracking-wide text-gray-500">
                ROOMS
              </span>
              <button
                type="button"
                onClick={openAddRoom}
                className="text-xs font-medium text-burgundy hover:underline"
              >
                + Add Room
              </button>
            </div>

            <ul className="flex-1 overflow-y-auto py-1">
              {rooms.map((room) => {
                const total = roomTotal(room.items);
                const selected = room.id === selectedRoomId;
                return (
                  <li key={room.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedRoomId(room.id)}
                      className={`flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm transition-colors ${
                        selected
                          ? "bg-cream font-medium text-gray-900"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      <span className="truncate">{room.name}</span>
                      <span className="shrink-0 tabular-nums text-gray-600">
                        {formatCurrencyFull(total)}
                      </span>
                    </button>
                  </li>
                );
              })}
              {rooms.length === 0 && (
                <li className="px-4 py-6 text-center text-xs text-gray-500">
                  No rooms yet
                </li>
              )}
            </ul>

            {rooms.length > 0 && (
              <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 text-sm">
                <span className="text-gray-600">
                  Total ({rooms.length} Room{rooms.length !== 1 ? "s" : ""})
                </span>
                <span className="font-semibold tabular-nums text-gray-900">
                  {formatCurrencyFull(grandTotal)}
                </span>
              </div>
            )}
          </aside>
        )}

        <div className="flex min-w-0 flex-1 flex-col border-r border-gray-200">
          {!selectedRoom ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <p className="text-sm text-gray-500">
                {rooms.length === 0
                  ? "Add a room to start building this quote."
                  : "Select a room from the list."}
              </p>
              {rooms.length === 0 && (
                <button
                  type="button"
                  onClick={openAddRoom}
                  className="mt-4 rounded-md bg-burgundy px-4 py-2 text-sm font-medium text-white hover:bg-burgundy/90"
                >
                  + Add Room
                </button>
              )}
            </div>
          ) : (
            <div
              className={`flex min-h-0 flex-1 flex-col transition-colors ${
                isDragOver
                  ? "bg-burgundy/[0.04] ring-2 ring-inset ring-burgundy/40"
                  : ""
              } ${addingFromCatalogue ? "pointer-events-none opacity-70" : ""}`}
              onDragOver={handleRoomDragOver}
              onDragLeave={handleRoomDragLeave}
              onDrop={handleRoomDrop}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-6 py-4">
                <div className="flex min-w-0 items-center gap-2">
                  <h2 className="truncate text-lg font-semibold uppercase tracking-wide text-burgundy">
                    {selectedRoom.name}
                  </h2>
                  <button
                    type="button"
                    onClick={() => openEditRoom(selectedRoom)}
                    className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-burgundy"
                    aria-label="Edit room"
                    title="Edit room"
                  >
                    <IconPencil size={16} />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleExpand}
                    className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    aria-label={
                      isExpanded ? "Exit expanded view" : "Expand room"
                    }
                    title={isExpanded ? "Exit expanded view" : "Expand room"}
                  >
                    {isExpanded ? (
                      <IconArrowsMinimize size={16} />
                    ) : (
                      <IconArrowsMaximize size={16} />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteRoom}
                    disabled={deletingRoom}
                    className="inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    <IconTrash size={16} />
                    Delete Room
                  </button>
                </div>
              </div>

              <RoomPricingMultipliers
                room={selectedRoom}
                woodSpecies={woodSpecies}
                finishTypes={finishTypes}
                doorStyles={doorStyles}
                onSave={handleSaveRoomMultipliers}
              />

              <div className="flex min-h-0 flex-1 flex-col overflow-auto px-6 py-2">
                <div className="mb-2 flex shrink-0 items-center justify-between gap-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Items in this Room
                    {isDragOver && (
                      <span className="ml-2 font-normal normal-case text-burgundy">
                        — drop to add
                      </span>
                    )}
                  </h3>
                  <button
                    type="button"
                    onClick={() => void addMiscLineItem()}
                    className="text-xs font-semibold uppercase tracking-wide text-burgundy hover:underline"
                  >
                    + Add line item
                  </button>
                </div>
                <table
                  className={`w-full text-left text-sm ${showDimensionColumns ? "min-w-[720px]" : "min-w-[480px]"}`}
                >
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-gray-200 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                      <th className="pb-2 pr-2 w-12">Qty</th>
                      <th className="pb-2 pr-3">Item</th>
                      <th className="pb-2 pr-3">Type</th>
                      {showDimensionColumns && (
                        <>
                          <th className="pb-2 pr-2">W (in)</th>
                          <th className="pb-2 pr-2">H (in)</th>
                          <th className="pb-2 pr-2">D (in)</th>
                        </>
                      )}
                      <th className="pb-2 pr-2 text-right">Price</th>
                      <th className="pb-2 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {selectedRoom.items.map((item) => (
                      <QuoteRoomItemRow
                        key={item.id}
                        ref={(handle) => {
                          if (handle) rowRefs.current.set(item.id, handle);
                          else rowRefs.current.delete(item.id);
                        }}
                        item={item}
                        showDimensionColumns={showDimensionColumns}
                        cabinetMultiplier={cabinetMultiplier}
                        onUpdate={updateRoomItem}
                        onDelete={handleDeleteItem}
                        onEnterComplete={handleItemEnterComplete}
                      />
                    ))}
                    {selectedRoom.items.length === 0 && (
                      <tr>
                        <td
                          colSpan={showDimensionColumns ? 8 : 5}
                          className={`py-8 text-center text-sm ${
                            isDragOver ? "text-burgundy" : "text-gray-500"
                          }`}
                        >
                          {isDragOver
                            ? "Release to add this catalogue item"
                            : "No items yet — drag from the catalogue →"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
                <button
                  type="button"
                  onClick={openAddItem}
                  className="text-sm font-medium text-burgundy hover:underline"
                >
                  + Add Item
                </button>
                <div className="text-sm text-gray-600">
                  Room Total{" "}
                  <span className="ml-2 text-base font-semibold tabular-nums text-gray-900">
                    {formatCurrencyFull(roomTotals?.total ?? 0)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <aside className={`${SIDE_PANEL_CLASS} border-l border-gray-200`}>
          <QuoteCataloguePanel
            canDrop={!!selectedRoom}
            selectedRoomName={selectedRoom?.name}
          />
        </aside>
      </>
    );
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-gray-200 bg-white">
        <p className="text-sm text-gray-500">Loading rooms…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-full items-center rounded-lg border border-amber-200 bg-amber-50 p-6">
        <p className="text-sm text-amber-900">{loadError}</p>
      </div>
    );
  }

  return (
    <>
      <div className="h-full min-h-0">
        {expandPlaceholderHeight != null && (
          <div
            className="shrink-0"
            style={{ height: expandPlaceholderHeight }}
            aria-hidden
          />
        )}
        {!isExpanded && (
          <div
            ref={rootRef}
            className="flex h-full min-h-0 overflow-hidden rounded-lg border border-gray-200 bg-white"
          >
            {renderRoomsPanel()}
          </div>
        )}
      </div>

      {isExpanded &&
        mounted &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex h-dvh w-screen overflow-hidden bg-white">
            {renderRoomsPanel()}
          </div>,
          document.body
        )}

      {showRoomForm && (
        <Modal
          title={editingRoom ? "Edit room" : "Add room"}
          onClose={() => setShowRoomForm(false)}
        >
          <form onSubmit={handleSaveRoom} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Room name</label>
              <input
                required
                autoFocus
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="e.g. Kitchen"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" onClick={() => setShowRoomForm(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={savingRoom}>
                {savingRoom ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {showItemForm && selectedRoom && (
        <Modal
          title={editingItem ? "Edit item" : "Add item"}
          onClose={() => setShowItemForm(false)}
        >
          <form onSubmit={handleSaveItem} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Item type</label>
              <input
                required
                value={itemForm.item_type}
                onChange={(e) =>
                  setItemForm((f) => ({ ...f, item_type: e.target.value }))
                }
                placeholder="e.g. Base Cabinets"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Category</label>
              <select
                value={itemForm.category}
                onChange={(e) =>
                  setItemForm((f) => ({
                    ...f,
                    category: e.target.value as QuoteRoomItemCategory,
                  }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                {QUOTE_ITEM_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Description</label>
              <input
                value={itemForm.description}
                onChange={(e) =>
                  setItemForm((f) => ({ ...f, description: e.target.value }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Qty / size</label>
              <input
                value={itemForm.qty_size}
                onChange={(e) =>
                  setItemForm((f) => ({ ...f, qty_size: e.target.value }))
                }
                placeholder="e.g. 18.2 lin ft"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Price</label>
              <input
                type="number"
                min={0}
                step="0.01"
                required
                value={itemForm.price}
                onChange={(e) =>
                  setItemForm((f) => ({ ...f, price: e.target.value }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-between gap-3">
              {editingItem ? (
                <Button
                  type="button"
                  onClick={() => {
                    handleDeleteItem(editingItem);
                    setShowItemForm(false);
                  }}
                >
                  Delete item
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-3">
                <Button type="button" onClick={() => setShowItemForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={savingItem}>
                  {savingItem ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
