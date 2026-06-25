"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  IconChevronLeft,
  IconChevronRight,
  IconCircleCheck,
  IconColumns3,
  IconFileText,
  IconSearch,
  IconSend,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/client";
import PageHeader from "@/components/PageHeader";
import ConfirmModal from "@/components/ConfirmModal";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import ContactSearchSelect from "@/components/ContactSearchSelect";
import {
  formatCurrencyFull,
  formatDateLong,
  formatRelativeTime,
} from "@/lib/utils";
import {
  countByQuoteStatus,
  formatQuoteNumber,
  isActiveQuote,
  nextQuoteNumber,
  normalizeQuoteStatus,
  quotePipelineValue,
  sumQuoteValue,
  type QuoteDisplayStatus,
} from "@/lib/quotes";
import type { Contact, Lead } from "@/lib/types";

const STATUS_FILTERS: { value: QuoteDisplayStatus | "all"; label: string }[] = [
  { value: "all", label: "All Quotes" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "approved", label: "Approved" },
  { value: "lost", label: "Lost" },
];

const DATE_RANGES = [
  { value: "", label: "Date Range" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "year", label: "This year" },
];

const PAGE_SIZE_OPTIONS = [10, 25, 50];

const selectClass =
  "rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-burgundy focus:outline-none focus:ring-1 focus:ring-burgundy";

const emptyForm = {
  job_name: "",
  job_address: "",
  primary_contact_id: null as string | null,
  additional_contact_ids: [] as string[],
};

