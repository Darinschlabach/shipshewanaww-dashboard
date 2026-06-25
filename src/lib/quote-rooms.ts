import { createClient } from "@/lib/supabase/client";
import { calculateQuoteItemPrice, sortQuoteRoomItems } from "@/lib/quote-item-pricing";
import type { QuoteRoom, QuoteRoomItem, QuoteRoomItemCategory } from "@/lib/types";

export type QuoteRoomWithItems = QuoteRoom & { items: QuoteRoomItem[] };

export type QuoteRoomSummaryLine = {
  id: string;
  name: string;
  amount: number;
};

export async function fetchQuoteRoomsWithItems(
  quoteId: string
): Promise<{ rooms: QuoteRoomWithItems[]; error: string | null }> {
  const supabase = createClient();

  const { data: roomsData, error: roomsError } = await supabase
    .from("quote_rooms")
    .select("*")
    .eq("lead_id", quoteId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (roomsError) {
    const setupHint = roomsError.message.includes("quote_rooms")
      ? "Run supabase/migrations/20250604000016_quote_rooms.sql in the Supabase SQL Editor."
      : roomsError.message;
    return { rooms: [], error: setupHint };
  }

  const roomList = (roomsData as QuoteRoom[]) ?? [];
  const roomIds = roomList.map((r) => r.id);

  let items: QuoteRoomItem[] = [];
  if (roomIds.length > 0) {
    const { data: itemsData } = await supabase
      .from("quote_room_items")
      .select("*")
      .in("room_id", roomIds)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    items = (itemsData as QuoteRoomItem[]) ?? [];
  }

  const rooms: QuoteRoomWithItems[] = roomList.map((room) => ({
    ...room,
    items: sortQuoteRoomItems(items.filter((i) => i.room_id === room.id)),
  }));

  return { rooms, error: null };
}

export function buildQuoteRoomSummaries(
  rooms: QuoteRoomWithItems[]
): QuoteRoomSummaryLine[] {
  return rooms.map((room) => ({
    id: room.id,
    name: room.name,
    amount: roomTotal(room.items),
  }));
}

export function quoteRoomsGrandTotal(summaries: QuoteRoomSummaryLine[]): number {
  return summaries.reduce((sum, line) => sum + line.amount, 0);
}

export function sumByCategory(
  items: Pick<QuoteRoomItem, "price" | "category">[]
): Record<QuoteRoomItemCategory, number> {
  return items.reduce(
    (acc, item) => {
      acc[item.category] += Number(item.price);
      return acc;
    },
    { cabinets: 0, components: 0, labor: 0 } as Record<QuoteRoomItemCategory, number>
  );
}

export function roomTotal(items: Pick<QuoteRoomItem, "price">[]): number {
  return items.reduce((sum, item) => sum + Number(item.price), 0);
}

/** Recompute stored price from qty/dimensions; returns 0 when not yet calculable. */
export function resolvedQuoteItemPrice(
  item: Parameters<typeof calculateQuoteItemPrice>[0],
  cabinetMultiplier = 1
): number {
  const mult =
    item.category === "cabinets" ? cabinetMultiplier : 1;
  return (
    calculateQuoteItemPrice(item, {
      cabinetMultiplier: mult,
    }) ?? 0
  );
}

export const QUOTE_ITEM_CATEGORIES: { value: QuoteRoomItemCategory; label: string }[] = [
  { value: "cabinets", label: "Cabinets" },
  { value: "components", label: "Components" },
  { value: "labor", label: "Labor" },
];
