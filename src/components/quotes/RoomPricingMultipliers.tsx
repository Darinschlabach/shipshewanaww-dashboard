"use client";

import { useEffect, useMemo, useState } from "react";
import { IconPencil } from "@tabler/icons-react";
import { formatMultiplier } from "@/lib/pricing-catalogue";
import {
  formatTotalMultiplier,
  resolveRoomMultipliers,
} from "@/lib/quote-room-multipliers";
import type {
  PricingDoorStyle,
  PricingFinishType,
  PricingWoodSpecies,
} from "@/lib/pricing-catalogue";
import type { QuoteRoom } from "@/lib/types";

interface RoomPricingMultipliersProps {
  room: QuoteRoom;
  woodSpecies: PricingWoodSpecies[];
  finishTypes: PricingFinishType[];
  doorStyles: PricingDoorStyle[];
  onSave: (patch: {
    wood_species_id: string | null;
    finish_type_id: string | null;
    door_style_id: string | null;
  }) => Promise<void>;
}

function MultiplierBadge({ value }: { value: number }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded bg-emerald-100 px-1.5 py-0 text-[10px] font-semibold tabular-nums text-emerald-800">
      {formatMultiplier(value)}x
    </span>
  );
}

export default function RoomPricingMultipliers({
  room,
  woodSpecies,
  finishTypes,
  doorStyles,
  onSave,
}: RoomPricingMultipliersProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [woodId, setWoodId] = useState(room.wood_species_id ?? "");
  const [finishId, setFinishId] = useState(room.finish_type_id ?? "");
  const [doorId, setDoorId] = useState(room.door_style_id ?? "");

  useEffect(() => {
    setWoodId(room.wood_species_id ?? "");
    setFinishId(room.finish_type_id ?? "");
    setDoorId(room.door_style_id ?? "");
  }, [room]);

  const resolved = useMemo(
    () => resolveRoomMultipliers(room, woodSpecies, finishTypes, doorStyles),
    [room, woodSpecies, finishTypes, doorStyles]
  );

  const draftResolved = useMemo(() => {
    const draftRoom = {
      wood_species_id: woodId || null,
      finish_type_id: finishId || null,
      door_style_id: doorId || null,
    };
    return resolveRoomMultipliers(
      draftRoom,
      woodSpecies,
      finishTypes,
      doorStyles
    );
  }, [woodId, finishId, doorId, woodSpecies, finishTypes, doorStyles]);

  const display = editing ? draftResolved : resolved;

  const selectClass =
    "w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

  async function handleSave() {
    setSaving(true);
    await onSave({
      wood_species_id: woodId || null,
      finish_type_id: finishId || null,
      door_style_id: doorId || null,
    });
    setSaving(false);
    setEditing(false);
  }

  function handleCancel() {
    setWoodId(room.wood_species_id ?? "");
    setFinishId(room.finish_type_id ?? "");
    setDoorId(room.door_style_id ?? "");
    setEditing(false);
  }

  return (
    <div className="shrink-0 border-b border-gray-200 bg-white px-6 py-2">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
          Room Pricing Variables
        </span>
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline"
          >
            <IconPencil size={11} />
            Edit Variables
          </button>
        ) : (
          <div className="flex shrink-0 gap-3">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="text-[11px] font-medium text-blue-600 hover:underline disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="text-[11px] font-medium text-gray-600 hover:underline"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="rounded-md border border-blue-200 bg-blue-50/30 px-3 py-2">
        <div className="flex items-stretch gap-2">
          <div className="grid min-w-0 flex-1 grid-cols-3 gap-2">
            <div className="min-w-0">
              <label className="mb-0.5 block text-[10px] font-medium text-gray-600">
                Wood Species
              </label>
              {editing ? (
                <div className="flex min-w-0 items-center gap-2">
                  <select
                    value={woodId}
                    onChange={(e) => setWoodId(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">— Select —</option>
                    {woodSpecies.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                  {display.wood && <MultiplierBadge value={display.wood.multiplier} />}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 rounded border border-gray-200 bg-white px-2 py-1">
                  <span className="min-w-0 flex-1 text-xs text-gray-900">
                    {resolved.wood?.name ?? "—"}
                  </span>
                  {resolved.wood && (
                    <MultiplierBadge value={resolved.wood.multiplier} />
                  )}
                </div>
              )}
            </div>

            <div className="min-w-0">
              <label className="mb-0.5 block text-[10px] font-medium text-gray-600">
                Finish Type
              </label>
              {editing ? (
                <div className="flex min-w-0 items-center gap-2">
                  <select
                    value={finishId}
                    onChange={(e) => setFinishId(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">— Select —</option>
                    {finishTypes.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                  {display.finish && (
                    <MultiplierBadge value={display.finish.multiplier} />
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 rounded border border-gray-200 bg-white px-2 py-1">
                  <span className="min-w-0 flex-1 text-xs text-gray-900">
                    {resolved.finish?.name ?? "—"}
                  </span>
                  {resolved.finish && (
                    <MultiplierBadge value={resolved.finish.multiplier} />
                  )}
                </div>
              )}
            </div>

            <div className="min-w-0">
              <label className="mb-0.5 block text-[10px] font-medium text-gray-600">
                Door Style
              </label>
              {editing ? (
                <div className="flex min-w-0 items-center gap-2">
                  <select
                    value={doorId}
                    onChange={(e) => setDoorId(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">— Select —</option>
                    {doorStyles.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                  {display.door && <MultiplierBadge value={display.door.multiplier} />}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 rounded border border-gray-200 bg-white px-2 py-1">
                  <span className="min-w-0 flex-1 text-xs text-gray-900">
                    {resolved.door?.name ?? "—"}
                  </span>
                  {resolved.door && (
                    <MultiplierBadge value={resolved.door.multiplier} />
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 self-stretch rounded border border-gray-200 bg-gray-50 px-3 py-2">
            <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
              Total
            </span>
            <span className="text-base font-bold leading-none tabular-nums text-gray-900">
              {formatTotalMultiplier(display.total)}
            </span>
            <span className="text-[9px] text-gray-500">(cabinets)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
