import { createClient } from "@/lib/supabase/client";
import { fetchSlots } from "@/lib/costing/db";

const MARKER = "SAMPLE – 3/4 Maple Plywood";
/** Survives after the sample rows are deleted, so a refresh does not create them again. */
const SEEDED = "SAMPLE_LIBRARY";

/** Inserts the labeled sample library once. Safe to call on every visit. */
export async function ensureCostingSamples(): Promise<string | null> {
  const supabase = createClient();
  const heightReady = await ensureDrawerBoxHeight(supabase);
  if (heightReady) return heightReady;
  const seeded = await libraryAlreadySeeded(supabase);
  if (seeded.error) return seeded.error;
  if (seeded.seeded) return null;

  const existing = await supabase
    .from("costing_materials")
    .select("id")
    .eq("name", MARKER)
    .maybeSingle();
  if (existing.error) return existing.error.message;
  if (existing.data) {
    const cabinetError = await ensureSampleCabinet();
    if (cabinetError) return cabinetError;
    return markLibrarySeeded(supabase);
  }

  const categories = await supabase.from("costing_material_categories").select("id, name");
  if (categories.error) return categories.error.message;
  const categoryId = new Map((categories.data ?? []).map((row) => [row.name, row.id]));
  const plywoodCategory = categoryId.get("Plywood");
  const hardwoodCategory = categoryId.get("Hardwood");
  if (!plywoodCategory || !hardwoodCategory) return "Material categories are missing.";

  const materials = await supabase
    .from("costing_materials")
    .insert([
      {
        name: "SAMPLE – 3/4 Maple Plywood",
        category_id: plywoodCategory,
        material_type: "sheet",
        unit_price: 80,
        sheet_length: 96,
        sheet_width: 48,
        thickness: 0.75,
        waste_pct: 15,
        supplier: "Sample supplier",
        notes: "Sample sheet for testing.",
      },
      {
        name: "SAMPLE – 1/4 Maple Plywood",
        category_id: plywoodCategory,
        material_type: "sheet",
        unit_price: 42,
        sheet_length: 96,
        sheet_width: 48,
        thickness: 0.25,
        waste_pct: 15,
        supplier: "Sample supplier",
        notes: "Sample back and drawer bottom.",
      },
      {
        name: "SAMPLE – 4/4 Maple Lumber",
        category_id: hardwoodCategory,
        material_type: "lumber",
        unit_price: 5,
        thickness: 0.75,
        rough_thickness: 1,
        waste_pct: 30,
        supplier: "Sample supplier",
        notes: "Sample face-frame lumber.",
      },
      {
        name: "SAMPLE – 4/4 Oak Lumber",
        category_id: hardwoodCategory,
        material_type: "lumber",
        unit_price: 6.5,
        thickness: 0.75,
        rough_thickness: 1,
        waste_pct: 30,
        supplier: "Sample supplier",
        notes: "Sample oak face frame.",
      },
    ])
    .select("id, name");
  if (materials.error) return materials.error.message;

  const door = await supabase
    .from("costing_door_styles")
    .insert({
      name: "SAMPLE – Shaker",
      price_per_sqft: 28,
      supplier: "Sample supplier",
      notes: "Bought-in door and drawer-front price.",
    })
    .select("id")
    .single();
  if (door.error) return door.error.message;

  const drawerBox = await supabase
    .from("costing_drawer_box_styles")
    .insert({
      name: "SAMPLE – Dovetail Maple",
      price_per_cuft: 25,
      supplier: "Sample supplier",
      notes: "Sample drawer box priced by cubic foot.",
    })
    .select("id")
    .single();
  if (drawerBox.error) return drawerBox.error.message;

  const finishes = await supabase
    .from("costing_finishes")
    .insert([
      {
        name: "SAMPLE – Stain",
        use_exterior: true,
        use_interior: false,
        price_per_sqft: 3.5,
        notes: "Sample stain.",
      },
      {
        name: "SAMPLE – Paint",
        use_exterior: true,
        use_interior: false,
        price_per_sqft: 4.25,
        notes: "Sample paint.",
      },
      {
        name: "SAMPLE – Glaze",
        use_exterior: true,
        use_interior: false,
        price_per_sqft: 2.5,
        notes: "Sample glaze.",
      },
      {
        name: "SAMPLE – Clear Coat",
        use_exterior: false,
        use_interior: true,
        price_per_sqft: 1.75,
        notes: "Sample interior clear coat.",
      },
    ])
    .select("id, name");
  if (finishes.error) return finishes.error.message;

  const hardwareError = await ensureSampleHardware(supabase);
  if (hardwareError) return hardwareError;

  const materialId = new Map((materials.data ?? []).map((row) => [row.name, row.id]));
  const finishId = new Map((finishes.data ?? []).map((row) => [row.name, row.id]));
  const slots = await fetchSlots();
  if (slots.error) return slots.error;
  const slotId = new Map(slots.rows.map((row) => [row.name, row.id]));

  const maple = await insertSchedule(
    supabase,
    "SAMPLE – Maple/Maple",
    "Maple face frame and maple interior."
  );
  if ("error" in maple) return maple.error;
  const oak = await insertSchedule(
    supabase,
    "SAMPLE – Oak Frame/Maple Interior",
    "Oak face frame with a maple box and interior."
  );
  if ("error" in oak) return oak.error;
  const mapleId = maple.id;
  const oakId = oak.id;

  const plywood = materialId.get("SAMPLE – 3/4 Maple Plywood");
  const quarter = materialId.get("SAMPLE – 1/4 Maple Plywood");
  const mapleLumber = materialId.get("SAMPLE – 4/4 Maple Lumber");
  const oakLumber = materialId.get("SAMPLE – 4/4 Oak Lumber");
  if (!plywood || !quarter || !mapleLumber || !oakLumber || !door.data) {
    return "Sample materials did not save";
  }

  const shared = (frameId: string) => [
    item(mapleId, slotId, "Cabinet Box", "material", plywood),
    item(mapleId, slotId, "Shelves", "material", plywood),
    item(mapleId, slotId, "Drawer Box", "drawer_box", drawerBox.data.id),
    item(mapleId, slotId, "Doors & Drawer Fronts", "door", door.data.id),
    item(mapleId, slotId, "Exterior Finish", "finish", finishId.get("SAMPLE – Stain") ?? ""),
    item(mapleId, slotId, "Interior Finish", "finish", finishId.get("SAMPLE – Clear Coat") ?? ""),
    item(oakId, slotId, "Cabinet Box", "material", plywood),
    item(oakId, slotId, "Shelves", "material", plywood),
    item(oakId, slotId, "Face Frame", "material", frameId),
    item(oakId, slotId, "Drawer Box", "drawer_box", drawerBox.data.id),
    item(oakId, slotId, "Doors & Drawer Fronts", "door", door.data.id),
    item(oakId, slotId, "Exterior Finish", "finish", finishId.get("SAMPLE – Stain") ?? ""),
    item(oakId, slotId, "Interior Finish", "finish", finishId.get("SAMPLE – Clear Coat") ?? ""),
  ];

  const rows = [
    item(mapleId, slotId, "Face Frame", "material", mapleLumber),
    ...shared(oakLumber),
  ].filter((row) => row.slot_id && row.choice);
  const { error } = await supabase.from("costing_schedule_items").insert(
    rows.map((row) => ({
      schedule_id: row.schedule_id,
      slot_id: row.slot_id,
      material_id: row.kind === "material" ? row.choice : null,
      door_style_id: row.kind === "door" ? row.choice : null,
      drawer_box_style_id: row.kind === "drawer_box" ? row.choice : null,
      finish_id: row.kind === "finish" ? row.choice : null,
    }))
  );
  if (error) return error.message;
  const cabinetError = await ensureSampleCabinet();
  if (cabinetError) return cabinetError;
  return markLibrarySeeded(supabase);
}

