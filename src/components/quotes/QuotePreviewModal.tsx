"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  IconFileTypePdf,
  IconPrinter,
  IconX,
} from "@tabler/icons-react";
import QuoteDocument from "@/components/quotes/QuoteDocument";
import {
  fetchQuoteDocumentData,
  type QuoteDocumentData,
} from "@/lib/quote-document";
import type { Lead } from "@/lib/types";

interface QuotePreviewModalProps {
  quote: Lead;
  open: boolean;
  onClose: () => void;
  /** When true, open the browser print dialog after the document loads. */
  autoPrint?: boolean;
}

export default function QuotePreviewModal({
  quote,
  open,
  onClose,
  autoPrint = false,
}: QuotePreviewModalProps) {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<QuoteDocumentData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchQuoteDocumentData(quote);
    if (result.error || !result.data) {
      setError(result.error ?? "Could not load quote.");
      setData(null);
    } else {
      setData(result.data);
    }
    setLoading(false);
  }, [quote]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !autoPrint || loading || !data) return;
    const timer = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(timer);
  }, [open, autoPrint, loading, data]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="quote-print-portal fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        className="no-print absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-label="Close quote preview"
      />

      <div className="quote-print-dialog relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xl">
        <div className="no-print flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <IconX size={16} />
            Close
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              disabled={!data}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
            >
              <IconPrinter size={16} />
              Print
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              disabled={!data}
              className="inline-flex items-center gap-2 rounded-md bg-burgundy px-4 py-2 text-sm font-medium text-white hover:bg-burgundy/90 disabled:opacity-50"
            >
              <IconFileTypePdf size={16} />
              Download PDF
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-gray-50 p-4 sm:p-5 print:overflow-visible print:bg-white print:p-0">
          {loading && (
            <p className="py-16 text-center text-sm text-gray-500">
              Loading quote…
            </p>
          )}
          {error && (
            <p className="py-16 text-center text-sm text-red-600">{error}</p>
          )}
          {data && (
            <div id="quote-print-document" className="print:max-w-none">
              <QuoteDocument data={data} />
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
