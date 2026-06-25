"use client";

import Modal from "@/components/Modal";
import Button from "@/components/Button";
import QuoteStatusBadge from "@/components/QuoteStatusBadge";
import { formatCurrencyFull, formatDateLong } from "@/lib/utils";
import { formatQuoteNumber } from "@/lib/quotes";
import type { Lead } from "@/lib/types";

interface QuoteViewModalProps {
  quote: Lead;
  onClose: () => void;
  onViewJob?: () => void;
  onConvert?: () => void;
}

export default function QuoteViewModal({
  quote,
  onClose,
  onViewJob,
  onConvert,
}: QuoteViewModalProps) {
  return (
    <Modal title={formatQuoteNumber(quote)} onClose={onClose}>
      <div className="space-y-4 text-sm">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Customer
          </p>
          <p className="mt-0.5 font-medium text-gray-900">{quote.customer_name}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Description
          </p>
          <p className="mt-0.5 text-gray-900">{quote.project_type}</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Source
            </p>
            <p className="mt-0.5 text-gray-900">{quote.source ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Designer
            </p>
            <p className="mt-0.5 text-gray-900">{quote.designer ?? "—"}</p>
          </div>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Amount
          </p>
          <p className="mt-0.5 text-gray-900">
            {formatCurrencyFull(Number(quote.est_value))}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Status
            </p>
            <p className="mt-1">
              <QuoteStatusBadge status={quote.status} />
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Sent
            </p>
            <p className="mt-0.5 text-gray-900">{formatDateLong(quote.sent_at)}</p>
          </div>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Notes
          </p>
          <p className="mt-0.5 whitespace-pre-wrap text-gray-900">
            {quote.notes?.trim() || "—"}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          {onConvert && quote.status !== "converted" && (
            <Button variant="small" onClick={onConvert}>
              Convert to job
            </Button>
          )}
          {onViewJob && (
            <Button variant="small" onClick={onViewJob}>
              View job
            </Button>
          )}
          <Button type="button" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
