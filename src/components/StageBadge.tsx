import { JOB_STAGE_LABELS, type JobStage } from "@/lib/types";

const styles: Record<JobStage, string> = {
  quote: "bg-blue-100 text-blue-800",
  design: "bg-amber-100 text-amber-800",
  production: "bg-green-100 text-green-800",
  delivery: "bg-purple-100 text-purple-800",
  complete: "bg-gray-100 text-gray-600",
};

interface StageBadgeProps {
  stage: JobStage;
}

export default function StageBadge({ stage }: StageBadgeProps) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[stage]}`}
    >
      {JOB_STAGE_LABELS[stage]}
    </span>
  );
}
