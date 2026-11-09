/**
 * Cabinet cost from parts, hardware, and a resolved material schedule.
 * Money is full precision. Use roundMoney for display.
 * Percents are whole numbers: 15 means 15%.
 */

import { cabinetScope, evaluateFormula, type FormulaScope } from "./formula.ts";

export type MaterialType = "sheet" | "lumber" | "sqft" | "linear_ft" | "each";
export type SlotType = "material" | "door" | "drawer_box" | "exterior_finish" | "interior_finish";
export type QuantityUnit = "sqft" | "board_ft" | "linear_ft" | "each" | "cuft";

export type CostingMaterial = {
  name: string;
  materialType: MaterialType;
  unitPrice: number;
  wastePct: number;
  sheetLength: number | null;
  sheetWidth: number | null;
  thickness: number | null;
  roughThickness: number | null;
};

export type CostingDoor = {
  name: string;
  pricePerSqft: number;
};

export type CostingDrawerBox = {
  name: string;
  pricePerCuft: number;
};

export type CostingFinish = {
  name: string;
  pricePerSqft: number;
};

export type CabinetPartInput = {
  name: string;
  slotName: string;
  slotType: SlotType;
  lengthFormula: string;
  widthFormula: string;
  /** Used when the slot is a drawer box. Empty for every other part. */
  heightFormula?: string;
  qtyFormula: string;
  /** One-person minutes for one piece. */
  laborMinutes: number;
  exteriorFinishSides: number;
  interiorFinishSides: number;
  material: CostingMaterial | null;
  door: CostingDoor | null;
  drawerBox?: CostingDrawerBox | null;
  /**
   * Set only when this part keeps its own finish price.
   * Leave unset to use the cabinet finish.
   */
  exteriorFinish?: CostingFinish | null;
  interiorFinish?: CostingFinish | null;
};

export type CabinetHardwareInput = {
  name: string;
  qtyFormula: string;
  unitCost: number;
  /** Whole-number percent. 50 means 50% of unit cost. */
  markupPct: number;
  /** One-person minutes to install one piece. */
  installMinutes: number;
};

export type CabinetCostInput = {
  height: number;
  width: number;
  depth: number;
  doors: number;
  drawers: number;
  shelves: number;
  /** How many of this cabinet. Part lines stay per cabinet; totals are extended. */
  quantity: number;
  baseLaborMinutes: number;
  /** Codes from costing_variables. */
  variables: FormulaScope;
  shopHourlyCost: number;
  workerCount: number;
  exteriorFinish: CostingFinish | null;
  interiorFinish: CostingFinish | null;
  parts: CabinetPartInput[];
  hardware: CabinetHardwareInput[];
};

export type PartCostLine = {
  name: string;
  slotName: string;
  slotType: SlotType;
  lengthFormula: string;
  widthFormula: string;
  heightFormula: string;
  qtyFormula: string;
  length: number | null;
  width: number | null;
  height: number | null;
  qty: number | null;
  materialName: string | null;
  materialType: MaterialType | null;
  materialUnitPrice: number | null;
  materialWastePct: number | null;
  sheetLength: number | null;
  sheetWidth: number | null;
  thickness: number | null;
  roughThickness: number | null;
  doorName: string | null;
  doorPricePerSqft: number | null;
  drawerBoxName: string | null;
  drawerBoxPricePerCuft: number | null;
  exteriorFinishName: string | null;
  exteriorFinishPricePerSqft: number | null;
  interiorFinishName: string | null;
  interiorFinishPricePerSqft: number | null;
  exteriorFinishSides: number;
  interiorFinishSides: number;
  quantityUsed: number | null;
  quantityUnit: QuantityUnit | null;
  materialCost: number;
  doorCost: number;
  drawerBoxCost: number;
  finishCost: number;
  laborMinutesEach: number;
  laborMinutes: number;
  error: string | null;
};

export type HardwareCostLine = {
  name: string;
  qtyFormula: string;
  qty: number | null;
  unitCost: number;
  markupPct: number;
  installMinutesEach: number;
  installMinutes: number;
  lineCost: number;
  lineMarkup: number;
  error: string | null;
};

export type CostTotals = {
  materialCost: number;
  laborCost: number;
  doorCost: number;
  drawerBoxCost: number;
  finishCost: number;
  hardwareCost: number;
  hardwareMarkup: number;
  /** Material + labor + doors + drawer boxes + finish + hardware. Markup is not included. */
  totalCost: number;
  laborMinutes: number;
};

export type CabinetCost = {
  quantity: number;
  laborRate: number;
  /** One cabinet. */
  each: CostTotals;
  /** each × quantity. */
  total: CostTotals;
  parts: PartCostLine[];
  hardware: HardwareCostLine[];
  errors: string[];
};

