import { formatMultiplier } from "@/lib/pricing-catalogue";
import type {
  PricingDoorStyle,
  PricingFinishType,
  PricingWoodSpecies,
} from "@/lib/pricing-catalogue";
import type { QuoteRoom } from "@/lib/types";

export type PricingVariableOption = {
  id: string;
  name: string;
  multiplier: number;
};

export function toVariableOptions<
  T extends { id: string; name: string; multiplier: number },
>(rows: T[]): PricingVariableOption[] {
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    multiplier: Number(r.multiplier),
  }));
}

export function resolveRoomMultipliers(
  room: Pick<
    QuoteRoom,
    "wood_species_id" | "finish_type_id" | "door_style_id"
  >,
  woodSpecies: PricingWoodSpecies[],
  finishTypes: PricingFinishType[],
  doorStyles: PricingDoorStyle[]
): {
  wood: PricingVariableOption | null;
  finish: PricingVariableOption | null;
  door: PricingVariableOption | null;
  total: number;
} {
  const wood = woodSpecies.find((w) => w.id === room.wood_species_id) ?? null;
  const finish = finishTypes.find((f) => f.id === room.finish_type_id) ?? null;
  const door = doorStyles.find((d) => d.id === room.door_style_id) ?? null;

  const woodM = wood ? Number(wood.multiplier) : 1;
  const finishM = finish ? Number(finish.multiplier) : 1;
  const doorM = door ? Number(door.multiplier) : 1;
  const total = roundMultiplier(woodM * finishM * doorM);

  return {
    wood: wood
      ? { id: wood.id, name: wood.name, multiplier: woodM }
      : null,
    finish: finish
      ? { id: finish.id, name: finish.name, multiplier: finishM }
      : null,
    door: door ? { id: door.id, name: door.name, multiplier: doorM } : null,
    total,
  };
}

export function formatTotalMultiplier(value: number): string {
  return `${formatMultiplier(value)}x`;
}

function roundMultiplier(value: number): number {
  return Math.round(value * 1000) / 1000;
}
