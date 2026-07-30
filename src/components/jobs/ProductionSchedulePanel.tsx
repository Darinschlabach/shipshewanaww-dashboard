"use client";

import {
  SCHEDULE_COLOR_OPTIONS,
  SCHEDULE_PHASE_LABELS,
  type SchedulePhaseKey,
} from "@/lib/schedule-phase-drag";
import { useProductionSchedule } from "@/components/calendar/CalendarEmbedContext";

const PHASE_KEYS: SchedulePhaseKey[] = ["fabricating", "finishing", "delivery"];

function formatPhaseDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function PhaseCard({ phase }: { phase: SchedulePhaseKey }) {
  const {
    phaseDates,
    activePhase,
    setActivePhase,
    selectedColor,
  } = useProductionSchedule();
  const assignedDate = phaseDates[phase];
  const isActive = activePhase === phase;
  const colorClasses = SCHEDULE_COLOR_OPTIONS.find((c) => c.id === selectedColor);

  return (
    <button
      type="button"
      onClick={() => setActivePhase(isActive ? null : phase)}
      className={`flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-left ${
        isActive
          ? `border-gray-400 bg-gray-50 ring-2 ${colorClasses?.ring ?? "ring-red-500"} ring-offset-1`
          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
      }`}
      title="Click a card, then click a date on the calendar"
    >
      <p className="text-sm font-medium text-gray-900">
        {SCHEDULE_PHASE_LABELS[phase]}
      </p>
      <span className="shrink-0 text-xs text-gray-500">
        {assignedDate ? formatPhaseDate(assignedDate) : "—"}
      </span>
    </button>
  );
}

export default function ProductionSchedulePanel() {
  const { selectedColor, setSelectedColor } = useProductionSchedule();

  return (
    <div className="flex h-full min-h-0 flex-col p-4">
      <div className="space-y-1.5">
        {PHASE_KEYS.map((phase) => (
          <PhaseCard key={phase} phase={phase} />
        ))}
      </div>

      <div className="mt-auto pt-6">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
          Color
        </p>
        <div className="flex flex-wrap gap-2">
          {SCHEDULE_COLOR_OPTIONS.map((color) => (
            <button
              key={color.id}
              type="button"
              onClick={() => setSelectedColor(color.id)}
              className={`h-9 w-9 rounded-full ${color.bg} ${
                selectedColor === color.id
                  ? `ring-2 ${color.ring} ring-offset-2`
                  : "hover:brightness-95"
              }`}
              aria-label={`Select ${color.id}`}
              aria-pressed={selectedColor === color.id}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