export type QuoteCostInput = {
  /** Whole-number margin. 30 means sell = cost / 0.70. */
  marginPct: number;
  cabinets: CostTotals[];
};

export type QuotePrice = {
  materialCost: number;
  laborCost: number;
  doorCost: number;
  drawerBoxCost: number;
  finishCost: number;
  hardwareCost: number;
  hardwareMarkup: number;
  totalCost: number;
  marginPct: number;
  /** Markup that produces the same sell price as this margin, before hardware markup. */
  equivalentMarkupPct: number;
  sellPrice: number;
  error: string | null;
};

/** Round to cents for display. Do not store this back onto a cost. */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateCabinet(input: CabinetCostInput): CabinetCost {
  const errors: string[] = [];
  const laborRate =
    input.workerCount > 0 ? input.shopHourlyCost / input.workerCount : 0;
  if (input.workerCount <= 0) {
    errors.push("Worker count must be at least 1");
  }
  if (!(input.quantity >= 1)) {
    errors.push("Cabinet quantity must be at least 1");
  }

  const parts = input.parts.map((part) => pricePart(part, input, errors));
  const hardware = input.hardware.map((item) => priceHardware(item, input, errors));

  const partLabor = parts.reduce((sum, part) => sum + part.laborMinutes, 0);
  const hardwareLabor = hardware.reduce((sum, item) => sum + item.installMinutes, 0);
  const laborMinutes = input.baseLaborMinutes + partLabor + hardwareLabor;
  const laborCost = (laborMinutes / 60) * laborRate;

  const each = totals({
    materialCost: sum(parts, (part) => part.materialCost),
    laborCost,
    doorCost: sum(parts, (part) => part.doorCost),
    drawerBoxCost: sum(parts, (part) => part.drawerBoxCost),
    finishCost: sum(parts, (part) => part.finishCost),
    hardwareCost: sum(hardware, (item) => item.lineCost),
    hardwareMarkup: sum(hardware, (item) => item.lineMarkup),
    laborMinutes,
  });

  const quantity = input.quantity >= 1 ? input.quantity : 0;
  return {
    quantity: input.quantity,
    laborRate,
    each,
    total: scaleTotals(each, quantity),
    parts,
    hardware,
    errors,
  };
}

export function priceQuote(input: QuoteCostInput): QuotePrice {
  const summed = input.cabinets.reduce(
    (total, cabinet) => ({
      materialCost: total.materialCost + cabinet.materialCost,
      laborCost: total.laborCost + cabinet.laborCost,
      doorCost: total.doorCost + cabinet.doorCost,
      drawerBoxCost: total.drawerBoxCost + cabinet.drawerBoxCost,
      finishCost: total.finishCost + cabinet.finishCost,
      hardwareCost: total.hardwareCost + cabinet.hardwareCost,
      hardwareMarkup: total.hardwareMarkup + cabinet.hardwareMarkup,
      laborMinutes: total.laborMinutes + cabinet.laborMinutes,
    }),
    {
      materialCost: 0,
      laborCost: 0,
      doorCost: 0,
      drawerBoxCost: 0,
      finishCost: 0,
      hardwareCost: 0,
      hardwareMarkup: 0,
      laborMinutes: 0,
    }
  );
  const costs = totals(summed);
  const marginPct = input.marginPct;
  if (!(marginPct >= 0) || marginPct >= 100) {
    return {
      ...costs,
      marginPct,
      equivalentMarkupPct: 0,
      sellPrice: 0,
      error: "Margin must be from 0 up to, but not including, 100%",
    };
  }
  const margin = marginPct / 100;
  const sellBeforeMarkup = costs.totalCost / (1 - margin);
  return {
    ...costs,
    marginPct,
    equivalentMarkupPct: (margin / (1 - margin)) * 100,
    sellPrice: sellBeforeMarkup + costs.hardwareMarkup,
    error: null,
  };
}

