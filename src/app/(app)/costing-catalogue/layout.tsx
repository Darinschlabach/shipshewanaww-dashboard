"use client";

import CostingCatalogue from "@/components/costing/CostingCatalogue";

export default function CostingCatalogueLayout({ children }: { children: React.ReactNode }) {
  return <CostingCatalogue>{children}</CostingCatalogue>;
}
