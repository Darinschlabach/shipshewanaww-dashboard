import { createClient } from "@/lib/supabase/client";

export type MaterialType = "sheet" | "lumber" | "sqft" | "linear_ft" | "each";
export type SlotType = "material" | "door" | "drawer_box" | "exterior_finish" | "interior_finish";

export type CostingSettings = {
  id: string;
  shop_hourly_cost: number;
  worker_count: number;
  default_margin_pct: number;
  default_waste_sheet_pct: number;
  default_waste_lumber_pct: number;
};

export type CostingVariable = {
  id: string;
  code: string;
  name: string;
  value: number;
  unit: string;
  description: string;
};

export type CostingMaterial = {
  id: string;
  name: string;
  category_id: string;
  material_type: MaterialType;
  unit_price: number;
  sheet_length: number | null;
  sheet_width: number | null;
  thickness: number | null;
  rough_thickness: number | null;
  waste_pct: number;
  supplier: string;
  notes: string;
  active: boolean;
};

export type CostingMaterialCategory = {
  id: string;
  name: string;
  sort_order: number;
};

export type CostingDoor = {
  id: string;
  name: string;
  price_per_sqft: number;
  supplier: string;
  notes: string;
  active: boolean;
};

export type CostingDrawerBox = {
  id: string;
  name: string;
  price_per_cuft: number;
  supplier: string;
  notes: string;
  active: boolean;
};

export type CostingFinish = {
  id: string;
  name: string;
  use_exterior: boolean;
  use_interior: boolean;
  price_per_sqft: number;
  notes: string;
  active: boolean;
};

export type CostingHardware = {
  id: string;
  name: string;
  category: string;
  unit_cost: number;
  install_minutes: number;
  markup_pct: number;
  supplier: string;
  sku: string;
  notes: string;
  active: boolean;
};

export type CostingSlot = {
  id: string;
  name: string;
  slot_type: SlotType;
  sort_order: number;
};

export type CostingSchedule = {
  id: string;
  name: string;
  description: string;
  active: boolean;
};

export type CostingScheduleItem = {
  id: string;
  schedule_id: string;
  slot_id: string;
  material_id: string | null;
  door_style_id: string | null;
  drawer_box_style_id: string | null;
  finish_id: string | null;
};

export type CostingScheduleComponentOverride = {
  id: string;
  schedule_id: string;
  component_id: string;
  material_id: string | null;
  door_style_id: string | null;
  drawer_box_style_id: string | null;
  finish_id: string | null;
};

export type CostingComponent = {
  id: string;
  name: string;
  slot_id: string;
  length_formula: string;
  width_formula: string;
  height_formula: string | null;
  qty_formula: string;
  labor_minutes: number;
  exterior_finish_sides: number;
  interior_finish_sides: number;
  notes: string;
};

export const HARDWARE_CATEGORIES = [
  "Hinges",
  "Slides",
  "Pulls/Knobs",
  "Pullouts",
  "Lazy Susans",
  "Trash Pullouts",
  "Other",
] as const;

export const MATERIAL_TYPE_LABEL: Record<MaterialType, string> = {
  sheet: "Sheet",
  lumber: "Lumber",
  sqft: "Square foot",
  linear_ft: "Linear foot",
  each: "Each",
};

export const SLOT_TYPE_LABEL: Record<SlotType, string> = {
  material: "Material",
  door: "Door",
  drawer_box: "Drawer box",
  exterior_finish: "Exterior finish",
  interior_finish: "Interior finish",
};

function num(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function numOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function db() {
  return createClient();
}

export async function fetchSettings(): Promise<{
  row: CostingSettings | null;
  error: string | null;
}> {
  const { data, error } = await db().from("costing_settings").select("*").limit(1).maybeSingle();
  if (error) return { row: null, error: error.message };
  if (!data) return { row: null, error: "Shop settings row is missing" };
  return {
    row: {
      id: data.id,
      shop_hourly_cost: num(data.shop_hourly_cost, 275),
      worker_count: num(data.worker_count, 5),
      default_margin_pct: num(data.default_margin_pct, 30),
      default_waste_sheet_pct: num(data.default_waste_sheet_pct, 15),
      default_waste_lumber_pct: num(data.default_waste_lumber_pct, 30),
    },
    error: null,
  };
}

export async function saveSettings(
  id: string,
  patch: Omit<CostingSettings, "id">
): Promise<string | null> {
  const { error } = await db().from("costing_settings").update(patch).eq("id", id);
  return error?.message ?? null;
}

export async function fetchVariables(): Promise<{
  rows: CostingVariable[];
  error: string | null;
}> {
  const { data, error } = await db()
    .from("costing_variables")
    .select("*")
    .order("code");
  if (error) return { rows: [], error: error.message };
  return {
    rows: (data ?? [])
      .filter((row) => row.code !== "SAMPLE_LIBRARY")
      .map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        value: num(row.value),
        unit: row.unit,
        description: row.description,
      })),
    error: null,
  };
}

