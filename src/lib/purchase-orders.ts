import type { PurchaseOrder, PoStatus } from "@/lib/types";

export type PoDisplayStatus =
  | "pending_approval"
  | "on_order"
  | "partially_received"
  | "fully_received";

export const PO_DISPLAY_LABELS: Record<PoDisplayStatus, string> = {
  pending_approval: "Pending Approval",
  on_order: "On Order",
  partially_received: "Partially Received",
  fully_received: "Fully Received",
};

export const PO_DISPLAY_STYLES: Record<PoDisplayStatus, string> = {
  pending_approval: "bg-red-100 text-red-700",
  on_order: "bg-amber-100 text-amber-800",
  partially_received: "bg-green-100 text-green-700",
  fully_received: "bg-emerald-100 text-emerald-800",
};

export const DEFAULT_INVENTORY_ALERTS = [
  'Low stock: 3/4" Maple Plywood (5 sheets remaining)',
  "Reorder needed: Blum soft-close hinges (12 pairs left)",
  'Low stock: 1/2" MDF sheets (3 sheets remaining)',
];

export function getReceivedPercent(po: PurchaseOrder): number {
  if (po.received_percent != null && po.received_percent >= 0) {
    return Math.min(100, po.received_percent);
  }
  if (po.status === "delivered" || po.status === "archived") return 100;
  if (po.status === "not_ordered") return 0;
  if (po.status === "ordered") {
    const hash = parseInt(po.id.replace(/\D/g, "").slice(0, 4), 10) || 0;
    if (hash % 3 === 0) return 50;
    if (hash % 3 === 1) return 75;
    return 0;
  }
  return 0;
}

export function normalizePoDisplayStatus(po: PurchaseOrder): PoDisplayStatus {
  const received = getReceivedPercent(po);
  if (po.status === "not_ordered") return "pending_approval";
  if (po.status === "delivered" || po.status === "archived" || received >= 100) {
    return "fully_received";
  }
  if (po.status === "ordered" && received > 0) return "partially_received";
  if (po.status === "ordered") return "on_order";
  return "pending_approval";
}

export function formatPoNumber(
  po: Pick<PurchaseOrder, "id" | "po_number" | "created_at">
): string {
  if (po.po_number) return po.po_number;
  const year = new Date(po.created_at).getFullYear().toString().slice(2);
  const seq = parseInt(po.id.replace(/\D/g, "").slice(0, 6), 10) % 1000;
  return `PO-${year}${String(seq).padStart(3, "0")}`;
}

export function nextPoNumber(existing: PurchaseOrder[]): string {
  const year = new Date().getFullYear().toString().slice(2);
  const prefix = `PO-${year}`;
  const maxSeq = existing.reduce((max, po) => {
    const num = po.po_number ?? formatPoNumber(po);
    if (!num.startsWith(prefix)) return max;
    const seq = parseInt(num.slice(prefix.length), 10);
    return Number.isFinite(seq) ? Math.max(max, seq) : max;
  }, 0);
  return `${prefix}${String(maxSeq + 1).padStart(3, "0")}`;
}

export function isActivePo(po: PurchaseOrder): boolean {
  return po.status !== "archived";
}

export function countByPoDisplayStatus(
  orders: PurchaseOrder[],
  status: PoDisplayStatus
): number {
  return orders.filter((o) => normalizePoDisplayStatus(o) === status).length;
}

export function sumByPoDisplayStatus(
  orders: PurchaseOrder[],
  status: PoDisplayStatus
): number {
  return orders
    .filter((o) => normalizePoDisplayStatus(o) === status)
    .reduce((sum, o) => sum + Number(o.amount), 0);
}

export function getTopVendors(
  orders: PurchaseOrder[],
  limit = 5
): { vendor: string; total: number }[] {
  const totals = new Map<string, number>();
  for (const po of orders) {
    if (!po.ordered_at) continue;
    const ordered = new Date(po.ordered_at);
    const now = new Date();
    if (
      ordered.getMonth() !== now.getMonth() ||
      ordered.getFullYear() !== now.getFullYear()
    ) {
      continue;
    }
    totals.set(po.vendor, (totals.get(po.vendor) ?? 0) + Number(po.amount));
  }
  return [...totals.entries()]
    .map(([vendor, total]) => ({ vendor, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

export function getMonthlySpend(orders: PurchaseOrder[]): {
  thisMonth: number;
  lastMonth: number;
} {
  const now = new Date();
  let thisMonth = 0;
  let lastMonth = 0;

  for (const po of orders) {
    if (!po.ordered_at) continue;
    const ordered = new Date(po.ordered_at);
    const amount = Number(po.amount);
    if (
      ordered.getMonth() === now.getMonth() &&
      ordered.getFullYear() === now.getFullYear()
    ) {
      thisMonth += amount;
    }
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    if (
      ordered.getMonth() === prev.getMonth() &&
      ordered.getFullYear() === prev.getFullYear()
    ) {
      lastMonth += amount;
    }
  }

  return { thisMonth, lastMonth };
}

export function getSpendTrend(orders: PurchaseOrder[]): number[] {
  const now = new Date();
  const weeks: number[] = [0, 0, 0, 0];
  for (const po of orders) {
    if (!po.ordered_at) continue;
    const ordered = new Date(po.ordered_at);
    if (
      ordered.getMonth() !== now.getMonth() ||
      ordered.getFullYear() !== now.getFullYear()
    ) {
      continue;
    }
    const weekIndex = Math.min(3, Math.floor((ordered.getDate() - 1) / 7));
    weeks[weekIndex] += Number(po.amount);
  }
  return weeks;
}

export function getUpcomingDeliveries(
  orders: PurchaseOrder[],
  limit = 3
): PurchaseOrder[] {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return orders
    .filter((po) => {
      if (!po.expected_delivery) return false;
      const due = new Date(`${po.expected_delivery}T12:00:00`);
      return due >= today && po.status !== "delivered" && po.status !== "archived";
    })
    .sort(
      (a, b) =>
        new Date(`${a.expected_delivery}T12:00:00`).getTime() -
        new Date(`${b.expected_delivery}T12:00:00`).getTime()
    )
    .slice(0, limit);
}

export function dbStatusFromDisplay(status: PoDisplayStatus): PoStatus {
  const map: Record<PoDisplayStatus, PoStatus> = {
    pending_approval: "not_ordered",
    on_order: "ordered",
    partially_received: "ordered",
    fully_received: "delivered",
  };
  return map[status];
}
