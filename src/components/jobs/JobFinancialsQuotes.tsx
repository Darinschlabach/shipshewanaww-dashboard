"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  IconChevronLeft,
  IconChevronRight,
  IconDots,
} from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/Button";
import ContactSearchSelect from "@/components/ContactSearchSelect";
import Modal from "@/components/Modal";
import QuoteStatusBadge from "@/components/QuoteStatusBadge";
import {
  formatQuoteNumber,
  isActiveQuote,
  nextQuoteNumber,
  normalizeQuoteStatus,
} from "@/lib/quotes";
import { formatCurrencyFull, formatDateLong } from "@/lib/utils";
import type { Contact, Job, Lead } from "@/lib/types";

const STATUS_FILTERS = [
  { value: "all", label: "All quotes" },
  { value: "active", label: "Active quotes" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "approved", label: "Approved" },
  { value: "lost", label: "Rejected" },
] as const;

const PAGE_SIZE = 10;

const selectClass =
  "rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-burgundy focus:outline-none focus:ring-1 focus:ring-burgundy";

type JobWithContact = Job & { contacts: Contact | null };

function quoteDisplayName(lead: Lead): string {
  const name = lead.project_type.trim();
  if (!name) return lead.customer_name;
  if (name.toLowerCase().includes(lead.customer_name.toLowerCase())) return name;
  return `${lead.customer_name} – ${name}`;
}

function quoteExpiresAt(lead: Pick<Lead, "sent_at">): string | null {
  if (!lead.sent_at) return null;
  const expires = new Date(`${lead.sent_at}T12:00:00`);
  expires.setDate(expires.getDate() + 30);
  return expires.toISOString().slice(0, 10);
}

function quoteVersion(quote: Lead, allQuotes: Lead[]): number {
  const sorted = [...allQuotes].sort((a, b) =>
    a.created_at.localeCompare(b.created_at)
  );
  const index = sorted.findIndex((q) => q.id === quote.id);
  return index >= 0 ? index + 1 : 1;
}

function defaultQuoteName(jobName: string, existingCount: number): string {
  if (existingCount === 0) return jobName;
  return `${jobName} – Quote V${existingCount + 1}`;
}

interface JobFinancialsQuotesProps {
  jobId: string;
}