function pricePart(
  part: CabinetPartInput,
  cabinet: CabinetCostInput,
  errors: string[]
): PartCostLine {
  const material = part.slotType === "material" ? part.material : null;
  const scope = cabinetScope({
    H: cabinet.height,
    W: cabinet.width,
    D: cabinet.depth,
    DOORS: cabinet.doors,
    DRAWERS: cabinet.drawers,
    SHELVES: cabinet.shelves,
    T: material?.thickness ?? undefined,
    variables: cabinet.variables,
  });

  const length = measure(part.lengthFormula, scope);
  const width = measure(part.widthFormula, scope);
  const height =
    part.slotType === "drawer_box"
      ? measure(part.heightFormula ?? "", scope)
      : { value: null, error: null };
  const qty = measure(part.qtyFormula, scope);
  const formulasOk =
    length.error == null && width.error == null && height.error == null && qty.error == null;
  const problems = [length.error, width.error, height.error, qty.error].filter(
    (item): item is string => item != null
  );

  let materialCost = 0;
  let doorCost = 0;
  let drawerBoxCost = 0;
  let quantityUsed: number | null = null;
  let quantityUnit: QuantityUnit | null = null;

  if (formulasOk && length.value != null && width.value != null && qty.value != null) {
    if (part.slotType === "material") {
      if (!part.material) {
        problems.push(`No material for ${part.slotName}`);
      } else {
        const priced = priceMaterial(part.material, length.value, width.value, qty.value);
        if (priced.error) problems.push(priced.error);
        materialCost = priced.cost;
        quantityUsed = priced.quantityUsed;
        quantityUnit = priced.quantityUnit;
      }
    } else if (part.slotType === "door") {
      if (!part.door) {
        problems.push(`No door style for ${part.slotName}`);
      } else {
        quantityUsed = (length.value * width.value * qty.value) / 144;
        quantityUnit = "sqft";
        doorCost = quantityUsed * part.door.pricePerSqft;
      }
    } else if (part.slotType === "drawer_box") {
      if (!part.drawerBox) {
        problems.push(`No drawer box style for ${part.slotName}`);
      } else if (height.value != null) {
        quantityUsed = (length.value * width.value * height.value * qty.value) / 1728;
        quantityUnit = "cuft";
        drawerBoxCost = quantityUsed * part.drawerBox.pricePerCuft;
      }
    }
  }

  const exteriorFinish =
    part.exteriorFinish === undefined ? cabinet.exteriorFinish : part.exteriorFinish;
  const interiorFinish =
    part.interiorFinish === undefined ? cabinet.interiorFinish : part.interiorFinish;
  const finish = priceFinish(
    part,
    exteriorFinish,
    interiorFinish,
    length.value,
    width.value,
    qty.value,
    formulasOk
  );
  if (finish.error) problems.push(finish.error);

  const error = problems.length ? problems.join("; ") : null;
  if (error) errors.push(`${part.name}: ${error}`);

  return {
    name: part.name,
    slotName: part.slotName,
    slotType: part.slotType,
    lengthFormula: part.lengthFormula,
    widthFormula: part.widthFormula,
    heightFormula: part.heightFormula ?? "",
    qtyFormula: part.qtyFormula,
    length: length.value,
    width: width.value,
    height: height.value,
    qty: qty.value,
    materialName: material?.name ?? null,
    materialType: material?.materialType ?? null,
    materialUnitPrice: material?.unitPrice ?? null,
    materialWastePct: material?.wastePct ?? null,
    sheetLength: material?.sheetLength ?? null,
    sheetWidth: material?.sheetWidth ?? null,
    thickness: material?.thickness ?? null,
    roughThickness: material?.roughThickness ?? null,
    doorName: part.slotType === "door" ? part.door?.name ?? null : null,
    doorPricePerSqft: part.slotType === "door" ? part.door?.pricePerSqft ?? null : null,
    drawerBoxName: part.slotType === "drawer_box" ? part.drawerBox?.name ?? null : null,
    drawerBoxPricePerCuft: part.slotType === "drawer_box" ? part.drawerBox?.pricePerCuft ?? null : null,
    exteriorFinishName: exteriorFinish?.name ?? null,
    exteriorFinishPricePerSqft: exteriorFinish?.pricePerSqft ?? null,
    interiorFinishName: interiorFinish?.name ?? null,
    interiorFinishPricePerSqft: interiorFinish?.pricePerSqft ?? null,
    exteriorFinishSides: part.exteriorFinishSides,
    interiorFinishSides: part.interiorFinishSides,
    quantityUsed,
    quantityUnit,
    materialCost,
    doorCost,
    drawerBoxCost,
    finishCost: finish.cost,
    laborMinutesEach: part.laborMinutes,
    laborMinutes: qty.value == null ? 0 : part.laborMinutes * qty.value,
    error,
  };
}

function priceHardware(
  item: CabinetHardwareInput,
  cabinet: CabinetCostInput,
  errors: string[]
): HardwareCostLine {
  const scope = cabinetScope({
    H: cabinet.height,
    W: cabinet.width,
    D: cabinet.depth,
    DOORS: cabinet.doors,
    DRAWERS: cabinet.drawers,
    SHELVES: cabinet.shelves,
    variables: cabinet.variables,
  });
  const qty = measure(item.qtyFormula, scope);
  const qtyValue = qty.value ?? 0;
  const lineCost = qty.error ? 0 : qtyValue * item.unitCost;
  const lineMarkup = qty.error ? 0 : lineCost * (item.markupPct / 100);
  if (qty.error) errors.push(`${item.name}: ${qty.error}`);
  return {
    name: item.name,
    qtyFormula: item.qtyFormula,
    qty: qty.value,
    unitCost: item.unitCost,
    markupPct: item.markupPct,
    installMinutesEach: item.installMinutes,
    installMinutes: qty.error ? 0 : item.installMinutes * qtyValue,
    lineCost,
    lineMarkup,
    error: qty.error,
  };
}

