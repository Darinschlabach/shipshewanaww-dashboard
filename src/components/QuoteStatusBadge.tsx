import {
  QUOTE_STATUS_LABELS,
  QUOTE_STATUS_STYLES,
  normalizeQuoteStatus,
} from "@/lib/quotes";
import type { LeadStatus } from "@/lib/types";

interface QuoteStatusBadgeProps {
  status: LeadStatus | string;
}

export default function QuoteStatusBadge({ status }: QuoteStatusBadgeProps) {
  const key = normalizeQuoteStatus(status);
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${QUOTE_STATUS_STYLES[key]}`}
    >
      {QUOTE_STATUS_LABELS[key]}
    </span>
  );
}
