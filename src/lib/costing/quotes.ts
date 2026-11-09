import { createClient } from "@/lib/supabase/client";
import { calculateCabinet, priceQuote, type CabinetCost, type CabinetPartInput, type CostingFinish } from "@/lib/costing/calculate";
import { choiceIdForSlot, type ScheduleChoiceRef } from "@/lib/costing/schedule-choice";
import type { FormulaScope } from "@/lib/costing/formula";
import {
  cabinetCostColumns,
  hardwareRecordFromLine,
  partRecordFromLine,
  quoteWithCurrentPrices,
  repriceFrozen,
  type QuoteHardwareRecord,
  type QuotePartRecord,
  type SlotChoice,
} from "@/lib/costing/freeze";
import {
  fetchComponents,
  fetchDoors,
  fetchDrawerBoxes,
  fetchFinishes,
  fetchHardware,
  fetchMaterials,
  fetchScheduleItems,
  fetchScheduleOverrides,
  fetchSettings,
  fetchSlots,
  fetchTemplateHardware,
  fetchTemplateParts,
  fetchTemplates,
  fetchVariables,
  type CostingComponent,
  type CostingDoor,
  type CostingScheduleComponentOverride,
  type CostingDrawerBox,
  type CostingFinish as DbFinish,
  type CostingHardware,
  type CostingMaterial,
  type CostingSettings,
  type CostingSlot,
  type CostingVariable,
} from "@/lib/costing/db";

export type QuoteStatus = "draft" | "sent";

export type QuoteSummary = {
  id: string;
  name: string;
  status: QuoteStatus;
  margin_pct: number;
  created_at: string;
  contact_id: string | null;
  contact_name: string | null;
  total_cost: number;
  sell_price: number;
};

export type CostingQuote = {
  id: string;
  name: string;
  contact_id: string | null;
  margin_pct: number;
  status: QuoteStatus;
  notes: string;
  created_at: string;
};

export type QuoteRoom = {
  id: string;
  quote_id: string;
  name: string;
  schedule_id: string | null;
  sort_order: number;
};

export type QuoteCabinet = {
  id: string;
  room_id: string;
  template_id: string | null;
  label: string;
  height: number;
  width: number;
  depth: number;
  doors: number;
  drawers: number;
  shelves: number;
  quantity: number;
  schedule_override_id: string | null;
  base_labor_minutes: number;
  material_cost: number;
  labor_cost: number;
  door_cost: number;
  drawer_box_cost: number;
  finish_cost: number;
  hardware_cost: number;
  hardware_markup: number;
  total_cost: number;
  labor_rate_used: number | null;
  notes: string;
  updated_at: string;
};

export type SavedPart = QuotePartRecord & { id: string; cabinet_id: string };
export type SavedHardware = QuoteHardwareRecord & { id: string; cabinet_id: string };

export type CabinetSize = {
  label?: string;
  height: number;
  width: number;
  depth: number;
  doors: number;
  drawers: number;
  shelves: number;
  quantity: number;
  base_labor_minutes: number;
  notes?: string;
};

type Library = {
  components: CostingComponent[];
  slots: CostingSlot[];
  componentOverrides: CostingScheduleComponentOverride[];
  materials: CostingMaterial[];
  doors: CostingDoor[];
  drawerBoxes: CostingDrawerBox[];
  finishes: DbFinish[];
  hardware: CostingHardware[];
  settings: CostingSettings;
  variables: CostingVariable[];
};

function client() {
  return createClient();
}

