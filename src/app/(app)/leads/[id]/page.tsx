"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { unconvertQuoteFromJob } from "@/lib/unconvert-quote";
import QuoteDetailView from "@/components/quotes/QuoteDetailView";
import type { Contact, Lead } from "@/lib/types";

function normalizeLeadContact(
  lead: Lead & { contacts?: Contact | Contact[] | null }
): Lead {
  const raw = lead.contacts;
  const contacts = Array.isArray(raw) ? (raw[0] ?? null) : (raw ?? null);
  return { ...lead, contacts };
}

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [quote, setQuote] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);
  const [unconverting, setUnconverting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
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

    let lead = data ? normalizeLeadContact(data as Lead) : null;
    if (lead?.contact_id && !lead.contacts) {
      const { data: contact } = await supabase
        .from("contacts")
        .select("id, name, email, phone, address")
        .eq("id", lead.contact_id)
        .maybeSingle();
      if (contact) lead = { ...lead, contacts: contact as Contact };
    }
    setQuote(lead);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleConvert() {
    if (!quote) return;
    setConverting(true);
    const supabase = createClient();

    let customerId = quote.contact_id;

    if (!customerId) {
      const { data: contact } = await supabase
        .from("contacts")
        .insert({ name: quote.customer_name.trim() })
        .select()
        .single();
      customerId = contact?.id ?? null;
    }

    const { data: job } = await supabase
      .from("jobs")
      .insert({
        name: quote.project_type,
        customer_id: customerId,
        stage: "design",
        total_value: quote.est_value,
        notes: quote.notes,
      })
      .select()
      .single();

    if (!job) {
      setConverting(false);
      return;
    }

    const { convertQuoteSharePointToJobClient } = await import("@/lib/job-files");
    const sharePoint = await convertQuoteSharePointToJobClient({
      quoteId: quote.id,
      jobId: job.id,
    });

    if (!sharePoint.ok) {
      await supabase.from("jobs").delete().eq("id", job.id);
      setConverting(false);
      window.alert(
        sharePoint.error ??
          "Could not move the SharePoint folder to Jobs. Conversion was cancelled."
      );
      return;
    }

    await supabase
      .from("leads")
      .update({ status: "converted", converted_job_id: job.id, job_id: job.id })
      .eq("id", quote.id);

    await supabase.from("production_jobs").insert({
      job_id: job.id,
      kanban_status: "cutting",
    });

    router.push(`/jobs/${job.id}`);
    setConverting(false);
  }

  async function handleUnconvert() {
    if (!quote?.converted_job_id) return;
    setUnconverting(true);
    const supabase = createClient();

    let job: { name: string; total_value: number; notes: string } | null = null;
    const { data: jobData } = await supabase
      .from("jobs")
      .select("name, total_value, notes")
      .eq("id", quote.converted_job_id)
      .maybeSingle();
    if (jobData) job = jobData;

    const { error } = await unconvertQuoteFromJob(supabase, quote, job);
    setUnconverting(false);
    if (!error) {
      await load();
      router.push("/leads");
    }
  }

  async function handleDelete() {
    if (!quote) return;
    setDeleting(true);
    const supabase = createClient();
    await supabase.from("leads").delete().eq("id", quote.id);
    router.push("/leads");
    setDeleting(false);
  }

  if (loading) {
    return <p className="text-gray-500">Loading quote…</p>;
  }

  if (!quote) {
    return (
      <div>
        <p className="text-gray-600">Quote not found.</p>
        <Link href="/leads" className="mt-2 text-sm text-burgundy hover:underline">
          Back to Quotes
        </Link>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-2.5rem)] overflow-hidden">
      <QuoteDetailView
        quote={quote}
        onConvert={handleConvert}
        onUnconvert={handleUnconvert}
        onDelete={handleDelete}
        onQuoteUpdated={load}
        converting={converting}
        unconverting={unconverting}
        deleting={deleting}
      />
    </div>
  );
}