export async function saveVariable(
  row: Omit<CostingVariable, "id"> & { id?: string }
): Promise<string | null> {
  const payload = {
    code: row.code.trim().toUpperCase(),
    name: row.name.trim(),
    value: row.value,
    unit: row.unit.trim() || "in",
    description: row.description.trim(),
  };
  const query = row.id
    ? db().from("costing_variables").update(payload).eq("id", row.id)
    : db().from("costing_variables").insert(payload);
  const { error } = await query;
  return error?.message ?? null;
}

export async function variableUsage(code: string): Promise<string[]> {
  const needle = new RegExp(`\\b${code}\\b`);
  const used: string[] = [];
  const [components, templateParts, templateHardware] = await Promise.all([
    db()
      .from("costing_components")
      .select("name, length_formula, width_formula, height_formula, qty_formula"),
    db()
      .from("costing_template_components")
      .select(
        "length_formula, width_formula, qty_formula, template:costing_cabinet_templates(name), component:costing_components(name)"
      ),
    db()
      .from("costing_template_hardware")
      .select(
        "qty_formula, template:costing_cabinet_templates(name), hardware:costing_hardware(name)"
      ),
  ]);
  for (const row of components.data ?? []) {
    const text = `${row.length_formula} ${row.width_formula} ${row.height_formula ?? ""} ${row.qty_formula}`;
    if (needle.test(text)) used.push(`Component ${row.name}`);
  }
  for (const row of templateParts.data ?? []) {
    const text = `${row.length_formula ?? ""} ${row.width_formula ?? ""} ${row.qty_formula ?? ""}`;
    if (!needle.test(text)) continue;
    const template = firstName(row.template);
    const component = firstName(row.component);
    used.push(`Template ${template}${component ? ` (${component})` : ""}`);
  }
  for (const row of templateHardware.data ?? []) {
    if (!needle.test(row.qty_formula ?? "")) continue;
    used.push(
      `Template ${firstName(row.template)} hardware ${firstName(row.hardware)}`
    );
  }
  return used;
}

export async function deleteVariable(id: string): Promise<string | null> {
  const { error } = await db().from("costing_variables").delete().eq("id", id);
  return error?.message ?? null;
}

export async function fetchMaterials(): Promise<{
  rows: CostingMaterial[];
  error: string | null;
}> {
  const { data, error } = await db().from("costing_materials").select("*").order("name");
  if (error) return { rows: [], error: error.message };
  return {
    rows: (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      category_id: row.category_id ?? "",
      material_type: row.material_type,
      unit_price: num(row.unit_price),
      sheet_length: numOrNull(row.sheet_length),
      sheet_width: numOrNull(row.sheet_width),
      thickness: numOrNull(row.thickness),
      rough_thickness: numOrNull(row.rough_thickness),
      waste_pct: num(row.waste_pct),
      supplier: row.supplier ?? "",
      notes: row.notes ?? "",
      active: Boolean(row.active),
    })),
    error: null,
  };
}

export async function saveMaterial(
  row: Omit<CostingMaterial, "id"> & { id?: string }
): Promise<string | null> {
  const payload = {
    name: row.name.trim(),
    category_id: row.category_id,
    material_type: row.material_type,
    unit_price: row.unit_price,
    sheet_length: row.material_type === "sheet" ? row.sheet_length : null,
    sheet_width: row.material_type === "sheet" ? row.sheet_width : null,
    thickness: row.thickness,
    rough_thickness: row.material_type === "lumber" ? row.rough_thickness : null,
    waste_pct: row.waste_pct,
    supplier: row.supplier.trim(),
    notes: row.notes.trim(),
    active: row.active,
  };
  const query = row.id
    ? db().from("costing_materials").update(payload).eq("id", row.id)
    : db().from("costing_materials").insert(payload);
  const { error } = await query;
  return error?.message ?? null;
}

