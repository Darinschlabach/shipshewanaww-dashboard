import { getJobStageDisplay } from "@/lib/jobs";
import type { Job } from "@/lib/types";

interface JobStageBadgeProps {
  job: Pick<Job, "stage" | "quote_approved_at" | "design_approved_at" | "total_value">;
  kanbanStatus?: string | null;
}

export default function JobStageBadge({ job, kanbanStatus }: JobStageBadgeProps) {
  const { label, className } = getJobStageDisplay(job, kanbanStatus);

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}
