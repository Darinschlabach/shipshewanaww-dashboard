export function formatCurrency(value: number): string {
  if (value >= 1000) {
    return `$${Math.round(value / 1000)}k`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCurrencyFull(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCurrencyPrecise(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date + (date.includes("T") ? "" : "T12:00:00"));
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatDateLong(date: string | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date + (date.includes("T") ? "" : "T12:00:00"));
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function getInitialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
}

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-amber-100 text-amber-700",
  "bg-green-100 text-green-700",
  "bg-purple-100 text-purple-700",
  "bg-rose-100 text-rose-700",
];

export function getAvatarColor(index: number): string {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

export function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function stageLabel(stage: string): string {
  return stage.charAt(0).toUpperCase() + stage.slice(1);
}

export function leadStatusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: "Draft",
    sent: "Sent",
    revision: "Revision",
    approved: "Approved",
    lost: "Lost",
    converted: "Converted",
    new_inquiry: "Draft",
    quote_sent: "Sent",
  };
  return map[status] ?? status;
}

export function poStatusLabel(status: string): string {
  const map: Record<string, string> = {
    not_ordered: "Not ordered",
    ordered: "Ordered",
    delivered: "Delivered",
    archived: "Archived",
  };
  return map[status] ?? status;
}

export function kanbanColumnLabel(status: string): string {
  const map: Record<string, string> = {
    queued: "Queue",
    cutting: "Fabricating",
    edgebanding: "Finish Prep",
    in_progress: "Finishing",
    assembly: "Finishing",
    finishing: "Assembly",
    ready_to_ship: "Ready for Delivery",
    ready_for_delivery: "Ready for Delivery",
  };
  return map[status] ?? status;
}

export function formatRelativeTime(date: string | null | undefined): string {
  if (!date) return "—";
  const then = new Date(date.includes("T") ? date : `${date}T12:00:00`);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return "Just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;

  return then.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
