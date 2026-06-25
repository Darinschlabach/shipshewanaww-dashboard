"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { IconArrowLeft, IconPrinter } from "@tabler/icons-react";
import QuoteDocument from "@/components/quotes/QuoteDocument";
import { createClient } from "@/lib/supabase/client";
import { fetchQuoteDocumentData } from "@/lib/quote-document";
import type { QuoteDocumentData } from "@/lib/quote-document";
import type { Contact, Lead } from "@/lib/types";

function normalizeLeadContact(
  lead: Lead & { contacts?: Contact | Contact[] | null }
): Lead {
  const raw = lead.contacts;
  const contacts = Array.isArray(raw) ? (raw[0] ?? null) : (raw ?? null);
  return { ...lead, contacts };
}

export default function QuotePrintPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const autoPrint = searchParams.get("download") === "1";
  const [data, setData] = useState<QuoteDocumentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data: leadData } = await supabase
      .from("leads")
      .select(
        `
        *,
        contacts!contact_id (
          id,
          name,
          email,
          phone,
          address
        )
      `
      )
      .eq("id", id)
      .maybeSingle();

    let quote = leadData ? normalizeLeadContact(leadData as Lead) : null;
    if (quote?.contact_id && !quote.contacts) {
      const { data: contact } = await supabase
        .from("contacts")
        .select("id, name, email, phone, address")
        .eq("id", quote.contact_id)
        .maybeSingle();
      if (contact) quote = { ...quote, contacts: contact };
    }

    if (!quote) {
      setError("Quote not found.");
      setLoading(false);
      return;
    }

    const result = await fetchQuoteDocumentData(quote);
    if (result.error || !result.data) {
      setError(result.error ?? "Could not load quote.");
    } else {
      setData(result.data);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!autoPrint || loading || !data) return;
    const timer = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(timer);
  }, [autoPrint, loading, data]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-500">
        Loading quote…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-gray-600">
        <p>{error ?? "Quote not found."}</p>
        <Link href={`/leads/${id}`} className="text-sm text-burgundy hover:underline">
          Back to quote
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="no-print sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-[8.5in] items-center justify-between gap-3">
          <Link
            href={`/leads/${id}`}
            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-burgundy"
          >
            <IconArrowLeft size={16} />
            Back to quote
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-md bg-burgundy px-4 py-2 text-sm font-medium text-white hover:bg-burgundy/90"
          >
            <IconPrinter size={16} />
            {autoPrint ? "Save as PDF" : "Download PDF"}
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-[8.5in] px-4 py-6 print:px-0 print:py-0">
        <QuoteDocument data={data} />
      </div>
    </>
  );
}
