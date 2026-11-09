"use client";

import { useParams } from "next/navigation";
import CatalogueSection from "@/components/costing/CatalogueSection";

export default function CostingSectionPage() {
  const params = useParams();
  const section = typeof params.section === "string" ? params.section : "";
  return <CatalogueSection section={section} />;
}
