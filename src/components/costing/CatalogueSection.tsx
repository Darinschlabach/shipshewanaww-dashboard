"use client";

import { IconSearch } from "@tabler/icons-react";
import CabinetsTab from "@/components/costing/CabinetsTab";
import ComponentsTab from "@/components/costing/ComponentsTab";
import DoorsTab from "@/components/costing/DoorsTab";
import DrawerBoxesTab from "@/components/costing/DrawerBoxesTab";
import { EmptyState } from "@/components/costing/design";
import FinishesTab from "@/components/costing/FinishesTab";
import HardwareTab from "@/components/costing/HardwareTab";
import MaterialsTab from "@/components/costing/MaterialsTab";
import SchedulesTab from "@/components/costing/SchedulesTab";
import SettingsTab from "@/components/costing/SettingsTab";
import SlotsTab from "@/components/costing/SlotsTab";
import { isCatalogueSection } from "@/components/costing/catalogue-nav";
import { useCatalogue } from "@/components/costing/CostingCatalogue";

export default function CatalogueSection({ section }: { section: string }) {
  const { settings, variables, reloadShared, refreshCounts } = useCatalogue();

  if (!isCatalogueSection(section)) {
    return (
      <EmptyState
        icon={IconSearch}
        title="This section is not in the catalogue"
        body="Choose Cabinets, Components, or another item in the menu."
      />
    );
  }

  switch (section) {
    case "cabinets":
      return <CabinetsTab />;
    case "components":
      return <ComponentsTab variables={variables} onChanged={() => void refreshCounts()} />;
    case "materials":
      return <MaterialsTab settings={settings} onChanged={() => void refreshCounts()} />;
    case "doors":
      return <DoorsTab />;
    case "drawer-boxes":
      return <DrawerBoxesTab onChanged={() => void refreshCounts()} />;
    case "finishes":
      return <FinishesTab onChanged={() => void refreshCounts()} />;
    case "hardware":
      return <HardwareTab onChanged={() => void refreshCounts()} />;
    case "schedules":
      return <SchedulesTab />;
    case "slots":
      return <SlotsTab />;
    case "settings":
      return <SettingsTab settings={settings} onSaved={reloadShared} />;
  }
}
