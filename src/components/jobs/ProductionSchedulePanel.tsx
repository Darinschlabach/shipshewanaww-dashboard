"use client";

import {
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
  const { phaseDates, activePhase, setActivePhase } = useProductionSchedule();
  const assignedDate = phaseDates[phase];
  const isActive = activePhase === phase;

  return (
    <button
      type="button"
      onClick={() => setActivePhase(isActive ? null : phase)}
      className={`flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-left ${
        isActive
          ? "border-burgundy bg-burgundy/5 ring-2 ring-burgundy/40 ring-offset-1"
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
  return (
    <div className="flex h-full min-h-0 flex-col p-4">
      <div className="space-y-1.5">
        {PHASE_KEYS.map((phase) => (
          <PhaseCard key={phase} phase={phase} />
        ))}
      </div>
    </div>
  );
}
