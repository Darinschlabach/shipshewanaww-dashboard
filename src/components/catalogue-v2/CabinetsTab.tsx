"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  IconChevronLeft,
  IconDotsVertical,
  IconSearch,
  IconTrash,
} from "@tabler/icons-react";
import ConfirmModal from "@/components/ConfirmModal";
import { useSessionState } from "@/components/catalogue-v2/session-state";
import { formatCurrencyPrecise } from "@/lib/utils";

const CATEGORIES = ["Base", "Wall", "Tall", "Vanity"] as const;
const CATEGORY_LABEL: Record<(typeof CATEGORIES)[number], string> = {
  Base: "Base Cabinet",
  Wall: "Wall Cabinet",
  Tall: "Tall Cabinet",
  Vanity: "Vanity Cabinet",
};

const FINISHES = [
  "Unfinished (No Finish)",
  "Natural",
  "Stain",
  "Paint",
] as const;

const MATERIAL_OVERRIDES = [
  "Use Default Materials",
  "Override all materials",
] as const;

const COMPONENT_GROUPS = [
  "Cabinet Box",
  "Shelving",
  "Face Frame",
  "Doors",
  "Drawers",
  "Miscellaneous",
  "Panels",
] as const;

type LibraryComponent = {
  id: string;
  name: string;
  category: string;
  unit?: MeasureUnit;
  pricePerUnit?: number;
  widthFormula?: string;
  heightFormula?: string;
  widthInches?: string;
  heightInches?: string;
  defaultMaterialId?: string;
  primaryMaterial?: string;
  materialType?: string;
  materialThickness?: string;
};

const EMPTY_COMPONENTS: LibraryComponent[] = [];

type LibraryMaterial = {
  id: string;
  name?: string;
  species?: string;
  thickness?: string;
  category?: string;
  cost?: number;
  unit?: string;
};

const WOOD_SPECIES = [
  "Quarter Sawn White Oak",
  "Rift Sawn White Oak",
  "Reg. White Oak",
  "Sorted Light Hickory",
  "Sorted Dark Hickory",
  "Rift Sawn Red Oak",
  "Hard Maple",
  "Soft Maple",
  "White Oak",
  "Red Oak",
  "Maple",
  "Birch",
  "Oak",
  "Cherry",
  "Walnut",
  "Hickory",
  "Poplar",
  "Ash",
  "Alder",
  "Pine",
  "Mahogany",
  "Beech",
  "Cedar",
];

const MATERIAL_GROUPS = [
  ["Face Frame Material", "faceFrameSpecies", "Face Frame"],
  ["Cabinet Box Material", "cabinetBoxSpecies", "Cabinet Box"],
  ["Door Material", "doorSpecies", "Doors"],
] as const;

function speciesFromName(name: string) {
  const lower = name.toLowerCase();
  return WOOD_SPECIES.find((species) => lower.includes(species.toLowerCase())) ?? "";
}

function speciesOf(material: LibraryMaterial) {
  const stored = material.species?.trim();
  if (stored) return stored;
  return speciesFromName(material.name ?? "");
}

function norm(value: string | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/″/g, '"').replace(/\s+/g, "");
}

