import { buildQuoteDetail } from "@/lib/quote-detail";
import { fetchPricingVariables } from "@/lib/pricing-catalogue";
import {
  formatTotalMultiplier,
  resolveRoomMultipliers,
} from "@/lib/quote-room-multipliers";
import {
  fetchQuoteRoomsWithItems,
  roomTotal,
  type QuoteRoomWithItems,
} from "@/lib/quote-rooms";
import { fetchQuoteServices, quoteDeliveryTotal, quoteServicesTotal } from "@/lib/quote-services";
import { formatQuoteNumber } from "@/lib/quotes";
import type { Lead, QuoteRoomItem, QuoteService } from "@/lib/types";

export type QuoteDocumentRoomItem = {
  id: string;
  qty: string;
  name: string;
  category: QuoteRoomItem["category"];
  subtype: string;
  dimensions: string | null;
  price: number;
};

export type QuoteDocumentRoom = {
  id: string;
  name: string;
  woodSpecies: string;
  finish: string;
  doorStyle: string;
  cabinetMultiplier: string;
  itemCount: number;
  roomTotal: number;
  items: QuoteDocumentRoomItem[];
};

export type QuoteDocumentService = {
  id: string;
  qty: number;
  name: string;
  description: string;
  type: string;
  price: number;
};

export type QuoteDocumentData = {
  quoteNumber: string;
  quoteDate: string;
  expirationDate: string;
  validForDays: number;
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  customerEmail: string;
  jobName: string;
  jobAddress: string;
  notes: string;
  rooms: QuoteDocumentRoom[];
  services: QuoteDocumentService[];
  roomsTotal: number;
  servicesTotal: number;
  deliveryTotal: number;
  quoteTotal: number;
  customerMessage: string;
};

function formatItemQty(item: QuoteRoomItem): string {
  if (item.qty != null && item.qty > 0) return String(item.qty);
  return "—";
}

function formatItemDimensions(item: QuoteRoomItem): string | null {
  const w = item.width_in;
  const h = item.height_in;
  const d = item.length_in;
  if (w == null || h == null || d == null || w <= 0 || h <= 0 || d <= 0) {
    return null;
  }
  return `${w} x ${h} x ${d}`;
}

function mapRoomItems(items: QuoteRoomItem[]): QuoteDocumentRoomItem[] {
  return items.map((item) => {
    const isMisc = item.item_type === "Misc" && item.catalogue_id == null;
    const description = item.description?.trim() || "";
    return {
      id: item.id,
      qty: formatItemQty(item),
      name: isMisc ? description || "Misc" : item.item_type.trim() || "—",
      category: item.category === "labor" ? "components" : item.category,
      subtype: isMisc ? "Misc" : description || "—",
      dimensions: formatItemDimensions(item),
      price: Number(item.price),
    };
  });
}

function mapRooms(
  rooms: QuoteRoomWithItems[],
  woodSpecies: Parameters<typeof resolveRoomMultipliers>[1],
  finishTypes: Parameters<typeof resolveRoomMultipliers>[2],
  doorStyles: Parameters<typeof resolveRoomMultipliers>[3]
): QuoteDocumentRoom[] {
  return rooms.map((room) => {
    const multipliers = resolveRoomMultipliers(
      room,
      woodSpecies,
      finishTypes,
      doorStyles
    );
    return {
      id: room.id,
      name: room.name,
      woodSpecies: multipliers.wood?.name ?? "—",
      finish: multipliers.finish?.name ?? "—",
      doorStyle: multipliers.door?.name ?? "—",
      cabinetMultiplier: formatTotalMultiplier(multipliers.total),
      itemCount: room.items.length,
      roomTotal: roomTotal(room.items),
      items: mapRoomItems(room.items),
    };
  });
}

function mapServices(services: QuoteService[]): QuoteDocumentService[] {
  return services.map((service) => ({
    id: service.id,
    qty: 1,
    name: service.name.trim() || "—",
    description: service.description?.trim() || "—",
    type: "Fixed Price",
    price: Number(service.price),
  }));
}

export async function fetchQuoteDocumentData(
  quote: Lead
): Promise<{ data: QuoteDocumentData | null; error: string | null }> {
  const meta = buildQuoteDetail(quote);
  const [{ rooms, error: roomsError }, { services, error: servicesError }, pricing] =
    await Promise.all([
      fetchQuoteRoomsWithItems(quote.id),
      fetchQuoteServices(quote.id),
      fetchPricingVariables(),
    ]);

  if (roomsError) return { data: null, error: roomsError };
  if (servicesError) return { data: null, error: servicesError };

  const documentRooms = mapRooms(
    rooms,
    pricing.woodSpecies,
    pricing.finishTypes,
    pricing.doorStyles
  );
  const documentServices = mapServices(services);
  const roomsTotal = documentRooms.reduce((sum, room) => sum + room.roomTotal, 0);
  const servicesTotal = quoteServicesTotal(services);
  const deliveryTotal = quoteDeliveryTotal(services);
  const quoteTotal = roomsTotal + servicesTotal;

  return {
    data: {
      quoteNumber: formatQuoteNumber(quote),
      quoteDate: quote.created_at.slice(0, 10),
      expirationDate: meta.expirationDate ?? quote.created_at.slice(0, 10),
      validForDays: 30,
      customerName: meta.customerName,
      customerAddress: meta.customerAddress,
      customerPhone: meta.phone,
      customerEmail: meta.email,
      jobName: meta.jobName,
      jobAddress: meta.jobAddress,
      notes:
        quote.notes?.trim() ||
        "Thank you for the opportunity to quote your project.",
      rooms: documentRooms,
      services: documentServices,
      roomsTotal,
      servicesTotal,
      deliveryTotal,
      quoteTotal:
        documentRooms.length > 0 || documentServices.length > 0
          ? quoteTotal
          : Number(quote.est_value),
      customerMessage: meta.customerMessage,
    },
    error: null,
  };
}