export default function JobFinancialsQuotes({ jobId }: JobFinancialsQuotesProps) {
  const [job, setJob] = useState<JobWithContact | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [quotes, setQuotes] = useState<Lead[]>([]);
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("active");
  const [page, setPage] = useState(1);
  const [showNewModal, setShowNewModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [quoteName, setQuoteName] = useState("");
  const [contactId, setContactId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [{ data: jobData }, { data: quotesData }, { data: contactsData }, { data: leadsData }] =
      await Promise.all([
        supabase
          .from("jobs")
          .select("*, contacts(*)")
          .eq("id", jobId)
          .maybeSingle(),
        supabase
          .from("leads")
          .select("*")
          .or(`job_id.eq.${jobId},converted_job_id.eq.${jobId}`)
          .order("created_at", { ascending: false }),
        supabase.from("contacts").select("*").order("name"),
        supabase.from("leads").select("id, quote_number, created_at"),
      ]);

    setJob((jobData as JobWithContact) ?? null);
    setQuotes((quotesData as Lead[]) ?? []);
    setContacts((contactsData as Contact[]) ?? []);
    setAllLeads((leadsData as Lead[]) ?? []);
    setLoading(false);
  }, [jobId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return quotes;
    if (statusFilter === "active") {
      return quotes.filter(
        (q) => isActiveQuote(q.status) || q.status === "converted"
      );
    }
    return quotes.filter(
      (q) => normalizeQuoteStatus(q.status) === statusFilter
    );
  }, [quotes, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageQuotes = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function openNewQuoteModal() {
    if (!job) return;
    setCreateError(null);
    setQuoteName(defaultQuoteName(job.name, quotes.length));
    setContactId(job.customer_id);
    setShowNewModal(true);
  }

  async function handleCreateQuote(e: React.FormEvent) {
    e.preventDefault();
    if (!job) return;
    setCreateError(null);

    const name = quoteName.trim();
    if (!name) {
      setCreateError("Quote name is required.");
      return;
    }

    const resolvedContactId = contactId ?? job.customer_id;
    if (!resolvedContactId) {
      setCreateError("Select a customer for this quote.");
      return;
    }

    setCreating(true);
    const supabase = createClient();

    let customerName =
      contacts.find((c) => c.id === resolvedContactId)?.name ??
      job.contacts?.name ??
      null;

    if (!customerName) {
      const { data: contactRow, error: contactError } = await supabase
        .from("contacts")
        .select("name")
        .eq("id", resolvedContactId)
        .maybeSingle();
      if (contactError || !contactRow?.name) {
        setCreateError("Could not load the selected contact. Try again.");
        setCreating(false);
        return;
      }
      customerName = contactRow.name;
    }

    const quoteNumber = nextQuoteNumber(allLeads);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    let designer: string | null = null;
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      designer = profile?.full_name ?? null;
    }

    const { error } = await supabase.from("leads").insert({
      customer_name: customerName,
      project_type: name,
      contact_id: resolvedContactId,
      job_id: jobId,
      est_value: 0,
      status: "draft",
      quote_number: quoteNumber,
      designer,
    });

    if (error) {
      const msg = error.message ?? "";
      const schemaHint =
        msg.includes("schema cache") || msg.includes("column")
          ? " Run supabase/migrations/20260622000001_leads_job_id.sql in the Supabase SQL Editor, then try again."
          : "";
      setCreateError((msg || "Could not create quote.") + schemaHint);
      setCreating(false);
      return;
    }

    setShowNewModal(false);
    setCreating(false);
    await load();
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Loading quotes…</p>;
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Quotes</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={selectClass}
            >
              {STATUS_FILTERS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={openNewQuoteModal}
              disabled={!job}
              className="inline-flex shrink-0 items-center rounded-md bg-burgundy px-4 py-2 text-sm font-medium text-white hover:bg-burgundy/90 disabled:opacity-50"
            >
              + New quote
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                    Quote #
                  </th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                    Name
                  </th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                    Version
                  </th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                    Total
                  </th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                    Created
                  </th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                    Expires
                  </th>
                  <th className="w-10 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {pageQuotes.map((quote) => (
                  <tr
                    key={quote.id}
                    className="group border-b border-gray-100 transition-colors hover:bg-gray-50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/leads/${quote.id}`}
                        className="font-medium text-burgundy hover:underline"
                      >
                        {formatQuoteNumber(quote)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-900">
                      {quoteDisplayName(quote)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {quoteVersion(quote, quotes)}
                    </td>
                    <td className="px-4 py-3">
                      <QuoteStatusBadge status={quote.status} />
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {formatCurrencyFull(Number(quote.est_value))}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatDateLong(quote.created_at.slice(0, 10))}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatDateLong(quoteExpiresAt(quote))}
                    </td>
                    <td className="w-10 px-4 py-3">
                      <Link
                        href={`/leads/${quote.id}`}
                        className="inline-flex rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        aria-label={`Open ${formatQuoteNumber(quote)}`}
                      >
                        <IconDots size={18} />
                      </Link>
                    </td>
                  </tr>
                ))}
                {pageQuotes.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-12 text-center text-sm text-gray-500"
                    >
                      {quotes.length === 0
                        ? "No quotes for this job yet. Click + New quote to create one."
                        : "No quotes match this filter."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-4 py-3 text-sm text-gray-600">
            <p>
              {filtered.length === 0
                ? "No quotes to show"
                : `Showing ${pageStart + 1} to ${Math.min(pageStart + PAGE_SIZE, filtered.length)} of ${filtered.length} quote${filtered.length !== 1 ? "s" : ""}`}
            </p>

            {filtered.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="rounded-md border border-gray-300 p-1.5 hover:bg-gray-50 disabled:opacity-40"
                  aria-label="Previous page"
                >
                  <IconChevronLeft size={16} />
                </button>
                <span className="min-w-[2rem] rounded-md border border-burgundy bg-burgundy px-2 py-1 text-center text-white">
                  {safePage}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="rounded-md border border-gray-300 p-1.5 hover:bg-gray-50 disabled:opacity-40"
                  aria-label="Next page"
                >
                  <IconChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showNewModal && job && (
        <Modal
          title="New quote"
          onClose={() => {
            if (!creating) setShowNewModal(false);
          }}
        >
          <form onSubmit={handleCreateQuote} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Quote name</label>
              <input
                required
                value={quoteName}
                onChange={(e) => setQuoteName(e.target.value)}
                placeholder={`e.g. ${job.name}`}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Customer</label>
              <ContactSearchSelect
                contacts={contacts}
                value={contactId}
                required
                onChange={(id) => setContactId(id)}
              />
            </div>
            {createError && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {createError}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                disabled={creating}
                onClick={() => setShowNewModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={creating || !contactId}
              >
                {creating ? "Creating…" : "Create quote"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
