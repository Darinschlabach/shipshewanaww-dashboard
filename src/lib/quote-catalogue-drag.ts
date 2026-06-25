import type { PricingCatalogueItem } from "@/lib/pricing-catalogue";
import type { QuoteRoomItemCategory } from "@/lib/types";

export type CatalogueItemSource = "cabinet" | "component";

export type CatalogueDragPayload = {
  source: CatalogueItemSource;
  id: string;
  name: string;
  category: string;
  base_price: number;
  sq_ft_price: number;
};

export const CATALOGUE_DRAG_MIME = "application/x-sw-catalogue-item";

export function buildCatalogueDragPayload(
  item: PricingCatalogueItem,
  source: CatalogueItemSource
): CatalogueDragPayload {
  return {
    source,
    id: item.id,
    name: item.name,
    category: item.category,
    base_price: Number(item.base_price),
    sq_ft_price: Number(item.sq_ft_price),
  };
}

export function parseCatalogueDrag(
  dataTransfer: DataTransfer
): CatalogueDragPayload | null {
  const raw = dataTransfer.getData(CATALOGUE_DRAG_MIME);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CatalogueDragPayload;
    if (!parsed?.name || !parsed?.source) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function catalogueItemToQuoteCategory(
  source: CatalogueItemSource
): QuoteRoomItemCategory {
  return source === "cabinet" ? "cabinets" : "components";
}