async function insertSchedule(
  supabase: ReturnType<typeof createClient>,
  name: string,
  description: string
): Promise<{ id: string } | { error: string }> {
  const { data, error } = await supabase
    .from("costing_schedules")
    .insert({ name, description, active: true })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not save a sample schedule" };
  return { id: data.id };
}

const SAMPLE_TEMPLATE = "SAMPLE – Base 1 Door 1 Drawer";

const SAMPLE_PARTS: Array<{
  name: string;
  slot: string;
  length: string;
  width: string;
  height?: string;
  qty: string;
  labor: number;
  exterior: number;
  interior: number;
}> = [
  { name: "SAMPLE – Side", slot: "Cabinet Box", length: "H", width: "D", qty: "2", labor: 6, exterior: 0, interior: 1 },
  { name: "SAMPLE – Bottom", slot: "Cabinet Box", length: "W", width: "D", qty: "1", labor: 4, exterior: 0, interior: 1 },
  { name: "SAMPLE – Back", slot: "Cabinet Box", length: "W", width: "H", qty: "1", labor: 3, exterior: 0, interior: 1 },
  { name: "SAMPLE – Shelf", slot: "Shelves", length: "W", width: "D", qty: "SHELVES", labor: 4, exterior: 0, interior: 2 },
  { name: "SAMPLE – Back Nailer", slot: "Cabinet Box", length: "W", width: "NAILER", qty: "1", labor: 3, exterior: 0, interior: 0 },
  { name: "SAMPLE – Face Frame Stile", slot: "Face Frame", length: "H", width: "STILE", qty: "2", labor: 4, exterior: 1, interior: 0 },
  { name: "SAMPLE – Face Frame Rail", slot: "Face Frame", length: "W - (2 * STILE)", width: "RAIL", qty: "1", labor: 3, exterior: 1, interior: 0 },
  { name: "SAMPLE – Face Frame Top Rail", slot: "Face Frame", length: "W - (2 * STILE)", width: "TOPRAIL", qty: "1", labor: 3, exterior: 1, interior: 0 },
  {
    name: "SAMPLE – Drawer Box",
    slot: "Drawer Box",
    length: "D - 1",
    width: "W - (2 * STILE) - DRAWERBOX_CLEAR",
    height: "DRAWERBOX_H",
    qty: "DRAWERS",
    labor: 10,
    exterior: 0,
    interior: 0,
  },
  { name: "SAMPLE – Door and Drawer Front", slot: "Doors & Drawer Fronts", length: "W", width: "H - TOEKICK", qty: "1", labor: 8, exterior: 2, interior: 0 },
];