export default function LeadsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filter, setFilter] = useState<QuoteDisplayStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [convertLead, setConvertLead] = useState<Lead | null>(null);
  const [converting, setConverting] = useState(false);
  const [deleteLead, setDeleteLead] = useState<Lead | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    customer: true,
    description: true,
    amount: true,
    sent: true,
    updated: true,
  });
  const [form, setForm] = useState(emptyForm);

  const loadLeads = useCallback(async () => {
    const supabase = createClient();
    const [{ data }, { data: contactsData }] = await Promise.all([
      supabase
        .from("leads")
        .select("*")
        .neq("status", "converted")
        .order("updated_at", { ascending: false }),
      supabase.from("contacts").select("*").order("name"),
    ]);
    setLeads((data as Lead[]) ?? []);
    setContacts((contactsData as Contact[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setShowNewModal(true);
    }
  }, [searchParams]);


  const activeLeads = useMemo(
    () => leads.filter((l) => isActiveQuote(l.status)),
    [leads]
  );

  const stats = useMemo(
    () => ({
      total: activeLeads.length,
      sent: countByQuoteStatus(activeLeads, "sent"),
      sentValue: sumQuoteValue(activeLeads, "sent"),
      approved: countByQuoteStatus(activeLeads, "approved"),
      approvedValue: sumQuoteValue(activeLeads, "approved"),
      lost: countByQuoteStatus(activeLeads, "lost"),
      lostValue: sumQuoteValue(activeLeads, "lost"),
      pipeline: quotePipelineValue(activeLeads),
    }),
    [activeLeads]
  );

  const filterOptions = useMemo(
    () =>
      STATUS_FILTERS.map((opt) => ({
        ...opt,
        label:
          opt.value === "all"
            ? opt.label
            : `${opt.label} (${countByQuoteStatus(activeLeads, opt.value)})`,
      })),
    [activeLeads]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const activeStatus = filter === "all" ? "" : filter;

    return activeLeads.filter((lead) => {
      const displayStatus = normalizeQuoteStatus(lead.status);
      if (activeStatus && displayStatus !== activeStatus) return false;
      if (dateRange) {
        const ref = lead.sent_at ?? lead.created_at.slice(0, 10);
        const refDate = new Date(`${ref}T12:00:00`);
        const now = new Date();
        if (dateRange === "year") {
          if (refDate.getFullYear() !== now.getFullYear()) return false;
        } else {
          const days = parseInt(dateRange, 10);
          const cutoff = new Date(now);
          cutoff.setDate(cutoff.getDate() - days);
          if (refDate < cutoff) return false;
        }
      }

      if (!q) return true;
      const quoteNum = formatQuoteNumber(lead).toLowerCase();
      return (
        quoteNum.includes(q) ||
        lead.customer_name.toLowerCase().includes(q) ||
        lead.project_type.toLowerCase().includes(q)
      );
    });
  }, [
    activeLeads,
    search,
    filter,
    dateRange,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageLeads = filtered.slice(pageStart, pageStart + pageSize);

  useEffect(() => {
    setPage(1);
  }, [search, filter, dateRange, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function openNewQuoteModal() {
    setCreateError(null);
    setForm(emptyForm);
    setShowNewModal(true);
  }

  async function handleCreateLead(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);

    const jobName = form.job_name.trim();
    if (!jobName) {
      setCreateError("Job name is required.");
      return;
    }
    if (!form.primary_contact_id) {
      setCreateError("Select a primary job contact.");
      return;
    }

    setCreating(true);
    const supabase = createClient();

    let customerName =
      contacts.find((c) => c.id === form.primary_contact_id)?.name ?? null;
    if (!customerName) {
      const { data: contactRow, error: contactError } = await supabase
        .from("contacts")
        .select("name")
        .eq("id", form.primary_contact_id)
        .maybeSingle();
      if (contactError || !contactRow?.name) {
        setCreateError("Could not load the selected contact. Try again.");
        setCreating(false);
        return;
      }
      customerName = contactRow.name;
    }

    const quoteNumber = nextQuoteNumber(leads);

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

    const { data: lead, error } = await supabase
      .from("leads")
      .insert({
        customer_name: customerName,
        project_type: jobName,
        job_address: form.job_address.trim() || null,
        contact_id: form.primary_contact_id,
        est_value: 0,
        status: "draft",
        quote_number: quoteNumber,
        designer,
      })
      .select("id")
      .single();

    if (error || !lead) {
      const msg = error?.message ?? "";
      const schemaHint =
        msg.includes("schema cache") || msg.includes("column")
          ? " Run supabase/migrations/20250604000012_quotes_leads_catchup.sql in the Supabase SQL Editor (Dashboard → SQL → New query), then try again."
          : "";
      setCreateError(
        (msg || "Could not create quote.") + schemaHint
      );
      setCreating(false);
      return;
    }

    if (form.additional_contact_ids.length > 0) {
      const { error: linksError } = await supabase.from("lead_contacts").insert(
        form.additional_contact_ids.map((contact_id) => ({
          lead_id: lead.id,
          contact_id,
        }))
      );
      if (linksError) {
        setCreateError(
          `Quote ${quoteNumber} was created, but extra contacts could not be linked: ${linksError.message}`
        );
        setCreating(false);
        await loadLeads();
        return;
      }
    }

    setShowNewModal(false);
    setForm(emptyForm);
    setCreating(false);
    await loadLeads();
    router.push(`/leads/${lead.id}`);
  }

  async function handleConvert() {
    if (!convertLead) return;
    setConverting(true);
    const supabase = createClient();

    let customerId = convertLead.contact_id;

    if (!customerId) {
      const { data: contact } = await supabase
        .from("contacts")
        .insert({ name: convertLead.customer_name.trim() })
        .select()
        .single();
      customerId = contact?.id ?? null;
    }

    const { data: job } = await supabase
      .from("jobs")
      .insert({
        name: convertLead.project_type,
        customer_id: customerId,
        stage: "design",
        total_value: convertLead.est_value,
        notes: convertLead.notes,
      })
      .select()
      .single();

    if (job) {
      await supabase
        .from("leads")
        .update({ status: "converted", converted_job_id: job.id, job_id: job.id })
        .eq("id", convertLead.id);

      await supabase.from("production_jobs").insert({
        job_id: job.id,
        kanban_status: "cutting",
      });

      setConvertLead(null);
      router.push(`/jobs/${job.id}`);
    }
    setConverting(false);
  }

  async function handleDeleteLead() {
    if (!deleteLead) return;
    setDeleting(true);
    const supabase = createClient();
    await supabase.from("leads").delete().eq("id", deleteLead.id);
    setDeleteLead(null);
    setDeleting(false);
    await loadLeads();
  }

  function toggleColumn(key: keyof typeof visibleColumns) {
    setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const statItems = [
    {
      icon: IconFileText,
      value: stats.total,
      label: "Total Quotes",
      sub: null,
    },
    {
      icon: IconSend,
      value: stats.sent,
      label: "Sent Quotes",
      sub: formatCurrencyFull(stats.sentValue),
    },
    {
      icon: IconCircleCheck,
      value: stats.approved,
      label: "Approved Quotes",
      sub: formatCurrencyFull(stats.approvedValue),
    },
    {
      icon: IconX,
      value: stats.lost,
      label: "Lost Quotes",
      sub: formatCurrencyFull(stats.lostValue),
    },
  ];

  return (
    <>
      <PageHeader
        title="Quotes"
        rightSlot={
          <button
            type="button"
            onClick={openNewQuoteModal}
            className="shrink-0 rounded-md bg-burgundy px-4 py-2 text-sm font-medium text-white hover:bg-burgundy/90"
          >
            + New Quote
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {filterOptions.map((opt) => {
          const active = filter === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFilter(opt.value)}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "border-burgundy bg-white text-burgundy"
                  : "border-gray-300 bg-white text-gray-600 hover:border-gray-400"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <div className="mb-4 flex flex-wrap overflow-hidden rounded-lg border border-gray-200 bg-cream">
        {statItems.map(({ icon: Icon, value, label, sub }, idx) => (
          <div
            key={label}
            className={`flex min-w-[150px] flex-1 items-center gap-3 px-5 py-4 ${
              idx < statItems.length - 1 ? "border-r border-gray-200" : ""
            }`}
          >
            <Icon size={20} className="shrink-0 text-gray-400" stroke={1.5} />
            <div>
              <p className="text-lg font-semibold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
              {sub && <p className="text-xs font-medium text-gray-700">{sub}</p>}
            </div>
          </div>
        ))}
        <div className="flex min-w-[160px] flex-1 flex-col justify-center border-l border-gray-200 px-5 py-4">
          <p className="text-xs text-gray-500">Pipeline Value</p>
          <p className="text-lg font-semibold text-gray-900">
            {formatCurrencyFull(stats.pipeline)}
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[260px] flex-1">
          <IconSearch
            size={18}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="search"
            placeholder="Search quotes by customer, quote #, job name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-burgundy focus:outline-none focus:ring-1 focus:ring-burgundy"
          />
        </div>

        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className={selectClass}
        >
          {DATE_RANGES.map((r) => (
            <option key={r.value || "all-dates"} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowColumns((v) => !v)}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <IconColumns3 size={16} />
            Columns
          </button>
          {showColumns && (
            <div className="absolute right-0 z-10 mt-1 w-44 rounded-md border border-gray-200 bg-white py-2 shadow-lg">
              {(
                [
                  ["description", "Job Name"],
                  ["customer", "Customer"],
                  ["amount", "Amount"],
                  ["sent", "Sent"],
                  ["updated", "Updated"],
                ] as const
              ).map(([key, label]) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={visibleColumns[key]}
                    onChange={() => toggleColumn(key)}
                    className="rounded border-gray-300"
                  />
                  {label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                    Quote #
                  </th>
                  {visibleColumns.description && (
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                      Job Name
                    </th>
                  )}
                  {visibleColumns.customer && (
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                      Customer
                    </th>
                  )}
                  {visibleColumns.amount && (
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                      Amount
                    </th>
                  )}
                  {visibleColumns.sent && (
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                      Sent
                    </th>
                  )}
                  {visibleColumns.updated && (
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                      Updated
                    </th>
                  )}
                  <th className="w-10 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {pageLeads.map((lead) => (
                  <tr
                    key={lead.id}
                    onClick={() => router.push(`/leads/${lead.id}`)}
                    className="group cursor-pointer border-b border-gray-100 transition-colors hover:bg-gray-50"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 font-medium text-gray-900">
                        <IconFileText
                          size={18}
                          className="shrink-0 text-burgundy"
                          stroke={1.5}
                        />
                        {formatQuoteNumber(lead)}
                      </div>
                    </td>
                    {visibleColumns.description && (
                      <td className="px-4 py-3 text-sm font-normal text-gray-900">
                        {lead.project_type}
                      </td>
                    )}
                    {visibleColumns.customer && (
                      <td className="px-4 py-3 text-sm font-normal text-gray-900">
                        {lead.customer_name}
                      </td>
                    )}
                    {visibleColumns.amount && (
                      <td className="px-4 py-3 text-gray-900">
                        {formatCurrencyFull(Number(lead.est_value))}
                      </td>
                    )}
                    {visibleColumns.sent && (
                      <td className="px-4 py-3 text-gray-600">
                        {formatDateLong(lead.sent_at)}
                      </td>
                    )}
                    {visibleColumns.updated && (
                      <td className="px-4 py-3 text-gray-600">
                        {formatRelativeTime(lead.updated_at)}
                      </td>
                    )}
                    <td className="w-10 px-4 py-3">
                      <div className="relative ml-auto h-[18px] w-[18px]">
                        <IconChevronRight
                          size={18}
                          className="absolute inset-0 text-gray-400 transition-opacity group-hover:opacity-0"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteLead(lead);
                          }}
                          className="absolute inset-0 inline-flex items-center justify-center text-red-500 opacity-0 transition-opacity pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto hover:text-red-600"
                          aria-label={`Delete ${formatQuoteNumber(lead)}`}
                        >
                          <IconTrash size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {pageLeads.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-sm text-gray-500"
                    >
                      No quotes match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
            <p>
              {filtered.length === 0
                ? "No quotes to show"
                : `Showing ${pageStart + 1} to ${Math.min(pageStart + pageSize, filtered.length)} of ${filtered.length} quote${filtered.length !== 1 ? "s" : ""}`}
            </p>

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

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(
                  (p) =>
                    p === 1 ||
                    p === totalPages ||
                    Math.abs(p - safePage) <= 1
                )
                .reduce<(number | "ellipsis")[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1) {
                    acc.push("ellipsis");
                  }
                  acc.push(p);
                  return acc;
                }, [])
                .map((item, idx) =>
                  item === "ellipsis" ? (
                    <span key={`ellipsis-${idx}`} className="px-1 text-gray-400">
                      …
                    </span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setPage(item)}
                      className={`min-w-[2rem] rounded-md border px-2 py-1 ${
                        item === safePage
                          ? "border-gray-900 bg-gray-900 text-white"
                          : "border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {item}
                    </button>
                  )
                )}

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="rounded-md border border-gray-300 p-1.5 hover:bg-gray-50 disabled:opacity-40"
                aria-label="Next page"
              >
                <IconChevronRight size={16} />
              </button>

              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className={selectClass}
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size} / page
                  </option>
                ))}
              </select>
            </div>
          </div>
        </>
      )}

      {showNewModal && (
        <Modal
          title="New quote"
          onClose={() => {
            if (!creating) setShowNewModal(false);
          }}
        >
          <form onSubmit={handleCreateLead} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Job Name</label>
              <input
                required
                value={form.job_name}
                onChange={(e) =>
                  setForm({ ...form, job_name: e.target.value })
                }
                placeholder="e.g. Smith Residence Kitchen Remodel"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Job Address</label>
              <AddressAutocomplete
                id="quote-job-address"
                value={form.job_address}
                onChange={(job_address) =>
                  setForm((prev) => ({ ...prev, job_address }))
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Primary Job Contact
              </label>
              <ContactSearchSelect
                contacts={contacts}
                value={form.primary_contact_id}
                required
                excludeIds={form.additional_contact_ids}
                onChange={(contactId, contact) => {
                  setForm((prev) => ({
                    ...prev,
                    primary_contact_id: contactId,
                    additional_contact_ids: contactId
                      ? prev.additional_contact_ids.filter(
                          (id) => id !== contactId
                        )
                      : prev.additional_contact_ids,
                    job_address:
                      prev.job_address.trim() ||
                      contact?.address?.trim() ||
                      "",
                  }));
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Contacts</label>
              {form.additional_contact_ids.length > 0 && (
                <ul className="mb-2 space-y-2">
                  {form.additional_contact_ids.map((id) => {
                    const c = contacts.find((x) => x.id === id);
                    if (!c) return null;
                    return (
                      <li
                        key={id}
                        className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-900">
                            {c.name}
                          </p>
                          {(c.phone || c.email) && (
                            <p className="truncate text-xs text-gray-500">
                              {[c.phone, c.email].filter(Boolean).join(" · ")}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              additional_contact_ids:
                                prev.additional_contact_ids.filter(
                                  (x) => x !== id
                                ),
                            }))
                          }
                          className="ml-2 shrink-0 text-xs text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <ContactSearchSelect
                contacts={contacts}
                value={null}
                placeholder="Add another contact…"
                excludeIds={[
                  ...(form.primary_contact_id
                    ? [form.primary_contact_id]
                    : []),
                  ...form.additional_contact_ids,
                ]}
                onChange={(contactId) => {
                  if (!contactId) return;
                  setForm((prev) => {
                    if (
                      prev.additional_contact_ids.includes(contactId) ||
                      prev.primary_contact_id === contactId
                    ) {
                      return prev;
                    }
                    return {
                      ...prev,
                      additional_contact_ids: [
                        ...prev.additional_contact_ids,
                        contactId,
                      ],
                    };
                  });
                }}
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
                disabled={creating || !form.primary_contact_id}
              >
                {creating ? "Creating…" : "Create quote"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {convertLead && (
        <ConfirmModal
          title="Convert to job?"
          body={`Create a new job for ${convertLead.customer_name} — ${convertLead.project_type}?`}
          confirmLabel="Convert"
          loading={converting}
          onConfirm={handleConvert}
          onCancel={() => setConvertLead(null)}
        />
      )}

      {deleteLead && (
        <ConfirmModal
          title="Delete quote?"
          body={
            deleteLead.status === "converted"
              ? `Delete ${formatQuoteNumber(deleteLead)}? The linked job will remain; only this quote record is removed.`
              : `Permanently delete ${formatQuoteNumber(deleteLead)} for ${deleteLead.customer_name}? This cannot be undone.`
          }
          confirmLabel="Delete"
          loading={deleting}
          onConfirm={handleDeleteLead}
          onCancel={() => setDeleteLead(null)}
        />
      )}
    </>
  );
}
