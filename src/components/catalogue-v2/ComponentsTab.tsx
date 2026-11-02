"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { IconDotsVertical, IconPencil, IconSearch } from "@tabler/icons-react";
import ConfirmModal from "@/components/ConfirmModal";
import Modal from "@/components/Modal";
import { useSessionState } from "@/components/catalogue-v2/session-state";

const CATEGORIES = [
  "Cabinet Box",
  "Shelving",
  "Face Frame",
  "Doors",
  "Drawers",
  "Miscellaneous",
  "Panels",
] as const;

const MATERIALS = [
  '3/4" Maple Plywood',
  '1/2" Maple Plywood',
  '1/4" Maple Plywood',
  "Hard Maple Lumber",
  "Multiple",
] as const;

const MATERIAL_TYPES = [
  "Plywood",
  "Hardwood",
  "Hardware",
  "Pullouts",
  "Finishes",
  "Multiple",
] as const;

const PRICING_UNITS = ["Square Foot", "Linear Foot", "Each"] as const;

type Category = (typeof CATEGORIES)[number];
type MaterialName = (typeof MATERIALS)[number];
type MaterialType = (typeof MATERIAL_TYPES)[number];
type PricingUnit = (typeof PRICING_UNITS)[number];
type MeasureUnit = "Sq. Ft." | "Ln. Ft." | "Each";
type Status = "Active" | "Inactive";
type DimSource = "W" | "H" | "D" | "custom";

type CatalogueComponent = {
  id: string;
  name: string;
  category: Category;
  description: string;
  primaryMaterial: MaterialName;
  materialType: MaterialType;
  materialThickness: string;
  defaultMaterialId: string;
  pricingUnit: PricingUnit;
  widthFormula: DimSource;
  heightFormula: DimSource;
  widthInches: string;
  heightInches: string;
  formula: string;
  defaultQty: number;
  wasteFactor: number;
  unit: MeasureUnit;
  status: Status;
  pricePerUnit: number;
};

const FORMULA_OPTIONS: { value: DimSource; label: string }[] = [
  { value: "H", label: "Cabinet Height" },
  { value: "D", label: "Cabinet Depth" },
  { value: "W", label: "Cabinet Width" },
  { value: "custom", label: "Custom" },
];

/** Sample 24 × 34.5 × 24 cabinet side, 10% waste, estimates $26.78. */
const MAPLE_34_SQFT = 26.78 / (((34.5 * 24) / 144) * 1.1);

const MATERIAL_PRICES: Record<MaterialName, number> = {
  '3/4" Maple Plywood': MAPLE_34_SQFT,
  '1/2" Maple Plywood': 3.2,
  '1/4" Maple Plywood': 2.15,
  "Hard Maple Lumber": 8.75,
  Multiple: 42,
};

const inputClass =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-burgundy focus:outline-none focus:ring-1 focus:ring-burgundy";

function unitForPricing(pricingUnit: PricingUnit): MeasureUnit {
  if (pricingUnit === "Square Foot") return "Sq. Ft.";
  if (pricingUnit === "Linear Foot") return "Ln. Ft.";
  return "Each";
}

