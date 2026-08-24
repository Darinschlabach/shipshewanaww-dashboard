import { type ScheduleBubble, type ScheduleColor } from "@/lib/schedule-phase-drag";

export function scheduleBubbleFromMeta(
  title: string,
  meta: { phase_label: string; kind: ScheduleBubble["kind"] }
): ScheduleBubble {
  return {
    jobName: title,
    phaseLabel: meta.phase_label,
    kind: meta.kind,
  };
}

const PHASE_CHIP_STYLES = {
  fabricating: {
    bg: "bg-red-200",
    text: "text-red-950",
  },
  finishing: {
    bg: "bg-blue-200",
    text: "text-blue-950",
  },
  delivery: {
    bg: "bg-green-200",
    text: "text-green-950",
  },
} as const;

export default function ScheduleBubbleChip({
  bubble,
  size = "sm",
}: {
  bubble: ScheduleBubble;
  color?: ScheduleColor;
  size?: "sm" | "md";
}) {
  const styles = PHASE_CHIP_STYLES[bubble.kind];
  const textClass =
    size === "md"
      ? "truncate text-center text-sm font-semibold leading-tight"
      : "truncate text-center text-[8px] font-semibold leading-tight";
  const padClass = size === "md" ? "px-2 py-1.5" : "px-1 py-[1px]";

  return (
    <div
      className={`pointer-events-none block w-full overflow-hidden rounded border border-black ${padClass} ${styles.bg} ${styles.text}`}
    >
      <p className={textClass}>{bubble.jobName}</p>
      <p className={textClass}>{bubble.phaseLabel}</p>
    </div>
  );
}
