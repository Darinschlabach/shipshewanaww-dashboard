"use client";

import {
  IconBrush,
  IconBox,
  IconDoor,
  IconLayoutGrid,
  IconListDetails,
  IconPuzzle,
  IconSettings,
  IconStack2,
  IconTag,
  IconTool,
} from "@tabler/icons-react";

export type CatalogueSectionId =
  | "cabinets"
  | "components"
  | "materials"
  | "doors"
  | "drawer-boxes"
  | "finishes"
  | "hardware"
  | "schedules"
  | "slots"
  | "settings";

export type CatalogueNavItem = {
  id: CatalogueSectionId;
  label: string;
  icon: typeof IconTool;
  table: string;
};

export const catalogueNav: { label: string; items: CatalogueNavItem[] }[] = [
  {
    label: "Library",
    items: [
      { id: "cabinets", label: "Cabinets", icon: IconLayoutGrid, table: "costing_cabinet_templates" },
      { id: "components", label: "Components", icon: IconPuzzle, table: "costing_components" },
    ],
  },
  {
    label: "Pricing",
    items: [
      { id: "materials", label: "Materials", icon: IconStack2, table: "costing_materials" },
      { id: "doors", label: "Doors", icon: IconDoor, table: "costing_door_styles" },
      { id: "drawer-boxes", label: "Drawer Boxes", icon: IconBox, table: "costing_drawer_box_styles" },
      { id: "finishes", label: "Finishes", icon: IconBrush, table: "costing_finishes" },
      { id: "hardware", label: "Hardware", icon: IconTool, table: "costing_hardware" },
    ],
  },
  {
    label: "Setup",
    items: [
      { id: "schedules", label: "Schedules", icon: IconListDetails, table: "costing_schedules" },
      { id: "slots", label: "Slots", icon: IconTag, table: "costing_slots" },
      { id: "settings", label: "Shop Settings", icon: IconSettings, table: "costing_variables" },
    ],
  },
];

export const catalogueItems = catalogueNav.flatMap((group) => group.items);

export function isCatalogueSection(value: string): value is CatalogueSectionId {
  return catalogueItems.some((item) => item.id === value);
}

export function catalogueHref(id: CatalogueSectionId) {
  return `/costing-catalogue/${id}`;
}
