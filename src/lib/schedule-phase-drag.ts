export type SchedulePhaseKey = "fabricating" | "finishing" | "delivery";

export type ScheduleColor = "red" | "blue" | "purple" | "orange" | "yellow";

export const SCHEDULE_PHASE_DRAG_MIME = "application/x-sw-schedule-phase";

export type SchedulePhaseDragPayload = {
  phase: SchedulePhaseKey;
};

export const SCHEDULE_PHASE_LABELS: Record<SchedulePhaseKey, string> = {
  fabricating: "Fabricating Start",
  finishing: "Finishing Start",
  delivery: "Delivery Date",
};

export const SCHEDULE_COLOR_OPTIONS: {
  id: ScheduleColor;
  bg: string;
  ring: string;
  chipBg: string;
  chipText: string;
  chipDot: string;
  chipMuted: string;
  chipBorder: string;
  bubbleTopBg: string;
  bubbleTopText: string;
  bubbleFabricatingBg: string;
  bubbleFabricatingText: string;
  bubbleFinishingBg: string;
  bubbleFinishingText: string;
  bubbleDeliveryBg: string;
  bubbleDeliveryText: string;
}[] = [
  {
    id: "red",
    bg: "bg-red-500",
    ring: "ring-red-500",
    chipBg: "bg-red-50",
    chipText: "text-red-900",
    chipDot: "bg-red-500",
    chipMuted: "text-red-800/80",
    chipBorder: "border-red-200",
    bubbleTopBg: "bg-red-500",
    bubbleTopText: "text-white",
    bubbleFabricatingBg: "bg-red-800",
    bubbleFabricatingText: "text-white",
    bubbleFinishingBg: "bg-red-200",
    bubbleFinishingText: "text-red-900",
    bubbleDeliveryBg: "bg-red-800",
    bubbleDeliveryText: "text-white",
  },
  {
    id: "blue",
    bg: "bg-blue-500",
    ring: "ring-blue-500",
    chipBg: "bg-blue-50",
    chipText: "text-blue-900",
    chipDot: "bg-blue-500",
    chipMuted: "text-blue-800/80",
    chipBorder: "border-blue-200",
    bubbleTopBg: "bg-blue-500",
    bubbleTopText: "text-white",
    bubbleFabricatingBg: "bg-blue-800",
    bubbleFabricatingText: "text-white",
    bubbleFinishingBg: "bg-blue-200",
    bubbleFinishingText: "text-blue-900",
    bubbleDeliveryBg: "bg-blue-800",
    bubbleDeliveryText: "text-white",
  },
  {
    id: "purple",
    bg: "bg-purple-500",
    ring: "ring-purple-500",
    chipBg: "bg-purple-50",
    chipText: "text-purple-900",
    chipDot: "bg-purple-500",
    chipMuted: "text-purple-800/80",
    chipBorder: "border-purple-200",
    bubbleTopBg: "bg-purple-500",
    bubbleTopText: "text-white",
    bubbleFabricatingBg: "bg-purple-800",
    bubbleFabricatingText: "text-white",
    bubbleFinishingBg: "bg-purple-200",
    bubbleFinishingText: "text-purple-900",
    bubbleDeliveryBg: "bg-purple-800",
    bubbleDeliveryText: "text-white",
  },
  {
    id: "orange",
    bg: "bg-orange-500",
    ring: "ring-orange-500",
    chipBg: "bg-orange-50",
    chipText: "text-orange-900",
    chipDot: "bg-orange-500",
    chipMuted: "text-orange-800/80",
    chipBorder: "border-orange-200",
    bubbleTopBg: "bg-orange-500",
    bubbleTopText: "text-white",
    bubbleFabricatingBg: "bg-orange-800",
    bubbleFabricatingText: "text-white",
    bubbleFinishingBg: "bg-orange-200",
    bubbleFinishingText: "text-orange-900",
    bubbleDeliveryBg: "bg-orange-800",
    bubbleDeliveryText: "text-white",
  },
  {
    id: "yellow",
    bg: "bg-yellow-500",
    ring: "ring-yellow-500",
    chipBg: "bg-yellow-50",
    chipText: "text-yellow-900",
    chipDot: "bg-yellow-500",
    chipMuted: "text-yellow-800/80",
    chipBorder: "border-yellow-200",
    bubbleTopBg: "bg-yellow-500",
    bubbleTopText: "text-yellow-950",
    bubbleFabricatingBg: "bg-yellow-700",
    bubbleFabricatingText: "text-white",
    bubbleFinishingBg: "bg-yellow-200",
    bubbleFinishingText: "text-yellow-950",
    bubbleDeliveryBg: "bg-yellow-700",
    bubbleDeliveryText: "text-white",
  },
];

export function buildSchedulePhaseDragPayload(
  phase: SchedulePhaseKey
): SchedulePhaseDragPayload {
  return { phase };
}

export function parseSchedulePhaseDrag(
  dataTransfer: DataTransfer
): SchedulePhaseDragPayload | null {
  const raw = dataTransfer.getData(SCHEDULE_PHASE_DRAG_MIME);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SchedulePhaseDragPayload;
    if (
      parsed?.phase !== "fabricating" &&
      parsed?.phase !== "finishing" &&
      parsed?.phase !== "delivery"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function getScheduleColorClasses(color: ScheduleColor) {
  return (
    SCHEDULE_COLOR_OPTIONS.find((option) => option.id === color) ??
    SCHEDULE_COLOR_OPTIONS[0]
  );
}

export type PhaseDates = Record<SchedulePhaseKey, string | null>;

export type ScheduleBubbleKind = "fabricating" | "finishing" | "delivery";

export type ScheduleBubble = {
  jobName: string;
  phaseLabel: string;
  kind: ScheduleBubbleKind;
};

function parseScheduleIso(iso: string) {
  return new Date(iso + "T12:00:00");
}

function isScheduleWeekday(date: Date) {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

/** One bubble per phase start: fabricating, finishing, and delivery. */
export function buildJobScheduleBubbles(
  jobName: string,
  phaseDates: PhaseDates
): Map<string, ScheduleBubble> {
  const bubbles = new Map<string, ScheduleBubble>();
  const { fabricating, finishing, delivery } = phaseDates;

  function setBubble(iso: string, phaseLabel: string, kind: ScheduleBubbleKind) {
    if (isScheduleWeekday(parseScheduleIso(iso))) {
      bubbles.set(iso, { jobName, phaseLabel, kind });
    }
  }

  if (fabricating) setBubble(fabricating, "Fabricating Start", "fabricating");
  if (finishing) setBubble(finishing, "Finishing Start", "finishing");
  if (delivery) setBubble(delivery, "Delivery", "delivery");

  return bubbles;
}