function materialFromLegacy(material: string): {
  materialType: MaterialType;
  materialThickness: string;
} {
  const quoted = material.match(/^(\d+\/\d+|\d+)"/);
  const lower = material.toLowerCase();
  let materialType: MaterialType = "Plywood";
  if (material === "Multiple") materialType = "Multiple";
  else if (lower.includes("lumber") || lower.includes("hardwood")) materialType = "Hardwood";
  else if (lower.includes("hardware") || lower.includes("hinge")) materialType = "Hardware";
  else if (lower.includes("pullout")) materialType = "Pullouts";
  else if (lower.includes("finish") || lower.includes("lacquer")) materialType = "Finishes";
  return {
    materialType,
    materialThickness: quoted ? `${quoted[1]}"` : "",
  };
}

function normalizeSide(source: string, assemblyFallback: DimSource): DimSource {
  if (source === "W" || source === "H" || source === "D" || source === "custom") {
    return source;
  }
  if (source === "H-adj") return "H";
  if (source === "assembly") return assemblyFallback;
  return "custom";
}

function sideLabel(source: DimSource, inches: string): string {
  if (source === "W") return "Cabinet Width";
  if (source === "H") return "Cabinet Height";
  if (source === "D") return "Cabinet Depth";
  return inches.trim() || "Custom";
}

function isLinearUnit(unit?: string, pricingUnit?: string) {
  return unit === "Ln. Ft." || pricingUnit === "Linear Foot";
}

function isSquareUnit(unit?: string, pricingUnit?: string) {
  return unit === "Sq. Ft." || pricingUnit === "Square Foot";
}

function unitLabel(unit?: string, pricingUnit?: string) {
  if (pricingUnit === "Linear Foot") return "Lin. Ft.";
  if (pricingUnit === "Square Foot") return "Sq. Ft.";
  if (pricingUnit === "Each") return "Each";
  if (unit === "Ln. Ft.") return "Lin. Ft.";
  if (unit === "Sq. Ft.") return "Sq. Ft.";
  if (unit === "Each") return "Each";
  return unit ?? "";
}

function linearWidth(
  unit: string | undefined,
  pricingUnit: string | undefined,
  widthFormula: DimSource,
  heightFormula: DimSource,
  widthInches: string,
  heightInches: string
) {
  if (!isLinearUnit(unit, pricingUnit)) return { widthFormula, widthInches };
  const widthBlank = widthFormula === "custom" && !widthInches.trim();
  const heightUseful = heightFormula !== "custom" || !!heightInches.trim();
  if (widthBlank && heightUseful) {
    return { widthFormula: heightFormula, widthInches: heightInches };
  }
  return { widthFormula, widthInches };
}

function formulaText(
  widthFormula: DimSource,
  heightFormula: DimSource,
  widthInches: string,
  heightInches: string,
  linear = false
): string {
  const width = sideLabel(widthFormula, widthInches);
  if (linear) return width;
  return `${width} × ${sideLabel(heightFormula, heightInches)}`;
}

function componentDraft(item: CatalogueComponent): CatalogueComponent {
  const legacy = materialFromLegacy(item.primaryMaterial ?? "");
  const widthFormula = normalizeSide(item.widthFormula, "W");
  const heightFormula = normalizeSide(item.heightFormula, "H");
  const widthInches = item.widthInches ?? "";
  const heightInches = item.heightInches ?? "";
  const length = linearWidth(
    item.unit,
    item.pricingUnit,
    widthFormula,
    heightFormula,
    widthInches,
    heightInches
  );
  return {
    ...item,
    materialType: item.materialType ?? legacy.materialType,
    materialThickness: item.materialThickness ?? legacy.materialThickness,
    defaultMaterialId: item.defaultMaterialId ?? "",
    widthFormula: length.widthFormula,
    heightFormula,
    widthInches: length.widthInches,
    heightInches,
    formula: formulaText(
      length.widthFormula,
      heightFormula,
      length.widthInches,
      heightInches,
      isLinearUnit(item.unit, item.pricingUnit)
    ),
  };
}

function part(
  partial: Omit<
    CatalogueComponent,
    | "pricingUnit"
    | "pricePerUnit"
    | "materialType"
    | "materialThickness"
    | "defaultMaterialId"
    | "widthInches"
    | "heightInches"
    | "formula"
    | "widthFormula"
    | "heightFormula"
  > & {
    pricingUnit?: PricingUnit;
    materialType?: MaterialType;
    materialThickness?: string;
    defaultMaterialId?: string;
    widthInches?: string;
    heightInches?: string;
    formula?: string;
    widthFormula: string;
    heightFormula: string;
  }
): CatalogueComponent {
  const pricingUnit =
    partial.pricingUnit ??
    (partial.unit === "Ln. Ft."
      ? "Linear Foot"
      : partial.unit === "Each"
        ? "Each"
        : "Square Foot");
  const legacy = materialFromLegacy(partial.primaryMaterial);
  const widthFormula = normalizeSide(partial.widthFormula, "W");
  const heightFormula = normalizeSide(partial.heightFormula, "H");
  const widthInches = partial.widthInches ?? "";
  const heightInches = partial.heightInches ?? "";
  const length = linearWidth(
    partial.unit,
    pricingUnit,
    widthFormula,
    heightFormula,
    widthInches,
    heightInches
  );
  return {
    ...partial,
    pricingUnit,
    unit: partial.unit,
    materialType: partial.materialType ?? legacy.materialType,
    materialThickness: partial.materialThickness ?? legacy.materialThickness,
    defaultMaterialId: partial.defaultMaterialId ?? "",
    widthFormula: length.widthFormula,
    heightFormula,
    widthInches: length.widthInches,
    heightInches,
    formula: formulaText(
      length.widthFormula,
      heightFormula,
      length.widthInches,
      heightInches,
      pricingUnit === "Linear Foot"
    ),
    pricePerUnit: MATERIAL_PRICES[partial.primaryMaterial],
  };
}

const EMPTY_LIBRARY: { id: string; name: string }[] = [];

const SEED: CatalogueComponent[] = [
  part({
    id: "cabinet-side",
    name: "Cabinet Side",
    category: "Cabinet Box",
    description: "Vertical side panel for cabinet carcass.",
    primaryMaterial: '3/4" Maple Plywood',
    widthFormula: "D",
    heightFormula: "H",
    formula: "H × D",
    defaultQty: 1,
    wasteFactor: 10,
    unit: "Sq. Ft.",
    status: "Active",
  }),
  part({
    id: "cabinet-bottom",
    name: "Cabinet Bottom",
    category: "Cabinet Box",
    description: "Bottom panel of the cabinet box.",
    primaryMaterial: '3/4" Maple Plywood',
    widthFormula: "W",
    heightFormula: "D",
    formula: "W × D",
    defaultQty: 1,
    wasteFactor: 10,
    unit: "Sq. Ft.",
    status: "Active",
  }),
  part({
    id: "cabinet-top",
    name: "Cabinet Top",
    category: "Cabinet Box",
    description: "Top panel of the cabinet box.",
    primaryMaterial: '3/4" Maple Plywood',
    widthFormula: "W",
    heightFormula: "D",
    formula: "W × D",
    defaultQty: 1,
    wasteFactor: 10,
    unit: "Sq. Ft.",
    status: "Active",
  }),
  part({
    id: "cabinet-back",
    name: "Cabinet Back",
    category: "Cabinet Box",
    description: "Back panel of the cabinet box.",
    primaryMaterial: '1/4" Maple Plywood',
    widthFormula: "W",
    heightFormula: "H",
    formula: "W × H",
    defaultQty: 1,
    wasteFactor: 10,
    unit: "Sq. Ft.",
    status: "Active",
  }),
  part({
    id: "adjustable-shelf",
    name: "Adjustable Shelf",
    category: "Shelving",
    description: "Movable shelf inside the cabinet.",
    primaryMaterial: '3/4" Maple Plywood',
    widthFormula: "W",
    heightFormula: "D",
    formula: "W × D",
    defaultQty: 1,
    wasteFactor: 10,
    unit: "Sq. Ft.",
    status: "Active",
  }),
  part({
    id: "fixed-shelf",
    name: "Fixed Shelf",
    category: "Shelving",
    description: "Fixed shelf inside the cabinet.",
    primaryMaterial: '3/4" Maple Plywood',
    widthFormula: "W",
    heightFormula: "D",
    formula: "W × D",
    defaultQty: 1,
    wasteFactor: 10,
    unit: "Sq. Ft.",
    status: "Active",
  }),
  part({
    id: "face-frame-stile",
    name: "Face Frame Stile",
    category: "Face Frame",
    description: "Vertical face-frame member.",
    primaryMaterial: "Hard Maple Lumber",
    widthFormula: "none",
    heightFormula: "H",
    formula: "H",
    defaultQty: 1,
    wasteFactor: 10,
    unit: "Ln. Ft.",
    status: "Active",
  }),
  part({
    id: "face-frame-rail",
    name: "Face Frame Rail",
    category: "Face Frame",
    description: "Horizontal face-frame member.",
    primaryMaterial: "Hard Maple Lumber",
    widthFormula: "none",
    heightFormula: "H-adj",
    formula: "H (adjusted)",
    defaultQty: 1,
    wasteFactor: 10,
    unit: "Ln. Ft.",
    status: "Active",
  }),
  part({
    id: "center-stile",
    name: "Center Stile",
    category: "Face Frame",
    description: "Center vertical face-frame member.",
    primaryMaterial: "Hard Maple Lumber",
    widthFormula: "none",
    heightFormula: "H",
    formula: "H",
    defaultQty: 1,
    wasteFactor: 10,
    unit: "Ln. Ft.",
    status: "Active",
  }),
  part({
    id: "shaker-door",
    name: "Shaker Door",
    category: "Doors",
    description: "Assembled shaker-style door.",
    primaryMaterial: "Multiple",
    widthFormula: "assembly",
    heightFormula: "assembly",
    formula: "Assembly",
    defaultQty: 1,
    wasteFactor: 10,
    unit: "Each",
    pricingUnit: "Each",
    status: "Active",
  }),
  part({
    id: "drawer-box-side",
    name: "Drawer Box Side",
    category: "Drawers",
    description: "Side of the drawer box.",
    primaryMaterial: '1/2" Maple Plywood',
    widthFormula: "D",
    heightFormula: "H",
    formula: "D × H",
    defaultQty: 1,
    wasteFactor: 10,
    unit: "Sq. Ft.",
    status: "Active",
  }),
  part({
    id: "drawer-box-front",
    name: "Drawer Box Front",
    category: "Drawers",
    description: "Front of the drawer box.",
    primaryMaterial: '1/2" Maple Plywood',
    widthFormula: "W",
    heightFormula: "H",
    formula: "W × H",
    defaultQty: 1,
    wasteFactor: 10,
    unit: "Sq. Ft.",
    status: "Active",
  }),
  part({
    id: "drawer-box-bottom",
    name: "Drawer Box Bottom",
    category: "Drawers",
    description: "Bottom of the drawer box.",
    primaryMaterial: '1/4" Maple Plywood',
    widthFormula: "W",
    heightFormula: "D",
    formula: "W × D",
    defaultQty: 1,
    wasteFactor: 10,
    unit: "Sq. Ft.",
    status: "Active",
  }),
  part({
    id: "toe-kick",
    name: "Toe Kick",
    category: "Miscellaneous",
    description: "Toe-kick panel at the base of the cabinet.",
    primaryMaterial: '3/4" Maple Plywood',
    widthFormula: "W",
    heightFormula: "H",
    formula: "W × H",
    defaultQty: 1,
    wasteFactor: 10,
    unit: "Sq. Ft.",
    status: "Active",
  }),
  part({
    id: "end-panel",
    name: "End Panel",
    category: "Panels",
    description: "Finished end panel.",
    primaryMaterial: '3/4" Maple Plywood',
    widthFormula: "D",
    heightFormula: "H",
    formula: "H × D",
    defaultQty: 1,
    wasteFactor: 10,
    unit: "Sq. Ft.",
    status: "Active",
  }),
  part({
    id: "nail-rail",
    name: "Nail Rail",
    category: "Miscellaneous",
    description: "Rail used to fasten the cabinet to the wall.",
    primaryMaterial: '3/4" Maple Plywood',
    widthFormula: "W",
    heightFormula: "H",
    formula: "W × H",
    defaultQty: 1,
    wasteFactor: 10,
    unit: "Sq. Ft.",
    status: "Active",
  }),
];

function DimensionFormulas({
  item,
  disabled,
  selectClass,
  onPatch,
}: {
  item: CatalogueComponent;
  disabled: boolean;
  selectClass: string;
  onPatch: (patch: Partial<CatalogueComponent>) => void;
}) {
  const linear = isLinearUnit(item.unit, item.pricingUnit);
  const square = isSquareUnit(item.unit, item.pricingUnit);

  function choose(unit: "Ln. Ft." | "Sq. Ft.") {
    const pricingUnit: PricingUnit = unit === "Ln. Ft." ? "Linear Foot" : "Square Foot";
    const length = linearWidth(
      unit,
      pricingUnit,
      item.widthFormula,
      item.heightFormula,
      item.widthInches ?? "",
      item.heightInches ?? ""
    );
    onPatch({
      unit,
      pricingUnit,
      widthFormula: length.widthFormula,
      widthInches: length.widthInches,
    });
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900">Dimension Formulas</h3>
        <div className="flex shrink-0 items-center gap-2.5">
          <label className="flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-gray-700">
            <input
              type="checkbox"
              checked={linear}
              disabled={disabled}
              onChange={() => choose("Ln. Ft.")}
              className="h-3.5 w-3.5 accent-burgundy disabled:opacity-100"
            />
            Lin. Ft.
          </label>
          <label className="flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-gray-700">
            <input
              type="checkbox"
              checked={square}
              disabled={disabled}
              onChange={() => choose("Sq. Ft.")}
              className="h-3.5 w-3.5 accent-burgundy disabled:opacity-100"
            />
            Sq. Ft.
          </label>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 space-y-2">
          <select
            disabled={disabled}
            value={item.widthFormula}
            onChange={(e) => onPatch({ widthFormula: e.target.value as DimSource })}
            className={selectClass}
          >
            {FORMULA_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {item.widthFormula === "custom" && (
            <input
              disabled={disabled}
              type="number"
              min="0"
              step="0.125"
              value={item.widthInches ?? ""}
              placeholder="Inches"
              onChange={(e) => onPatch({ widthInches: e.target.value })}
              className={selectClass}
            />
          )}
        </div>
        {!linear && (
          <>
            <span className="pt-2 text-base font-medium text-gray-500">×</span>
            <div className="min-w-0 flex-1 space-y-2">
              <select
                disabled={disabled}
                value={item.heightFormula}
                onChange={(e) => onPatch({ heightFormula: e.target.value as DimSource })}
                className={selectClass}
              >
                {FORMULA_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {item.heightFormula === "custom" && (
                <input
                  disabled={disabled}
                  type="number"
                  min="0"
                  step="0.125"
                  value={item.heightInches ?? ""}
                  placeholder="Inches"
                  onChange={(e) => onPatch({ heightInches: e.target.value })}
                  className={selectClass}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function ComponentsTab() {
  const [components, setComponents, componentsReady] = useSessionState(
    "catalogue-v2-components",
    SEED
  );
  const [library] = useSessionState("catalogue-v2-materials", EMPTY_LIBRARY);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category | "all">("all");
  const [selectedId, setSelectedId] = useState("cabinet-side");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(
    null
  );
  const [pendingDelete, setPendingDelete] = useState<CatalogueComponent | null>(null);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<CatalogueComponent | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return components.filter((item) => {
      if (category !== "all" && item.category !== category) return false;
      if (!query) return true;
      return [item.name, item.category, item.materialType, item.materialThickness, item.primaryMaterial, item.formula]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [components, search, category]);

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
    if (filtered.length === 0) return;
    if (!filtered.some((item) => item.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  useEffect(() => {
    if (!componentsReady) return;
    setComponents((list) => {
      let changed = false;
      const next = list.map((item) => {
        const legacy = materialFromLegacy(item.primaryMaterial ?? "");
        const materialType = item.materialType ?? legacy.materialType;
        const materialThickness =
          typeof item.materialThickness === "string"
            ? item.materialThickness
            : legacy.materialThickness;
        const normalizedWidth = normalizeSide(item.widthFormula, "W");
        const heightFormula = normalizeSide(item.heightFormula, "H");
        const storedWidthInches = typeof item.widthInches === "string" ? item.widthInches : "";
        const heightInches = typeof item.heightInches === "string" ? item.heightInches : "";
        const length = linearWidth(
          item.unit,
          item.pricingUnit,
          normalizedWidth,
          heightFormula,
          storedWidthInches,
          heightInches
        );
        const widthFormula = length.widthFormula;
        const widthInches = length.widthInches;
        const defaultMaterialId =
          typeof item.defaultMaterialId === "string" ? item.defaultMaterialId : "";
        const formula = formulaText(
          widthFormula,
          heightFormula,
          widthInches,
          heightInches,
          isLinearUnit(item.unit, item.pricingUnit)
        );
        if (
          materialType === item.materialType &&
          materialThickness === item.materialThickness &&
          widthFormula === item.widthFormula &&
          heightFormula === item.heightFormula &&
          widthInches === item.widthInches &&
          heightInches === item.heightInches &&
          defaultMaterialId === item.defaultMaterialId &&
          formula === item.formula
        ) {
          return item;
        }
        changed = true;
        return {
          ...item,
          materialType,
          materialThickness,
          widthFormula,
          heightFormula,
          widthInches,
          heightInches,
          defaultMaterialId,
          formula,
        };
      });
      return changed ? next : list;
    });
  }, [componentsReady, setComponents]);

  const selected =
    components.find((item) => item.id === selectedId) ?? filtered[0] ?? null;

  function updateSelected(patch: Partial<CatalogueComponent>) {
    if (!selected) return;
    setComponents((list) =>
      list.map((item) => {
        if (item.id !== selected.id) return item;
        const next = { ...item, ...patch };
        if (
          patch.widthFormula ||
          patch.heightFormula ||
          patch.widthInches !== undefined ||
          patch.heightInches !== undefined ||
          patch.unit ||
          patch.pricingUnit
        ) {
          next.widthFormula = normalizeSide(next.widthFormula, "W");
          next.heightFormula = normalizeSide(next.heightFormula, "H");
          next.formula = formulaText(
            next.widthFormula,
            next.heightFormula,
            next.widthInches ?? "",
            next.heightInches ?? "",
            isLinearUnit(next.unit, next.pricingUnit)
          );
        }
        if (patch.pricingUnit) {
          next.unit = unitForPricing(patch.pricingUnit);
        }
        if (patch.primaryMaterial) {
          next.pricePerUnit = MATERIAL_PRICES[patch.primaryMaterial];
        }
        return next;
      })
    );
  }

  function patchDraft(patch: Partial<CatalogueComponent>) {
    setDraft((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      next.widthFormula = normalizeSide(next.widthFormula, "W");
      next.heightFormula = normalizeSide(next.heightFormula, "H");
      next.formula = formulaText(
        next.widthFormula,
        next.heightFormula,
        next.widthInches ?? "",
        next.heightInches ?? "",
        isLinearUnit(next.unit, next.pricingUnit)
      );
      return next;
    });
  }

  function beginEdit(item: CatalogueComponent) {
    setSelectedId(item.id);
    setDraft(componentDraft(item));
    setEditing(true);
  }

  function discardEdit() {
    setEditing(false);
    setCreating(false);
    setDraft(null);
  }

  function saveEdit() {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) return;
    const saved = {
      name,
      category: draft.category,
      materialType: draft.materialType,
      materialThickness: (draft.materialThickness ?? "").trim(),
      defaultMaterialId: draft.defaultMaterialId ?? "",
      widthFormula: draft.widthFormula,
      heightFormula: draft.heightFormula,
      widthInches: draft.widthInches ?? "",
      heightInches: draft.heightInches ?? "",
      unit: draft.unit,
      pricingUnit: draft.pricingUnit,
      formula: formulaText(
        draft.widthFormula,
        draft.heightFormula,
        draft.widthInches ?? "",
        draft.heightInches ?? "",
        isLinearUnit(draft.unit, draft.pricingUnit)
      ),
    };
    if (creating) {
      const created = { ...draft, ...saved };
      setComponents((list) => [created, ...list]);
      setSelectedId(created.id);
      setSearch("");
      setCategory("all");
      setCreating(false);
      setEditing(false);
      setDraft(null);
      return;
    }
    if (!selected) return;
    updateSelected(saved);
    setEditing(false);
    setDraft(null);
  }

  useEffect(() => {
    if (editing) nameRef.current?.focus();
  }, [editing]);

  function addComponent() {
    const created = part({
      id: crypto.randomUUID(),
      name: "New Component",
      category: "Cabinet Box",
      description: "",
      primaryMaterial: '3/4" Maple Plywood',
      widthFormula: "D",
      heightFormula: "H",
      formula: "Cabinet Depth × Cabinet Height",
      defaultQty: 1,
      wasteFactor: 10,
      unit: "Sq. Ft.",
      status: "Active",
    });
    setDraft(created);
    setCreating(true);
    setEditing(true);
  }

  if (!componentsReady) {
    return <p className="mt-6 text-sm text-gray-500">Loading…</p>;
  }

  const panelEditing = editing && !creating;
  const form =
    (panelEditing && draft) || (selected ? componentDraft(selected) : null);
  const lockedClass = panelEditing
    ? ""
    : " pointer-events-none cursor-default bg-gray-100 text-gray-800 disabled:cursor-default disabled:bg-gray-100 disabled:opacity-100";
  const fieldClass = `${inputClass} mt-1${lockedClass}`;
  const formulaClass = `${inputClass}${lockedClass}`;

  return (
    <div className="mt-6 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="overflow-visible rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 bg-cream">
        <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Components</h1>
            <p className="mt-1 text-sm text-gray-500">
              Define the building blocks used to construct cabinets. Each
              component has materials and dimension formulas.
            </p>
          </div>
          <button
            type="button"
            onClick={addComponent}
            className="inline-flex shrink-0 items-center rounded-md bg-burgundy px-4 py-2 text-sm font-medium text-white hover:bg-burgundy/90"
          >
            + Add Component
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
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search components..."
              className={`${inputClass} pl-9`}
            />
          </div>
          <label className="block text-xs text-gray-500">
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category | "all")}
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

        <div>
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-y border-gray-200 bg-gray-50">
                <th className="border-r border-gray-200 px-4 py-2.5 text-xs font-medium text-gray-500">
                  Name
                </th>
                <th className="border-r border-gray-200 px-2 py-2.5 text-xs font-medium text-gray-500">
                  Category
                </th>
                <th className="border-r border-gray-200 px-2 py-2.5 text-xs font-medium text-gray-500">
                  Material Type
                </th>
                <th className="border-r border-gray-200 px-2 py-2.5 text-xs font-medium text-gray-500">
                  Formula
                </th>
                <th className="border-r border-gray-200 px-2 py-2.5 text-xs font-medium text-gray-500">
                  Unit
                </th>
                <th className="w-10 px-2 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const active = item.id === selected?.id;
                const menuOpen = menuId === item.id;
                const editingRow =
                  panelEditing && draft && item.id === selected?.id ? draft : null;
                return (
                  <tr
                    key={item.id}
                    onClick={() => {
                      if (item.id !== selectedId || creating) {
                        setEditing(false);
                        setCreating(false);
                        setDraft(null);
                      }
                      setSelectedId(item.id);
                    }}
                    className={`relative cursor-pointer border-b border-gray-100 last:border-0 ${
                      menuOpen ? "z-30" : ""
                    } ${active ? "bg-gray-50" : "hover:bg-gray-50/70"}`}
                  >
                    <td className="border-r border-gray-200 px-4 py-[5px] font-medium text-gray-900">
                      {item.name}
                    </td>
                    <td className="border-r border-gray-200 px-2 py-[5px] text-gray-700">
                      {item.category}
                    </td>
                    <td className="border-r border-gray-200 px-2 py-[5px] text-gray-700">
                      {item.materialType ??
                        materialFromLegacy(item.primaryMaterial).materialType}
                    </td>
                    <td className="border-r border-gray-200 px-2 py-[5px] text-gray-700">
                      {editingRow ? editingRow.formula : item.formula}
                    </td>
                    <td className="border-r border-gray-200 px-2 py-[5px] text-gray-700">
                      {unitLabel(
                        editingRow ? editingRow.unit : item.unit,
                        editingRow ? editingRow.pricingUnit : item.pricingUnit
                      )}
                    </td>
                    <td className="relative px-2 py-[5px] text-right">
                      <button
                        type="button"
                        aria-label={`Actions for ${item.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(item.id);
                          if (menuId === item.id) {
                            setMenuId(null);
                            setMenuPos(null);
                            return;
                          }
                          const rect = e.currentTarget.getBoundingClientRect();
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
                          className="fixed z-50 w-36 rounded-md border border-gray-200 bg-white py-1 text-left shadow-lg"
                          style={{ top: menuPos.top, right: menuPos.right }}
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuId(null);
                              setMenuPos(null);
                              beginEdit(item);
                            }}
                            className="block w-full px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
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
                    No components match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <aside className="rounded-lg border border-gray-200 bg-white p-4 xl:sticky xl:top-0">
        {form ? (
          <div className="space-y-6">
            <div>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-gray-900">
                  Component Details
                </h2>
                {!panelEditing && (
                  <button
                    type="button"
                    onClick={() => beginEdit(form)}
                    className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
                  >
                    <IconPencil size={14} />
                    Edit
                  </button>
                )}
              </div>
              <div className="space-y-3">
                <label className="block text-xs text-gray-500">
                  Name
                  <input
                    ref={creating ? undefined : nameRef}
                    disabled={!panelEditing}
                    value={form.name}
                    onChange={(e) => patchDraft({ name: e.target.value })}
                    className={fieldClass}
                  />
                </label>
                <label className="block text-xs text-gray-500">
                  Category
                  <select
                    disabled={!panelEditing}
                    value={form.category}
                    onChange={(e) =>
                      patchDraft({ category: e.target.value as Category })
                    }
                    className={fieldClass}
                  >
                    {CATEGORIES.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold text-gray-900">Material</h3>
              <div className="space-y-3">
                <label className="block text-xs text-gray-500">
                  Material Type
                  <select
                    disabled={!panelEditing}
                    value={form.materialType}
                    onChange={(e) =>
                      patchDraft({
                        materialType: e.target.value as MaterialType,
                      })
                    }
                    className={fieldClass}
                  >
                    {MATERIAL_TYPES.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs text-gray-500">
                  Thickness
                  <input
                    disabled={!panelEditing}
                    value={form.materialThickness}
                    placeholder='3/4"'
                    onChange={(e) =>
                      patchDraft({ materialThickness: e.target.value })
                    }
                    className={fieldClass}
                  />
                </label>
                <label className="block text-xs text-gray-500">
                  Default Material
                  <select
                    disabled={!panelEditing}
                    value={form.defaultMaterialId ?? ""}
                    onChange={(e) =>
                      patchDraft({ defaultMaterialId: e.target.value })
                    }
                    className={fieldClass}
                  >
                    <option value="">Select from library</option>
                    {library.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <DimensionFormulas
              item={form}
              disabled={!panelEditing}
              selectClass={formulaClass}
              onPatch={patchDraft}
            />
            {panelEditing && (
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={discardEdit}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Discard changes
                </button>
                <button
                  type="button"
                  onClick={saveEdit}
                  className="rounded-md bg-burgundy px-4 py-2 text-sm font-medium text-white hover:bg-burgundy/90"
                >
                  Save
                </button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            Select a component to see its details.
          </p>
        )}
      </aside>

      {creating && draft && (
        <Modal
          title="Create Component"
          onClose={discardEdit}
          className="max-h-[90vh] w-full max-w-md"
          bodyClassName="!flex !min-h-0 !flex-col !overflow-hidden !p-0"
        >
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <label className="block text-xs text-gray-500">
              Name
              <input
                ref={nameRef}
                value={draft.name}
                onChange={(e) => patchDraft({ name: e.target.value })}
                className={`${inputClass} mt-1`}
              />
            </label>
            <label className="block text-xs text-gray-500">
              Category
              <select
                value={draft.category}
                onChange={(e) =>
                  patchDraft({ category: e.target.value as Category })
                }
                className={`${inputClass} mt-1`}
              >
                {CATEGORIES.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <div>
              <h3 className="mb-3 text-sm font-semibold text-gray-900">Material</h3>
              <div className="space-y-3">
                <label className="block text-xs text-gray-500">
                  Material Type
                  <select
                    value={draft.materialType}
                    onChange={(e) =>
                      patchDraft({ materialType: e.target.value as MaterialType })
                    }
                    className={`${inputClass} mt-1`}
                  >
                    {MATERIAL_TYPES.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs text-gray-500">
                  Thickness
                  <input
                    value={draft.materialThickness}
                    placeholder='3/4"'
                    onChange={(e) =>
                      patchDraft({ materialThickness: e.target.value })
                    }
                    className={`${inputClass} mt-1`}
                  />
                </label>
                <label className="block text-xs text-gray-500">
                  Default Material
                  <select
                    value={draft.defaultMaterialId ?? ""}
                    onChange={(e) =>
                      patchDraft({ defaultMaterialId: e.target.value })
                    }
                    className={`${inputClass} mt-1`}
                  >
                    <option value="">Select from library</option>
                    {library.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <DimensionFormulas
              item={draft}
              disabled={false}
              selectClass={inputClass}
              onPatch={patchDraft}
            />
          </div>
          <div className="flex shrink-0 justify-end gap-2 border-t border-gray-200 px-6 py-4">
            <button
              type="button"
              onClick={discardEdit}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={saveEdit}
              className="rounded-md bg-burgundy px-4 py-2 text-sm font-medium text-white hover:bg-burgundy/90"
            >
              Create Component
            </button>
          </div>
        </Modal>
      )}

      {pendingDelete && (
        <ConfirmModal
          title="Delete component"
          body={`Remove ${pendingDelete.name} from the component list?`}
          confirmLabel="Delete"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            setComponents((list) =>
              list.filter((item) => item.id !== pendingDelete.id)
            );
            setPendingDelete(null);
          }}
        />
      )}
    </div>
  );
}