export async function fetchDrawerBoxes(): Promise<{ rows: CostingDrawerBox[]; error: string | null }> {
  const { data, error } = await db().from("costing_drawer_box_styles").select("*").order("name");
  if (error) return { rows: [], error: error.message };
  return {
    rows: (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      price_per_cuft: num(row.price_per_cuft),
      supplier: row.supplier ?? "",
      notes: row.notes ?? "",
      active: Boolean(row.active),
    })),
    error: null,
  };
}

export async function saveDrawerBox(
  row: Omit<CostingDrawerBox, "id"> & { id?: string }
): Promise<string | null> {
  const payload = {
    name: row.name.trim(),
    price_per_cuft: row.price_per_cuft,
    supplier: row.supplier.trim(),
    notes: row.notes.trim(),
    active: row.active,
  };
  const query = row.id
    ? db().from("costing_drawer_box_styles").update(payload).eq("id", row.id)
    : db().from("costing_drawer_box_styles").insert(payload);
  const { error } = await query;
  return error?.message ?? null;
}

export async function fetchMaterialCategories(): Promise<{
  rows: CostingMaterialCategory[];
  error: string | null;
}> {
  const { data, error } = await db()
    .from("costing_material_categories")
    .select("*")
    .order("sort_order")
    .order("name");
  if (error) return { rows: [], error: error.message };
  return {
    rows: (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      sort_order: num(row.sort_order),
    })),
    error: null,
  };
}

export async function saveMaterialCategory(
  name: string
): Promise<{ id: string | null; error: string | null }> {
  const trimmed = name.trim();
  const existing = await db().from("costing_material_categories").select("id, name, sort_order");
  if (existing.error) return { id: null, error: existing.error.message };
  const match = (existing.data ?? []).find(
    (row) => row.name.trim().toLowerCase() === trimmed.toLowerCase()
  );
  if (match) return { id: match.id, error: null };
  const sort = (existing.data ?? []).reduce((max, row) => Math.max(max, num(row.sort_order)), 0) + 1;
  const { data, error } = await db()
    .from("costing_material_categories")
    .insert({ name: trimmed, sort_order: sort })
    .select("id")
    .single();
  return { id: data?.id ?? null, error: error?.message ?? null };
}

export async function fetchDoors(): Promise<{ rows: CostingDoor[]; error: string | null }> {
  const { data, error } = await db().from("costing_door_styles").select("*").order("name");
  if (error) return { rows: [], error: error.message };
  return {
    rows: (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      price_per_sqft: num(row.price_per_sqft),
      supplier: row.supplier ?? "",
      notes: row.notes ?? "",
      active: Boolean(row.active),
    })),
    error: null,
  };
}

export async function saveDoor(
  row: Omit<CostingDoor, "id"> & { id?: string }
): Promise<string | null> {
  const payload = {
    name: row.name.trim(),
    price_per_sqft: row.price_per_sqft,
    supplier: row.supplier.trim(),
    notes: row.notes.trim(),
    active: row.active,
  };
  const query = row.id
    ? db().from("costing_door_styles").update(payload).eq("id", row.id)
    : db().from("costing_door_styles").insert(payload);
  const { error } = await query;
  return error?.message ?? null;
}

export async function fetchFinishes(): Promise<{
  rows: CostingFinish[];
  error: string | null;
}> {
  const { data, error } = await db().from("costing_finishes").select("*").order("name");
  if (error) return { rows: [], error: error.message };
  return {
    rows: (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      use_exterior: Boolean(row.use_exterior),
      use_interior: Boolean(row.use_interior),
      price_per_sqft: num(row.price_per_sqft),
      notes: row.notes ?? "",
      active: Boolean(row.active),
    })),
    error: null,
  };
}

export async function saveFinish(
  row: Omit<CostingFinish, "id"> & { id?: string }
): Promise<string | null> {
  const payload = {
    name: row.name.trim(),
    use_exterior: row.use_exterior,
    use_interior: row.use_interior,
    price_per_sqft: row.price_per_sqft,
    notes: row.notes.trim(),
    active: row.active,
  };
  const query = row.id
    ? db().from("costing_finishes").update(payload).eq("id", row.id)
    : db().from("costing_finishes").insert(payload);
  const { error } = await query;
  return error?.message ?? null;
}

export async function fetchHardware(): Promise<{
  rows: CostingHardware[];
  error: string | null;
}> {
  const { data, error } = await db().from("costing_hardware").select("*").order("name");
  if (error) return { rows: [], error: error.message };
  return {
    rows: (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      unit_cost: num(row.unit_cost),
      install_minutes: num(row.install_minutes),
      markup_pct: num(row.markup_pct),
      supplier: row.supplier ?? "",
      sku: row.sku ?? "",
      notes: row.notes ?? "",
      active: Boolean(row.active),
    })),
    error: null,
  };
}

