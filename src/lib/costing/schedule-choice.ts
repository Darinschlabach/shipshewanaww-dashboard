import type { SlotType } from "./calculate.ts";

export type ScheduleChoiceRef = {
  material_id: string | null;
  door_style_id: string | null;
  drawer_box_style_id: string | null;
  finish_id: string | null;
};

/** A component override wins. Otherwise the slot's default is used. */
export function choiceIdForSlot(
  slotType: SlotType,
  slotDefault: ScheduleChoiceRef | null | undefined,
  componentOverride: ScheduleChoiceRef | null | undefined
): string | null {
  const source = componentOverride ?? slotDefault;
  if (!source) return null;
  if (slotType === "material") return source.material_id;
  if (slotType === "door") return source.door_style_id;
  if (slotType === "drawer_box") return source.drawer_box_style_id;
  return source.finish_id;
}
