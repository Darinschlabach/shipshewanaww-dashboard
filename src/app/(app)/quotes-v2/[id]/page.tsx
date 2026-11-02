"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  IconArrowLeft,
  IconArrowRight,
  IconDotsVertical,
  IconMail,
  IconMapPin,
  IconPencil,
  IconPhone,
  IconTrash,
} from "@tabler/icons-react";
import Button from "@/components/Button";
import ConfirmModal from "@/components/ConfirmModal";
import Modal from "@/components/Modal";
import QuoteStatusBadge from "@/components/QuoteStatusBadge";
import { createClient } from "@/lib/supabase/client";
import {
  buildQuoteDetail,
  formatQuoteDisplayNumber,
} from "@/lib/quote-detail";
import { renameQuoteSharePointFolderClient } from "@/lib/quote-files";
import { QUOTE_V2_SOURCE } from "@/lib/quotes";
import { formatCurrencyFull, formatDateLong } from "@/lib/utils";
import type { Contact, Lead } from "@/lib/types";

const TABS = [
  { id: "main", label: "Main" },
  { id: "files", label: "Files" },
] as const;

function normalizeLeadContact(
  lead: Lead & { contacts?: Contact | Contact[] | null }
): Lead {
  const raw = lead.contacts;
  const contacts = Array.isArray(raw) ? (raw[0] ?? null) : (raw ?? null);
  return { ...lead, contacts };
}

