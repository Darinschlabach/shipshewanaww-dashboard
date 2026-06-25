import type { Lead, LeadStatus } from "@/lib/types";

export type QuoteDisplayStatus =
  | "draft"
  | "sent"
  | "revision"
  | "approved"
  | "lost";

export const QUOTE_STATUS_LABELS: Record<QuoteDisplayStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  revision: "Revision",
  approved: "Approved",
  lost: "Lost",
};

export const QUOTE_STATUS_STYLES: Record<QuoteDisplayStatus, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-800",
  revision: "bg-orange-100 text-orange-800",
  approved: "bg-green-100 text-green-800",
  lost: "bg-red-100 text-red-800",
};

export const QUOTE_SOURCES = [
  "Direct Customer",
  "Designer",
  "Contractor",
  "Referral",
] as const;

export type QuoteSource = (typeof QUOTE_SOURCES)[number];

const STATUS_MAP: Record<string, QuoteDisplayStatus> = {
  new_inquiry: "draft",
  quote_sent: "sent",
  draft: "draft",
  sent: "sent",
  revision: "revision",
  approved: "approved",
  lost: "lost",
  converted: "approved",
};

export function normalizeQuoteStatus(status: LeadStatus | string): QuoteDisplayStatus {
  return STATUS_MAP[status] ?? "draft";
}

export function formatQuoteNumber(lead: Pick<Lead, "id" | "quote_number" | "created_at">): string {
  if (lead.quote_number) return lead.quote_number;
  const year = new Date(lead.created_at).getFullYear().toString().slice(2);
  const seq = parseInt(lead.id.replace(/\D/g, "").slice(0, 6), 10) % 1000;
  return `Q-${year}${String(seq).padStart(3, "0")}`;
}

export function nextQuoteNumber(existing: Lead[]): string {
  const year = new Date().getFullYear().toString().slice(2);
  const prefix = `Q-${year}`;
  const maxSeq = existing.reduce((max, lead) => {
    const num = lead.quote_number ?? formatQuoteNumber(lead);
    if (!num.startsWith(prefix)) return max;
    const seq = parseInt(num.slice(prefix.length), 10);
    return Number.isFinite(seq) ? Math.max(max, seq) : max;
  }, 0);
  return `${prefix}${String(maxSeq + 1).padStart(3, "0")}`;
}

export function isActiveQuote(status: LeadStatus | string): boolean {
  return status !== "converted";
}

export function quotePipelineValue(leads: Lead[]): number {
  return leads
    .filter((l) => {
      const s = normalizeQuoteStatus(l.status);
      return s !== "lost" && s !== "approved" && l.status !== "converted";
    })
    .reduce((sum, l) => sum + Number(l.est_value), 0);
}

export function quoteApprovalRate(leads: Lead[]): number {
  const approved = leads.filter((l) => normalizeQuoteStatus(l.status) === "approved").length;
  const decided = leads.filter((l) => {
    const s = normalizeQuoteStatus(l.status);
    return s === "approved" || s === "lost" || s === "sent" || s === "revision";
  }).length;
  if (decided === 0) return 0;
  return Math.round((approved / decided) * 100);
}

export function sumQuoteValue(
  leads: Lead[],
  status: QuoteDisplayStatus
): number {
  return leads
    .filter((l) => normalizeQuoteStatus(l.status) === status)
    .reduce((sum, l) => sum + Number(l.est_value), 0);
}

export function countByQuoteStatus(
  leads: Lead[],
  status: QuoteDisplayStatus
): number {
  return leads.filter((l) => normalizeQuoteStatus(l.status) === status).length;
}
