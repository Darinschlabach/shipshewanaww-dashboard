"use client";

import CostingGate from "@/components/costing/CostingGate";

export default function CostingQuotesLayout({ children }: { children: React.ReactNode }) {
  return <CostingGate>{children}</CostingGate>;
}