export default function QuoteV2DetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [quote, setQuote] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]["id"]>("main");
  const [menuOpen, setMenuOpen] = useState(false);
  const [showRenameJob, setShowRenameJob] = useState(false);
  const [showConvert, setShowConvert] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [jobName, setJobName] = useState("");
  const [savingJobName, setSavingJobName] = useState(false);
  const [converting, setConverting] = useState(false);
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
      .eq("source", QUOTE_V2_SOURCE)
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
    setJobName(lead?.project_type ?? "");
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSaveJobName(e: FormEvent) {
    e.preventDefault();
    if (!quote) return;
    const name = jobName.trim();
    if (!name) return;

    setSavingJobName(true);
    const supabase = createClient();
    await supabase.from("leads").update({ project_type: name }).eq("id", quote.id);
    await renameQuoteSharePointFolderClient({
      quoteId: quote.id,
      jobName: name,
    });
    setSavingJobName(false);
    setShowRenameJob(false);
    await load();
  }

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

    router.push(`/jobs/${job.id}`);
    setConverting(false);
  }

  async function handleDelete() {
    if (!quote) return;
    setDeleting(true);
    const supabase = createClient();
    await supabase.from("leads").delete().eq("id", quote.id);
    router.push("/quotes-v2");
    setDeleting(false);
  }

  if (loading) {
    return <p className="text-gray-500">Loading quote…</p>;
  }

  if (!quote) {
    return (
      <div>
        <p className="text-gray-600">Quote not found.</p>
        <Link href="/quotes-v2" className="mt-2 text-sm text-burgundy hover:underline">
          Back to Quotes
        </Link>
      </div>
    );
  }

  const meta = buildQuoteDetail(quote);
  const isConverted = quote.status === "converted";

  return (
    <div className="flex h-[calc(100vh-2.5rem)] min-h-0 flex-col overflow-hidden">
      <Link
        href="/quotes-v2"
        className="mb-2 inline-flex shrink-0 items-center gap-1 text-sm text-gray-600 hover:text-burgundy"
      >
        <IconArrowLeft size={16} />
        Back to Quotes
      </Link>

      <div className="mb-3 flex shrink-0 flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-2xl font-semibold text-gray-900">
              {meta.title}
            </h1>
            <button
              type="button"
              onClick={() => setShowRenameJob(true)}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-burgundy"
              aria-label="Rename job"
              title="Rename job"
            >
              <IconPencil size={16} />
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-600">
              {formatQuoteDisplayNumber(quote)}
            </span>
            <QuoteStatusBadge status={quote.status} />
          </div>
        </div>

        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            disabled={deleting || converting}
            className="rounded-md border border-gray-300 bg-white p-2 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            aria-label="Quote actions"
            aria-expanded={menuOpen}
          >
            <IconDotsVertical size={18} />
          </button>
          {menuOpen ? (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full z-20 mt-1 w-52 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                {!isConverted ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setShowConvert(true);
                    }}
                    disabled={converting}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <IconArrowRight size={16} className="shrink-0 text-gray-500" />
                    Convert To Job
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setShowDelete(true);
                  }}
                  disabled={deleting}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  <IconTrash size={16} className="shrink-0" />
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="mb-3 shrink-0 border-b border-gray-200">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-burgundy text-burgundy"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3 grid shrink-0 grid-cols-2 gap-0 divide-x divide-gray-200 rounded-lg border border-gray-200 bg-white md:grid-cols-4">
        <div className="p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Customer
          </p>
          <p className="mt-1 font-medium text-gray-900">{meta.customerName}</p>
          <p className="mt-1 flex items-center gap-1 text-xs text-gray-600">
            <IconPhone size={12} />
            {meta.phone}
          </p>
          <p className="flex items-center gap-1 text-xs text-gray-600">
            <IconMail size={12} />
            {meta.email}
          </p>
          <p className="mt-0.5 flex items-start gap-1 text-xs text-gray-600">
            <IconMapPin size={12} className="mt-0.5 shrink-0" />
            {meta.customerAddress}
          </p>
        </div>
        <div className="p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Job Info
          </p>
          <dl className="mt-1 space-y-1 text-xs text-gray-700">
            <div>
              <span className="text-gray-500">Job Name: </span>
              {meta.jobName}
            </div>
            <div>
              <span className="text-gray-500">Address: </span>
              {meta.jobAddress}
            </div>
          </dl>
        </div>
        <div className="p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Quote Summary
          </p>
          <p className="mt-1 text-xs text-gray-500">Quote Total</p>
          <p className="text-xl font-semibold text-gray-900">
            {formatCurrencyFull(Number(quote.est_value))}
          </p>
        </div>
        <div className="p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Dates
          </p>
          <dl className="mt-1 space-y-1 text-xs text-gray-700">
            <div>
              <span className="text-gray-500">Created: </span>
              {formatDateLong(quote.created_at.slice(0, 10))}
            </div>
            <div>
              <span className="text-gray-500">Sent: </span>
              {quote.sent_at ? formatDateLong(quote.sent_at) : "—"}
            </div>
            <div>
              <span className="text-gray-500">Last Updated: </span>
              {formatDateLong(quote.updated_at.slice(0, 10))}
            </div>
            <div>
              <span className="text-gray-500">Follow Up: </span>
              <span className="font-medium text-red-600">
                {meta.followUpDate ? formatDateLong(meta.followUpDate) : "—"}
              </span>
            </div>
          </dl>
        </div>
      </div>

      <div className="min-h-0 flex-1" />

      {showRenameJob && (
        <Modal title="Rename job" onClose={() => setShowRenameJob(false)}>
          <form onSubmit={handleSaveJobName} className="space-y-4">
            <p className="text-sm text-gray-600">
              Customer:{" "}
              <span className="font-medium text-gray-900">{meta.customerName}</span>
            </p>
            <div>
              <label className="mb-1 block text-sm font-medium">Job name</label>
              <input
                required
                autoFocus
                value={jobName}
                onChange={(e) => setJobName(e.target.value)}
                placeholder="e.g. Jamison Kitchen"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" onClick={() => setShowRenameJob(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={savingJobName}>
                {savingJobName ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {showConvert && (
        <ConfirmModal
          title="Convert to job?"
          body={`Create a new job for ${quote.customer_name} — ${quote.project_type}?`}
          confirmLabel="Convert"
          loading={converting}
          onConfirm={() => {
            setShowConvert(false);
            void handleConvert();
          }}
          onCancel={() => setShowConvert(false)}
        />
      )}

      {showDelete && (
        <ConfirmModal
          title="Delete quote?"
          body={`Permanently delete ${formatQuoteDisplayNumber(quote)} for ${quote.customer_name}? This cannot be undone.`}
          confirmLabel="Delete"
          loading={deleting}
          onConfirm={() => {
            setShowDelete(false);
            void handleDelete();
          }}
          onCancel={() => setShowDelete(false)}
        />
      )}
    </div>
  );
}
