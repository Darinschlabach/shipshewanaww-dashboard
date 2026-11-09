"use client";

import { useParams } from "next/navigation";
import QuoteBuilder from "@/components/costing/QuoteBuilder";

export default function CostingQuotePage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  if (!id) return null;
  return <QuoteBuilder quoteId={id} />;
}
