import { createClient } from "@/lib/supabase/client";

export type PricingCatalogueStatus = "active" | "inactive";

export interface PricingWoodSpecies {
  id: string;
  name: string;
  description: string;
  multiplier: number;
  status: PricingCatalogueStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PricingFinishType {
  id: string;
  name: string;
  multiplier: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PricingDoorStyle {
  id: string;
  name: string;
  multiplier: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PricingCatalogueItem {
  id: string;
  name: string;
  category: string;
  base_price: number;
  sq_ft_price: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** @deprecated Use PricingCatalogueItem */
export type PricingCabinetType = PricingCatalogueItem;

export type PricingCatalogueItemsLabels = {
  title: string;
  subtitle: string;
  searchPlaceholder: string;
  addButton: string;
  nameColumn: string;
  basePriceHint: string;
  loadingMessage: string;
  emptySearch: string;
  emptyList: string;
  countSingular: string;
  countPlural: string;
  deleteConfirm: string;
  modalAddTitle: string;
  modalEditTitle: string;
  formNameLabel: string;
  categoryListId: string;
  defaultCategory: string;
};

export const CABINET_CATALOGUE_LABELS: PricingCatalogueItemsLabels = {
  title: "Cabinet Types",
  subtitle: "Set base prices and square foot prices for each cabinet type.",
  searchPlaceholder: "Search cabinets…",
  addButton: "+ Add Cabinet",
  nameColumn: "Cabinet Type",
  basePriceHint: "Fixed price for this cabinet type",
  loadingMessage: "Loading cabinet types…",
  emptySearch: "No cabinet types match your search.",
  emptyList: "No cabinet types",
  countSingular: "cabinet type",
  countPlural: "cabinet types",
  deleteConfirm: "Delete this cabinet type?",
  modalAddTitle: "Add cabinet type",
  modalEditTitle: "Edit cabinet type",
  formNameLabel: "Cabinet Type",
  categoryListId: "cabinet-categories",
  defaultCategory: "Base Cabinets",
};

export const COMPONENT_CATALOGUE_LABELS: PricingCatalogueItemsLabels = {
  title: "Components",
  subtitle: "Set base prices and square foot prices for each component.",
  searchPlaceholder: "Search components…",
  addButton: "+ Add Component",
  nameColumn: "Component",
  basePriceHint: "Fixed price for this component",
  loadingMessage: "Loading components…",
  emptySearch: "No components match your search.",
  emptyList: "No components",
  countSingular: "component",
  countPlural: "components",
  deleteConfirm: "Delete this component?",
  modalAddTitle: "Add component",
  modalEditTitle: "Edit component",
  formNameLabel: "Component",
  categoryListId: "component-categories",
  defaultCategory: "Hardware",
};

export function formatMultiplier(value: number): string {
  return Number(value).toFixed(2);
}

export async function fetchPricingCabinetTypes(): Promise<{
  items: PricingCatalogueItem[];
  error: string | null;
}> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("pricing_cabinet_types")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    return {
      items: [],
      error: error.message.includes("pricing_cabinet_types")
        ? "Run cabinet catalogue migrations in Supabase."
        : error.message,
    };
  }
  return { items: (data as PricingCatalogueItem[]) ?? [], error: null };
}

export async function fetchPricingComponents(): Promise<{
  items: PricingCatalogueItem[];
  error: string | null;
}> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("pricing_components")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    return {
      items: [],
      error: error.message.includes("pricing_components")
        ? "Run component catalogue migrations in Supabase."
        : error.message,
    };
  }
  return { items: (data as PricingCatalogueItem[]) ?? [], error: null };
}

export async function fetchPricingVariables(): Promise<{
  woodSpecies: PricingWoodSpecies[];
  finishTypes: PricingFinishType[];
  doorStyles: PricingDoorStyle[];
  error: string | null;
}> {
  const supabase = createClient();
  const [woodRes, finishRes, doorRes] = await Promise.all([
    supabase.from("pricing_wood_species").select("*").order("sort_order"),
    supabase.from("pricing_finish_types").select("*").order("sort_order"),
    supabase.from("pricing_door_styles").select("*").order("sort_order"),
  ]);

  const error =
    woodRes.error?.message ??
    finishRes.error?.message ??
    doorRes.error?.message ??
    null;

  return {
    woodSpecies: (woodRes.data as PricingWoodSpecies[]) ?? [],
    finishTypes: (finishRes.data as PricingFinishType[]) ?? [],
    doorStyles: (doorRes.data as PricingDoorStyle[]) ?? [],
    error,
  };
}