export async function saveHardware(
  row: Omit<CostingHardware, "id"> & { id?: string }
): Promise<string | null> {
  const payload = {
    name: row.name.trim(),
    category: row.category.trim(),
    unit_cost: row.unit_cost,
    install_minutes: row.install_minutes,
    markup_pct: row.markup_pct,
    supplier: row.supplier.trim(),
    sku: row.sku.trim(),
    notes: row.notes.trim(),
    active: row.active,
  };
  const query = row.id
    ? db().from("costing_hardware").update(payload).eq("id", row.id)
    : db().from("costing_hardware").insert(payload);
  const { error } = await query;
  return error?.message ?? null;
}

export async function fetchSlots(): Promise<{ rows: CostingSlot[]; error: string | null }> {
  const { data, error } = await db()
    .from("costing_slots")
    .select("*")
    .order("sort_order")
    .order("name");
  if (error) return { rows: [], error: error.message };
  return {
    rows: (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      slot_type: row.slot_type,
      sort_order: num(row.sort_order),
    })),
    error: null,
  };
}

export async function saveSlot(
  row: Omit<CostingSlot, "id" | "sort_order"> & { id?: string; sort_order?: number }
): Promise<string | null> {
  const payload = {
    name: row.name.trim(),
    slot_type: row.slot_type,
    ...(row.sort_order != null ? { sort_order: row.sort_order } : {}),
  };
  const query = row.id
    ? db().from("costing_slots").update(payload).eq("id", row.id)
    : db().from("costing_slots").insert(payload);
  const { error } = await query;
  return error?.message ?? null;
}

export async function swapSlotOrder(a: CostingSlot, b: CostingSlot): Promise<string | null> {
  const first = await db()
    .from("costing_slots")
    .update({ sort_order: b.sort_order })
    .eq("id", a.id);
  if (first.error) return first.error.message;
  const second = await db()
    .from("costing_slots")
    .update({ sort_order: a.sort_order })
    .eq("id", b.id);
  return second.error?.message ?? null;
}

export async function fetchSchedules(): Promise<{
  rows: CostingSchedule[];
  error: string | null;
}> {
  const { data, error } = await db().from("costing_schedules").select("*").order("name");
  if (error) return { rows: [], error: error.message };
  return {
    rows: (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description ?? "",
      active: Boolean(row.active),
    })),
    error: null,
  };
}

export async function saveSchedule(
  row: Omit<CostingSchedule, "id"> & { id?: string }
): Promise<{ id: string | null; error: string | null }> {
  const payload = {
    name: row.name.trim(),
    description: row.description.trim(),
    active: row.active,
  };
  if (row.id) {
    const { error } = await db().from("costing_schedules").update(payload).eq("id", row.id);
    return { id: row.id, error: error?.message ?? null };
  }
  const { data, error } = await db()
    .from("costing_schedules")
    .insert(payload)
    .select("id")
    .single();
  return { id: data?.id ?? null, error: error?.message ?? null };
}

export async function fetchScheduleItems(
  scheduleId: string
): Promise<{ rows: CostingScheduleItem[]; error: string | null }> {
  const { data, error } = await db()
    .from("costing_schedule_items")
    .select("*")
    .eq("schedule_id", scheduleId);
  if (error) return { rows: [], error: error.message };
  return {
    rows: (data ?? []).map((row) => ({
      id: row.id,
      schedule_id: row.schedule_id,
      slot_id: row.slot_id,
      material_id: row.material_id,
      door_style_id: row.door_style_id,
      drawer_box_style_id: row.drawer_box_style_id,
      finish_id: row.finish_id,
    })),
    error: null,
  };
}

export async function setScheduleChoice(
  scheduleId: string,
  slot: CostingSlot,
  choiceId: string | null
): Promise<string | null> {
  if (!choiceId) {
    const { error } = await db()
      .from("costing_schedule_items")
      .delete()
      .eq("schedule_id", scheduleId)
      .eq("slot_id", slot.id);
    return error?.message ?? null;
  }
  const payload = {
    schedule_id: scheduleId,
    slot_id: slot.id,
    material_id: slot.slot_type === "material" ? choiceId : null,
    door_style_id: slot.slot_type === "door" ? choiceId : null,
    drawer_box_style_id: slot.slot_type === "drawer_box" ? choiceId : null,
    finish_id:
      slot.slot_type === "exterior_finish" || slot.slot_type === "interior_finish"
        ? choiceId
        : null,
  };
  const existing = await db()
    .from("costing_schedule_items")
    .select("id")
    .eq("schedule_id", scheduleId)
    .eq("slot_id", slot.id)
    .maybeSingle();
  if (existing.error) return existing.error.message;
  const query = existing.data
    ? db().from("costing_schedule_items").update(payload).eq("id", existing.data.id)
    : db().from("costing_schedule_items").insert(payload);
  const { error } = await query;
  return error?.message ?? null;
}

