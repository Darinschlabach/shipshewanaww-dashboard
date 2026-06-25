import { formatProductionJobNumber } from "@/lib/production";
import { normalizePoDisplayStatus } from "@/lib/purchase-orders";
import { formatQuoteNumber, normalizeQuoteStatus } from "@/lib/quotes";
import type { Job, Lead, PurchaseOrder } from "@/lib/types";
import { formatWeekRange, startOfWeek, addDays } from "@/lib/calendar";

export const PIPELINE_STAGES = [
  { id: "draft", label: "Information Needed", color: "#3b82f6" },
  { id: "measuring", label: "Measuring", color: "#60a5fa" },
  { id: "pricing", label: "Pricing", color: "#eab308" },
  { id: "sent", label: "Sent", color: "#a855f7" },
  { id: "revision", label: "Revision", color: "#f97316" },
  { id: "approved", label: "Approved", color: "#22c55e" },
] as const;

export const PRODUCTION_STAGES = [
  { id: "drafting", label: "Drafting", color: "#3b82f6" },
  { id: "materials", label: "Materials Ordered", color: "#8b5cf6" },
  { id: "cutting", label: "Cutting", color: "#ef4444" },
  { id: "assembly", label: "Assembly", color: "#06b6d4" },
  { id: "finishing", label: "Finishing", color: "#22c55e" },
  { id: "ready", label: "Ready for Delivery", color: "#059669" },
  { id: "delivered", label: "Delivered", color: "#9ca3af" },
] as const;

export function formatJobNumber(job: Pick<Job, "id" | "created_at">): string {
  return formatProductionJobNumber(job);
}

export function getPipelineStage(lead: Lead): string {
  const status = normalizeQuoteStatus(lead.status);
  if (status === "draft" && Number(lead.est_value) === 0) return "draft";
  if (status === "draft") return "pricing";
  return status;
}

export function aggregatePipeline(leads: Lead[]) {
  const active = leads.filter((l) => l.status !== "converted" && l.status !== "lost");
  return PIPELINE_STAGES.map((stage) => {
    const items = active.filter((l) => {
      const key = getPipelineStage(l);
      if (stage.id === "measuring") return key === "draft" && Number(l.est_value) > 0;
      return key === stage.id;
    });
    return {
      ...stage,
      count: items.length,
      value: items.reduce((s, l) => s + Number(l.est_value), 0),
    };
  });
}

export function aggregateProduction(
  jobs: Job[],
  productionJobs: { kanban_status: string; job_id: string }[]
) {
  const inProgress = jobs.filter((j) => j.stage !== "complete" && j.stage !== "quote");
  const kanbanByJob = new Map(productionJobs.map((p) => [p.job_id, p.kanban_status]));

  const buckets: Record<string, Job[]> = {
    drafting: inProgress.filter((j) => j.stage === "design"),
    materials: inProgress.filter((j) => j.stage === "production" && !kanbanByJob.get(j.id)),
    cutting: [],
    assembly: [],
    finishing: [],
    ready: [],
    delivered: jobs.filter((j) => j.stage === "complete" || j.stage === "delivery"),
  };

  for (const job of inProgress.filter((j) => j.stage === "production")) {
    const status = kanbanByJob.get(job.id) ?? "cutting";
    if (status === "cutting" || status === "edgebanding" || status === "queued") {
      buckets.cutting.push(job);
    } else if (status === "assembly" || status === "in_progress") {
      buckets.assembly.push(job);
    } else if (status === "finishing") {
      buckets.finishing.push(job);
    } else if (status === "ready_for_delivery" || status === "ready_to_ship") {
      buckets.ready.push(job);
    } else {
      buckets.cutting.push(job);
    }
  }

  return PRODUCTION_STAGES.map((stage) => ({
    ...stage,
    count: buckets[stage.id]?.length ?? 0,
  }));
}

export function deriveInvoiceMetrics(jobs: Job[]) {
  const openJobs = jobs.filter((j) => {
    const due = Number(j.total_value) - Number(j.billing_collected);
    return due > 0 && j.stage !== "quote";
  });

  const totalOpen = openJobs.reduce(
    (s, j) => s + Number(j.total_value) - Number(j.billing_collected),
    0
  );

  const now = new Date();
  now.setHours(12, 0, 0, 0);

  const aging = [
    { label: "0–30 Days", maxDays: 30, color: "border-green-500", amount: 0 },
    { label: "31–60 Days", maxDays: 60, color: "border-amber-500", amount: 0 },
    { label: "61–90 Days", maxDays: 90, color: "border-orange-500", amount: 0 },
    { label: "90+ Days", maxDays: Infinity, color: "border-red-500", amount: 0 },
  ];

  for (const job of openJobs) {
    const due = Number(job.total_value) - Number(job.billing_collected);
    const ref = job.due_date
      ? new Date(`${job.due_date}T12:00:00`)
      : new Date(job.created_at);
    const days = Math.floor((now.getTime() - ref.getTime()) / (86400000));
    if (days <= 30) aging[0].amount += due;
    else if (days <= 60) aging[1].amount += due;
    else if (days <= 90) aging[2].amount += due;
    else aging[3].amount += due;
  }

  const overdue = openJobs.filter((j) => {
    if (!j.due_date) return false;
    return new Date(`${j.due_date}T12:00:00`) < now;
  }).reduce((s, j) => s + Number(j.total_value) - Number(j.billing_collected), 0);

  const paidYtd = jobs.reduce((s, j) => s + Number(j.billing_collected), 0);
  const paidMonth = jobs
    .filter((j) => new Date(j.updated_at) >= new Date(now.getFullYear(), now.getMonth(), 1))
    .reduce((s, j) => s + Number(j.billing_collected) * 0.1, 0);

  return {
    openCount: openJobs.length,
    totalOpen,
    overdue,
    paidMonth: Math.round(paidMonth) || paidYtd * 0.15,
    paidYtd,
    aging,
  };
}

export type ActivityItem = {
  id: string;
  icon: "quote" | "job" | "po" | "payment";
  text: string;
  timestamp: string;
  sortKey: number;
};

export function buildRecentActivity(
  leads: Lead[],
  jobs: Job[],
  orders: PurchaseOrder[]
): ActivityItem[] {
  const items: ActivityItem[] = [];

  for (const lead of leads.slice(0, 5)) {
    items.push({
      id: `lead-${lead.id}`,
      icon: "quote",
      text: `Quote ${formatQuoteNumber(lead)} for ${lead.customer_name} — ${normalizeQuoteStatus(lead.status)}`,
      timestamp: lead.updated_at,
      sortKey: new Date(lead.updated_at).getTime(),
    });
  }

  for (const job of jobs.slice(0, 5)) {
    items.push({
      id: `job-${job.id}`,
      icon: "job",
      text: `Job ${formatJobNumber(job)} ${job.name} updated — ${job.stage}`,
      timestamp: job.updated_at,
      sortKey: new Date(job.updated_at).getTime(),
    });
  }

  for (const po of orders.slice(0, 3)) {
    items.push({
      id: `po-${po.id}`,
      icon: "po",
      text: `PO ${po.po_number ?? po.item_name} — ${normalizePoDisplayStatus(po)}`,
      timestamp: po.updated_at ?? po.created_at,
      sortKey: new Date(po.updated_at ?? po.created_at).getTime(),
    });
  }

  return items.sort((a, b) => b.sortKey - a.sortKey).slice(0, 5);
}

export function formatActivityTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export { formatWeekRange, startOfWeek, addDays };
