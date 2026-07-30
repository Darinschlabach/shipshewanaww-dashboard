import {
  getScheduleColorClasses,
  type ScheduleBubble,
  type ScheduleColor,
} from "@/lib/schedule-phase-drag";

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

export default function ScheduleBubbleChip({
  bubble,
  color,
  size = "sm",
}: {
  bubble: ScheduleBubble;
  color: ScheduleColor;
  size?: "sm" | "md";
}) {
  const styles = getScheduleColorClasses(color);
  const isDelivery = bubble.kind === "delivery";
  const bottomStyles = isDelivery
    ? { bg: "bg-green-500", text: "text-white" }
    : bubble.kind === "fabricating"
      ? {
          bg: styles.bubbleFabricatingBg,
          text: styles.bubbleFabricatingText,
        }
      : {
          bg: styles.bubbleFinishingBg,
          text: styles.bubbleFinishingText,
        };
  const topStyles = isDelivery
    ? { bg: "bg-green-500", text: "text-white" }
    : { bg: styles.bubbleTopBg, text: styles.bubbleTopText };
  const borderClass = isDelivery ? "border-green-300" : styles.chipBorder;
  const textClass =
    size === "md"
      ? "truncate text-center text-sm font-semibold leading-tight"
      : "truncate text-center text-[8px] font-semibold leading-tight";
  const padClass = size === "md" ? "px-2 py-1.5" : "px-1 py-[1px]";

  return (
    <div
      className={`pointer-events-none block w-full overflow-hidden rounded border ${borderClass}`}
    >
      <div
        className={`border-b border-black/15 ${padClass} ${topStyles.bg} ${topStyles.text}`}
      >
        <p className={textClass}>{bubble.jobName}</p>
      </div>
      <div className={`${padClass} ${bottomStyles.bg} ${bottomStyles.text}`}>
        <p className={textClass}>{bubble.phaseLabel}</p>
      </div>
    </div>
  );
}
