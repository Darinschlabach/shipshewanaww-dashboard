import type { QuoteRoomItem } from "@/lib/types";

/** Cabinet catalogue groups — sort order in room item lists. */
export const CABINET_TYPE_SORT_ORDER: Record<string, number> = {
  "Base Cabinets": 0,
  "Wall Cabinets": 1,
  "Upper Cabinets": 1,
  "Tall Cabinets": 2,
};

const COMPONENTS_GROUP = 100;
const LABOR_GROUP = 110;

export type QuoteItemPricingFields = Pick<
  QuoteRoomItem,
  | "qty"
  | "width_in"
  | "length_in"
  | "height_in"
  | "base_price"
  | "sq_ft_price"
  | "category"
>;

export type QuoteItemPriceOptions = {
  /** Applied to cabinet line items only (wood × finish × door). */
  cabinetMultiplier?: number;
};

export function cabinetTypeSortRank(description: string | null): number {
  if (!description) return 50;
  return CABINET_TYPE_SORT_ORDER[description] ?? 50;
}

export function compareQuoteRoomItems(a: QuoteRoomItem, b: QuoteRoomItem): number {
  const groupA =
    a.category === "components"
      ? COMPONENTS_GROUP
      : a.category === "labor"
        ? LABOR_GROUP
        : cabinetTypeSortRank(a.description);
  const groupB =
    b.category === "components"
      ? COMPONENTS_GROUP
      : b.category === "labor"
        ? LABOR_GROUP
        : cabinetTypeSortRank(b.description);

  if (groupA !== groupB) return groupA - groupB;

  if (a.category === "components" && b.category === "components") {
    const cat = (a.description ?? "").localeCompare(b.description ?? "");
    if (cat !== 0) return cat;
  }

  if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
  return a.created_at.localeCompare(b.created_at);
}

export function sortQuoteRoomItems(items: QuoteRoomItem[]): QuoteRoomItem[] {
  return [...items].sort(compareQuoteRoomItems);
}

const CUBIC_INCHES_PER_CU_FT = 1728;

/** Cubic feet from width × length × height (inches). */
export function itemCubicFt(
  widthIn: number,
  lengthIn: number,
  heightIn: number
): number {
  return (widthIn * lengthIn * heightIn) / CUBIC_INCHES_PER_CU_FT;
}

/** Cabinets with a cubic ft rate need qty, width, length, and height. */
export function quoteItemNeedsDimensions(item: QuoteItemPricingFields): boolean {
  return item.category === "cabinets" && Number(item.sq_ft_price) > 0;
}

/** Manually added qty + unit-price rows (not from the catalogue). */
export function isMiscQuoteItem(
  item: Pick<QuoteRoomItem, "item_type" | "catalogue_id">
): boolean {
  return item.item_type === "Misc" && item.catalogue_id == null;
}

/**
 * Returns calculated line price, or null if qty/dimensions are incomplete.
 * Cabinets with a cubic ft rate: qty × (base price + cubic ft × cubic ft price).
 * Components and other fixed-price items need qty only.
 */
export function calculateQuoteItemPrice(
  item: QuoteItemPricingFields,
  options?: QuoteItemPriceOptions
): number | null {
  const qty = item.qty;
  if (qty == null || qty < 1) return null;

  const base = Number(item.base_price) || 0;
  const cubicFtRate = Number(item.sq_ft_price) || 0;

  let linePrice: number | null = null;

  if (item.category === "components") {
    if (base <= 0) return null;
    linePrice = roundMoney(qty * base);
  } else if (cubicFtRate > 0) {
    const w = item.width_in != null ? Number(item.width_in) : null;
    const l = item.length_in != null ? Number(item.length_in) : null;
    const h = item.height_in != null ? Number(item.height_in) : null;
    if (w == null || l == null || h == null || w <= 0 || l <= 0 || h <= 0) {
      return null;
    }
    const cubicFt = itemCubicFt(w, l, h);
    linePrice = roundMoney(qty * (base + cubicFtRate * cubicFt));
  } else if (base > 0) {
    linePrice = roundMoney(qty * base);
  }

  if (linePrice == null) return null;

  if (
    item.category === "cabinets" &&
    options?.cabinetMultiplier != null &&
    options.cabinetMultiplier !== 1
  ) {
    return roundMoney(linePrice * options.cabinetMultiplier);
  }

  return linePrice;
}

export function quoteItemPriceIsReady(
  item: QuoteItemPricingFields,
  options?: QuoteItemPriceOptions
): boolean {
  return calculateQuoteItemPrice(item, options) !== null;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function parseOptionalInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = parseInt(trimmed, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function parseOptionalDimension(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = parseFloat(trimmed);
  return Number.isFinite(n) && n > 0 ? n : null;
}
