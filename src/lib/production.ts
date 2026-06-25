import type { KanbanStatus, ProductionJob } from "@/lib/types";

export type ProductionStage =
  | "cutting"
  | "edgebanding"
  | "assembly"
  | "finishing"
  | "ready_for_delivery";

export type ProductionPriority = "high" | "medium" | "low";

export const PRODUCTION_COLUMNS: {
  id: ProductionStage;
  label: string;
  accentClass: string;
}[] = [
  { id: "cutting", label: "Cutting", accentClass: "border-t-red-500" },
  { id: "edgebanding", label: "Edgebanding", accentClass: "border-t-purple-500" },
  { id: "assembly", label: "Assembly", accentClass: "border-t-blue-500" },
  { id: "finishing", label: "Finishing", accentClass: "border-t-green-500" },
  {
    id: "ready_for_delivery",
    label: "Ready for Delivery",
    accentClass: "border-t-emerald-700",
  },
];

export const PRODUCTION_DEPARTMENTS = [
  "Shop Floor",
  "Finishing",
  "Installation",
] as const;

export const PRODUCTION_PRIORITIES: ProductionPriority[] = [
  "high",
  "medium",
  "low",
];

const STAGE_MAP: Record<string, ProductionStage> = {
  queued: "cutting",
  cutting: "cutting",
  edgebanding: "edgebanding",
  in_progress: "assembly",
  assembly: "assembly",
  finishing: "finishing",
  ready_to_ship: "ready_for_delivery",
  ready_for_delivery: "ready_for_delivery",
};

const DB_STAGE_MAP: Record<ProductionStage, KanbanStatus> = {
  cutting: "cutting",
  edgebanding: "edgebanding",
  assembly: "assembly",
  finishing: "finishing",
  ready_for_delivery: "ready_for_delivery",
};

const LEGACY_DB_STAGE_MAP: Record<ProductionStage, KanbanStatus> = {
  cutting: "queued",
  edgebanding: "edgebanding",
  assembly: "in_progress",
  finishing: "finishing",
  ready_for_delivery: "ready_to_ship",
};

export function normalizeProductionStage(status: KanbanStatus | string): ProductionStage {
  return STAGE_MAP[status] ?? "cutting";
}

export function stageToDbStatus(stage: ProductionStage): KanbanStatus {
  return DB_STAGE_MAP[stage] ?? stage;
}

export function stageToLegacyDbStatus(stage: ProductionStage): KanbanStatus {
  return LEGACY_DB_STAGE_MAP[stage] ?? stage;
}

export function formatProductionJobNumber(
  job: { id: string; created_at?: string } | null | undefined
): string {
  if (!job) return "J—";
  const year = job.created_at
    ? new Date(job.created_at).getFullYear().toString().slice(2)
    : new Date().getFullYear().toString().slice(2);
  const seq = parseInt(job.id.replace(/\D/g, "").slice(0, 6), 10) % 1000;
  return `J${year}${String(seq).padStart(3, "0")}`;
}

export function getProductionPriority(
  card: Pick<ProductionJob, "priority" | "due_date">
): ProductionPriority {
  if (
    card.priority === "high" ||
    card.priority === "medium" ||
    card.priority === "low"
  ) {
    return card.priority;
  }

  const urgency = getDueUrgency(card.due_date);
  if (urgency === "past" || urgency === "urgent") return "high";
  if (urgency === "soon") return "medium";
  return "low";
}

export function getPriorityLabel(priority: ProductionPriority): string {
  const map: Record<ProductionPriority, string> = {
    high: "High Priority",
    medium: "Medium Priority",
    low: "Low Priority",
  };
  return map[priority];
}

export function getPriorityStyles(priority: ProductionPriority): string {
  const map: Record<ProductionPriority, string> = {
    high: "bg-red-100 text-red-700",
    medium: "bg-amber-100 text-amber-800",
    low: "bg-green-100 text-green-700",
  };
  return map[priority];
}

export type DueUrgency = "past" | "urgent" | "soon" | "normal";

export function getDueUrgency(dueDate: string | null | undefined): DueUrgency {
  if (!dueDate) return "normal";
  const due = new Date(`${dueDate}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const diffDays = Math.floor(
    (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays < 0) return "past";
  if (diffDays <= 2) return "urgent";
  if (diffDays <= 7) return "soon";
  return "normal";
}

export function getDueDateColor(dueDate: string | null | undefined): string {
  const urgency = getDueUrgency(dueDate);
  if (urgency === "past" || urgency === "urgent") return "text-red-600";
  if (urgency === "soon") return "text-amber-600";
  return "text-green-600";
}

export function getDueLabel(dueDate: string | null | undefined): string {
  if (!dueDate) return "No due date";
  const due = new Date(`${dueDate}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const diffDays = Math.floor(
    (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays < 0) return "Overdue";
  if (diffDays === 0) return "Due: Today";
  if (diffDays === 1) return "Due: Tomorrow";
  return `Due: ${due.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

export function getAssigneeInitials(
  assignee: string | null | undefined,
  fallbackIndex: number
): string {
  if (assignee?.trim()) {
    const parts = assignee.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return assignee.slice(0, 2).toUpperCase();
  }
  return ["KL", "JM", "FD", "DH"][fallbackIndex % 4];
}

export function isDueThisWeek(dueDate: string | null | undefined): boolean {
  if (!dueDate) return false;
  const due = new Date(`${dueDate}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);
  return due >= today && due <= weekEnd;
}

export function isPastDue(dueDate: string | null | undefined): boolean {
  return getDueUrgency(dueDate) === "past";
}

export function avgDaysInProduction(
  cards: Pick<ProductionJob, "created_at">[]
): number {
  if (cards.length === 0) return 0;
  const now = Date.now();
  const totalDays = cards.reduce((sum, card) => {
    const created = new Date(card.created_at).getTime();
    return sum + Math.max(0, Math.floor((now - created) / (1000 * 60 * 60 * 24)));
  }, 0);
  return Math.round(totalDays / cards.length);
}

export function getPriorityTaskLabel(stage: ProductionStage): string {
  const map: Record<ProductionStage, string> = {
    cutting: "Complete cutting for",
    edgebanding: "Run edgebanding for",
    assembly: "Finish assembly for",
    finishing: "Complete finishing for",
    ready_for_delivery: "Schedule delivery for",
  };
  return map[stage];
}

export const DEFAULT_SHOP_NOTES = [
  "Remember to label all parts for Job J24055 before end of day.",
  "Hardware delivery expected this afternoon for Kitchen Remodel.",
  "Team meeting at 3pm today to review next week's schedule.",
];
