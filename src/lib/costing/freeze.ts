/**
 * Turn a calculated cabinet into quote rows, and price those rows again
 * without looking up the library.
 */

import {
  calculateCabinet,
  type CabinetCost,
  type CostingDoor,
  type CostingDrawerBox,
  type CostingFinish,
  type CostingMaterial,
  type HardwareCostLine,
  type MaterialType,
  type PartCostLine,
  type SlotType,
} from "./calculate.ts";
import type { FormulaScope } from "./formula.ts";

export type QuotePartRecord = {
  sort_order: number;
  name: string;
  slot_name: string;
  slot_type: SlotType;
  length_formula: string;
  width_formula: string;
  height_formula: string;
  qty_formula: string;
  resolved_length: number | null;
  resolved_width: number | null;
  resolved_height: number | null;
  resolved_qty: number | null;
  material_name: string | null;
  material_type: MaterialType | null;
  material_unit_price: number | null;
  material_waste_pct: number | null;
  sheet_length: number | null;
  sheet_width: number | null;
  thickness: number | null;
  rough_thickness: number | null;
  door_style_name: string | null;
  door_price_per_sqft: number | null;
  drawer_box_name: string | null;
  drawer_box_price_per_cuft: number | null;
  exterior_finish_name: string | null;
  exterior_finish_price_per_sqft: number | null;
  interior_finish_name: string | null;
  interior_finish_price_per_sqft: number | null;
  exterior_finish_sides: number;
  interior_finish_sides: number;
  quantity_used: number | null;
  quantity_unit: string | null;
  material_cost: number;
  door_cost: number;
  drawer_box_cost: number;
  finish_cost: number;
  /** Minutes for one piece, so a later quantity change can scale it. */
  labor_minutes: number;
};

export type QuoteHardwareRecord = {
  sort_order: number;
  name: string;
  qty_formula: string;
  resolved_qty: number | null;
  unit_cost: number;
  markup_pct: number;
  /** Minutes to install one piece. */
  install_minutes: number;
  line_cost: number;
  line_markup: number;
};

export type FrozenCabinetInput = {
  height: number;
  width: number;
  depth: number;
  doors: number;
  drawers: number;
  shelves: number;
  quantity: number;
  baseLaborMinutes: number;
  /** Dollars per person-hour captured when the cabinet was priced. */
  laborRate: number;
  variables: FormulaScope;
  parts: QuotePartRecord[];
  hardware: QuoteHardwareRecord[];
};

export function partRecordFromLine(line: PartCostLine, sortOrder: number): QuotePartRecord {
  return {
    sort_order: sortOrder,
    name: line.name,
    slot_name: line.slotName,
    slot_type: line.slotType,
    length_formula: line.lengthFormula,
    width_formula: line.widthFormula,
    height_formula: line.heightFormula,
    qty_formula: line.qtyFormula,
    resolved_length: line.length,
    resolved_width: line.width,
    resolved_height: line.height,
    resolved_qty: line.qty,
    material_name: line.materialName,
    material_type: line.materialType,
    material_unit_price: line.materialUnitPrice,
    material_waste_pct: line.materialWastePct,
    sheet_length: line.sheetLength,
    sheet_width: line.sheetWidth,
    thickness: line.thickness,
    rough_thickness: line.roughThickness,
    door_style_name: line.doorName,
    door_price_per_sqft: line.doorPricePerSqft,
    drawer_box_name: line.drawerBoxName,
    drawer_box_price_per_cuft: line.drawerBoxPricePerCuft,
    exterior_finish_name: line.exteriorFinishName,
    exterior_finish_price_per_sqft: line.exteriorFinishPricePerSqft,
    interior_finish_name: line.interiorFinishName,
    interior_finish_price_per_sqft: line.interiorFinishPricePerSqft,
    exterior_finish_sides: line.exteriorFinishSides,
    interior_finish_sides: line.interiorFinishSides,
    quantity_used: line.quantityUsed,
    quantity_unit: line.quantityUnit,
    material_cost: line.materialCost,
    door_cost: line.doorCost,
    drawer_box_cost: line.drawerBoxCost,
    finish_cost: line.finishCost,
    labor_minutes: line.laborMinutesEach,
  };
}