export async function fetchScheduleOverrides(
  scheduleId: string
): Promise<{ rows: CostingScheduleComponentOverride[]; error: string | null }> {
  const { data, error } = await db()
    .from("costing_schedule_component_overrides")
    .select("*")
    .eq("schedule_id", scheduleId);
  if (error) return { rows: [], error: error.message };
  return {
    rows: (data ?? []).map((row) => ({
      id: row.id,
      schedule_id: row.schedule_id,
      component_id: row.component_id,
      material_id: row.material_id,
      door_style_id: row.door_style_id,
      drawer_box_style_id: row.drawer_box_style_id,
      finish_id: row.finish_id,
    })),
    error: null,
  };
}

export async function setScheduleComponentOverride(
  scheduleId: string,
  componentId: string,
  slot: CostingSlot,
  choiceId: string | null
): Promise<string | null> {
  if (!choiceId) {
    const { error } = await db()
      .from("costing_schedule_component_overrides")
      .delete()
      .eq("schedule_id", scheduleId)
      .eq("component_id", componentId);
    return error?.message ?? null;
  }
  const payload = {
    schedule_id: scheduleId,
    component_id: componentId,
    material_id: slot.slot_type === "material" ? choiceId : null,
    door_style_id: slot.slot_type === "door" ? choiceId : null,
    drawer_box_style_id: slot.slot_type === "drawer_box" ? choiceId : null,
    finish_id:
      slot.slot_type === "exterior_finish" || slot.slot_type === "interior_finish" ? choiceId : null,
  };
  const existing = await db()
    .from("costing_schedule_component_overrides")
    .select("id")
    .eq("schedule_id", scheduleId)
    .eq("component_id", componentId)
    .maybeSingle();
  if (existing.error) return existing.error.message;
  const query = existing.data
    ? db().from("costing_schedule_component_overrides").update(payload).eq("id", existing.data.id)
    : db().from("costing_schedule_component_overrides").insert(payload);
  const { error } = await query;
  return error?.message ?? null;
}

export async function duplicateSchedule(schedule: CostingSchedule): Promise<string | null> {
  const created = await saveSchedule({
    name: `${schedule.name} copy`,
    description: schedule.description,
    active: schedule.active,
  });
  if (created.error || !created.id) return created.error ?? "Could not copy the schedule";
  const [items, overrides] = await Promise.all([
    fetchScheduleItems(schedule.id),
    fetchScheduleOverrides(schedule.id),
  ]);
  if (items.error) return items.error;
  if (overrides.error) return overrides.error;
  if (items.rows.length > 0) {
    const { error } = await db()
      .from("costing_schedule_items")
      .insert(
        items.rows.map((item) => ({
          schedule_id: created.id,
          slot_id: item.slot_id,
          material_id: item.material_id,
          door_style_id: item.door_style_id,
          drawer_box_style_id: item.drawer_box_style_id,
          finish_id: item.finish_id,
        }))
      );
    if (error) return error.message;
  }
  if (overrides.rows.length === 0) return null;
  const { error } = await db().from("costing_schedule_component_overrides").insert(
    overrides.rows.map((row) => ({
      schedule_id: created.id,
      component_id: row.component_id,
      material_id: row.material_id,
      door_style_id: row.door_style_id,
      drawer_box_style_id: row.drawer_box_style_id,
      finish_id: row.finish_id,
    }))
  );
  return error?.message ?? null;
}

export async function fetchComponents(): Promise<{
  rows: CostingComponent[];
  error: string | null;
}> {
  const { data, error } = await db().from("costing_components").select("*").order("name");
  if (error) return { rows: [], error: error.message };
  return {
    rows: (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      slot_id: row.slot_id,
      length_formula: row.length_formula,
      width_formula: row.width_formula,
      height_formula: row.height_formula ?? null,
      qty_formula: row.qty_formula,
      labor_minutes: num(row.labor_minutes),
      exterior_finish_sides: num(row.exterior_finish_sides),
      interior_finish_sides: num(row.interior_finish_sides),
      notes: row.notes ?? "",
    })),
    error: null,
  };
}

