import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateCabinet,
  priceQuote,
  roundMoney,
  type CabinetCostInput,
  type CabinetPartInput,
  type CostingMaterial,
} from "./calculate.ts";
import { partRecordFromLine } from "./freeze.ts";
import { choiceIdForSlot } from "./schedule-choice.ts";

const maplePlywood: CostingMaterial = {
  name: '3/4" maple plywood',
  materialType: "sheet",
  unitPrice: 80,
  wastePct: 15,
  sheetLength: 96,
  sheetWidth: 48,
  thickness: 0.75,
  roughThickness: null,
};

const mapleLumber: CostingMaterial = {
  name: "4/4 maple lumber",
  materialType: "lumber",
  unitPrice: 5,
  wastePct: 30,
  sheetLength: null,
  sheetWidth: null,
  thickness: 0.75,
  roughThickness: 1,
};

function part(overrides: Partial<CabinetPartInput> & Pick<CabinetPartInput, "name">): CabinetPartInput {
  return {
    slotName: "Case Sides",
    slotType: "material",
    lengthFormula: "34.5",
    widthFormula: "24",
    qtyFormula: "1",
    laborMinutes: 0,
    exteriorFinishSides: 0,
    interiorFinishSides: 0,
    material: maplePlywood,
    door: null,
    ...overrides,
  };
}

function cabinet(overrides: Partial<CabinetCostInput> = {}): CabinetCostInput {
  return {
    height: 34.5,
    width: 36,
    depth: 24,
    doors: 1,
    drawers: 1,
    shelves: 1,
    quantity: 1,
    baseLaborMinutes: 0,
    variables: { TOEKICK: 4.5, STILE: 1.5, NAILER: 1.5 },
    shopHourlyCost: 275,
    workerCount: 5,
    exteriorFinish: null,
    interiorFinish: null,
    parts: [],
    hardware: [],
    ...overrides,
  };
}

describe("worked examples", () => {
  it("prices a plywood side at $16.53", () => {
    const result = calculateCabinet(
      cabinet({
        parts: [
          part({
            name: "Side",
            lengthFormula: "34.5",
            widthFormula: "24",
            qtyFormula: "1",
          }),
        ],
      })
    );
    const side = result.parts[0];
    assert.equal(side.quantityUsed, 5.75);
    assert.equal(side.quantityUnit, "sqft");
    assert.equal(side.materialCost, 2645 / 160);
    assert.equal(roundMoney(side.materialCost), 16.53);
    assert.equal(result.errors.length, 0);
  });

  it("prices a back from its schedule override and the sides from the slot default", () => {
    const threeQuarter = { ...maplePlywood, name: "3/4 Maple Plywood", unitPrice: 80 };
    const quarter = { ...maplePlywood, name: "1/4 Maple Plywood", unitPrice: 42, thickness: 0.25 };
    const slotDefault = {
      material_id: "ply34",
      door_style_id: null,
      drawer_box_style_id: null,
      finish_id: null,
    };
    const backOverride = { ...slotDefault, material_id: "ply14" };
    const materials = new Map([
      ["ply34", threeQuarter],
      ["ply14", quarter],
    ]);
    const sideId = choiceIdForSlot("material", slotDefault, null);
    const backId = choiceIdForSlot("material", slotDefault, backOverride);
    const result = calculateCabinet(
      cabinet({
        parts: [
          part({
            name: "Side",
            slotName: "Cabinet Box",
            material: materials.get(sideId ?? "") ?? null,
            lengthFormula: "34.5",
            widthFormula: "24",
            qtyFormula: "1",
          }),
          part({
            name: "Back",
            slotName: "Cabinet Box",
            material: materials.get(backId ?? "") ?? null,
            lengthFormula: "34.5",
            widthFormula: "24",
            qtyFormula: "1",
          }),
        ],
      })
    );
    const side = result.parts[0];
    const back = result.parts[1];
    assert.equal(sideId, "ply34");
    assert.equal(backId, "ply14");
    assert.equal(side.materialName, "3/4 Maple Plywood");
    assert.equal(side.materialUnitPrice, 80);
    assert.equal(roundMoney(side.materialCost), 16.53);
    assert.equal(back.materialName, "1/4 Maple Plywood");
    assert.equal(back.materialUnitPrice, 42);
    assert.equal(roundMoney(back.materialCost), 8.68);
    assert.equal(result.errors.length, 0);
  });

  it("prices a lumber stile at $2.34", () => {
    const result = calculateCabinet(
      cabinet({
        parts: [
          part({
            name: "Stile",
            slotName: "Face Frame",
            material: mapleLumber,
            lengthFormula: "34.5",
            widthFormula: "1.5",
            qtyFormula: "1",
          }),
        ],
      })
    );
    const stile = result.parts[0];
    assert.equal(stile.quantityUsed, 0.359375);
    assert.equal(stile.quantityUnit, "board_ft");
    assert.equal(stile.materialCost, 1495 / 640);
    assert.equal(roundMoney(stile.materialCost), 2.34);
  });

  it("prices 90 minutes of labor at $82.50", () => {
    const result = calculateCabinet(
      cabinet({
        baseLaborMinutes: 60,
        parts: [part({ name: "Side", laborMinutes: 30 })],
      })
    );
    assert.equal(result.laborRate, 55);
    assert.equal(result.each.laborMinutes, 90);
    assert.equal(result.each.laborCost, 82.5);
  });
});