export function hardwareRecordFromLine(
  line: HardwareCostLine,
  sortOrder: number
): QuoteHardwareRecord {
  return {
    sort_order: sortOrder,
    name: line.name,
    qty_formula: line.qtyFormula,
    resolved_qty: line.qty,
    unit_cost: line.unitCost,
    markup_pct: line.markupPct,
    install_minutes: line.installMinutesEach,
    line_cost: line.lineCost,
    line_markup: line.lineMarkup,
  };
}

/** Extended totals for one quoted cabinet, including its quantity. */
export function cabinetCostColumns(cost: CabinetCost) {
  return {
    material_cost: cost.total.materialCost,
    labor_cost: cost.total.laborCost,
    door_cost: cost.total.doorCost,
    drawer_box_cost: cost.total.drawerBoxCost,
    finish_cost: cost.total.finishCost,
    hardware_cost: cost.total.hardwareCost,
    hardware_markup: cost.total.hardwareMarkup,
    total_cost: cost.total.totalCost,
  };
}

/** Recalculate from the prices stored on the quote. Library prices are not read. */
export function repriceFrozen(input: FrozenCabinetInput): CabinetCost {
  return calculateCabinet({
    height: input.height,
    width: input.width,
    depth: input.depth,
    doors: input.doors,
    drawers: input.drawers,
    shelves: input.shelves,
    quantity: input.quantity,
    baseLaborMinutes: input.baseLaborMinutes,
    variables: input.variables,
    shopHourlyCost: input.laborRate,
    workerCount: 1,
    exteriorFinish: null,
    interiorFinish: null,
    parts: input.parts.map((part) => ({
      name: part.name,
      slotName: part.slot_name,
      slotType: part.slot_type,
      lengthFormula: part.length_formula,
      widthFormula: part.width_formula,
      heightFormula: part.height_formula,
      qtyFormula: part.qty_formula,
      laborMinutes: part.labor_minutes,
      exteriorFinishSides: part.exterior_finish_sides,
      interiorFinishSides: part.interior_finish_sides,
      material: materialFromRecord(part),
      door: doorFromRecord(part),
      drawerBox: drawerBoxFromRecord(part),
      exteriorFinish: finishFrom(part.exterior_finish_name, part.exterior_finish_price_per_sqft),
      interiorFinish: finishFrom(part.interior_finish_name, part.interior_finish_price_per_sqft),
    })),
    hardware: input.hardware.map((item) => ({
      name: item.name,
      qtyFormula: item.qty_formula,
      unitCost: item.unit_cost,
      markupPct: item.markup_pct,
      installMinutes: item.install_minutes,
    })),
  });
}

export type SlotChoice = {
  slotName: string;
  slotType: SlotType;
  material: CostingMaterial | null;
  door: CostingDoor | null;
  drawerBox: CostingDrawerBox | null;
};

export type HardwarePrice = {
  name: string;
  unitCost: number;
  markupPct: number;
  installMinutes: number;
};

/**
 * Keep the quote's parts and hardware. Replace prices from the schedule
 * and, when hardwarePrices is set, from the hardware library.
 * A line that cannot be matched keeps its saved price.
 */
export function quoteWithCurrentPrices(input: {
  frozen: FrozenCabinetInput;
  choices: SlotChoice[];
  /** A component override replaces the slot default for that part name. */
  partChoices?: Array<SlotChoice & { partName: string }>;
  exteriorFinish: CostingFinish | null;
  interiorFinish: CostingFinish | null;
  hardwarePrices: HardwarePrice[] | null;
}): { cost: CabinetCost; kept: string[]; notes: string[] } {
  const kept: string[] = [];
  const notes: string[] = [];
  const parts = input.frozen.parts.map((part) => {
    const specific = input.partChoices?.find(
      (row) => row.partName === part.name && row.slotName === part.slot_name
    );
    const choice = specific ?? input.choices.find((row) => row.slotName === part.slot_name);
    if (!choice) {
      kept.push(`${part.name} keeps its saved price because the ${part.slot_name} slot is gone.`);
      return part;
    }
    if (choice.slotType !== part.slot_type) {
      kept.push(
        `${part.name} keeps its saved price because ${part.slot_name} is no longer the same kind of slot.`
      );
      return part;
    }
    if (choice.slotType === "door") {
      if (!choice.door) notes.push(`${part.name} has no door style on this schedule.`);
      return applyDoor(part, choice.door, input.exteriorFinish, input.interiorFinish);
    }
    if (choice.slotType === "drawer_box") {
      if (!choice.drawerBox) notes.push(`${part.name} has no drawer box style on this schedule.`);
      return applyDrawerBox(part, choice.drawerBox, input.exteriorFinish, input.interiorFinish);
    }
    if (choice.slotType === "material") {
      if (!choice.material) notes.push(`${part.name} has no material on this schedule.`);
      return applyMaterial(part, choice.material, input.exteriorFinish, input.interiorFinish);
    }
    kept.push(`${part.name} keeps its saved price because ${part.slot_name} is not priced by a schedule.`);
    return part;
  });
  const hardware = input.frozen.hardware.map((item) => {
    if (!input.hardwarePrices) return item;
    const price = input.hardwarePrices.find((row) => row.name === item.name);
    if (!price) {
      kept.push(`${item.name} keeps its saved price because it is no longer in the hardware library.`);
      return item;
    }
    return {
      ...item,
      unit_cost: price.unitCost,
      markup_pct: price.markupPct,
      install_minutes: price.installMinutes,
    };
  });
  return {
    cost: repriceFrozen({ ...input.frozen, parts, hardware }),
    kept,
    notes,
  };
}

