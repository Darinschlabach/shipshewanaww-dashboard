"use client";

import { useState } from "react";
import CabinetsTab from "@/components/catalogue-v2/CabinetsTab";
import ComponentsTab from "@/components/catalogue-v2/ComponentsTab";
import MaterialsTab from "@/components/catalogue-v2/MaterialsTab";

const TABS = [
  { id: "cabinets", label: "Cabinets" },
  { id: "components", label: "Components" },
  { id: "materials", label: "Materials" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function CatalogueV2Page() {
  const [tab, setTab] = useState<TabId>("cabinets");
  const [cabinetOpen, setCabinetOpen] = useState(false);

  return (
    <div>
      {!cabinetOpen && (
        <>
          <div className="mb-4">
            <h1 className="text-2xl font-semibold text-gray-900">Catalogue v2</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage cabinets, components, and materials used for pricing.
            </p>
          </div>
          <div className="border-b border-gray-200">
            <div className="flex gap-6" role="tablist" aria-label="Catalogue">
              {TABS.map((item) => {
                const active = tab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTab(item.id)}
                    className={`border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
                      active
                        ? "border-burgundy text-burgundy"
                        : "border-transparent text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
      {tab === "cabinets" && <CabinetsTab onOpenChange={setCabinetOpen} />}
      {!cabinetOpen && tab === "components" && <ComponentsTab />}
      {!cabinetOpen && tab === "materials" && <MaterialsTab />}
    </div>
  );
}