/** Inserts the sample base cabinet once. A deleted sample cabinet stays deleted. */
export async function ensureSampleCabinet(): Promise<string | null> {
  const supabase = createClient();
  const seeded = await libraryAlreadySeeded(supabase);
  if (seeded.error) return seeded.error;
  const existing = await supabase
    .from("costing_cabinet_templates")
    .select("id")
    .eq("name", SAMPLE_TEMPLATE)
    .maybeSingle();
  if (existing.error) return existing.error.message;
  if (existing.data) return seeded.seeded ? null : markLibrarySeeded(supabase);
  if (seeded.seeded) return null;

  const hardwareReady = await ensureSampleHardware(supabase);
  if (hardwareReady) return hardwareReady;

  const [categories, slots, hardware] = await Promise.all([
    supabase.from("costing_cabinet_categories").select("id, name").eq("name", "Base").maybeSingle(),
    supabase.from("costing_slots").select("id, name"),
    supabase.from("costing_hardware").select("id, name").ilike("name", "SAMPLE%"),
  ]);
  if (categories.error) return categories.error.message;
  if (!categories.data) return "The Base cabinet category is missing.";
  if (slots.error) return slots.error.message;
  if (hardware.error) return hardware.error.message;

  const slotId = new Map((slots.data ?? []).map((slot) => [slot.name, slot.id]));
  const hingeId = findSampleId(hardware.data ?? [], "SAMPLE – Soft-Close Hinge");
  const slideId = findSampleId(hardware.data ?? [], "SAMPLE – Drawer Slides");
  if (!hingeId || !slideId) return "Could not save the sample hinge or drawer slides.";

  const componentIds: string[] = [];
  for (const part of SAMPLE_PARTS) {
    const slot = slotId.get(part.slot);
    if (!slot) return `The ${part.slot} slot is missing.`;
    const found = await supabase
      .from("costing_components")
      .select("id")
      .eq("name", part.name)
      .maybeSingle();
    if (found.error) return found.error.message;
    if (found.data) {
      componentIds.push(found.data.id);
      continue;
    }
    const inserted = await supabase
      .from("costing_components")
      .insert({
        name: part.name,
        slot_id: slot,
        length_formula: part.length,
        width_formula: part.width,
        height_formula: part.height ?? null,
        qty_formula: part.qty,
        labor_minutes: part.labor,
        exterior_finish_sides: part.exterior,
        interior_finish_sides: part.interior,
        notes: "Sample part for the base cabinet template.",
      })
      .select("id")
      .single();
    if (inserted.error || !inserted.data) {
      return inserted.error?.message ?? "Could not save a sample part";
    }
    componentIds.push(inserted.data.id);
  }

  const template = await supabase
    .from("costing_cabinet_templates")
    .insert({
      name: SAMPLE_TEMPLATE,
      category_id: categories.data.id,
      default_height: 34.5,
      default_width: 24,
      default_depth: 24,
      default_doors: 1,
      default_drawers: 1,
      default_shelves: 1,
      base_labor_minutes: 45,
      notes:
        "Sample base cabinet. The door line is the whole front area, not each door. Drawer box height is a fixed 4 inches.",
      active: true,
    })
    .select("id")
    .single();
  if (template.error || !template.data) {
    return template.error?.message ?? "Could not save the sample cabinet";
  }

  const parts = await supabase.from("costing_template_components").insert(
    componentIds.map((componentId, index) => ({
      template_id: template.data.id,
      component_id: componentId,
      sort_order: index,
    }))
  );
  if (parts.error) return parts.error.message;

  const lines = await supabase.from("costing_template_hardware").insert([
    {
      template_id: template.data.id,
      hardware_id: hingeId,
      qty_formula: "DOORS * 2",
      sort_order: 0,
    },
    {
      template_id: template.data.id,
      hardware_id: slideId,
      qty_formula: "DRAWERS",
      sort_order: 1,
    },
  ]);
  if (lines.error) return lines.error.message;
  return markLibrarySeeded(supabase);
}