function thicknessInches(value: string | undefined) {
  const text = (value ?? "")
    .trim()
    .replace(/″/g, '"')
    .replace(/''/g, '"')
    .replace(/["']/g, "");
  const fraction = text.match(/(\d+)\s*\/\s*(\d+)/);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);
  const decimal = text.match(/(\d*\.\d+|\d+)/);
  if (decimal && decimal[1] !== "") return Number(decimal[1]);
  return null;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function looseName(name: string) {
  return name
    .toLowerCase()
    .replace(/″|''|"|'/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function materialInches(material: LibraryMaterial) {
  const fromField = thicknessInches(material.thickness);
  if (fromField != null) return fromField;
  return thicknessInches(material.name);
}

function productKind(material: LibraryMaterial) {
  const category = (material.category ?? "").toLowerCase();
  const name = (material.name ?? "").toLowerCase();
  if (category === "plywood" || name.includes("plywood")) return "plywood";
  if (category === "hardwood" || name.includes("hardwood")) return "hardwood";
  return category;
}

function swappedMaterialName(original: LibraryMaterial, species: string) {
  const current = speciesOf(original);
  if (current && original.name) {
    return original.name.replace(new RegExp(escapeRegExp(current), "i"), species);
  }
  return "";
}

function materialBySpeciesSwap(
  original: LibraryMaterial,
  species: string,
  materials: LibraryMaterial[]
) {
  const wanted = species.toLowerCase();
  const kind = productKind(original);
  const inches = materialInches(original);
  const renamed = looseName(swappedMaterialName(original, species));
  const named = renamed
    ? materials.filter((item) => looseName(item.name ?? "") === renamed)
    : [];
  if (named.length) return pricedMaterial(named);
  const matches = materials.filter((item) => {
    const itemSpecies = (
      speciesOf(item) || speciesFromName(item.name ?? "")
    ).toLowerCase();
    if (itemSpecies !== wanted) return false;
    if (kind && productKind(item) !== kind) return false;
    const itemInches = materialInches(item);
    if (inches == null || itemInches == null) return false;
    return Math.abs(inches - itemInches) < 0.0001;
  });
  const sameUnit = matches.filter(
    (item) => norm(item.unit) && norm(item.unit) === norm(original.unit)
  );
  return pricedMaterial(sameUnit.length ? sameUnit : matches);
}

function pricedMaterial(matches: LibraryMaterial[]) {
  const priced = matches.filter((item) => Number(item.cost) > 0);
  const pool = priced.length ? priced : matches;
  return [...pool].sort((a, b) => Number(b.cost) - Number(a.cost))[0];
}

function componentMaterial(component: LibraryComponent, materials: LibraryMaterial[]) {
  if (!component.defaultMaterialId) return undefined;
  return materials.find((entry) => entry.id === component.defaultMaterialId);
}

function chosenMaterialLabel(component: LibraryComponent) {
  if (component.primaryMaterial?.trim()) return component.primaryMaterial.trim();
  return [component.materialThickness, component.materialType].filter(Boolean).join(" ");
}

function materialForSpecies(
  component: LibraryComponent,
  species: string,
  materials: LibraryMaterial[]
) {
  const source = componentMaterial(component, materials);
  if (!source) return undefined;
  if (!species || speciesOf(source).toLowerCase() === species.toLowerCase()) {
    return source;
  }
  return materialBySpeciesSwap(source, species, materials);
}

function materialUnitPrice(material: LibraryMaterial) {
  return Number(material.cost) || 0;
}

const CABINET_SPECIES = [
  "Maple",
  "Cherry",
  "Birch",
  "Reg. White Oak",
  "Quarter Sawn White Oak",
  "Rift Sawn White Oak",
  "Red Oak",
  "Rift Sawn Red Oak",
  "Hickory",
  "Walnut",
  "Sorted Light Hickory",
  "Sorted Dark Hickory",
] as const;

function cabinetSpecies(species: string) {
  return (CABINET_SPECIES as readonly string[]).includes(species) ? species : "";
}

const EMPTY_MATERIALS: LibraryMaterial[] = [];

function formulaInches(
  source: string | undefined,
  inches: string | undefined,
  width: number,
  height: number,
  depth: number
) {
  if (source === "W") return width;
  if (source === "H") return height;
  if (source === "D") return depth;
  if (source === "custom") return Number(inches) || 0;
  return 0;
}

function componentBasis(component: LibraryComponent): CostBasis {
  if (component.unit === "Each") return "each";
  const sides = [component.widthFormula, component.heightFormula];
  const has = (source: string) => sides.includes(source);
  if (has("W") && has("H") && !has("D") && !has("custom")) return "WxH";
  if (has("W") && has("D") && !has("H") && !has("custom")) return "WxD";
  if (has("H") && has("D") && !has("W") && !has("custom")) return "HxD";
  if (component.unit === "Ln. Ft." && has("W") && sides.filter((side) => side !== "custom").length === 1) {
    return "width";
  }
  return "each";
}

function componentCost(
  component: LibraryComponent,
  width: number,
  height: number,
  depth: number
) {
  const price = Number(component.pricePerUnit) || 0;
  const pieceWidth = formulaInches(
    component.widthFormula,
    component.widthInches,
    width,
    height,
    depth
  );
  const pieceHeight = formulaInches(
    component.heightFormula,
    component.heightInches,
    width,
    height,
    depth
  );
  if (component.unit === "Sq. Ft.") return (pieceWidth * pieceHeight * price) / 144;
  if (component.unit === "Ln. Ft.") {
    const widthSource = component.widthFormula;
    const widthBlank =
      (!widthSource ||
        widthSource === "custom" ||
        widthSource === "none" ||
        widthSource === "assembly") &&
      !pieceWidth;
    const length = widthBlank ? pieceHeight || pieceWidth : pieceWidth;
    return (length * price) / 12;
  }
  return price;
}

type Category = (typeof CATEGORIES)[number];
type Status = "Active" | "Inactive";
type LineKind = "component" | "material";
type MeasureUnit = "Sq. Ft." | "Ln. Ft." | "Each";
type CostBasis = "HxD" | "WxD" | "WxH" | "face-frame" | "width" | "each";

type CabinetLine = {
  id: string;
  kind: LineKind;
  name: string;
  quantity: number;
  unit: MeasureUnit;
  basis: CostBasis;
  costEach: number;
  componentId?: string;
  materialId?: string;
};

type Cabinet = {
  id: string;
  name: string;
  category: Category;
  width: number;
  height: number;
  depth: number;
  baseWidth: number;
  baseHeight: number;
  baseDepth: number;
  description: string;
  status: Status;
  faceFrameSpecies: string;
  cabinetBoxSpecies: string;
  doorSpecies: string;
  materialOverride: (typeof MATERIAL_OVERRIDES)[number];
  finish: (typeof FINISHES)[number];
  lines: CabinetLine[];
};

const inputClass =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-burgundy focus:outline-none focus:ring-1 focus:ring-burgundy";

function money(value: number) {
  return Math.round(value * 100) / 100;
}

function measure(basis: CostBasis, width: number, height: number, depth: number) {
  switch (basis) {
    case "HxD":
      return height * depth;
    case "WxD":
      return width * depth;
    case "WxH":
      return width * height;
    case "face-frame":
      return 2 * (height + width);
    case "width":
      return width;
    default:
      return 1;
  }
}

function lineCostEach(line: CabinetLine, cabinet: Cabinet) {
  const base = measure(
    line.basis,
    cabinet.baseWidth,
    cabinet.baseHeight,
    cabinet.baseDepth
  );
  const current = measure(line.basis, cabinet.width, cabinet.height, cabinet.depth);
  if (!base) return line.costEach;
  return line.costEach * (current / base);
}

function linkedComponent(item: CabinetLine, components: LibraryComponent[]) {
  if (item.kind !== "component") return undefined;
  if (item.componentId) {
    return components.find((component) => component.id === item.componentId);
  }
  return components.find((component) => component.name === item.name);
}

function requestedSpecies(cabinet: Cabinet, category: string | undefined) {
  if (category === "Face Frame") return cabinetSpecies(cabinet.faceFrameSpecies ?? "");
  if (category === "Cabinet Box") return cabinetSpecies(cabinet.cabinetBoxSpecies ?? "");
  if (category === "Doors") return cabinetSpecies(cabinet.doorSpecies ?? "");
  return "";
}

function sharedGroupSpecies(
  cabinet: Cabinet,
  group: string,
  components: LibraryComponent[],
  materials: LibraryMaterial[]
) {
  const found = new Set<string>();
  for (const item of cabinet.lines) {
    const component = linkedComponent(item, components);
    if (!component || component.category !== group) continue;
    const materialId = item.materialId || component.defaultMaterialId;
    const material = materialId
      ? materials.find((entry) => entry.id === materialId)
      : undefined;
    const species = material ? speciesOf(material) : "";
    if (species) found.add(species);
  }
  return found.size === 1 ? [...found][0] : "";
}

function priceWithMaterial(
  component: LibraryComponent,
  material: LibraryMaterial,
  cabinet: Cabinet
) {
  const unit =
    component.unit === "Sq. Ft." ||
    component.unit === "Ln. Ft." ||
    component.unit === "Each"
      ? component.unit
      : material.unit === "Sq. Ft."
        ? "Sq. Ft."
        : material.unit === "Lin. Ft."
          ? "Ln. Ft."
          : material.unit === "Each"
            ? "Each"
            : "Sq. Ft.";
  return componentCost(
    { ...component, unit, pricePerUnit: materialUnitPrice(material) },
    cabinet.width,
    cabinet.height,
    cabinet.depth
  );
}

function lineMaterial(
  item: CabinetLine,
  component: LibraryComponent | undefined,
  materials: LibraryMaterial[]
) {
  const materialId = item.materialId || component?.defaultMaterialId;
  if (!materialId) return undefined;
  return materials.find((entry) => entry.id === materialId);
}

function assignLineSpecies(
  item: CabinetLine,
  group: string,
  species: string,
  components: LibraryComponent[],
  materials: LibraryMaterial[]
) {
  const component = linkedComponent(item, components);
  if (!component || component.category !== group) return item;
  const chosen = materialForSpecies(component, species, materials);
  const source = componentMaterial(component, materials);
  if (!chosen || speciesOf(chosen).toLowerCase() !== species.toLowerCase()) {
    const keep = source?.id || item.materialId;
    return item.materialId === keep ? item : { ...item, materialId: keep };
  }
  return item.materialId === chosen.id ? item : { ...item, materialId: chosen.id };
}

function resolveLine(
  item: CabinetLine,
  cabinet: Cabinet,
  components: LibraryComponent[],
  materials: LibraryMaterial[]
) {
  const component = linkedComponent(item, components);
  const requested = component
    ? requestedSpecies(cabinet, component.category).trim()
    : "";
  if (!component) {
    return {
      each: lineCostEach(item, cabinet),
      error: "",
      material: undefined,
      materialLabel: "",
    };
  }
  const source = componentMaterial(component, materials);
  const assigned = requested
    ? materialForSpecies(component, requested, materials)
    : lineMaterial(item, component, materials);
  if (requested && (!assigned || speciesOf(assigned).toLowerCase() !== requested.toLowerCase())) {
    const expected =
      (source && swappedMaterialName(source, requested)) ||
      chosenMaterialLabel(component) ||
      requested;
    return {
      each: 0,
      error: `No ${expected} in the catalogue`,
      material: undefined,
      materialLabel: expected,
    };
  }
  if (!assigned) {
    const expected = chosenMaterialLabel(component);
    return {
      each: 0,
      error: expected
        ? `No ${expected} in the catalogue`
        : "No material in the catalogue",
      material: undefined,
      materialLabel: expected,
    };
  }
  return {
    each: priceWithMaterial(component, assigned, cabinet),
    error: "",
    material: assigned,
    materialLabel: assigned.name ?? "",
  };
}

function linePrice(
  item: CabinetLine,
  cabinet: Cabinet,
  components: LibraryComponent[],
  materials: LibraryMaterial[]
) {
  return resolveLine(item, cabinet, components, materials).each;
}

function cabinetTotal(
  cabinet: Cabinet,
  components: LibraryComponent[] = [],
  materials: LibraryMaterial[] = []
) {
  return money(
    cabinet.lines.reduce(
      (sum, item) => sum + item.quantity * linePrice(item, cabinet, components, materials),
      0
    )
  );
}

function componentCount(cabinet: Cabinet) {
  return cabinet.lines
    .filter((line) => line.kind === "component")
    .reduce((sum, line) => sum + line.quantity, 0);
}

function materialCount(cabinet: Cabinet) {
  return cabinet.lines.filter((line) => line.kind === "material").length;
}

function line(
  id: string,
  kind: LineKind,
  name: string,
  quantity: number,
  unit: MeasureUnit,
  basis: CostBasis,
  costEach: number
): CabinetLine {
  return { id, kind, name, quantity, unit, basis, costEach };
}

function cabinet(
  partial: Omit<
    Cabinet,
    | "baseWidth"
    | "baseHeight"
    | "baseDepth"
    | "materialOverride"
    | "finish"
    | "faceFrameSpecies"
    | "cabinetBoxSpecies"
    | "doorSpecies"
  > &
    Partial<
      Pick<
        Cabinet,
        | "materialOverride"
        | "finish"
        | "faceFrameSpecies"
        | "cabinetBoxSpecies"
        | "doorSpecies"
      >
    >
): Cabinet {
  return {
    materialOverride: "Use Default Materials",
    finish: "Unfinished (No Finish)",
    faceFrameSpecies: "",
    cabinetBoxSpecies: "",
    doorSpecies: "",
    ...partial,
    baseWidth: partial.width,
    baseHeight: partial.height,
    baseDepth: partial.depth,
  };
}

const SEED: Cabinet[] = [
  cabinet({
    id: "b36",
    name: "B36 - Base Cabinet (2 Door)",
    category: "Base",
    width: 36,
    height: 34.5,
    depth: 24,
    description: "Standard base cabinet with two doors and one adjustable shelf.",
    status: "Active",
    lines: [
      line("b36-side", "component", "Cabinet Side", 2, "Sq. Ft.", "HxD", 26.88),
      line("b36-bottom", "component", "Cabinet Bottom", 1, "Sq. Ft.", "WxD", 25.25),
      line("b36-back", "component", "Cabinet Back", 1, "Sq. Ft.", "WxH", 18.5),
      line("b36-shelf", "component", "Adjustable Shelf", 1, "Sq. Ft.", "WxD", 22.75),
      line("b36-frame", "component", "Face Frame", 1, "Ln. Ft.", "face-frame", 38),
      line("b36-door", "component", "Shaker Door", 2, "Each", "each", 72.5),
      line("b36-hinge", "material", "Blum Hinge", 4, "Each", "each", 5.5),
      line("b36-pin", "material", "Shelf Pin", 4, "Each", "each", 0.3),
    ],
  }),
  cabinet({
    id: "b24",
    name: "B24 - Base Cabinet (1 Door)",
    category: "Base",
    width: 24,
    height: 34.5,
    depth: 24,
    description: "Base cabinet with one door and one adjustable shelf.",
    status: "Active",
    lines: [
      line("b24-side", "component", "Cabinet Side", 2, "Sq. Ft.", "HxD", 26.88),
      line("b24-bottom", "component", "Cabinet Bottom", 1, "Sq. Ft.", "WxD", 16.83),
      line("b24-back", "component", "Cabinet Back", 1, "Sq. Ft.", "WxH", 12.33),
      line("b24-shelf", "component", "Adjustable Shelf", 1, "Sq. Ft.", "WxD", 15.17),
      line("b24-frame", "component", "Face Frame", 1, "Ln. Ft.", "face-frame", 65.53),
      line("b24-door", "component", "Shaker Door", 1, "Each", "each", 72.5),
      line("b24-hinge", "material", "Blum Hinge", 2, "Each", "each", 5.5),
      line("b24-pin", "material", "Shelf Pin", 4, "Each", "each", 0.3),
    ],
  }),
  cabinet({
    id: "b24-drawers",
    name: "B24 - 3 Drawer Base",
    category: "Base",
    width: 24,
    height: 34.5,
    depth: 24,
    description: "Base cabinet with three drawers.",
    status: "Active",
    lines: [
      line("d-side", "component", "Cabinet Side", 2, "Sq. Ft.", "HxD", 26.88),
      line("d-bottom", "component", "Cabinet Bottom", 1, "Sq. Ft.", "WxD", 16.83),
      line("d-back", "component", "Cabinet Back", 1, "Sq. Ft.", "WxH", 12.33),
      line("d-frame", "component", "Face Frame", 1, "Ln. Ft.", "face-frame", 34),
      line("d-box", "component", "Drawer Box", 3, "Each", "each", 32),
      line("d-front", "component", "Drawer Front", 3, "Each", "each", 42),
      line("d-kick", "component", "Toe Kick", 1, "Ln. Ft.", "width", 18.5),
      line("d-slide", "material", "Drawer Slide", 3, "Each", "each", 12.4),
      line("d-pull", "material", "Drawer Pull", 3, "Each", "each", 5.25),
      line("d-bumper", "material", "Drawer Bumper", 1, "Each", "each", 1.81),
    ],
  }),
  cabinet({
    id: "sb36",
    name: "SB36 - Sink Base",
    category: "Base",
    width: 36,
    height: 34.5,
    depth: 24,
    description: "Sink base cabinet with two doors.",
    status: "Active",
    lines: [
      line("s-side", "component", "Cabinet Side", 2, "Sq. Ft.", "HxD", 26.88),
      line("s-bottom", "component", "Cabinet Bottom", 1, "Sq. Ft.", "WxD", 25.25),
      line("s-back", "component", "Cabinet Back", 1, "Sq. Ft.", "WxH", 18.5),
      line("s-frame", "component", "Face Frame", 1, "Ln. Ft.", "face-frame", 34.23),
      line("s-door", "component", "Shaker Door", 2, "Each", "each", 62),
      line("s-rail", "component", "Sink Rail", 1, "Ln. Ft.", "width", 19.8),
      line("s-hinge", "material", "Blum Hinge", 4, "Each", "each", 5.5),
      line("s-bumper", "material", "Door Bumper", 4, "Each", "each", 0.3),
    ],
  }),
  cabinet({
    id: "w36",
    name: "W36 - Wall Cabinet (2 Door)",
    category: "Wall",
    width: 36,
    height: 30,
    depth: 12,
    description: "Wall cabinet with two doors and one adjustable shelf.",
    status: "Active",
    lines: [
      line("w36-side", "component", "Cabinet Side", 2, "Sq. Ft.", "HxD", 18.2),
      line("w36-top", "component", "Cabinet Top", 1, "Sq. Ft.", "WxD", 12.4),
      line("w36-back", "component", "Cabinet Back", 1, "Sq. Ft.", "WxH", 15.8),
      line("w36-shelf", "component", "Adjustable Shelf", 1, "Sq. Ft.", "WxD", 22.41),
      line("w36-frame", "component", "Face Frame", 1, "Ln. Ft.", "face-frame", 26),
      line("w36-door", "component", "Shaker Door", 2, "Each", "each", 55),
      line("w36-hinge", "material", "Blum Hinge", 4, "Each", "each", 5.25),
      line("w36-pin", "material", "Shelf Pin", 4, "Each", "each", 0.3),
    ],
  }),
  cabinet({
    id: "w24",
    name: "W24 - Wall Cabinet (1 Door)",
    category: "Wall",
    width: 24,
    height: 30,
    depth: 12,
    description: "Wall cabinet with one door.",
    status: "Active",
    lines: [
      line("w24-side", "component", "Cabinet Side", 2, "Sq. Ft.", "HxD", 16.4),
      line("w24-top", "component", "Cabinet Top", 1, "Sq. Ft.", "WxD", 9.8),
      line("w24-back", "component", "Cabinet Back", 1, "Sq. Ft.", "WxH", 11.2),
      line("w24-shelf", "component", "Adjustable Shelf", 1, "Sq. Ft.", "WxD", 9.4),
      line("w24-frame", "component", "Face Frame", 1, "Ln. Ft.", "face-frame", 22),
      line("w24-door", "component", "Shaker Door", 1, "Each", "each", 92.16),
      line("w24-hinge", "material", "Blum Hinge", 2, "Each", "each", 5.5),
      line("w24-pin", "material", "Shelf Pin", 4, "Each", "each", 0.3),
    ],
  }),
  cabinet({
    id: "t24",
    name: "T24 - Tall Pantry (2 Door)",
    category: "Tall",
    width: 24,
    height: 90,
    depth: 24,
    description: "Tall pantry cabinet with two doors.",
    status: "Active",
    lines: [
      line("t-side", "component", "Cabinet Side", 2, "Sq. Ft.", "HxD", 48),
      line("t-bottom", "component", "Cabinet Bottom", 1, "Sq. Ft.", "WxD", 28),
      line("t-top", "component", "Cabinet Top", 1, "Sq. Ft.", "WxD", 28),
      line("t-back", "component", "Cabinet Back", 1, "Sq. Ft.", "WxH", 46),
      line("t-shelf", "component", "Adjustable Shelf", 2, "Sq. Ft.", "WxD", 22.5),
      line("t-frame", "component", "Face Frame", 1, "Ln. Ft.", "face-frame", 72),
      line("t-door", "component", "Shaker Door", 2, "Each", "each", 143.75),
      line("t-hinge", "material", "Blum Hinge", 8, "Each", "each", 5.5),
      line("t-pin", "material", "Shelf Pin", 8, "Each", "each", 0.35),
      line("t-bumper", "material", "Door Bumper", 4, "Each", "each", 0.4),
    ],
  }),
  cabinet({
    id: "v36",
    name: "V36 - Vanity Cabinet",
    category: "Vanity",
    width: 36,
    height: 34.5,
    depth: 21,
    description: "Vanity cabinet with two doors and one adjustable shelf.",
    status: "Active",
    lines: [
      line("v-side", "component", "Cabinet Side", 2, "Sq. Ft.", "HxD", 25.4),
      line("v-bottom", "component", "Cabinet Bottom", 1, "Sq. Ft.", "WxD", 22.6),
      line("v-back", "component", "Cabinet Back", 1, "Sq. Ft.", "WxH", 19.4),
      line("v-shelf", "component", "Adjustable Shelf", 1, "Sq. Ft.", "WxD", 19.9),
      line("v-frame", "component", "Face Frame", 1, "Ln. Ft.", "face-frame", 36.5),
      line("v-door", "component", "Shaker Door", 2, "Each", "each", 70),
      line("v-hinge", "material", "Blum Hinge", 4, "Each", "each", 5.5),
      line("v-pin", "material", "Shelf Pin", 4, "Each", "each", 0.3),
    ],
  }),
];

export default function CabinetsTab({
  onOpenChange,
}: {
  onOpenChange: (open: boolean) => void;
}) {
  const [cabinets, setCabinets, cabinetsReady] = useSessionState(
    "catalogue-v2-cabinets",
    SEED
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category | "all">("all");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(
    null
  );
  const [pendingDelete, setPendingDelete] = useState<Cabinet | null>(null);
  const [saved, setSaved] = useState(false);
  const [library] = useSessionState("catalogue-v2-components", EMPTY_COMPONENTS);
  const [materials] = useSessionState("catalogue-v2-materials", EMPTY_MATERIALS);
  const [componentGroup, setComponentGroup] = useState<string>("all");
  const [dragOverContents, setDragOverContents] = useState(false);
  const [pendingComponent, setPendingComponent] = useState<LibraryComponent | null>(
    null
  );
  const [pendingQty, setPendingQty] = useState("");
  const qtyRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onOpenChange(selectedId !== null);
  }, [onOpenChange, selectedId]);

  useEffect(() => {
    if (!menuId) return;
    function close() {
      setMenuId(null);
      setMenuPos(null);
    }
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menuId]);

  useEffect(() => {
    if (pendingComponent) qtyRef.current?.focus();
  }, [pendingComponent]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return cabinets.filter((item) => {
      if (category !== "all" && item.category !== category) return false;
      if (!query) return true;
      return item.name.toLowerCase().includes(query);
    });
  }, [cabinets, search, category]);

  const catalogue = useMemo(() => {
    return library.filter(
      (item) => componentGroup === "all" || item.category === componentGroup
    );
  }, [library, componentGroup]);

  const selected = cabinets.find((item) => item.id === selectedId) ?? null;

  if (!cabinetsReady) {
    return <p className="mt-6 text-sm text-gray-500">Loading…</p>;
  }

  function updateSelected(patch: Partial<Cabinet>) {
    if (!selected) return;
    setCabinets((list) =>
      list.map((item) => (item.id === selected.id ? { ...item, ...patch } : item))
    );
  }

  function queueComponent(component: LibraryComponent) {
    setPendingComponent(component);
    setPendingQty("");
  }

  function commitComponent() {
    if (!selected || !pendingComponent) return;
    const quantity = Number(pendingQty);
    if (!quantity || quantity < 1) return;
    const basis = componentBasis(pendingComponent);
    const sizedAt =
      basis === "each"
        ? componentCost(
            pendingComponent,
            selected.width,
            selected.height,
            selected.depth
          )
        : componentCost(
            pendingComponent,
            selected.baseWidth,
            selected.baseHeight,
            selected.baseDepth
          );
    const created: CabinetLine = {
      ...line(
        crypto.randomUUID(),
        "component",
        pendingComponent.name,
        quantity,
        pendingComponent.unit === "Sq. Ft." || pendingComponent.unit === "Ln. Ft."
          ? pendingComponent.unit
          : "Each",
        basis,
        money(sizedAt)
      ),
      componentId: pendingComponent.id,
      materialId: pendingComponent.defaultMaterialId || undefined,
    };
    const species = requestedSpecies(selected, pendingComponent.category);
    const assigned = species
      ? assignLineSpecies(created, pendingComponent.category, species, library, materials)
      : created;
    updateSelected({ lines: [...selected.lines, assigned] });
    setPendingComponent(null);
    setPendingQty("");
  }

  function addCabinet() {
    const created = cabinet({
      id: crypto.randomUUID(),
      name: "New Cabinet",
      category: "Base",
      width: 36,
      height: 34.5,
      depth: 24,
      description: "",
      status: "Active",
      lines: [],
    });
    setCabinets((list) => [created, ...list]);
    setSelectedId(created.id);
    setSearch("");
    setCategory("all");
  }

  if (selected) {
    const total = cabinetTotal(selected, library, materials);
    return (
      <div className="flex h-[calc(100vh-2.5rem)] flex-col overflow-hidden">
        <div className="mb-5 flex shrink-0 flex-wrap items-start justify-between gap-3">
          <div>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
            >
              <IconChevronLeft size={16} />
              Back to Cabinets
            </button>
            <h1 className="mt-2 text-2xl font-semibold text-gray-900">
              {selected.name}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSaved(true);
                window.setTimeout(() => setSaved(false), 1600);
              }}
              className="rounded-md bg-burgundy px-4 py-2 text-sm font-medium text-white hover:bg-burgundy/90"
            >
              {saved ? "Saved" : "Save Cabinet"}
            </button>
            <div className="relative">
              <button
                type="button"
                aria-label="Cabinet actions"
                onClick={(event) => {
                  event.stopPropagation();
                  setMenuId((current) =>
                    current === selected.id ? null : selected.id
                  );
                }}
                className="rounded-md border border-gray-300 p-2 text-gray-500 hover:bg-gray-50"
              >
                <IconDotsVertical size={16} />
              </button>
              {menuId === selected.id && (
                <div className="absolute right-0 z-20 mt-1 w-36 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuId(null);
                      setPendingDelete(selected);
                    }}
                    className="block w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-gray-50"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 items-stretch gap-4 xl:grid-cols-4">
          <section className="order-3 min-h-0 overflow-y-auto rounded-lg border border-gray-200 bg-white p-4 xl:order-none xl:col-start-4 xl:row-start-1">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">
              Cabinet Information
            </h2>
            <div className="space-y-3">
              <label className="block text-xs text-gray-500">
                Name
                <input
                  value={selected.name}
                  onChange={(event) => updateSelected({ name: event.target.value })}
                  className={`${inputClass} mt-1`}
                />
              </label>
              <label className="block text-xs text-gray-500">
                Category
                <select
                  value={selected.category}
                  onChange={(event) =>
                    updateSelected({ category: event.target.value as Category })
                  }
                  className={`${inputClass} mt-1`}
                >
                  {CATEGORIES.map((item) => (
                    <option key={item} value={item}>
                      {CATEGORY_LABEL[item]}
                    </option>
                  ))}
                </select>
              </label>
              {MATERIAL_GROUPS.map(([label, key, group]) => {
                const current = cabinetSpecies(
                  selected[key] ||
                    sharedGroupSpecies(selected, group, library, materials)
                );
                return (
                  <label key={key} className="block text-xs text-gray-500">
                    {label}
                    <select
                      value={current}
                      onChange={(event) => {
                        const species = event.target.value;
                        updateSelected({
                          [key]: species,
                          lines: selected.lines.map((item) =>
                            assignLineSpecies(item, group, species, library, materials)
                          ),
                        });
                      }}
                      className={`${inputClass} mt-1`}
                    >
                      {!current && <option value="">Select species</option>}
                      {CABINET_SPECIES.map((species) => (
                        <option key={species} value={species}>
                          {species}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })}
            </div>
          </section>

          <section
            className={`order-1 flex min-h-0 flex-col overflow-hidden rounded-lg border bg-white xl:order-none xl:col-span-2 xl:col-start-1 xl:row-start-1 ${
              dragOverContents ? "border-burgundy ring-2 ring-burgundy" : "border-gray-200"
            }`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOverContents(true);
            }}
            onDragLeave={() => setDragOverContents(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragOverContents(false);
              const id = event.dataTransfer.getData("text/plain");
              const component = library.find((item) => item.id === id);
              if (component) queueComponent(component);
            }}
          >
            <div className="shrink-0 px-4 py-4">
              <h2 className="text-sm font-semibold text-gray-900">
                Cabinet Contents
              </h2>
              <p className="mt-1 text-xs text-gray-500">
                Components and materials used to build this cabinet.
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
              <table className="w-full table-fixed border-collapse text-left text-[11px]">
                <colgroup>
                  <col className="w-[4.75rem]" />
                  <col className="w-[16%]" />
                  <col />
                  <col className="w-[4.25rem]" />
                  <col className="w-[3.25rem]" />
                  <col className="w-[4.5rem]" />
                  <col className="w-[4.5rem]" />
                  <col className="w-7" />
                </colgroup>
                <thead>
                  <tr className="border-y border-gray-200 bg-gray-50">
                    {["Type", "Item", "Material", "Quantity", "Unit", "Cost Each", "Total Cost"].map(
                      (label) => (
                        <th
                          key={label}
                          className="border-r border-gray-200 px-1.5 py-1.5 text-[11px] font-medium text-gray-500"
                        >
                          {label}
                        </th>
                      )
                    )}
                    <th className="px-1 py-1.5" />
                  </tr>
                </thead>
                <tbody>
                  {selected.lines.map((item) => {
                    const quote = resolveLine(item, selected, library, materials);
                    const each = quote.each;
                    const rowTotal = each * item.quantity;
                    const materialName =
                      quote.material?.name ||
                      quote.materialLabel ||
                      (item.kind === "material" ? item.name : "");
                    return (
                      <tr key={item.id} className="border-b border-gray-100">
                        <td className="border-r border-gray-200 px-1.5 py-1 text-gray-700">
                          {item.kind === "component" ? "Component" : "Material"}
                        </td>
                        <td className="break-words border-r border-gray-200 px-1.5 py-1 text-gray-700">
                          {item.name}
                        </td>
                        <td className="break-words border-r border-gray-200 px-1.5 py-1 text-gray-700">
                          {materialName}
                          {quote.error && (
                            <p className="mt-0.5 text-[10px] text-red-600">{quote.error}</p>
                          )}
                        </td>
                        <td className="border-r border-gray-200 px-1.5 py-1 text-gray-700">
                          {item.quantity}
                        </td>
                        <td className="border-r border-gray-200 px-1.5 py-1 text-gray-700">
                          {item.unit}
                        </td>
                        <td className="border-r border-gray-200 px-1.5 py-1 text-gray-900">
                          {formatCurrencyPrecise(money(each))}
                        </td>
                        <td className="border-r border-gray-200 px-1.5 py-1 text-gray-900">
                          {formatCurrencyPrecise(money(rowTotal))}
                        </td>
                        <td className="px-1 py-1">
                          <button
                            type="button"
                            aria-label={`Remove ${item.name}`}
                            onClick={() =>
                              updateSelected({
                                lines: selected.lines.filter(
                                  (row) => row.id !== item.id
                                ),
                              })
                            }
                            className="rounded p-1 text-gray-300 hover:bg-gray-100 hover:text-red-600"
                          >
                            <IconTrash size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {selected.lines.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                        No components or materials yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {pendingComponent && (
              <form
                className="flex shrink-0 items-center gap-2 border-t border-gray-200 px-3 py-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  commitComponent();
                }}
              >
                <p className="min-w-0 flex-1 truncate text-sm text-gray-700">
                  {pendingComponent.name}
                </p>
                <input
                  ref={qtyRef}
                  type="number"
                  min="1"
                  step="1"
                  value={pendingQty}
                  placeholder="Qty"
                  onChange={(event) => setPendingQty(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitComponent();
                    }
                  }}
                  className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-burgundy focus:outline-none focus:ring-1 focus:ring-burgundy"
                />
              </form>
            )}
            <div className="flex shrink-0 items-center justify-between border-t border-gray-200 bg-gray-50 px-3 py-3">
              <p className="text-sm font-medium text-gray-700">
                Total Manufacturing Cost
              </p>
              <p className="pr-8 font-semibold text-gray-900">
                {formatCurrencyPrecise(total)}
              </p>
            </div>
          </section>

          <aside className="order-2 flex h-full min-h-0 flex-col gap-4 xl:order-none xl:col-start-3 xl:row-start-1">
            <section className="shrink-0 rounded-lg border border-gray-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-gray-900">Pricing Preview</h2>
              <p className="mt-1 text-xs text-gray-500">
                Enter dimensions to see calculated cost.
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {(
                  [
                    ["Width (W)", "width", selected.width],
                    ["Height (H)", "height", selected.height],
                    ["Depth (D)", "depth", selected.depth],
                  ] as const
                ).map(([label, key, value]) => (
                  <label key={key} className="block text-[11px] text-gray-500">
                    {label}
                    <span className="relative mt-1 block">
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={value}
                        onChange={(event) =>
                          updateSelected({ [key]: Number(event.target.value) })
                        }
                        className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 pr-6 text-sm focus:border-burgundy focus:outline-none focus:ring-1 focus:ring-burgundy"
                      />
                      <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[11px] text-gray-400">
                        in
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              <div className="mt-3 rounded-lg border border-sky-100 bg-sky-50 px-3 py-3">
                <p className="text-xs text-gray-500">Estimated Manufacturing Cost</p>
                <p className="mt-1 text-2xl font-semibold text-gray-900">
                  {formatCurrencyPrecise(total)}
                </p>
              </div>
            </section>
            <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-gray-900">Components</h2>
              </div>
              <label className="mt-2 block text-[11px] text-gray-500">
                Group
                <select
                  value={componentGroup}
                  onChange={(event) => setComponentGroup(event.target.value)}
                  className={`${inputClass} mt-1 py-1.5`}
                >
                  <option value="all">All Groups</option>
                  {COMPONENT_GROUPS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <div className="mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto">
                {catalogue.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData("text/plain", item.id);
                      event.dataTransfer.effectAllowed = "copy";
                    }}
                    onClick={() => queueComponent(item)}
                    className="block w-full cursor-grab rounded-md px-2 py-1.5 text-left hover:bg-gray-50 active:cursor-grabbing"
                  >
                    <span className="block truncate text-sm font-medium text-gray-900">
                      {item.name}
                    </span>
                    <span className="block truncate text-[11px] text-gray-500">
                      {item.category}
                    </span>
                  </button>
                ))}
                {catalogue.length === 0 && (
                  <p className="px-2 py-4 text-center text-xs text-gray-500">
                    No components in this group.
                  </p>
                )}
              </div>
            </section>
          </aside>
        </div>

        {pendingDelete && (
          <ConfirmModal
            title="Delete cabinet"
            body={`Remove ${pendingDelete.name} from the catalogue?`}
            confirmLabel="Delete"
            onCancel={() => setPendingDelete(null)}
            onConfirm={() => {
              setCabinets((list) => list.filter((item) => item.id !== pendingDelete.id));
              setSelectedId(null);
              setPendingDelete(null);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="mt-6">
      <section className="overflow-visible rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 bg-cream">
        <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Cabinets</h1>
            <p className="mt-1 text-sm text-gray-500">
              Create and manage cabinet models. Each cabinet is built from
              components and materials with default dimensions and settings.
            </p>
          </div>
          <button
            type="button"
            onClick={addCabinet}
            className="inline-flex shrink-0 items-center rounded-md bg-burgundy px-4 py-2 text-sm font-medium text-white hover:bg-burgundy/90"
          >
            + Add Cabinet
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-3 px-4 pb-4">
          <div className="relative min-w-[200px] flex-1">
            <IconSearch
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search cabinets..."
              className={`${inputClass} pl-9`}
            />
          </div>
          <label className="block text-xs text-gray-500">
            Category
            <select
              value={category}
              onChange={(event) =>
                setCategory(event.target.value as Category | "all")
              }
              className={`${inputClass} mt-1 min-w-[160px]`}
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>
        </div>

        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-y border-gray-200 bg-gray-50">
              {(
                [
                  "Name",
                  "Category",
                  "Components",
                  "Materials",
                  "Estimated Cost",
                ] as const
              ).map((label) => (
                <th
                  key={label}
                  className="border-r border-gray-200 px-2 py-2.5 text-xs font-medium text-gray-500 first:px-4"
                >
                  {label}
                </th>
              ))}
              <th className="w-10 px-2 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => {
              const menuOpen = menuId === item.id;
              return (
                <tr
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={`relative cursor-pointer border-b border-gray-100 last:border-0 hover:bg-gray-50 ${
                    menuOpen ? "z-30" : ""
                  }`}
                >
                  <td className="border-r border-gray-200 px-4 py-[5px] font-medium text-gray-900">
                    {item.name}
                  </td>
                  <td className="border-r border-gray-200 px-2 py-[5px] text-gray-700">
                    {item.category}
                  </td>
                  <td className="border-r border-gray-200 px-2 py-[5px] text-gray-700">
                    {componentCount(item)}
                  </td>
                  <td className="border-r border-gray-200 px-2 py-[5px] text-gray-700">
                    {materialCount(item)}
                  </td>
                  <td className="border-r border-gray-200 px-2 py-[5px] text-gray-900">
                    {formatCurrencyPrecise(cabinetTotal(item, library, materials))}
                  </td>
                  <td className="relative px-2 py-[5px] text-right">
                    <button
                      type="button"
                      aria-label={`Actions for ${item.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (menuId === item.id) {
                          setMenuId(null);
                          setMenuPos(null);
                          return;
                        }
                        const rect = event.currentTarget.getBoundingClientRect();
                        setMenuId(item.id);
                        setMenuPos({
                          top: rect.bottom + 4,
                          right: window.innerWidth - rect.right,
                        });
                      }}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                    >
                      <IconDotsVertical size={16} />
                    </button>
                    {menuId === item.id && menuPos && (
                      <div
                        className="fixed z-50 w-32 rounded-md border border-gray-200 bg-white py-1 text-left shadow-lg"
                        style={{ top: menuPos.top, right: menuPos.right }}
                      >
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setMenuId(null);
                            setMenuPos(null);
                            setSelectedId(item.id);
                          }}
                          className="block w-full px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          Open
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setMenuId(null);
                            setMenuPos(null);
                            setPendingDelete(item);
                          }}
                          className="block w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-gray-50"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                  No cabinets match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {pendingDelete && (
        <ConfirmModal
          title="Delete cabinet"
          body={`Remove ${pendingDelete.name} from the catalogue?`}
          confirmLabel="Delete"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            setCabinets((list) => list.filter((item) => item.id !== pendingDelete.id));
            setPendingDelete(null);
          }}
        />
      )}
    </div>
  );
}