export async function saveComponent(
  row: Omit<CostingComponent, "id"> & { id?: string }
): Promise<string | null> {
  const payload = {
    name: row.name.trim(),
    slot_id: row.slot_id,
    length_formula: row.length_formula.trim(),
    width_formula: row.width_formula.trim(),
    height_formula: row.height_formula?.trim() || null,
    qty_formula: row.qty_formula.trim() || "1",
    labor_minutes: row.labor_minutes,
    exterior_finish_sides: row.exterior_finish_sides,
    interior_finish_sides: row.interior_finish_sides,
    notes: row.notes.trim(),
  };
  const query = row.id
    ? db().from("costing_components").update(payload).eq("id", row.id)
    : db().from("costing_components").insert(payload);
  const { error } = await query;
  return error?.message ?? null;
}

export async function materialUsage(id: string): Promise<string[]> {
  const { data, error } = await db()
    .from("costing_schedule_items")
    .select("schedule:costing_schedules(name)")
    .eq("material_id", id);
  if (error) return [error.message];
  return (data ?? []).map((row) => `Schedule ${firstName(row.schedule)}`);
}

export async function drawerBoxUsage(id: string): Promise<string[]> {
  const { data, error } = await db()
    .from("costing_schedule_items")
    .select("schedule:costing_schedules(name)")
    .eq("drawer_box_style_id", id);
  if (error) return [error.message];
  return (data ?? []).map((row) => `Schedule ${firstName(row.schedule)}`);
}

export async function doorUsage(id: string): Promise<string[]> {
  const { data, error } = await db()
    .from("costing_schedule_items")
    .select("schedule:costing_schedules(name)")
    .eq("door_style_id", id);
  if (error) return [error.message];
  return (data ?? []).map((row) => `Schedule ${firstName(row.schedule)}`);
}

export async function finishUsage(id: string): Promise<string[]> {
  const { data, error } = await db()
    .from("costing_schedule_items")
    .select("schedule:costing_schedules(name)")
    .eq("finish_id", id);
  if (error) return [error.message];
  return (data ?? []).map((row) => `Schedule ${firstName(row.schedule)}`);
}

export async function hardwareUsage(id: string): Promise<string[]> {
  const { data, error } = await db()
    .from("costing_template_hardware")
    .select("template:costing_cabinet_templates(name)")
    .eq("hardware_id", id);
  if (error) return [error.message];
  return (data ?? []).map((row) => `Template ${firstName(row.template)}`);
}

export async function componentUsage(id: string): Promise<string[]> {
  const { data, error } = await db()
    .from("costing_template_components")
    .select("template:costing_cabinet_templates(name)")
    .eq("component_id", id);
  if (error) return [error.message];
  return (data ?? []).map((row) => `Template ${firstName(row.template)}`);
}

export async function slotUsage(id: string): Promise<string[]> {
  const [components, items] = await Promise.all([
    db().from("costing_components").select("name").eq("slot_id", id),
    db()
      .from("costing_schedule_items")
      .select("schedule:costing_schedules(name)")
      .eq("slot_id", id),
  ]);
  const used: string[] = [];
  if (components.error) used.push(components.error.message);
  else used.push(...(components.data ?? []).map((row) => `Component ${row.name}`));
  if (items.error) used.push(items.error.message);
  else used.push(...(items.data ?? []).map((row) => `Schedule ${firstName(row.schedule)}`));
  return used;
}

export async function scheduleUsage(id: string): Promise<string[]> {
  const [rooms, cabinets] = await Promise.all([
    db()
      .from("costing_quote_rooms")
      .select("name, quote:costing_quotes(name)")
      .eq("schedule_id", id),
    db()
      .from("costing_quote_cabinets")
      .select("label, room:costing_quote_rooms(name)")
      .eq("schedule_override_id", id),
  ]);
  const used: string[] = [];
  if (rooms.error) used.push(rooms.error.message);
  else {
    used.push(
      ...(rooms.data ?? []).map(
        (row) => `Quote ${firstName(row.quote)} room ${row.name}`
      )
    );
  }
  if (cabinets.error) used.push(cabinets.error.message);
  else {
    used.push(
      ...(cabinets.data ?? []).map(
        (row) => `Cabinet ${row.label} in ${firstName(row.room)}`
      )
    );
  }
  return used;
}

export type CostingCategory = {
  id: string;
  name: string;
  sort_order: number;
};