function priceMaterial(
  material: CostingMaterial,
  length: number,
  width: number,
  qty: number
): { cost: number; quantityUsed: number | null; quantityUnit: QuantityUnit | null; error: string | null } {
  const waste = 1 + material.wastePct / 100;
  if (material.materialType === "sheet") {
    const sheetSqft = ((material.sheetLength ?? 0) * (material.sheetWidth ?? 0)) / 144;
    if (!(sheetSqft > 0)) {
      return { cost: 0, quantityUsed: null, quantityUnit: "sqft", error: `${material.name} needs a sheet size` };
    }
    const quantityUsed = (length * width * qty) / 144;
    return {
      cost: (quantityUsed * waste * material.unitPrice) / sheetSqft,
      quantityUsed,
      quantityUnit: "sqft",
      error: null,
    };
  }
  if (material.materialType === "lumber") {
    if (!(material.roughThickness != null && material.roughThickness > 0)) {
      return {
        cost: 0,
        quantityUsed: null,
        quantityUnit: "board_ft",
        error: `${material.name} needs a rough thickness`,
      };
    }
    const quantityUsed = (length * width * material.roughThickness * qty) / 144;
    return {
      cost: quantityUsed * waste * material.unitPrice,
      quantityUsed,
      quantityUnit: "board_ft",
      error: null,
    };
  }
  if (material.materialType === "sqft") {
    const quantityUsed = (length * width * qty) / 144;
    return {
      cost: quantityUsed * waste * material.unitPrice,
      quantityUsed,
      quantityUnit: "sqft",
      error: null,
    };
  }
  if (material.materialType === "linear_ft") {
    const quantityUsed = (length / 12) * qty;
    return {
      cost: quantityUsed * waste * material.unitPrice,
      quantityUsed,
      quantityUnit: "linear_ft",
      error: null,
    };
  }
  return {
    cost: qty * waste * material.unitPrice,
    quantityUsed: qty,
    quantityUnit: "each",
    error: null,
  };
}

function priceFinish(
  part: CabinetPartInput,
  exteriorFinish: CostingFinish | null,
  interiorFinish: CostingFinish | null,
  length: number | null,
  width: number | null,
  qty: number | null,
  measuresOk: boolean
): { cost: number; error: string | null } {
  if (!measuresOk || length == null || width == null || qty == null) {
    return { cost: 0, error: null };
  }
  const area = (length * width * qty) / 144;
  const problems: string[] = [];
  let cost = 0;
  if (part.exteriorFinishSides > 0) {
    if (!exteriorFinish) {
      problems.push("No exterior finish on the schedule");
    } else {
      cost += area * part.exteriorFinishSides * exteriorFinish.pricePerSqft;
    }
  }
  if (part.interiorFinishSides > 0) {
    if (!interiorFinish) {
      problems.push("No interior finish on the schedule");
    } else {
      cost += area * part.interiorFinishSides * interiorFinish.pricePerSqft;
    }
  }
  return { cost, error: problems.length ? problems.join("; ") : null };
}

function measure(
  expression: string,
  scope: FormulaScope
): { value: number | null; error: string | null } {
  const result = evaluateFormula(expression, scope);
  if (!result.ok) return { value: null, error: result.error };
  return { value: result.value, error: null };
}

function totals(input: Omit<CostTotals, "totalCost">): CostTotals {
  return {
    ...input,
    totalCost:
      input.materialCost +
      input.laborCost +
      input.doorCost +
      input.drawerBoxCost +
      input.finishCost +
      input.hardwareCost,
  };
}

function scaleTotals(input: CostTotals, quantity: number): CostTotals {
  return totals({
    materialCost: input.materialCost * quantity,
    laborCost: input.laborCost * quantity,
    doorCost: input.doorCost * quantity,
    drawerBoxCost: input.drawerBoxCost * quantity,
    finishCost: input.finishCost * quantity,
    hardwareCost: input.hardwareCost * quantity,
    hardwareMarkup: input.hardwareMarkup * quantity,
    laborMinutes: input.laborMinutes * quantity,
  });
}

function sum<T>(items: T[], pick: (item: T) => number): number {
  return items.reduce((total, item) => total + pick(item), 0);
}
