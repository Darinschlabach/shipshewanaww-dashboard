import type { CatalogueItem } from "@/lib/types";

export type MaterialCatalogueDragPayload = {
  id: string;
  name: string;
  category: string;
  price: number;
};

export const MATERIAL_CATALOGUE_DRAG_MIME =
  "application/x-sw-material-catalogue-item";

export function buildMaterialCatalogueDragPayload(
  item: CatalogueItem
): MaterialCatalogueDragPayload {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    price: Number(item.price),
  };
}

export function parseMaterialCatalogueDrag(
  dataTransfer: DataTransfer
): MaterialCatalogueDragPayload | null {
  const raw = dataTransfer.getData(MATERIAL_CATALOGUE_DRAG_MIME);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as MaterialCatalogueDragPayload;
    if (!parsed?.id || !parsed?.name) return null;
    return parsed;
  } catch {
    return null;
  }
}