export type CostingTemplate = {
  id: string;
  name: string;
  category_id: string;
  default_height: number;
  default_width: number;
  default_depth: number;
  default_doors: number;
  default_drawers: number;
  default_shelves: number;
  base_labor_minutes: number;
  notes: string;
  active: boolean;
};

export type TemplatePart = {
  id: string;
  template_id: string;
  component_id: string;
  sort_order: number;
  length_formula: string | null;
  width_formula: string | null;
  qty_formula: string | null;
  labor_minutes: number | null;
};

export type TemplateHardwareRow = {
  id: string;
  template_id: string;
  hardware_id: string;
  qty_formula: string;
  sort_order: number;
};

export async function fetchCategories(): Promise<{
  rows: CostingCategory[];
  error: string | null;
}> {
  const { data, error } = await db()
    .from("costing_cabinet_categories")
    .select("*")
    .order("sort_order")
    .order("name");
  if (error) return { rows: [], error: error.message };
  return {
    rows: (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      sort_order: num(row.sort_order),
    })),
    error: null,
  };
}

export async function saveCategory(
  row: Omit<CostingCategory, "id" | "sort_order"> & { id?: string; sort_order?: number }
): Promise<string | null> {
  const payload = {
    name: row.name.trim(),
    ...(row.sort_order != null ? { sort_order: row.sort_order } : {}),
  };
  const query = row.id
    ? db().from("costing_cabinet_categories").update(payload).eq("id", row.id)
    : db().from("costing_cabinet_categories").insert(payload);
  const { error } = await query;
  return error?.message ?? null;
}

export async function fetchTemplates(): Promise<{
  rows: CostingTemplate[];
  error: string | null;
}> {
  const { data, error } = await db().from("costing_cabinet_templates").select("*").order("name");
  if (error) return { rows: [], error: error.message };
  return {
    rows: (data ?? []).map(mapTemplate),
    error: null,
  };
}

export async function saveTemplate(
  row: Omit<CostingTemplate, "id"> & { id?: string }
): Promise<{ id: string | null; error: string | null }> {
  const payload = {
    name: row.name.trim(),
    category_id: row.category_id,
    default_height: row.default_height,
    default_width: row.default_width,
    default_depth: row.default_depth,
    default_doors: row.default_doors,
    default_drawers: row.default_drawers,
    default_shelves: row.default_shelves,
    base_labor_minutes: row.base_labor_minutes,
    notes: row.notes.trim(),
    active: row.active,
  };
  if (row.id) {
    const { error } = await db().from("costing_cabinet_templates").update(payload).eq("id", row.id);
    return { id: row.id, error: error?.message ?? null };
  }
  const { data, error } = await db()
    .from("costing_cabinet_templates")
    .insert(payload)
    .select("id")
    .single();
  return { id: data?.id ?? null, error: error?.message ?? null };
}

export async function fetchTemplateParts(
  templateId: string
): Promise<{ rows: TemplatePart[]; error: string | null }> {
  const { data, error } = await db()
    .from("costing_template_components")
    .select("*")
    .eq("template_id", templateId)
    .order("sort_order");
  if (error) return { rows: [], error: error.message };
  return {
    rows: (data ?? []).map((row) => ({
      id: row.id,
      template_id: row.template_id,
      component_id: row.component_id,
      sort_order: num(row.sort_order),
      length_formula: row.length_formula,
      width_formula: row.width_formula,
      qty_formula: row.qty_formula,
      labor_minutes: row.labor_minutes == null ? null : num(row.labor_minutes),
    })),
    error: null,
  };
}

export async function fetchTemplateHardware(
  templateId: string
): Promise<{ rows: TemplateHardwareRow[]; error: string | null }> {
  const { data, error } = await db()
    .from("costing_template_hardware")
    .select("*")
    .eq("template_id", templateId)
    .order("sort_order");
  if (error) return { rows: [], error: error.message };
  return {
    rows: (data ?? []).map((row) => ({
      id: row.id,
      template_id: row.template_id,
      hardware_id: row.hardware_id,
      qty_formula: row.qty_formula,
      sort_order: num(row.sort_order),
    })),
    error: null,
  };
}

export async function addTemplatePart(
  templateId: string,
  componentId: string,
  sortOrder: number
): Promise<string | null> {
  const { error } = await db().from("costing_template_components").insert({
    template_id: templateId,
    component_id: componentId,
    sort_order: sortOrder,
  });
  return error?.message ?? null;
}

