import {
  PO_DISPLAY_LABELS,
  PO_DISPLAY_STYLES,
  normalizePoDisplayStatus,
} from "@/lib/purchase-orders";
import type { PurchaseOrder } from "@/lib/types";

interface PoStatusBadgeProps {
  po: PurchaseOrder;
}

export default function PoStatusBadge({ po }: PoStatusBadgeProps) {
  const key = normalizePoDisplayStatus(po);
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${PO_DISPLAY_STYLES[key]}`}
    >
      {PO_DISPLAY_LABELS[key]}
    </span>
  );
}