function num(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function numOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function scopeFrom(variables: CostingVariable[]): FormulaScope {
  const scope: Record<string, number> = {};
  for (const variable of variables) scope[variable.code] = variable.value;
  return scope;
}

function rateFrom(settings: CostingSettings) {
  return settings.worker_count > 0 ? settings.shop_hourly_cost / settings.worker_count : 0;
}

export async function fetchQuoteSummaries(): Promise<{ rows: QuoteSummary[]; error: string | null }> {
  const { data, error } = await client()
    .from("costing_quotes")
    .select("id, name, status, margin_pct, created_at, contact_id")
    .order("created_at", { ascending: false });
  if (error) return { rows: [], error: error.message };
  const quotes = data ?? [];
  const contactIds = [...new Set(quotes.map((row) => row.contact_id).filter(Boolean))] as string[];
  const quoteIds = quotes.map((row) => row.id);
  const [contacts, rooms] = await Promise.all([
    contactIds.length
      ? client().from("contacts").select("id, name").in("id", contactIds)
      : Promise.resolve({ data: [], error: null }),
    quoteIds.length
      ? client().from("costing_quote_rooms").select("id, quote_id").in("quote_id", quoteIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (contacts.error) return { rows: [], error: contacts.error.message };
  if (rooms.error) return { rows: [], error: rooms.error.message };
  const roomIds = (rooms.data ?? []).map((row) => row.id);
  const cabinets = roomIds.length
    ? await client()
        .from("costing_quote_cabinets")
        .select(
          "room_id, material_cost, labor_cost, door_cost, drawer_box_cost, finish_cost, hardware_cost, hardware_markup, total_cost"
        )
        .in("room_id", roomIds)
    : { data: [], error: null };
  if (cabinets.error) return { rows: [], error: cabinets.error.message };
  const contactName = new Map((contacts.data ?? []).map((row) => [row.id, row.name as string]));
  const roomsByQuote = new Map<string, string[]>();
  for (const room of rooms.data ?? []) {
    const list = roomsByQuote.get(room.quote_id) ?? [];
    list.push(room.id);
    roomsByQuote.set(room.quote_id, list);
  }
  return {
    rows: quotes.map((quote) => {
      const roomSet = new Set(roomsByQuote.get(quote.id) ?? []);
      const totals = (cabinets.data ?? [])
        .filter((row) => roomSet.has(row.room_id))
        .map((row) => ({
          materialCost: num(row.material_cost),
          laborCost: num(row.labor_cost),
          doorCost: num(row.door_cost),
          drawerBoxCost: num(row.drawer_box_cost),
          finishCost: num(row.finish_cost),
          hardwareCost: num(row.hardware_cost),
          hardwareMarkup: num(row.hardware_markup),
          totalCost: num(row.total_cost),
          laborMinutes: 0,
        }));
      const priced = priceQuote({ marginPct: num(quote.margin_pct), cabinets: totals });
      return {
        id: quote.id,
        name: quote.name,
        status: quote.status,
        margin_pct: num(quote.margin_pct),
        created_at: quote.created_at,
        contact_id: quote.contact_id,
        contact_name: quote.contact_id ? contactName.get(quote.contact_id) ?? null : null,
        total_cost: priced.totalCost,
        sell_price: priced.sellPrice,
      };
    }),
    error: null,
  };
}

export async function fetchContactNames(): Promise<{ id: string; name: string }[]> {
  const { data } = await client().from("contacts").select("id, name").order("name");
  return (data ?? []).map((row) => ({ id: row.id, name: row.name as string }));
}

export async function createQuote(input: {
  name: string;
  contact_id: string | null;
  margin_pct: number;
}): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await client()
    .from("costing_quotes")
    .insert({
      name: input.name.trim(),
      contact_id: input.contact_id,
      margin_pct: input.margin_pct,
      status: "draft",
      notes: "",
    })
    .select("id")
    .single();
  return { id: data?.id ?? null, error: error?.message ?? null };
}

export async function fetchQuote(id: string): Promise<{ row: CostingQuote | null; error: string | null }> {
  const { data, error } = await client().from("costing_quotes").select("*").eq("id", id).maybeSingle();
  if (error) return { row: null, error: error.message };
  if (!data) return { row: null, error: "Quote not found" };
  return {
    row: {
      id: data.id,
      name: data.name,
      contact_id: data.contact_id,
      margin_pct: num(data.margin_pct),
      status: data.status,
      notes: data.notes ?? "",
      created_at: data.created_at,
    },
    error: null,
  };
}

export async function saveQuote(
  id: string,
  patch: Partial<Pick<CostingQuote, "name" | "contact_id" | "margin_pct" | "status" | "notes">>
): Promise<string | null> {
  const { error } = await client().from("costing_quotes").update(patch).eq("id", id);
  return error?.message ?? null;
}

export async function deleteQuote(id: string): Promise<string | null> {
  const { error } = await client().from("costing_quotes").delete().eq("id", id);
  return error?.message ?? null;
}

export async function fetchRooms(quoteId: string): Promise<{ rows: QuoteRoom[]; error: string | null }> {
  const { data, error } = await client()
    .from("costing_quote_rooms")
    .select("*")
    .eq("quote_id", quoteId)
    .order("sort_order")
    .order("name");
  if (error) return { rows: [], error: error.message };
  return {
    rows: (data ?? []).map((row) => ({
      id: row.id,
      quote_id: row.quote_id,
      name: row.name,
      schedule_id: row.schedule_id,
      sort_order: num(row.sort_order),
    })),
    error: null,
  };
}

export async function saveRoom(input: {
  id?: string;
  quote_id: string;
  name: string;
  schedule_id: string | null;
  sort_order?: number;
}): Promise<string | null> {
  const payload = {
    quote_id: input.quote_id,
    name: input.name.trim(),
    schedule_id: input.schedule_id,
    ...(input.sort_order != null ? { sort_order: input.sort_order } : {}),
  };
  const query = input.id
    ? client().from("costing_quote_rooms").update(payload).eq("id", input.id)
    : client().from("costing_quote_rooms").insert(payload);
  const { error } = await query;
  return error?.message ?? null;
}

export async function deleteRoom(id: string): Promise<string | null> {
  const { error } = await client().from("costing_quote_rooms").delete().eq("id", id);
  return error?.message ?? null;
}

export async function fetchCabinets(roomIds: string[]): Promise<{ rows: QuoteCabinet[]; error: string | null }> {
  if (!roomIds.length) return { rows: [], error: null };
  const { data, error } = await client()
    .from("costing_quote_cabinets")
    .select("*")
    .in("room_id", roomIds)
    .order("created_at");
  if (error) return { rows: [], error: error.message };
  return { rows: (data ?? []).map(mapCabinet), error: null };
}

export async function fetchQuoteParts(cabinetIds: string[]): Promise<{ rows: SavedPart[]; error: string | null }> {
  if (!cabinetIds.length) return { rows: [], error: null };
  const { data, error } = await client()
    .from("costing_quote_cabinet_parts")
    .select("*")
    .in("cabinet_id", cabinetIds)
    .order("sort_order");
  if (error) return { rows: [], error: error.message };
  return { rows: (data ?? []).map(mapPart), error: null };
}

export async function fetchQuoteHardware(
  cabinetIds: string[]
): Promise<{ rows: SavedHardware[]; error: string | null }> {
  if (!cabinetIds.length) return { rows: [], error: null };
  const { data, error } = await client()
    .from("costing_quote_cabinet_hardware")
    .select("*")
    .in("cabinet_id", cabinetIds)
    .order("sort_order");
  if (error) return { rows: [], error: error.message };
  return { rows: (data ?? []).map(mapHardware), error: null };
}

export async function addCabinetFromTemplate(input: {
  roomId: string;
  templateId: string;
  label: string;
  height: number;
  width: number;
  depth: number;
  doors: number;
  drawers: number;
  shelves: number;
  quantity: number;
  baseLaborMinutes: number;
  scheduleOverrideId: string | null;
  notes: string;
}): Promise<{ id: string | null; error: string | null; warnings: string[] }> {
  const room = await client().from("costing_quote_rooms").select("schedule_id").eq("id", input.roomId).maybeSingle();
  if (room.error) return { id: null, error: room.error.message, warnings: [] };
  const scheduleId = input.scheduleOverrideId ?? room.data?.schedule_id ?? null;
  if (!scheduleId) return { id: null, error: "Pick a schedule for this room first.", warnings: [] };
  const built = await priceTemplate({
    templateId: input.templateId,
    scheduleId,
    height: input.height,
    width: input.width,
    depth: input.depth,
    doors: input.doors,
    drawers: input.drawers,
    shelves: input.shelves,
    quantity: input.quantity,
    baseLaborMinutes: input.baseLaborMinutes,
    laborRate: null,
  });
  if (built.error || !built.cost || built.laborRate == null) {
    return { id: null, error: built.error ?? "Could not price the cabinet", warnings: [] };
  }
  const inserted = await client()
    .from("costing_quote_cabinets")
    .insert({
      room_id: input.roomId,
      template_id: input.templateId,
      label: input.label.trim(),
      height: input.height,
      width: input.width,
      depth: input.depth,
      doors: input.doors,
      drawers: input.drawers,
      shelves: input.shelves,
      quantity: input.quantity,
      schedule_override_id: input.scheduleOverrideId,
      base_labor_minutes: input.baseLaborMinutes,
      notes: input.notes.trim(),
      labor_rate_used: built.laborRate,
      ...cabinetCostColumns(built.cost),
    })
    .select("id")
    .single();
  if (inserted.error || !inserted.data) {
    return { id: null, error: inserted.error?.message ?? "Could not save the cabinet", warnings: [] };
  }
  const saved = await insertLines(inserted.data.id, built.cost);
  if (saved) {
    await client().from("costing_quote_cabinets").delete().eq("id", inserted.data.id);
    return { id: null, error: saved, warnings: [] };
  }
  return { id: inserted.data.id, error: null, warnings: built.cost.errors };
}

export async function saveCabinetMeta(
  id: string,
  patch: { label?: string; notes?: string; schedule_override_id?: string | null }
): Promise<string | null> {
  const { error } = await client().from("costing_quote_cabinets").update(patch).eq("id", id);
  return error?.message ?? null;
}

export async function updateCabinetSize(
  id: string,
  size: CabinetSize
): Promise<{ error: string | null; warnings: string[] }> {
  const loaded = await loadFrozen(id);
  if (loaded.error || !loaded.cabinet) return { error: loaded.error ?? "Cabinet not found", warnings: [] };
  const rate = loaded.cabinet.labor_rate_used ?? (await currentRate());
  if (rate == null) return { error: "Shop settings are missing.", warnings: [] };
  const variables = await fetchVariables();
  if (variables.error) return { error: variables.error, warnings: [] };
  const cost = repriceFrozen({
    height: size.height,
    width: size.width,
    depth: size.depth,
    doors: size.doors,
    drawers: size.drawers,
    shelves: size.shelves,
    quantity: size.quantity,
    baseLaborMinutes: size.base_labor_minutes,
    laborRate: rate,
    variables: scopeFrom(variables.rows),
    parts: loaded.parts,
    hardware: loaded.hardware,
  });
  const message = await writeExisting(loaded.cabinet.id, cost, loaded.parts, loaded.hardware, {
    label: size.label?.trim() || loaded.cabinet.label,
    height: size.height,
    width: size.width,
    depth: size.depth,
    doors: size.doors,
    drawers: size.drawers,
    shelves: size.shelves,
    quantity: size.quantity,
    base_labor_minutes: size.base_labor_minutes,
    notes: size.notes?.trim() ?? loaded.cabinet.notes,
    labor_rate_used: rate,
  });
  return { error: message, warnings: cost.errors };
}

export async function deleteCabinet(id: string): Promise<string | null> {
  const { error } = await client().from("costing_quote_cabinets").delete().eq("id", id);
  return error?.message ?? null;
}

export async function addPartToCabinet(
  cabinetId: string,
  componentId: string
): Promise<{ error: string | null; warnings: string[] }> {
  const loaded = await loadFrozen(cabinetId);
  if (loaded.error || !loaded.cabinet) return { error: loaded.error ?? "Cabinet not found", warnings: [] };
  const scheduleId = await scheduleFor(loaded.cabinet);
  if (!scheduleId) return { error: "Pick a schedule for this room first.", warnings: [] };
  const library = await loadLibrary(scheduleId);
  if (library.error || !library.data) return { error: library.error ?? "Could not load the library", warnings: [] };
  const part = partFromComponent(componentId, library.data, library.items);
  if (!part) return { error: "That component is missing.", warnings: [] };
  const rate = loaded.cabinet.labor_rate_used ?? rateFrom(library.data.settings);
  const cost = repriceFrozen({
    ...sizeOf(loaded.cabinet),
    laborRate: rate,
    variables: scopeFrom(library.data.variables),
    parts: [...loaded.parts, blankRecord(part)],
    hardware: loaded.hardware,
  });
  const message = await writeExisting(cabinetId, cost, [...loaded.parts, unsavedPart()], loaded.hardware, {
    labor_rate_used: rate,
  });
  return { error: message, warnings: cost.errors };
}

export async function removePartFromCabinet(
  cabinetId: string,
  partId: string
): Promise<{ error: string | null; warnings: string[] }> {
  return removeLine(cabinetId, partId, "part");
}

export async function addHardwareToCabinet(
  cabinetId: string,
  hardwareId: string,
  qtyFormula: string
): Promise<{ error: string | null; warnings: string[] }> {
  const loaded = await loadFrozen(cabinetId);
  if (loaded.error || !loaded.cabinet) return { error: loaded.error ?? "Cabinet not found", warnings: [] };
  const hardware = await fetchHardware();
  if (hardware.error) return { error: hardware.error, warnings: [] };
  const item = hardware.rows.find((row) => row.id === hardwareId);
  if (!item) return { error: "That hardware is missing.", warnings: [] };
  const variables = await fetchVariables();
  if (variables.error) return { error: variables.error, warnings: [] };
  const settings = await fetchSettings();
  if (settings.error || !settings.row) return { error: settings.error ?? "Shop settings are missing.", warnings: [] };
  const rate = loaded.cabinet.labor_rate_used ?? rateFrom(settings.row);
  const added: QuoteHardwareRecord = {
    sort_order: loaded.hardware.length,
    name: item.name,
    qty_formula: qtyFormula.trim() || "1",
    resolved_qty: null,
    unit_cost: item.unit_cost,
    markup_pct: item.markup_pct,
    install_minutes: item.install_minutes,
    line_cost: 0,
    line_markup: 0,
  };
  const cost = repriceFrozen({
    ...sizeOf(loaded.cabinet),
    laborRate: rate,
    variables: scopeFrom(variables.rows),
    parts: loaded.parts,
    hardware: [...loaded.hardware, added],
  });
  const message = await writeExisting(cabinetId, cost, loaded.parts, [...loaded.hardware, unsavedHardware()], {
    labor_rate_used: rate,
  });
  return { error: message, warnings: cost.errors };
}

export async function removeHardwareFromCabinet(
  cabinetId: string,
  hardwareId: string
): Promise<{ error: string | null; warnings: string[] }> {
  return removeLine(cabinetId, hardwareId, "hardware");
}

export type CabinetPriceChange = {
  id: string;
  label: string;
  before: number;
  after: number;
  warnings: string[];
  kept: string[];
};

export async function previewRoomSchedule(
  roomId: string,
  scheduleId: string | null
): Promise<{ changes: CabinetPriceChange[]; skipped: number; error: string | null }> {
  const listed = await cabinetsInRoom(roomId);
  if (listed.error) return { changes: [], skipped: 0, error: listed.error };
  const affected = listed.rows.filter((row) => !row.schedule_override_id);
  const changes: CabinetPriceChange[] = [];
  for (const cabinet of affected) {
    const priced = await priceKeptLines(cabinet.id, scheduleId, "schedule", false);
    if (priced.error || !priced.change) return { changes: [], skipped: 0, error: priced.error ?? "Could not price a cabinet" };
    changes.push(priced.change);
  }
  return { changes, skipped: listed.rows.length - affected.length, error: null };
}

export async function commitRoomSchedule(
  roomId: string,
  scheduleId: string | null
): Promise<{ error: string | null; warnings: string[] }> {
  const listed = await cabinetsInRoom(roomId);
  if (listed.error) return { error: listed.error, warnings: [] };
  const warnings: string[] = [];
  for (const cabinet of listed.rows.filter((row) => !row.schedule_override_id)) {
    const priced = await priceKeptLines(cabinet.id, scheduleId, "schedule", true);
    if (priced.error) return { error: priced.error, warnings };
    warnings.push(...(priced.change?.warnings ?? []), ...(priced.change?.kept ?? []));
  }
  const { error } = await client().from("costing_quote_rooms").update({ schedule_id: scheduleId }).eq("id", roomId);
  return { error: error?.message ?? null, warnings };
}

export async function previewCabinetSchedule(
  cabinetId: string,
  scheduleOverrideId: string | null
): Promise<{ change: CabinetPriceChange | null; error: string | null }> {
  const scheduleId = await effectiveSchedule(cabinetId, scheduleOverrideId);
  if (scheduleId.error) return { change: null, error: scheduleId.error };
  if (!scheduleId.changed) return { change: null, error: null };
  return priceKeptLines(cabinetId, scheduleId.next, "schedule", false);
}

export async function commitCabinetSchedule(
  cabinetId: string,
  scheduleOverrideId: string | null
): Promise<{ error: string | null; warnings: string[] }> {
  const scheduleId = await effectiveSchedule(cabinetId, scheduleOverrideId);
  if (scheduleId.error) return { error: scheduleId.error, warnings: [] };
  const warnings: string[] = [];
  if (scheduleId.changed) {
    const priced = await priceKeptLines(cabinetId, scheduleId.next, "schedule", true);
    if (priced.error) return { error: priced.error, warnings: [] };
    warnings.push(...(priced.change?.warnings ?? []), ...(priced.change?.kept ?? []));
  }
  const message = await saveCabinetMeta(cabinetId, { schedule_override_id: scheduleOverrideId });
  return { error: message, warnings };
}

export async function previewRefresh(cabinetId: string): Promise<{
  before: number;
  after: number;
  error: string | null;
  warnings: string[];
  kept: string[];
}> {
  const scheduleId = await scheduleForId(cabinetId);
  if (scheduleId.error) return { before: 0, after: 0, error: scheduleId.error, warnings: [], kept: [] };
  const priced = await priceKeptLines(cabinetId, scheduleId.id, "refresh", false);
  if (priced.error || !priced.change) {
    return { before: 0, after: 0, error: priced.error ?? "Could not price the cabinet", warnings: [], kept: [] };
  }
  return {
    before: priced.change.before,
    after: priced.change.after,
    error: null,
    warnings: priced.change.warnings,
    kept: priced.change.kept,
  };
}

export async function commitRefresh(cabinetId: string): Promise<{ error: string | null; warnings: string[] }> {
  const scheduleId = await scheduleForId(cabinetId);
  if (scheduleId.error) return { error: scheduleId.error, warnings: [] };
  const priced = await priceKeptLines(cabinetId, scheduleId.id, "refresh", true);
  return {
    error: priced.error,
    warnings: [...(priced.change?.warnings ?? []), ...(priced.change?.kept ?? [])],
  };
}

async function priceTemplate(input: {
  templateId: string;
  scheduleId: string;
  height: number;
  width: number;
  depth: number;
  doors: number;
  drawers: number;
  shelves: number;
  quantity: number;
  baseLaborMinutes: number;
  laborRate: number | null;
  useTemplateLabor?: boolean;
}): Promise<{ cost: CabinetCost | null; laborRate: number | null; baseLaborMinutes: number; error: string | null }> {
  const [templates, parts, hardware, library] = await Promise.all([
    fetchTemplates(),
    fetchTemplateParts(input.templateId),
    fetchTemplateHardware(input.templateId),
    loadLibrary(input.scheduleId),
  ]);
  const error =
    templates.error ?? parts.error ?? hardware.error ?? library.error;
  if (error || !library.data) return { cost: null, laborRate: null, baseLaborMinutes: 0, error: error ?? "Could not load the library" };
  const template = templates.rows.find((row) => row.id === input.templateId);
  if (!template) return { cost: null, laborRate: null, baseLaborMinutes: 0, error: "That cabinet template is missing." };
  const partInputs: CabinetPartInput[] = [];
  for (const line of parts.rows) {
    const component = library.data.components.find((row) => row.id === line.component_id);
    if (!component) return { cost: null, laborRate: null, baseLaborMinutes: 0, error: "A part on this template is missing." };
    const built = partFromComponent(component.id, library.data, library.items, {
      lengthFormula: line.length_formula,
      widthFormula: line.width_formula,
      qtyFormula: line.qty_formula,
      laborMinutes: line.labor_minutes,
    });
    if (!built) return { cost: null, laborRate: null, baseLaborMinutes: 0, error: "A part on this template is missing." };
    partInputs.push(built);
  }
  const hardwareInputs = [];
  for (const line of hardware.rows) {
    const item = library.data.hardware.find((row) => row.id === line.hardware_id);
    if (!item) return { cost: null, laborRate: null, baseLaborMinutes: 0, error: "Hardware on this template is missing." };
    hardwareInputs.push({
      name: item.name,
      qtyFormula: line.qty_formula,
      unitCost: item.unit_cost,
      markupPct: item.markup_pct,
      installMinutes: item.install_minutes,
    });
  }
  const finishes = finishPair(library.data, library.items);
  const laborRate = input.laborRate ?? rateFrom(library.data.settings);
  const baseLaborMinutes = input.useTemplateLabor ? template.base_labor_minutes : input.baseLaborMinutes;
  const cost = calculateCabinet({
    height: input.height,
    width: input.width,
    depth: input.depth,
    doors: input.doors,
    drawers: input.drawers,
    shelves: input.shelves,
    quantity: input.quantity,
    baseLaborMinutes,
    variables: scopeFrom(library.data.variables),
    shopHourlyCost: laborRate,
    workerCount: 1,
    exteriorFinish: finishes.exterior,
    interiorFinish: finishes.interior,
    parts: partInputs,
    hardware: hardwareInputs,
  });
  return { cost, laborRate, baseLaborMinutes, error: null };
}

function partFromComponent(
  componentId: string,
  library: Library,
  items: {
    slot_id: string;
    material_id: string | null;
    door_style_id: string | null;
    drawer_box_style_id: string | null;
    finish_id: string | null;
  }[],
  override?: {
    lengthFormula: string | null;
    widthFormula: string | null;
    qtyFormula: string | null;
    laborMinutes: number | null;
  }
): CabinetPartInput | null {
  const component = library.components.find((row) => row.id === componentId);
  if (!component) return null;
  const slot = library.slots.find((row) => row.id === component.slot_id);
  if (!slot) return null;
  const choice = items.find((row) => row.slot_id === slot.id);
  const componentOverride = library.componentOverrides.find((row) => row.component_id === component.id);
  const choiceId = choiceIdForSlot(slot.slot_type, choice, componentOverride);
  const material =
    slot.slot_type === "material" ? library.materials.find((row) => row.id === choiceId) : undefined;
  const door = slot.slot_type === "door" ? library.doors.find((row) => row.id === choiceId) : undefined;
  const drawerBox =
    slot.slot_type === "drawer_box" ? library.drawerBoxes.find((row) => row.id === choiceId) : undefined;
  const finishes = finishesForPart(library, items, slot.slot_type, choiceId);
  return {
    name: component.name,
    slotName: slot.name,
    slotType: slot.slot_type,
    lengthFormula: override?.lengthFormula ?? component.length_formula,
    widthFormula: override?.widthFormula ?? component.width_formula,
    heightFormula: component.height_formula ?? "",
    qtyFormula: override?.qtyFormula ?? component.qty_formula,
    laborMinutes: override?.laborMinutes ?? component.labor_minutes,
    exteriorFinishSides: component.exterior_finish_sides,
    interiorFinishSides: component.interior_finish_sides,
    material: material
      ? {
          name: material.name,
          materialType: material.material_type,
          unitPrice: material.unit_price,
          wastePct: material.waste_pct,
          sheetLength: material.sheet_length,
          sheetWidth: material.sheet_width,
          thickness: material.thickness,
          roughThickness: material.rough_thickness,
        }
      : null,
    door: door ? { name: door.name, pricePerSqft: door.price_per_sqft } : null,
    drawerBox: drawerBox ? { name: drawerBox.name, pricePerCuft: drawerBox.price_per_cuft } : null,
    exteriorFinish: finishes.exterior,
    interiorFinish: finishes.interior,
  };
}

function finishesForPart(
  library: Library,
  items: { slot_id: string; finish_id: string | null }[],
  slotType: CostingSlot["slot_type"],
  choiceId: string | null
): { exterior: CostingFinish | null; interior: CostingFinish | null } {
  const pair = finishPair(library, items);
  if (slotType !== "exterior_finish" && slotType !== "interior_finish") return pair;
  const finish = library.finishes.find((row) => row.id === choiceId);
  if (!finish) return pair;
  const priced = { name: finish.name, pricePerSqft: finish.price_per_sqft };
  if (slotType === "exterior_finish") return { exterior: priced, interior: pair.interior };
  return { exterior: pair.exterior, interior: priced };
}

function finishPair(
  library: Library,
  items: { slot_id: string; finish_id: string | null }[]
): { exterior: CostingFinish | null; interior: CostingFinish | null } {
  return {
    exterior: finishFor(library, items, "exterior_finish"),
    interior: finishFor(library, items, "interior_finish"),
  };
}

function finishFor(
  library: Library,
  items: { slot_id: string; finish_id: string | null }[],
  slotType: "exterior_finish" | "interior_finish"
): CostingFinish | null {
  const slot = library.slots.find((row) => row.slot_type === slotType);
  if (!slot) return null;
  const choice = items.find((row) => row.slot_id === slot.id);
  const finish = library.finishes.find((row) => row.id === choice?.finish_id);
  if (!finish) return null;
  return { name: finish.name, pricePerSqft: finish.price_per_sqft };
}

async function priceKeptLines(
  cabinetId: string,
  scheduleId: string | null,
  mode: "schedule" | "refresh",
  write: boolean
): Promise<{ change: CabinetPriceChange | null; error: string | null }> {
  const loaded = await loadFrozen(cabinetId);
  if (loaded.error || !loaded.cabinet) return { change: null, error: loaded.error ?? "Cabinet not found" };
  const library = await loadLibrary(scheduleId);
  if (library.error || !library.data) return { change: null, error: library.error ?? "Could not load the library" };
  const laborRate =
    mode === "refresh"
      ? rateFrom(library.data.settings)
      : loaded.cabinet.labor_rate_used ?? rateFrom(library.data.settings);
  const finishes = finishPair(library.data, library.items);
  const priced = quoteWithCurrentPrices({
    frozen: {
      ...sizeOf(loaded.cabinet),
      laborRate,
      variables: scopeFrom(library.data.variables),
      parts: loaded.parts,
      hardware: loaded.hardware,
    },
    choices: choicesFrom(library.data, library.items),
    partChoices: partChoicesFrom(library.data, library.items),
    exteriorFinish: finishes.exterior,
    interiorFinish: finishes.interior,
    hardwarePrices:
      mode === "refresh"
        ? library.data.hardware.map((row) => ({
            name: row.name,
            unitCost: row.unit_cost,
            markupPct: row.markup_pct,
            installMinutes: row.install_minutes,
          }))
        : null,
  });
  if (write) {
    const message = await writeExisting(loaded.cabinet.id, priced.cost, loaded.parts, loaded.hardware, {
      labor_rate_used: laborRate,
    });
    if (message) return { change: null, error: message };
  }
  return {
    change: {
      id: loaded.cabinet.id,
      label: loaded.cabinet.label,
      before: loaded.cabinet.total_cost,
      after: priced.cost.total.totalCost,
      warnings: [...priced.notes, ...priced.cost.errors],
      kept: priced.kept,
    },
    error: null,
  };
}

function choicesFrom(
  library: Library,
  items: {
    slot_id: string;
    material_id: string | null;
    door_style_id: string | null;
    drawer_box_style_id?: string | null;
  }[]
): SlotChoice[] {
  return library.slots
    .filter((slot) => slot.slot_type === "material" || slot.slot_type === "door" || slot.slot_type === "drawer_box")
    .map((slot) => {
      const choice = items.find((row) => row.slot_id === slot.id);
      const material =
        slot.slot_type === "material"
          ? library.materials.find((row) => row.id === choice?.material_id)
          : undefined;
      const door =
        slot.slot_type === "door" ? library.doors.find((row) => row.id === choice?.door_style_id) : undefined;
      const drawerBox =
        slot.slot_type === "drawer_box"
          ? library.drawerBoxes.find((row) => row.id === choice?.drawer_box_style_id)
          : undefined;
      return {
        slotName: slot.name,
        slotType: slot.slot_type,
        material: material
          ? {
              name: material.name,
              materialType: material.material_type,
              unitPrice: material.unit_price,
              wastePct: material.waste_pct,
              sheetLength: material.sheet_length,
              sheetWidth: material.sheet_width,
              thickness: material.thickness,
              roughThickness: material.rough_thickness,
            }
          : null,
        door: door ? { name: door.name, pricePerSqft: door.price_per_sqft } : null,
        drawerBox: drawerBox ? { name: drawerBox.name, pricePerCuft: drawerBox.price_per_cuft } : null,
      };
    });
}

function partChoicesFrom(
  library: Library,
  items: Array<ScheduleChoiceRef & { slot_id: string }>
): Array<SlotChoice & { partName: string }> {
  return library.componentOverrides.flatMap((override) => {
    const component = library.components.find((row) => row.id === override.component_id);
    if (!component) return [];
    const slot = library.slots.find((row) => row.id === component.slot_id);
    if (!slot || (slot.slot_type !== "material" && slot.slot_type !== "door" && slot.slot_type !== "drawer_box")) {
      return [];
    }
    const slotDefault = items.find((row) => row.slot_id === slot.id);
    const choiceId = choiceIdForSlot(slot.slot_type, slotDefault, override);
    const material =
      slot.slot_type === "material" ? library.materials.find((row) => row.id === choiceId) : undefined;
    const door = slot.slot_type === "door" ? library.doors.find((row) => row.id === choiceId) : undefined;
    const drawerBox =
      slot.slot_type === "drawer_box" ? library.drawerBoxes.find((row) => row.id === choiceId) : undefined;
    return [
      {
        partName: component.name,
        slotName: slot.name,
        slotType: slot.slot_type,
        material: material
          ? {
              name: material.name,
              materialType: material.material_type,
              unitPrice: material.unit_price,
              wastePct: material.waste_pct,
              sheetLength: material.sheet_length,
              sheetWidth: material.sheet_width,
              thickness: material.thickness,
              roughThickness: material.rough_thickness,
            }
          : null,
        door: door ? { name: door.name, pricePerSqft: door.price_per_sqft } : null,
        drawerBox: drawerBox ? { name: drawerBox.name, pricePerCuft: drawerBox.price_per_cuft } : null,
      },
    ];
  });
}

async function cabinetsInRoom(roomId: string): Promise<{ rows: QuoteCabinet[]; error: string | null }> {
  return fetchCabinets([roomId]);
}

async function effectiveSchedule(
  cabinetId: string,
  scheduleOverrideId: string | null
): Promise<{ next: string | null; changed: boolean; error: string | null }> {
  const loaded = await loadFrozen(cabinetId);
  if (loaded.error || !loaded.cabinet) return { next: null, changed: false, error: loaded.error ?? "Cabinet not found" };
  const room = await client()
    .from("costing_quote_rooms")
    .select("schedule_id")
    .eq("id", loaded.cabinet.room_id)
    .maybeSingle();
  if (room.error) return { next: null, changed: false, error: room.error.message };
  const roomSchedule = room.data?.schedule_id ?? null;
  const current = loaded.cabinet.schedule_override_id ?? roomSchedule;
  const next = scheduleOverrideId ?? roomSchedule;
  return { next, changed: next !== current, error: null };
}

async function scheduleForId(cabinetId: string): Promise<{ id: string | null; error: string | null }> {
  const loaded = await loadFrozen(cabinetId);
  if (loaded.error || !loaded.cabinet) return { id: null, error: loaded.error ?? "Cabinet not found" };
  return { id: await scheduleFor(loaded.cabinet), error: null };
}

async function loadLibrary(scheduleId: string | null): Promise<{
  data: Library | null;
  items: {
    slot_id: string;
    material_id: string | null;
    door_style_id: string | null;
    drawer_box_style_id: string | null;
    finish_id: string | null;
  }[];
  error: string | null;
}> {
  const [components, slots, items, overrides, materials, doors, drawerBoxes, finishes, hardware, settings, variables] =
    await Promise.all([
      fetchComponents(),
      fetchSlots(),
      scheduleId
        ? fetchScheduleItems(scheduleId)
        : Promise.resolve({
            rows: [] as {
              slot_id: string;
              material_id: string | null;
              door_style_id: string | null;
              drawer_box_style_id: string | null;
              finish_id: string | null;
            }[],
            error: null,
          }),
      scheduleId
        ? fetchScheduleOverrides(scheduleId)
        : Promise.resolve({ rows: [] as CostingScheduleComponentOverride[], error: null }),
      fetchMaterials(),
      fetchDoors(),
      fetchDrawerBoxes(),
      fetchFinishes(),
      fetchHardware(),
      fetchSettings(),
      fetchVariables(),
    ]);
  const error =
    components.error ??
    slots.error ??
    items.error ??
    overrides.error ??
    materials.error ??
    doors.error ??
    drawerBoxes.error ??
    finishes.error ??
    hardware.error ??
    settings.error ??
    variables.error;
  if (error || !settings.row) return { data: null, items: [], error: error ?? "Shop settings are missing." };
  return {
    data: {
      components: components.rows,
      slots: slots.rows,
      componentOverrides: overrides.rows,
      materials: materials.rows,
      doors: doors.rows,
      drawerBoxes: drawerBoxes.rows,
      finishes: finishes.rows,
      hardware: hardware.rows,
      settings: settings.row,
      variables: variables.rows,
    },
    items: items.rows,
    error: null,
  };
}

async function loadFrozen(cabinetId: string): Promise<{
  cabinet: QuoteCabinet | null;
  parts: SavedPart[];
  hardware: SavedHardware[];
  error: string | null;
}> {
  const cabinet = await client().from("costing_quote_cabinets").select("*").eq("id", cabinetId).maybeSingle();
  if (cabinet.error) return { cabinet: null, parts: [], hardware: [], error: cabinet.error.message };
  if (!cabinet.data) return { cabinet: null, parts: [], hardware: [], error: "Cabinet not found" };
  const [parts, hardware] = await Promise.all([
    fetchQuoteParts([cabinetId]),
    fetchQuoteHardware([cabinetId]),
  ]);
  return {
    cabinet: mapCabinet(cabinet.data),
    parts: parts.rows,
    hardware: hardware.rows,
    error: parts.error ?? hardware.error,
  };
}

async function scheduleFor(cabinet: QuoteCabinet): Promise<string | null> {
  if (cabinet.schedule_override_id) return cabinet.schedule_override_id;
  const room = await client().from("costing_quote_rooms").select("schedule_id").eq("id", cabinet.room_id).maybeSingle();
  if (room.error || !room.data) return null;
  return room.data.schedule_id;
}

async function currentRate(): Promise<number | null> {
  const settings = await fetchSettings();
  if (!settings.row) return null;
  return rateFrom(settings.row);
}

function sizeOf(cabinet: QuoteCabinet) {
  return {
    height: cabinet.height,
    width: cabinet.width,
    depth: cabinet.depth,
    doors: cabinet.doors,
    drawers: cabinet.drawers,
    shelves: cabinet.shelves,
    quantity: cabinet.quantity,
    baseLaborMinutes: cabinet.base_labor_minutes,
  };
}

function blankRecord(part: CabinetPartInput): QuotePartRecord {
  const cost = calculateCabinet({
    height: 1,
    width: 1,
    depth: 1,
    doors: 0,
    drawers: 0,
    shelves: 0,
    quantity: 1,
    baseLaborMinutes: 0,
    variables: {},
    shopHourlyCost: 0,
    workerCount: 1,
    exteriorFinish: null,
    interiorFinish: null,
    parts: [part],
    hardware: [],
  });
  return partRecordFromLine(cost.parts[0], 0);
}

function unsavedPart(): SavedPart {
  return { ...blankId(), id: "", cabinet_id: "" };
}

function unsavedHardware(): SavedHardware {
  return {
    id: "",
    cabinet_id: "",
    sort_order: 0,
    name: "",
    qty_formula: "1",
    resolved_qty: null,
    unit_cost: 0,
    markup_pct: 0,
    install_minutes: 0,
    line_cost: 0,
    line_markup: 0,
  };
}

function blankId(): QuotePartRecord {
  return {
    sort_order: 0,
    name: "",
    slot_name: "",
    slot_type: "material",
    length_formula: "1",
    width_formula: "1",
    qty_formula: "1",
    height_formula: "",
    resolved_length: null,
    resolved_width: null,
    resolved_height: null,
    resolved_qty: null,
    material_name: null,
    material_type: null,
    material_unit_price: null,
    material_waste_pct: null,
    sheet_length: null,
    sheet_width: null,
    thickness: null,
    rough_thickness: null,
    door_style_name: null,
    door_price_per_sqft: null,
    drawer_box_name: null,
    drawer_box_price_per_cuft: null,
    exterior_finish_name: null,
    exterior_finish_price_per_sqft: null,
    interior_finish_name: null,
    interior_finish_price_per_sqft: null,
    exterior_finish_sides: 0,
    interior_finish_sides: 0,
    quantity_used: null,
    quantity_unit: null,
    material_cost: 0,
    door_cost: 0,
    drawer_box_cost: 0,
    finish_cost: 0,
    labor_minutes: 0,
  };
}

async function removeLine(
  cabinetId: string,
  lineId: string,
  kind: "part" | "hardware"
): Promise<{ error: string | null; warnings: string[] }> {
  const loaded = await loadFrozen(cabinetId);
  if (loaded.error || !loaded.cabinet) return { error: loaded.error ?? "Cabinet not found", warnings: [] };
  const variables = await fetchVariables();
  if (variables.error) return { error: variables.error, warnings: [] };
  const settings = await fetchSettings();
  if (!settings.row) return { error: settings.error ?? "Shop settings are missing.", warnings: [] };
  const parts = kind === "part" ? loaded.parts.filter((row) => row.id !== lineId) : loaded.parts;
  const hardware = kind === "hardware" ? loaded.hardware.filter((row) => row.id !== lineId) : loaded.hardware;
  const rate = loaded.cabinet.labor_rate_used ?? rateFrom(settings.row);
  const cost = repriceFrozen({
    ...sizeOf(loaded.cabinet),
    laborRate: rate,
    variables: scopeFrom(variables.rows),
    parts,
    hardware,
  });
  const message = await writeExisting(cabinetId, cost, parts, hardware, { labor_rate_used: rate });
  if (message) return { error: message, warnings: [] };
  const table = kind === "part" ? "costing_quote_cabinet_parts" : "costing_quote_cabinet_hardware";
  const removed = await client().from(table).delete().eq("id", lineId);
  return { error: removed.error?.message ?? null, warnings: cost.errors };
}

async function writeExisting(
  cabinetId: string,
  cost: CabinetCost,
  parts: Array<{ id: string }>,
  hardware: Array<{ id: string }>,
  cabinetPatch: Record<string, unknown>
): Promise<string | null> {
  for (let index = 0; index < cost.parts.length; index += 1) {
    const record = partRecordFromLine(cost.parts[index], index);
    const id = parts[index]?.id;
    const result = id
      ? await client().from("costing_quote_cabinet_parts").update(record).eq("id", id)
      : await client().from("costing_quote_cabinet_parts").insert({ ...record, cabinet_id: cabinetId });
    if (result.error) return result.error.message;
  }
  for (let index = 0; index < cost.hardware.length; index += 1) {
    const record = hardwareRecordFromLine(cost.hardware[index], index);
    const id = hardware[index]?.id;
    const result = id
      ? await client().from("costing_quote_cabinet_hardware").update(record).eq("id", id)
      : await client().from("costing_quote_cabinet_hardware").insert({ ...record, cabinet_id: cabinetId });
    if (result.error) return result.error.message;
  }
  const { error } = await client()
    .from("costing_quote_cabinets")
    .update({ ...cabinetPatch, ...cabinetCostColumns(cost) })
    .eq("id", cabinetId);
  return error?.message ?? null;
}

async function insertLines(cabinetId: string, cost: CabinetCost): Promise<string | null> {
  if (cost.parts.length) {
    const { error } = await client()
      .from("costing_quote_cabinet_parts")
      .insert(cost.parts.map((line, index) => ({ ...partRecordFromLine(line, index), cabinet_id: cabinetId })));
    if (error) return error.message;
  }
  if (cost.hardware.length) {
    const { error } = await client()
      .from("costing_quote_cabinet_hardware")
      .insert(
        cost.hardware.map((line, index) => ({
          ...hardwareRecordFromLine(line, index),
          cabinet_id: cabinetId,
        }))
      );
    if (error) return error.message;
  }
  return null;
}

function mapCabinet(row: {
  id: string;
  room_id: string;
  template_id: string | null;
  label: string;
  height: unknown;
  width: unknown;
  depth: unknown;
  doors: unknown;
  drawers: unknown;
  shelves: unknown;
  quantity: unknown;
  schedule_override_id: string | null;
  base_labor_minutes: unknown;
  material_cost: unknown;
  labor_cost: unknown;
  door_cost: unknown;
  drawer_box_cost: unknown;
  finish_cost: unknown;
  hardware_cost: unknown;
  hardware_markup: unknown;
  total_cost: unknown;
  labor_rate_used: unknown;
  notes: string | null;
  updated_at: string;
}): QuoteCabinet {
  return {
    id: row.id,
    room_id: row.room_id,
    template_id: row.template_id,
    label: row.label,
    height: num(row.height),
    width: num(row.width),
    depth: num(row.depth),
    doors: num(row.doors),
    drawers: num(row.drawers),
    shelves: num(row.shelves),
    quantity: num(row.quantity, 1),
    schedule_override_id: row.schedule_override_id,
    base_labor_minutes: num(row.base_labor_minutes),
    material_cost: num(row.material_cost),
    labor_cost: num(row.labor_cost),
    door_cost: num(row.door_cost),
    drawer_box_cost: num(row.drawer_box_cost),
    finish_cost: num(row.finish_cost),
    hardware_cost: num(row.hardware_cost),
    hardware_markup: num(row.hardware_markup),
    total_cost: num(row.total_cost),
    labor_rate_used: numOrNull(row.labor_rate_used),
    notes: row.notes ?? "",
    updated_at: row.updated_at,
  };
}

function mapPart(row: QuotePartRecord & { id: string; cabinet_id: string }): SavedPart {
  return {
    ...row,
    id: row.id,
    cabinet_id: row.cabinet_id,
    sort_order: num(row.sort_order),
    height_formula: row.height_formula ?? "",
    resolved_length: numOrNull(row.resolved_length),
    resolved_width: numOrNull(row.resolved_width),
    resolved_height: numOrNull(row.resolved_height),
    resolved_qty: numOrNull(row.resolved_qty),
    material_unit_price: numOrNull(row.material_unit_price),
    material_waste_pct: numOrNull(row.material_waste_pct),
    sheet_length: numOrNull(row.sheet_length),
    sheet_width: numOrNull(row.sheet_width),
    thickness: numOrNull(row.thickness),
    rough_thickness: numOrNull(row.rough_thickness),
    door_price_per_sqft: numOrNull(row.door_price_per_sqft),
    drawer_box_name: row.drawer_box_name ?? null,
    drawer_box_price_per_cuft: numOrNull(row.drawer_box_price_per_cuft),
    exterior_finish_price_per_sqft: numOrNull(row.exterior_finish_price_per_sqft),
    interior_finish_price_per_sqft: numOrNull(row.interior_finish_price_per_sqft),
    exterior_finish_sides: num(row.exterior_finish_sides),
    interior_finish_sides: num(row.interior_finish_sides),
    quantity_used: numOrNull(row.quantity_used),
    material_cost: num(row.material_cost),
    door_cost: num(row.door_cost),
    drawer_box_cost: num(row.drawer_box_cost),
    finish_cost: num(row.finish_cost),
    labor_minutes: num(row.labor_minutes),
  };
}

function mapHardware(row: QuoteHardwareRecord & { id: string; cabinet_id: string }): SavedHardware {
  return {
    ...row,
    id: row.id,
    cabinet_id: row.cabinet_id,
    sort_order: num(row.sort_order),
    resolved_qty: numOrNull(row.resolved_qty),
    unit_cost: num(row.unit_cost),
    markup_pct: num(row.markup_pct),
    install_minutes: num(row.install_minutes),
    line_cost: num(row.line_cost),
    line_markup: num(row.line_markup),
  };
}
