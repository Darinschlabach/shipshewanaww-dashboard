import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateCabinet, type CabinetPartInput, type CostingMaterial } from "./calculate.ts";
import {
  partRecordFromLine,
  quoteWithCurrentPrices,
  repriceFrozen,
  type QuotePartRecord,
} from "./freeze.ts";

const sheet: CostingMaterial = {
  name: "Plywood",
  materialType: "sheet",
  unitPrice: 80,
  wastePct: 0,
  sheetLength: 96,
  sheetWidth: 48,
  thickness: 0.75,
  roughThickness: null,
};

function side(price: number): CabinetPartInput {
  return {
    name: "Side",
    slotName: "Case Sides",
    slotType: "material",
    lengthFormula: "12",
    widthFormula: "W",
    qtyFormula: "1",
    laborMinutes: 0,
    exteriorFinishSides: 0,
    interiorFinishSides: 0,
    material: { ...sheet, unitPrice: price },
    door: null,
  };
}

function freeze(price: number, width: number): QuotePartRecord {
  const cost = calculateCabinet({
    height: 30,
    width,
    depth: 24,
    doors: 0,
    drawers: 0,
    shelves: 0,
    quantity: 1,
    baseLaborMinutes: 0,
    variables: {},
    shopHourlyCost: 55,
    workerCount: 1,
    exteriorFinish: null,
    interiorFinish: null,
    parts: [side(price)],
    hardware: [],
  });
  return partRecordFromLine(cost.parts[0], 0);
}

describe("frozen quote prices", () => {
  it("recalculates a new width with the saved sheet price", () => {
    const saved = freeze(80, 12);
    assert.equal(saved.material_cost, 2.5);
    const wider = repriceFrozen({
      height: 30,
      width: 24,
      depth: 24,
      doors: 0,
      drawers: 0,
      shelves: 0,
      quantity: 1,
      baseLaborMinutes: 0,
      laborRate: 55,
      variables: {},
      parts: [saved],
      hardware: [],
    });
    assert.equal(wider.parts[0].materialCost, 5);
    assert.equal(wider.parts[0].materialUnitPrice, 80);
  });

  it("prices a part added later at the price it brings with it", () => {
    const original = freeze(80, 12);
    const added = freeze(160, 12);
    added.name = "Shelf";
    const cost = repriceFrozen({
      height: 30,
      width: 12,
      depth: 24,
      doors: 0,
      drawers: 0,
      shelves: 0,
      quantity: 1,
      baseLaborMinutes: 0,
      laborRate: 55,
      variables: {},
      parts: [original, added],
      hardware: [],
    });
    assert.equal(cost.parts[0].materialCost, 2.5);
    assert.equal(cost.parts[1].materialCost, 5);
    assert.equal(cost.each.materialCost, 7.5);
  });

  it("keeps the labor rate that was saved on the cabinet", () => {
    const saved = freeze(80, 12);
    saved.labor_minutes = 60;
    const priced = repriceFrozen({
      height: 30,
      width: 12,
      depth: 24,
      doors: 0,
      drawers: 0,
      shelves: 0,
      quantity: 2,
      baseLaborMinutes: 0,
      laborRate: 55,
      variables: {},
      parts: [saved],
      hardware: [],
    });
    assert.equal(priced.each.laborCost, 55);
    assert.equal(priced.total.laborCost, 110);
    assert.equal(priced.total.materialCost, 5);
  });

  it("reprices the parts that are on the quote and leaves an unmatched one", () => {
    const side = freeze(80, 12);
    const shelf = freeze(80, 12);
    shelf.name = "Shelf";
    shelf.slot_name = "Shelves";
    const orphan = freeze(80, 12);
    orphan.name = "Scribe";
    orphan.slot_name = "Old Scribe";
    const priced = quoteWithCurrentPrices({
      frozen: {
        height: 30,
        width: 12,
        depth: 24,
        doors: 0,
        drawers: 0,
        shelves: 0,
        quantity: 1,
        baseLaborMinutes: 0,
        laborRate: 55,
        variables: {},
        parts: [side, shelf],
        hardware: [
          {
            sort_order: 0,
            name: "Hinge",
            qty_formula: "2",
            resolved_qty: null,
            unit_cost: 4,
            markup_pct: 0,
            install_minutes: 3,
            line_cost: 8,
            line_markup: 0,
          },
        ],
      },
      choices: [
        { slotName: "Case Sides", slotType: "material", material: { ...sheet, unitPrice: 160 }, door: null, drawerBox: null },
        { slotName: "Shelves", slotType: "material", material: { ...sheet, unitPrice: 160 }, door: null, drawerBox: null },
      ],
      exteriorFinish: null,
      interiorFinish: null,
      hardwarePrices: null,
    });
    assert.equal(priced.cost.parts.length, 2);
    assert.equal(priced.cost.parts[0].materialCost, 5);
    assert.equal(priced.cost.parts[1].name, "Shelf");
    assert.equal(priced.cost.parts[1].materialCost, 5);
    assert.equal(priced.cost.hardware[0].unitCost, 4);
    assert.equal(priced.kept.length, 0);

    const withOrphan = quoteWithCurrentPrices({
      frozen: {
        height: 30,
        width: 12,
        depth: 24,
        doors: 0,
        drawers: 0,
        shelves: 0,
        quantity: 1,
        baseLaborMinutes: 0,
        laborRate: 55,
        variables: {},
        parts: [side, orphan],
        hardware: [],
      },
      choices: [
        { slotName: "Case Sides", slotType: "material", material: { ...sheet, unitPrice: 160 }, door: null, drawerBox: null },
      ],
      exteriorFinish: null,
      interiorFinish: null,
      hardwarePrices: [{ name: "Missing", unitCost: 9, markupPct: 0, installMinutes: 1 }],
    });
    assert.equal(withOrphan.cost.parts[0].materialUnitPrice, 160);
    assert.equal(withOrphan.cost.parts[1].materialUnitPrice, 80);
    assert.match(withOrphan.kept[0], /Scribe keeps its saved price/);

    const hinge = {
      sort_order: 0,
      name: "Hinge",
      qty_formula: "2",
      resolved_qty: null,
      unit_cost: 4,
      markup_pct: 0,
      install_minutes: 3,
      line_cost: 8,
      line_markup: 0,
    };
    const refreshed = quoteWithCurrentPrices({
      frozen: {
        height: 30,
        width: 12,
        depth: 24,
        doors: 0,
        drawers: 0,
        shelves: 0,
        quantity: 1,
        baseLaborMinutes: 0,
        laborRate: 55,
        variables: {},
        parts: [side],
        hardware: [hinge, { ...hinge, name: "Custom pull", sort_order: 1 }],
      },
      choices: [
        { slotName: "Case Sides", slotType: "material", material: { ...sheet, unitPrice: 160 }, door: null, drawerBox: null },
      ],
      exteriorFinish: null,
      interiorFinish: null,
      hardwarePrices: [{ name: "Hinge", unitCost: 9, markupPct: 10, installMinutes: 1 }],
    });
    assert.equal(refreshed.cost.hardware[0].unitCost, 9);
    assert.equal(refreshed.cost.hardware[0].markupPct, 10);
    assert.equal(refreshed.cost.hardware[1].name, "Custom pull");
    assert.equal(refreshed.cost.hardware[1].unitCost, 4);
    assert.match(refreshed.kept[0], /Custom pull keeps its saved price/);
  });
});