function applyMaterial(
  part: QuotePartRecord,
  material: CostingMaterial | null,
  exterior: CostingFinish | null,
  interior: CostingFinish | null
): QuotePartRecord {
  return {
    ...part,
    ...finishFields(exterior, interior),
    material_name: material?.name ?? null,
    material_type: material?.materialType ?? null,
    material_unit_price: material?.unitPrice ?? null,
    material_waste_pct: material?.wastePct ?? null,
    sheet_length: material?.sheetLength ?? null,
    sheet_width: material?.sheetWidth ?? null,
    thickness: material?.thickness ?? null,
    rough_thickness: material?.roughThickness ?? null,
    door_style_name: null,
    door_price_per_sqft: null,
    drawer_box_name: null,
    drawer_box_price_per_cuft: null,
  };
}

function applyDoor(
  part: QuotePartRecord,
  door: CostingDoor | null,
  exterior: CostingFinish | null,
  interior: CostingFinish | null
): QuotePartRecord {
  return {
    ...part,
    ...finishFields(exterior, interior),
    material_name: null,
    material_type: null,
    material_unit_price: null,
    material_waste_pct: null,
    sheet_length: null,
    sheet_width: null,
    thickness: null,
    rough_thickness: null,
    door_style_name: door?.name ?? null,
    door_price_per_sqft: door?.pricePerSqft ?? null,
    drawer_box_name: null,
    drawer_box_price_per_cuft: null,
  };
}

function applyDrawerBox(
  part: QuotePartRecord,
  drawerBox: CostingDrawerBox | null,
  exterior: CostingFinish | null,
  interior: CostingFinish | null
): QuotePartRecord {
  return {
    ...part,
    ...finishFields(exterior, interior),
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
    drawer_box_name: drawerBox?.name ?? null,
    drawer_box_price_per_cuft: drawerBox?.pricePerCuft ?? null,
  };
}

function finishFields(exterior: CostingFinish | null, interior: CostingFinish | null) {
  return {
    exterior_finish_name: exterior?.name ?? null,
    exterior_finish_price_per_sqft: exterior?.pricePerSqft ?? null,
    interior_finish_name: interior?.name ?? null,
    interior_finish_price_per_sqft: interior?.pricePerSqft ?? null,
  };
}

function materialFromRecord(part: QuotePartRecord): CostingMaterial | null {
  if (!part.material_name || !part.material_type || part.material_unit_price == null) return null;
  return {
    name: part.material_name,
    materialType: part.material_type,
    unitPrice: part.material_unit_price,
    wastePct: part.material_waste_pct ?? 0,
    sheetLength: part.sheet_length,
    sheetWidth: part.sheet_width,
    thickness: part.thickness,
    roughThickness: part.rough_thickness,
  };
}

function doorFromRecord(part: QuotePartRecord): CostingDoor | null {
  if (!part.door_style_name || part.door_price_per_sqft == null) return null;
  return { name: part.door_style_name, pricePerSqft: part.door_price_per_sqft };
}

function drawerBoxFromRecord(part: QuotePartRecord): CostingDrawerBox | null {
  if (!part.drawer_box_name || part.drawer_box_price_per_cuft == null) return null;
  return { name: part.drawer_box_name, pricePerCuft: part.drawer_box_price_per_cuft };
}

function finishFrom(name: string | null, price: number | null): CostingFinish | null {
  if (!name || price == null) return null;
  return { name, pricePerSqft: price };
}
