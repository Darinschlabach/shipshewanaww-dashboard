import { createClient } from "@/lib/supabase/client";
import { fetchQuoteRoomsWithItems } from "@/lib/quote-rooms";
import type { QuoteService } from "@/lib/types";

export async function fetchQuoteServices(
  quoteId: string
): Promise<{ services: QuoteService[]; error: string | null }> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("quote_services")
    .select("*")
    .eq("lead_id", quoteId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    const setupHint = error.message.includes("quote_services")
      ? "Run supabase/migrations/20260610000001_quote_services.sql in the Supabase SQL Editor."
      : error.message;
    return { services: [], error: setupHint };
  }

  return { services: (data as QuoteService[]) ?? [], error: null };
}

export function quoteServicesTotal(
  services: Pick<QuoteService, "price">[]
): number {
  return services.reduce((sum, service) => sum + Number(service.price), 0);
}

export async function fetchQuoteCabinetsTotal(
  quoteId: string
): Promise<number> {
  const { rooms } = await fetchQuoteRoomsWithItems(quoteId);
  return rooms.reduce(
    (sum, room) =>
      sum +
      room.items
        .filter((item) => item.category === "cabinets")
        .reduce((roomSum, item) => roomSum + Number(item.price), 0),
    0
  );
}

export async function reorderQuoteServices(
  orderedIds: string[]
): Promise<void> {
  const supabase = createClient();
  await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from("quote_services").update({ sort_order: index }).eq("id", id)
    )
  );
}