describe("other material types, doors, finish, and hardware", () => {
  it("prices square-foot, linear-foot, and each materials", () => {
    const result = calculateCabinet(
      cabinet({
        parts: [
          part({
            name: "Panel",
            material: {
              ...maplePlywood,
              materialType: "sqft",
              unitPrice: 10,
              wastePct: 0,
            },
            lengthFormula: "12",
            widthFormula: "12",
          }),
          part({
            name: "Edge",
            slotName: "Face Frame",
            material: {
              ...mapleLumber,
              materialType: "linear_ft",
              unitPrice: 2,
              wastePct: 0,
            },
            lengthFormula: "96",
            widthFormula: "0",
          }),
          part({
            name: "Hinge block",
            slotName: "Case Sides",
            material: {
              ...maplePlywood,
              materialType: "each",
              unitPrice: 3,
              wastePct: 0,
            },
            qtyFormula: "4",
          }),
        ],
      })
    );
    assert.equal(result.parts[0].materialCost, 10);
    assert.equal(result.parts[1].quantityUsed, 8);
    assert.equal(result.parts[1].materialCost, 16);
    assert.equal(result.parts[2].materialCost, 12);
  });

  it("prices door area with no waste and finish on both faces", () => {
    const result = calculateCabinet(
      cabinet({
        height: 34.5,
        width: 30,
        exteriorFinish: { name: "Stain", pricePerSqft: 3 },
        interiorFinish: { name: "Clear", pricePerSqft: 1 },
        parts: [
          part({
            name: "Door",
            slotName: "Doors & Drawer Fronts",
            slotType: "door",
            material: null,
            door: { name: "Shaker", pricePerSqft: 10 },
            lengthFormula: "W",
            widthFormula: "H - TOEKICK",
            exteriorFinishSides: 2,
            interiorFinishSides: 1,
          }),
        ],
      })
    );
    const door = result.parts[0];
    assert.equal(door.length, 30);
    assert.equal(door.width, 30);
    assert.equal(door.quantityUsed, 6.25);
    assert.equal(door.doorCost, 62.5);
    assert.equal(door.materialCost, 0);
    assert.equal(door.finishCost, 6.25 * 2 * 3 + 6.25 * 1);
    assert.equal(result.each.totalCost, door.doorCost + door.finishCost);
  });

  it("prices a drawer box by cubic foot with no waste", () => {
    const result = calculateCabinet(
      cabinet({
        drawers: 2,
        parts: [
          part({
            name: "Drawer box",
            slotName: "Drawer Box",
            slotType: "drawer_box",
            material: null,
            door: null,
            drawerBox: { name: "Dovetail Maple", pricePerCuft: 25 },
            lengthFormula: "23",
            widthFormula: "14.5",
            heightFormula: "4",
            qtyFormula: "2",
          }),
        ],
      })
    );
    const box = result.parts[0];
    const oneBox = (23 * 14.5 * 4) / 1728;
    assert.equal(Math.round(oneBox * 1000) / 1000, 0.772);
    assert.equal(box.length, 23);
    assert.equal(box.width, 14.5);
    assert.equal(box.height, 4);
    assert.equal(box.qty, 2);
    assert.equal(box.quantityUsed, oneBox * 2);
    assert.equal(box.quantityUnit, "cuft");
    assert.equal(box.materialCost, 0);
    assert.equal(box.finishCost, 0);
    assert.equal(roundMoney(box.drawerBoxCost), 38.6);
    assert.equal(result.each.drawerBoxCost, box.drawerBoxCost);
    assert.equal(result.each.totalCost, box.drawerBoxCost);
    const saved = partRecordFromLine(box, 0);
    assert.equal(saved.drawer_box_name, "Dovetail Maple");
    assert.equal(saved.drawer_box_price_per_cuft, 25);
    assert.equal(saved.quantity_used, oneBox * 2);
    assert.equal(saved.quantity_unit, "cuft");
    assert.equal(saved.height_formula, "4");
  });

  it("lets one part keep an older finish price", () => {
    const result = calculateCabinet(
      cabinet({
        exteriorFinish: { name: "New stain", pricePerSqft: 10 },
        parts: [
          part({
            name: "Old door",
            slotType: "door",
            material: null,
            door: { name: "Shaker", pricePerSqft: 0 },
            lengthFormula: "12",
            widthFormula: "12",
            exteriorFinishSides: 1,
            exteriorFinish: { name: "Old stain", pricePerSqft: 2 },
          }),
          part({
            name: "New door",
            slotType: "door",
            material: null,
            door: { name: "Shaker", pricePerSqft: 0 },
            lengthFormula: "12",
            widthFormula: "12",
            exteriorFinishSides: 1,
          }),
        ],
      })
    );
    assert.equal(result.parts[0].finishCost, 2);
    assert.equal(result.parts[0].exteriorFinishPricePerSqft, 2);
    assert.equal(result.parts[1].finishCost, 10);
    assert.equal(result.parts[1].exteriorFinishName, "New stain");
  });

  it("keeps hardware markup out of cost and adds it after the margin", () => {
    const result = calculateCabinet(
      cabinet({
        doors: 2,
        hardware: [
          {
            name: "Hinge",
            qtyFormula: "DOORS * 2",
            unitCost: 5,
            markupPct: 50,
            installMinutes: 3,
          },
        ],
      })
    );
    const hinge = result.hardware[0];
    assert.equal(hinge.qty, 4);
    assert.equal(hinge.lineCost, 20);
    assert.equal(hinge.lineMarkup, 10);
    assert.equal(hinge.installMinutes, 12);
    assert.equal(result.each.hardwareCost, 20);
    assert.equal(result.each.laborCost, 11);
    assert.equal(result.each.totalCost, 31);
    assert.equal(result.each.hardwareMarkup, 10);

    const quote = priceQuote({ marginPct: 30, cabinets: [result.total] });
    assert.equal(quote.error, null);
    assert.equal(quote.sellPrice, 31 / 0.7 + 10);
    assert.equal(quote.equivalentMarkupPct, (0.3 / 0.7) * 100);
  });

  it("extends totals by the cabinet quantity", () => {
    const result = calculateCabinet(
      cabinet({
        quantity: 3,
        baseLaborMinutes: 60,
        parts: [part({ name: "Side", laborMinutes: 30 })],
      })
    );
    assert.equal(result.each.laborCost, 82.5);
    assert.equal(result.total.laborCost, 247.5);
    assert.equal(roundMoney(result.total.materialCost), roundMoney(16.53 * 3));
  });
});

describe("cost errors", () => {
  it("reports a missing material without dropping labor", () => {
    const result = calculateCabinet(
      cabinet({
        parts: [part({ name: "Side", material: null, laborMinutes: 30 })],
      })
    );
    assert.equal(result.parts[0].materialCost, 0);
    assert.equal(result.parts[0].laborMinutes, 30);
    assert.match(result.errors[0], /No material for Case Sides/);
  });

  it("reports a bad formula on the part", () => {
    const result = calculateCabinet(
      cabinet({
        parts: [part({ name: "Side", lengthFormula: "W - MISSING" })],
      })
    );
    assert.equal(result.parts[0].materialCost, 0);
    assert.match(result.parts[0].error ?? "", /Unknown variable "MISSING"/);
  });

  it("rejects a margin of 100%", () => {
    const quote = priceQuote({
      marginPct: 100,
      cabinets: [calculateCabinet(cabinet()).total],
    });
    assert.equal(quote.sellPrice, 0);
    assert.match(quote.error ?? "", /Margin/);
  });
});