const SAMPLE_HARDWARE = [
  {
    name: "SAMPLE – Soft-Close Hinge",
    category: "Hinges",
    unit_cost: 4.25,
    install_minutes: 3,
    markup_pct: 0,
    supplier: "Sample supplier",
    notes: "",
  },
  {
    name: "SAMPLE – Drawer Slides",
    category: "Slides",
    unit_cost: 18,
    install_minutes: 8,
    markup_pct: 0,
    supplier: "Sample supplier",
    notes: "One pair.",
  },
  {
    name: "SAMPLE – Bar Pull",
    category: "Pulls/Knobs",
    unit_cost: 6,
    install_minutes: 2,
    markup_pct: 0,
    supplier: "Sample supplier",
    notes: "",
  },
  {
    name: "SAMPLE – Trash Pullout",
    category: "Trash Pullouts",
    unit_cost: 145,
    install_minutes: 20,
    markup_pct: 25,
    supplier: "Sample supplier",
    notes: "Sample extra markup.",
  },
];

/** Adds any sample hardware that is not already in the library. */
async function ensureSampleHardware(
  supabase: ReturnType<typeof createClient>
): Promise<string | null> {
  const existing = await supabase.from("costing_hardware").select("name").ilike("name", "SAMPLE%");
  if (existing.error) return existing.error.message;
  const have = new Set((existing.data ?? []).map((row) => normalizeSampleName(row.name)));
  const missing = SAMPLE_HARDWARE.filter((row) => !have.has(normalizeSampleName(row.name)));
  if (!missing.length) return null;
  const inserted = await supabase.from("costing_hardware").insert(missing);
  return inserted.error?.message ?? null;
}

async function libraryAlreadySeeded(
  supabase: ReturnType<typeof createClient>
): Promise<{ seeded: boolean; error: string | null }> {
  const existing = await supabase.from("costing_variables").select("id").eq("code", SEEDED).maybeSingle();
  if (existing.error) return { seeded: false, error: existing.error.message };
  return { seeded: Boolean(existing.data), error: null };
}

async function markLibrarySeeded(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  const existing = await libraryAlreadySeeded(supabase);
  if (existing.error || existing.seeded) return existing.error;
  const inserted = await supabase.from("costing_variables").insert({
    code: SEEDED,
    name: "Sample library created",
    value: 1,
    unit: "in",
    description: "Records that the sample catalogue was created. Deleting those rows does not create them again.",
  });
  return inserted.error?.message ?? null;
}

async function ensureDrawerBoxHeight(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  const existing = await supabase.from("costing_variables").select("id").eq("code", "DRAWERBOX_H").maybeSingle();
  if (existing.error || existing.data) return existing.error?.message ?? null;
  const inserted = await supabase.from("costing_variables").insert({
    code: "DRAWERBOX_H",
    name: "Drawer box height",
    value: 4,
    unit: "in",
    description: "Standard drawer box height",
  });
  return inserted.error?.message ?? null;
}

function findSampleId(rows: { id: string; name: string }[], name: string) {
  const wanted = normalizeSampleName(name);
  return rows.find((row) => normalizeSampleName(row.name) === wanted)?.id;
}

function normalizeSampleName(name: string) {
  return name.replace(/[\u2010\u2011\u2012\u2013\u2014\u2212-]/g, "-").replace(/\s+/g, " ").trim().toLowerCase();
}

function item(
  scheduleId: string,
  slots: Map<string, string>,
  slotName: string,
  kind: "material" | "door" | "drawer_box" | "finish",
  choice: string
) {
  return {
    schedule_id: scheduleId,
    slot_id: slots.get(slotName) ?? "",
    kind,
    choice,
  };
}
