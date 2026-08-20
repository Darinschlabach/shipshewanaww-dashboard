import { createClient } from "@/lib/supabase/client";

export interface RoomSpecOptions {
  woodSpecies: string[];
  doorStyles: string[];
  finishTypes: string[];
  finishColors: string[];
  baseMoldings: string[];
  crownMoldings: string[];
}

export async function fetchRoomSpecOptions(): Promise<RoomSpecOptions> {
  const supabase = createClient();
  const [woodRes, doorRes, finishRes, colorRes, baseRes, crownRes] =
    await Promise.all([
      supabase
        .from("pricing_wood_species")
        .select("name")
        .eq("status", "active")
        .order("sort_order"),
      supabase.from("pricing_door_styles").select("name").order("sort_order"),
      supabase.from("pricing_finish_types").select("name").order("sort_order"),
      supabase.from("pricing_finish_colors").select("name").order("sort_order"),
      supabase.from("pricing_base_moldings").select("name").order("sort_order"),
      supabase.from("pricing_crown_moldings").select("name").order("sort_order"),
    ]);

  return {
    woodSpecies: (woodRes.data ?? []).map((row) => row.name),
    doorStyles: (doorRes.data ?? []).map((row) => row.name),
    finishTypes: (finishRes.data ?? []).map((row) => row.name),
    finishColors: (colorRes.data ?? []).map((row) => row.name),
    baseMoldings: (baseRes.data ?? []).map((row) => row.name),
    crownMoldings: (crownRes.data ?? []).map((row) => row.name),
  };
}

function mergeOption(value: string | null | undefined, options: string[]) {
  const trimmed = value?.trim();
  if (!trimmed) return options;
  if (options.some((o) => o.toLowerCase() === trimmed.toLowerCase())) {
    return options;
  }
  return [...options, trimmed];
}

export function mergeRoomSpecOptions(
  options: RoomSpecOptions,
  room?: {
    wood_species?: string | null;
    door_style?: string | null;
    finish_type?: string | null;
    finish_color?: string | null;
    base_molding?: string | null;
    crown_molding?: string | null;
  } | null,
): RoomSpecOptions {
  return {
    woodSpecies: mergeOption(room?.wood_species, options.woodSpecies),
    doorStyles: mergeOption(room?.door_style, options.doorStyles),
    finishTypes: mergeOption(room?.finish_type, options.finishTypes),
    finishColors: mergeOption(room?.finish_color, options.finishColors),
    baseMoldings: mergeOption(room?.base_molding, options.baseMoldings),
    crownMoldings: mergeOption(room?.crown_molding, options.crownMoldings),
  };
}

async function addNamedCatalogOption(
  table: "pricing_base_moldings" | "pricing_crown_moldings",
  name: string,
): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const supabase = createClient();
  const { data: existing } = await supabase
    .from(table)
    .select("name")
    .ilike("name", trimmed)
    .maybeSingle();

  if (existing) return existing.name;

  const { data: last } = await supabase
    .from(table)
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from(table)
    .insert({
      name: trimmed,
      sort_order: (last?.sort_order ?? 0) + 1,
    })
    .select("name")
    .single();

  if (error) return null;
  return data.name;
}

export async function addWoodSpeciesOption(name: string): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const supabase = createClient();
  const { data: existing } = await supabase
    .from("pricing_wood_species")
    .select("name")
    .ilike("name", trimmed)
    .maybeSingle();

  if (existing) return existing.name;

  const { data: last } = await supabase
    .from("pricing_wood_species")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("pricing_wood_species")
    .insert({
      name: trimmed,
      description: "",
      multiplier: 1,
      status: "active",
      sort_order: (last?.sort_order ?? 0) + 1,
    })
    .select("name")
    .single();

  if (error) return null;
  return data.name;
}

export async function addDoorStyleOption(name: string): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const supabase = createClient();
  const { data: existing } = await supabase
    .from("pricing_door_styles")
    .select("name")
    .ilike("name", trimmed)
    .maybeSingle();

  if (existing) return existing.name;

  const { data: last } = await supabase
    .from("pricing_door_styles")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("pricing_door_styles")
    .insert({
      name: trimmed,
      multiplier: 1,
      sort_order: (last?.sort_order ?? 0) + 1,
    })
    .select("name")
    .single();

  if (error) return null;
  return data.name;
}

export async function renameDoorStyleOption(
  oldName: string,
  newName: string,
): Promise<string | null> {
  const trimmedOld = oldName.trim();
  const trimmedNew = newName.trim();
  if (!trimmedOld || !trimmedNew) return null;
  if (trimmedOld.toLowerCase() === trimmedNew.toLowerCase()) return trimmedNew;

  const supabase = createClient();
  const { data: conflict } = await supabase
    .from("pricing_door_styles")
    .select("name")
    .ilike("name", trimmedNew)
    .maybeSingle();

  if (conflict) return conflict.name;

  const { data: row } = await supabase
    .from("pricing_door_styles")
    .select("id")
    .ilike("name", trimmedOld)
    .maybeSingle();

  if (!row) return null;

  const { error } = await supabase
    .from("pricing_door_styles")
    .update({ name: trimmedNew })
    .eq("id", row.id);

  if (error) return null;

  await supabase
    .from("rooms")
    .update({ door_style: trimmedNew })
    .eq("door_style", trimmedOld);

  return trimmedNew;
}

export async function addFinishTypeOption(name: string): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const supabase = createClient();
  const { data: existing } = await supabase
    .from("pricing_finish_types")
    .select("name")
    .ilike("name", trimmed)
    .maybeSingle();

  if (existing) return existing.name;

  const { data: last } = await supabase
    .from("pricing_finish_types")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("pricing_finish_types")
    .insert({
      name: trimmed,
      multiplier: 1,
      sort_order: (last?.sort_order ?? 0) + 1,
    })
    .select("name")
    .single();

  if (error) return null;
  return data.name;
}

export async function addFinishColorOption(name: string): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const supabase = createClient();
  const { data: existing } = await supabase
    .from("pricing_finish_colors")
    .select("name")
    .ilike("name", trimmed)
    .maybeSingle();

  if (existing) return existing.name;

  const { data: last } = await supabase
    .from("pricing_finish_colors")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("pricing_finish_colors")
    .insert({
      name: trimmed,
      sort_order: (last?.sort_order ?? 0) + 1,
    })
    .select("name")
    .single();

  if (error) return null;
  return data.name;
}

export async function addBaseMoldingOption(name: string): Promise<string | null> {
  return addNamedCatalogOption("pricing_base_moldings", name);
}

export async function addCrownMoldingOption(name: string): Promise<string | null> {
  return addNamedCatalogOption("pricing_crown_moldings", name);
}
