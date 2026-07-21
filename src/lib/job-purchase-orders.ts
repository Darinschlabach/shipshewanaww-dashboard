import type { PurchaseOrder as DbPurchaseOrder } from "@/lib/types";
import { formatPoNumber } from "@/lib/purchase-orders";

export type JobPoStatus = "Received" | "Partial" | "Open" | "Overdue";
export type JobPoType = "Doors" | "Drawers" | "Plywood" | "Hardware";

export interface JobPurchaseOrder {
  id: string;
  po: string;
  title: string;
  poType?: JobPoType;
  vendor: string;
  category: string;
  categoryStyle: string;
  orderDate: string;
  expected: string;
  expectedOverdue?: boolean;
  total: number;
  received: number;
  status: JobPoStatus;
  isDraft?: boolean;
}

const CATEGORY_STYLES: Record<string, string> = {
  "Lumber & Panels": "bg-pink-50 text-pink-700",
  "Cabinet Parts": "bg-purple-50 text-purple-700",
  Hardware: "bg-blue-50 text-blue-700",
  "Finishes & Supplies": "bg-amber-50 text-amber-700",
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function categoryStyleFor(category: string | null | undefined) {
  if (!category) return "bg-gray-50 text-gray-700";
  return CATEGORY_STYLES[category] ?? "bg-gray-50 text-gray-700";
}

function deriveUiStatus(row: DbPurchaseOrder & { ui_status?: string | null }): JobPoStatus {
  if (
    row.ui_status === "Received" ||
    row.ui_status === "Partial" ||
    row.ui_status === "Open" ||
    row.ui_status === "Overdue"
  ) {
    return row.ui_status;
  }

  if (row.status === "delivered" || row.status === "archived") return "Received";
  if (row.status === "ordered" && (row.received_percent ?? 0) > 0) return "Partial";
  if (
    row.expected_delivery &&
    row.expected_delivery < todayIso() &&
    (row.status === "not_ordered" || row.status === "ordered")
  ) {
    return "Overdue";
  }
  return "Open";
}

export function dbRowToJobPurchaseOrder(
  row: DbPurchaseOrder & {
    title?: string | null;
    category?: string | null;
    po_type?: string | null;
    received_amount?: number | null;
    ui_status?: string | null;
  }
): JobPurchaseOrder {
  const status = deriveUiStatus(row);
  const orderDate =
    row.ordered_at?.slice(0, 10) ?? row.created_at.slice(0, 10);
  const expected = row.expected_delivery ?? "";

  return {
    id: row.id,
    po: row.po_number ?? formatPoNumber(row),
    title: row.title ?? row.item_name,
    poType: (row.po_type as JobPoType | null) ?? undefined,
    vendor: row.vendor,
    category: row.category ?? "Other",
    categoryStyle: categoryStyleFor(row.category),
    orderDate,
    expected,
    expectedOverdue:
      !!expected && expected < todayIso() && status !== "Received",
    total: Number(row.amount),
    received: Number(row.received_amount ?? 0),
    status,
    isDraft: row.status === "not_ordered",
  };
}

export function getCategoryMetaForPoType(type: JobPoType) {
  const map: Record<JobPoType, { label: string; style: string }> = {
    Doors: { label: "Cabinet Parts", style: CATEGORY_STYLES["Cabinet Parts"] },
    Drawers: { label: "Cabinet Parts", style: CATEGORY_STYLES["Cabinet Parts"] },
    Plywood: { label: "Lumber & Panels", style: CATEGORY_STYLES["Lumber & Panels"] },
    Hardware: { label: "Hardware", style: CATEGORY_STYLES.Hardware },
  };
  return map[type];
}

export function nextJobPoNumber(existing: DbPurchaseOrder[]) {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const prefix = `PO-${y}${m}${d}-`;
  const maxSuffix = existing.reduce((max, row) => {
    const num = row.po_number ?? formatPoNumber(row);
    if (!num.startsWith(prefix)) return max;
    const suffix = Number.parseInt(num.slice(prefix.length), 10);
    return Number.isNaN(suffix) ? max : Math.max(max, suffix);
  }, 0);
  return `${prefix}${String(maxSuffix + 1).padStart(3, "0")}`;
}

export function buildJobPurchaseOrderInsert(
  jobId: string,
  input: {
    title: string;
    vendor: string;
    poType: JobPoType;
    poNumber?: string;
    orderDate: string;
    expectedDelivery: string;
  }
) {
  const categoryMeta = getCategoryMetaForPoType(input.poType);
  const core = {
    job_id: jobId,
    item_name: input.title,
    title: input.title,
    vendor: input.vendor,
    amount: 0,
    ordered_at: `${input.orderDate}T12:00:00Z`,
    expected_delivery: input.expectedDelivery,
    status: "not_ordered" as const,
    po_type: input.poType,
    category: categoryMeta.label,
    received_amount: 0,
    ui_status: "Open",
  };

  if (!input.poNumber) return core;

  return {
    ...core,
    po_number: input.poNumber,
    received_percent: 0,
  };
}

export function isMissingColumnError(message: string) {
  return /column|schema cache/i.test(message);
}

export function purchaseOrderInsertErrorMessage(message: string) {
  if (isMissingColumnError(message)) {
    return "Could not create purchase order. The database schema is out of date — run pending Supabase migrations, then try again.";
  }
  if (message.includes("row-level security")) {
    return "Could not create purchase order. Please sign in again and retry.";
  }
  if (message.includes("violates foreign key")) {
    return "Could not create purchase order. This job could not be found.";
  }
  return `Could not create purchase order: ${message}`;
}
