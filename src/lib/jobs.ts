import {
  getProductionStageBadgeClass,
  getProductionStageLabel,
} from "@/lib/production";
import { JOB_STAGE_LABELS, type Job, type JobStage } from "@/lib/types";

export type JobStageDisplay =
  | JobStage
  | "awaiting_approval";

const STAGE_BADGE_STYLES: Record<JobStageDisplay, string> = {
  quote: "bg-blue-100 text-blue-800",
  design: "bg-orange-100 text-orange-800",
  production: "bg-green-100 text-green-800",
  delivery: "bg-purple-100 text-purple-800",
  complete: "bg-gray-100 text-gray-600",
  awaiting_approval: "bg-orange-100 text-orange-800",
};

export function isJobAwaitingApproval(
  job: Pick<Job, "stage" | "quote_approved_at" | "design_approved_at" | "total_value">
): boolean {
  if (job.stage === "quote" && !job.quote_approved_at && Number(job.total_value) > 0) {
    return true;
  }
  if (
    job.stage === "design" &&
    job.quote_approved_at &&
    !job.design_approved_at
  ) {
    return true;
  }
  return false;
}

export function getJobStageDisplay(
  job: Pick<Job, "stage" | "quote_approved_at" | "design_approved_at" | "total_value">,
  kanbanStatus?: string | null
): { key: JobStageDisplay; label: string; className: string } {
  if (isJobAwaitingApproval(job)) {
    return {
      key: "awaiting_approval",
      label: "Awaiting approval",
      className: STAGE_BADGE_STYLES.awaiting_approval,
    };
  }

  const productionLabel =
    job.stage === "production" || job.stage === "delivery"
      ? getProductionStageLabel(kanbanStatus) ??
        (job.stage === "delivery" ? "Ready for Delivery" : null)
      : null;
  const productionBadgeClass =
    job.stage === "production" || job.stage === "delivery"
      ? getProductionStageBadgeClass(kanbanStatus) ??
        (job.stage === "delivery"
          ? "bg-green-100 text-green-800"
          : null)
      : null;
  const displayStage = job.stage === "delivery" ? "production" : job.stage;

  return {
    key: displayStage,
    label: productionLabel ?? JOB_STAGE_LABELS[job.stage],
    className: productionBadgeClass ?? STAGE_BADGE_STYLES[displayStage],
  };
}

export function isJobInProgress(
  job: Pick<Job, "stage" | "quote_approved_at" | "design_approved_at" | "total_value">
): boolean {
  if (job.stage === "complete") return false;
  if (isJobAwaitingApproval(job)) return false;
  if (job.stage === "quote") return false;
  return true;
}