export async function updateTemplatePart(
  id: string,
  patch: Partial<Pick<TemplatePart, "length_formula" | "width_formula" | "qty_formula" | "labor_minutes" | "sort_order">>
): Promise<string | null> {
  const { error } = await db().from("costing_template_components").update(patch).eq("id", id);
  return error?.message ?? null;
}

export async function addTemplateHardware(
  templateId: string,
  hardwareId: string,
  qtyFormula: string,
  sortOrder: number
): Promise<string | null> {
  const { error } = await db().from("costing_template_hardware").insert({
    template_id: templateId,
    hardware_id: hardwareId,
    qty_formula: qtyFormula,
    sort_order: sortOrder,
  });
  return error?.message ?? null;
}

export async function updateTemplateHardware(
  id: string,
  patch: Partial<Pick<TemplateHardwareRow, "qty_formula" | "sort_order">>
): Promise<string | null> {
  const { error } = await db().from("costing_template_hardware").update(patch).eq("id", id);
  return error?.message ?? null;
}

export async function duplicateTemplate(template: CostingTemplate): Promise<string | null> {
  const created = await saveTemplate({
    ...template,
    id: undefined,
    name: `${template.name} copy`,
  });
  if (created.error || !created.id) return created.error ?? "Could not copy the template";
  const [parts, hardware] = await Promise.all([
    fetchTemplateParts(template.id),
    fetchTemplateHardware(template.id),
  ]);
  if (parts.error) return parts.error;
  if (hardware.error) return hardware.error;
  if (parts.rows.length) {
    const { error } = await db().from("costing_template_components").insert(
      parts.rows.map((row) => ({
        template_id: created.id,
        component_id: row.component_id,
        sort_order: row.sort_order,
        length_formula: row.length_formula,
        width_formula: row.width_formula,
        qty_formula: row.qty_formula,
        labor_minutes: row.labor_minutes,
      }))
    );
    if (error) return error.message;
  }
  if (hardware.rows.length) {
    const { error } = await db().from("costing_template_hardware").insert(
      hardware.rows.map((row) => ({
        template_id: created.id,
        hardware_id: row.hardware_id,
        qty_formula: row.qty_formula,
        sort_order: row.sort_order,
      }))
    );
    if (error) return error.message;
  }
  return null;
}

export async function templateUsage(id: string): Promise<string[]> {
  const { data, error } = await db()
    .from("costing_quote_cabinets")
    .select("label")
    .eq("template_id", id);
  if (error) return [error.message];
  return (data ?? []).map((row) => `Quote cabinet ${row.label}`);
}

export async function categoryUsage(id: string): Promise<string[]> {
  const { data, error } = await db()
    .from("costing_cabinet_templates")
    .select("name")
    .eq("category_id", id);
  if (error) return [error.message];
  return (data ?? []).map((row) => `Template ${row.name}`);
}

function mapTemplate(row: {
  id: string;
  name: string;
  category_id: string;
  default_height: unknown;
  default_width: unknown;
  default_depth: unknown;
  default_doors: unknown;
  default_drawers: unknown;
  default_shelves: unknown;
  base_labor_minutes: unknown;
  notes: string | null;
  active: boolean;
}): CostingTemplate {
  return {
    id: row.id,
    name: row.name,
    category_id: row.category_id,
    default_height: num(row.default_height),
    default_width: num(row.default_width),
    default_depth: num(row.default_depth),
    default_doors: num(row.default_doors),
    default_drawers: num(row.default_drawers),
    default_shelves: num(row.default_shelves),
    base_labor_minutes: num(row.base_labor_minutes),
    notes: row.notes ?? "",
    active: Boolean(row.active),
  };
}

export async function deleteRow(
  table:
    | "costing_materials"
    | "costing_door_styles"
    | "costing_drawer_box_styles"
    | "costing_finishes"
    | "costing_hardware"
    | "costing_slots"
    | "costing_schedules"
    | "costing_components"
    | "costing_cabinet_templates"
    | "costing_cabinet_categories"
    | "costing_template_components"
    | "costing_template_hardware",
  id: string
): Promise<string | null> {
  const { data, error } = await db().from(table).delete().eq("id", id).select("id");
  if (error) return error.message;
  if (!data?.length) return "That row is still in use, so it was not deleted.";
  return null;
}

function firstName(value: unknown): string {
  const row = Array.isArray(value) ? value[0] : value;
  if (row && typeof row === "object" && "name" in row && typeof row.name === "string") {
    return row.name;
  }
  return "Unknown";
}
