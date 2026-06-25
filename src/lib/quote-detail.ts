import { formatQuoteNumber, normalizeQuoteStatus } from "@/lib/quotes";
import type { Contact, Lead } from "@/lib/types";

export interface QuoteChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface QuoteDetailMeta {
  title: string;
  customerName: string;
  phone: string;
  email: string;
  customerAddress: string;
  jobName: string;
  jobAddress: string;
  followUpDate: string | null;
  expirationDate: string | null;
  statusSteps: QuoteChecklistItem[];
  nextActions: QuoteChecklistItem[];
  customerMessage: string;
  fileCount: number;
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function getPrimaryContact(lead: Lead): Contact | null {
  return lead.contacts ?? null;
}

export function getQuoteTitle(lead: Lead): string {
  const jobName = lead.project_type.trim();
  if (!jobName) {
    return getPrimaryContact(lead)?.name ?? lead.customer_name;
  }
  if (/remodel|kitchen|bath|office|mudroom/i.test(jobName)) {
    return jobName.charAt(0).toUpperCase() + jobName.slice(1);
  }
  const customer = getPrimaryContact(lead)?.name ?? lead.customer_name;
  return `${customer} — ${jobName}`;
}

export function buildQuoteDetail(lead: Lead): QuoteDetailMeta {
  const contact = getPrimaryContact(lead);
  const customerName = contact?.name ?? lead.customer_name;
  const status = normalizeQuoteStatus(lead.status);
  const sent = status === "sent" || status === "revision" || status === "approved";
  const approved = status === "approved";
  const created = lead.created_at.slice(0, 10);
  const sentDate = lead.sent_at ?? (sent ? addDays(created, 14) : null);
  const followUp = sentDate ? addDays(sentDate, 7) : addDays(created, 21);

  return {
    title: getQuoteTitle(lead),
    customerName,
    phone: contact?.phone?.trim() || "—",
    email: contact?.email?.trim() || "—",
    customerAddress: contact?.address?.trim() || "—",
    jobName: lead.project_type.trim() || "—",
    jobAddress: lead.job_address?.trim() || "—",
    followUpDate: followUp,
    expirationDate: sentDate ? addDays(sentDate, 30) : addDays(created, 30),
    statusSteps: [
      { id: "1", label: "Quote Created", done: true },
      { id: "2", label: "Drawings Completed", done: sent },
      { id: "3", label: "Quote Sent", done: sent },
      { id: "4", label: "Approval Received", done: approved },
    ],
    nextActions: [
      { id: "a1", label: "Measure Completed", done: true },
      { id: "a2", label: "Drawings Completed", done: sent },
      { id: "a3", label: "Quote Sent", done: sent },
      {
        id: "a4",
        label: `Customer Follow-Up — ${new Date(`${followUp}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
        done: false,
      },
      { id: "a5", label: "Approval Received", done: approved },
    ],
    customerMessage: `Dear ${customerName.split(" ")[0] ?? "Customer"},\n\nThank you for the opportunity to provide this proposal for your ${lead.project_type.toLowerCase() || "project"}. We are excited about the project and confident our team can deliver the quality craftsmanship you expect.\n\nPlease review the attached quote at your convenience. We are happy to answer any questions or schedule a walkthrough.\n\nBest regards,\n${lead.designer ?? "Shipshewana Woodworks"}`,
    fileCount: 6,
  };
}

export function formatQuoteDisplayNumber(lead: Lead): string {
  const num = formatQuoteNumber(lead);
  return num.startsWith("Q-") ? `Quote # ${num}` : num;
}
