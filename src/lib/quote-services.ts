import { createClient } from "@/lib/supabase/client";
import { fetchQuoteRoomsWithItems } from "@/lib/quote-rooms";
import type { QuoteService } from "@/lib/types";

export const DELIVERY_SERVICE_NAME = "Delivery";

export function isDeliveryService(
  service: Pick<QuoteService, "name" | "is_delivery">
): boolean {
  if (service.is_delivery) return true;
  return service.name.trim().toLowerCase() === "delivery";
}

export function partitionQuoteServices(services: QuoteService[]): {
  delivery: QuoteService | null;
  otherServices: QuoteService[];
} {
  const delivery = services.find(isDeliveryService) ?? null;
  const otherServices = services.filter((service) => !isDeliveryService(service));
  return { delivery, otherServices };
}

export function quoteDeliveryTotal(services: QuoteService[]): number {
  const { delivery } = partitionQuoteServices(services);
  return delivery ? Number(delivery.price) : 0;
}

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

  const rows = (data as QuoteService[]) ?? [];
  const services = await ensureQuoteDeliveryService(quoteId, rows);
  return { services, error: null };
}

async function ensureQuoteDeliveryService(
  quoteId: string,
  services: QuoteService[]
): Promise<QuoteService[]> {
  const supabase = createClient();
  let delivery = services.find(isDeliveryService) ?? null;

  if (!delivery) {
    const { data, error } = await supabase
      .from("quote_services")
      .insert({
        lead_id: quoteId,
        name: DELIVERY_SERVICE_NAME,
        description: "",
        price: 0,
        sort_order: 0,
        is_delivery: true,
      })
      .select("*")
      .single();

    if (error || !data) {
      return services;
    }

    delivery = data as QuoteService;
    const others = services.filter((service) => service.id !== delivery!.id);
    const ordered = [delivery, ...others];
    await reorderQuoteServices(ordered.map((service) => service.id));
    return ordered.map((service, index) => ({ ...service, sort_order: index }));
  }

  const others = services.filter((service) => service.id !== delivery!.id);
  const ordered = [delivery, ...others];

  if (delivery.sort_order !== 0 || !delivery.is_delivery) {
    await supabase
      .from("quote_services")
      .update({
        is_delivery: true,
        name: DELIVERY_SERVICE_NAME,
        sort_order: 0,
      })
      .eq("id", delivery.id);
    await reorderQuoteServices(ordered.map((service) => service.id));
    delivery = { ...delivery, is_delivery: true, name: DELIVERY_SERVICE_NAME, sort_order: 0 };
    return [delivery, ...others].map((service, index) => ({
      ...service,
      sort_order: index,
    }));
  }

  return ordered;
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
