"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IconChevronRight,
  IconDotsVertical,
  IconSearch,
} from "@tabler/icons-react";
import PageHeader from "@/components/PageHeader";
import Button from "@/components/Button";
import Modal from "@/components/Modal";
import JobStageBadge from "@/components/JobStageBadge";
import QuoteStatusBadge from "@/components/QuoteStatusBadge";
import { createClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/async";
import {
  buildWholesaleAccounts,
  wholesaleAccountStats,
  type WholesaleAccount,
  type WholesaleJob,
} from "@/lib/wholesale-accounts";
import type { Invoice } from "@/lib/invoices";
import {
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_STYLES,
  type InvoiceRow,
} from "@/lib/invoices";
import { formatProductionJobNumber } from "@/lib/production";
import { formatQuoteNumber } from "@/lib/quotes";
import {
  formatCurrencyFull,
  formatCurrencyPrecise,
  formatRelativeTime,
  getAvatarColor,
  getInitialsFromName,
} from "@/lib/utils";
import type { Contact, ContactPerson, Job, Lead } from "@/lib/types";

type DetailTab = "jobs" | "invoices" | "quotes" | "history" | "contacts";

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm";

export default function WholesaleAccountsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<WholesaleAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("jobs");
  const [people, setPeople] = useState<ContactPerson[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const supabase = createClient();
      const [
        { data: contactsData, error: contactsError },
        { data: jobsData },
        { data: invoiceData },
        { data: quotesData },
        { data: boardData },
      ] = await withTimeout(
        Promise.all([
          supabase
            .from("contacts")
            .select("*")
            .eq("contact_type", "Contractors")
            .order("name"),
          supabase.from("jobs").select("*").order("updated_at", {
            ascending: false,
          }),
          supabase
            .from("invoices")
            .select("*")
            .order("invoice_date", { ascending: false }),
          supabase
            .from("leads")
            .select("*")
            .order("updated_at", { ascending: false }),
          supabase.from("production_jobs").select("job_id, kanban_status"),
        ]),
        12_000,
        "Wholesale accounts"
      );

      if (contactsError) {
        setLoadError(contactsError.message);
        setAccounts([]);
        return;
      }

      const kanbanByJobId = Object.fromEntries(
        (
          (boardData as { job_id: string; kanban_status: string }[]) ?? []
        ).map((row) => [row.job_id, row.kanban_status])
      );
      const jobs: WholesaleJob[] = ((jobsData as Job[]) ?? []).map((job) => ({
        ...job,
        kanban_status: kanbanByJobId[job.id] ?? null,
      }));

      const next = buildWholesaleAccounts(
        (contactsData as Contact[]) ?? [],
        jobs,
        (invoiceData as Invoice[]) ?? [],
        (quotesData as Lead[]) ?? []
      );
      setAccounts(next);
      setSelectedId((current) => {
        if (current && next.some((account) => account.contact.id === current)) {
          return current;
        }
        return next[0]?.contact.id ?? null;
      });
    } catch (err) {
      console.error("Wholesale accounts load failed:", err);
      setLoadError(
        err instanceof Error ? err.message : "Could not load wholesale accounts."
      );
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((account) =>
      account.contact.name.toLowerCase().includes(q)
    );
  }, [accounts, search]);

  const selected = useMemo(
    () => accounts.find((account) => account.contact.id === selectedId) ?? null,
    [accounts, selectedId]
  );

  useEffect(() => {
    if (selected && !filtered.some((account) => account.contact.id === selected.contact.id)) {
      setSelectedId(filtered[0]?.contact.id ?? null);
    }
  }, [filtered, selected]);

  useEffect(() => {
    if (!selectedId) {
      setPeople([]);
      return;
    }
    let cancelled = false;
    async function loadPeople() {
      setPeopleLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("contact_people")
        .select("*")
        .eq("contact_id", selectedId)
        .order("name");
      if (!cancelled) {
        setPeople((data as ContactPerson[]) ?? []);
        setPeopleLoading(false);
      }
    }
    void loadPeople();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const stats = useMemo(() => wholesaleAccountStats(accounts), [accounts]);

  async function handleCreate() {
    const name = form.name.trim();
    if (!name) {
      setCreateError("Enter an account name.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const response = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          address: form.address.trim() || null,
          contact_type: "Contractors",
        }),
      });
      const json = (await response.json()) as {
        error?: string;
        data?: Contact;
      };
      if (!response.ok || !json.data) {
        setCreateError(json.error || "Could not create account.");
        return;
      }
      setShowCreate(false);
      setForm({ name: "", email: "", phone: "", address: "" });
      await load();
      setSelectedId(json.data.id);
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Could not create account."
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-2.5rem)] min-h-0 flex-col">
      <PageHeader
        title="Wholesale"
        rightSlot={
          <button
            type="button"
            onClick={() => {
              setCreateError(null);
              setShowCreate(true);
            }}
            className="shrink-0 rounded-md bg-burgundy px-4 py-2 text-sm font-medium text-white hover:bg-burgundy/90"
          >
            + New Account
          </button>
        }
      />

      {loadError ? (
        <p className="text-sm text-red-600">{loadError}</p>
      ) : loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <>
          <div className="mb-4 grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Total Outstanding"
              value={formatCurrencyFull(stats.totalOutstanding)}
              hint={`Across ${stats.outstandingCustomerCount} account${
                stats.outstandingCustomerCount === 1 ? "" : "s"
              }`}
            />
            <StatCard
              label="30+ Days Outstanding"
              value={formatCurrencyFull(stats.total30Plus)}
              hint={`Across ${stats.plus30CustomerCount} account${
                stats.plus30CustomerCount === 1 ? "" : "s"
              }`}
            />
            <StatCard
              label="Open Jobs"
              value={String(stats.openJobCount)}
              hint="Across all accounts"
            />
            <StatCard
              label="Active Accounts"
              value={String(stats.activeCount)}
              hint="With jobs or invoices"
            />
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1.2fr)]">
            <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white">
              <div className="shrink-0 border-b border-gray-100 p-3">
                <div className="relative">
                  <IconSearch
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search accounts…"
                    className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm"
                  />
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {filtered.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-gray-500">
                    No wholesale accounts yet. Add a contractor as a new
                    account.
                  </p>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="sticky top-0 border-b border-gray-200 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                        <th className="px-4 py-2.5">Account</th>
                        <th className="px-4 py-2.5 text-right">Outstanding</th>
                        <th className="hidden px-4 py-2.5 text-right sm:table-cell">
                          Open Jobs
                        </th>
                        <th className="hidden px-4 py-2.5 md:table-cell">
                          Last Activity
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((account, index) => {
                        const active =
                          account.contact.id === selected?.contact.id;
                        return (
                          <tr
                            key={account.contact.id}
                            onClick={() => {
                              setSelectedId(account.contact.id);
                              setDetailTab("jobs");
                            }}
                            className={`cursor-pointer border-b border-gray-100 ${
                              active ? "bg-gray-50" : "hover:bg-gray-50"
                            }`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <span
                                  className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${getAvatarColor(
                                    index
                                  )}`}
                                >
                                  {getInitialsFromName(account.contact.name)}
                                </span>
                                <span className="min-w-0 truncate font-medium text-gray-900">
                                  {account.contact.name}
                                </span>
                                {active ? (
                                  <IconChevronRight
                                    size={16}
                                    className="ml-auto shrink-0 text-gray-400"
                                  />
                                ) : null}
                              </div>
                            </td>
                            <td
                              className={`px-4 py-3 text-right tabular-nums ${
                                account.outstanding > 0
                                  ? "font-medium text-red-600"
                                  : "text-gray-600"
                              }`}
                            >
                              {formatCurrencyFull(account.outstanding)}
                            </td>
                            <td className="hidden px-4 py-3 text-right tabular-nums text-gray-700 sm:table-cell">
                              {account.openJobs.length}
                            </td>
                            <td className="hidden px-4 py-3 text-gray-500 md:table-cell">
                              {formatRelativeTime(account.lastActivity)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </section>

            <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white">
              {selected ? (
                <AccountDetail
                  account={selected}
                  detailTab={detailTab}
                  onDetailTab={setDetailTab}
                  people={people}
                  peopleLoading={peopleLoading}
                  onNewQuote={() => router.push("/leads")}
                  onNewJob={() => router.push("/jobs")}
                />
              ) : (
                <p className="p-8 text-center text-sm text-gray-500">
                  Select an account to view details.
                </p>
              )}
            </section>
          </div>
        </>
      )}

      {showCreate ? (
        <Modal
          title="New wholesale account"
          className="w-full max-w-md"
          onClose={() => setShowCreate(false)}
        >
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Creates a contractor contact. You can add more details later in
              Contacts.
            </p>
            <label className="block text-sm font-medium text-gray-700">
              Account name
              <input
                autoFocus
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={`${inputClass} mt-1`}
              />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Email
              <input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={`${inputClass} mt-1`}
              />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Phone
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className={`${inputClass} mt-1`}
              />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Address
              <input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className={`${inputClass} mt-1`}
              />
            </label>
            {createError ? (
              <p className="text-sm text-red-600">{createError}</p>
            ) : null}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={creating}
                onClick={() => void handleCreate()}
              >
                {creating ? "Saving…" : "Create account"}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-gray-900">{value}</p>
      <p className="mt-0.5 text-xs text-gray-500">{hint}</p>
    </div>
  );
}

function AccountDetail({
  account,
  detailTab,
  onDetailTab,
  people,
  peopleLoading,
  onNewQuote,
  onNewJob,
}: {
  account: WholesaleAccount;
  detailTab: DetailTab;
  onDetailTab: (tab: DetailTab) => void;
  people: ContactPerson[];
  peopleLoading: boolean;
  onNewQuote: () => void;
  onNewJob: () => void;
}) {
  const [downloadingStatement, setDownloadingStatement] = useState(false);
  const [statementError, setStatementError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const tabs: { id: DetailTab; label: string }[] = [
    { id: "jobs", label: `Open Jobs (${account.openJobs.length})` },
    { id: "invoices", label: `Invoices (${account.invoices.length})` },
    { id: "quotes", label: `Quotes (${account.quotes.length})` },
    { id: "history", label: "History" },
    { id: "contacts", label: "Contacts" },
  ];

  async function handleDownloadStatement() {
    setMenuOpen(false);
    setDownloadingStatement(true);
    setStatementError(null);
    try {
      const { downloadStatementPdf } = await import(
        "@/lib/download-statement-pdf"
      );
      const { error } = await downloadStatementPdf({
        customer: {
          name: account.contact.name,
          address: account.contact.address,
          phone: account.contact.phone,
          email: account.contact.email,
        },
        lines: account.invoices.map((invoice) => ({
          job: invoice.jobs?.name?.trim() || "—",
          invoiceNumber: invoice.invoice_number,
          invoiceTotal: Number(invoice.amount),
          remainingBalance: Number(invoice.balance),
        })),
      });
      if (error) setStatementError(error);
    } catch (err) {
      setStatementError(
        err instanceof Error ? err.message : "Failed to generate PDF."
      );
    } finally {
      setDownloadingStatement(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-gray-100 px-5 py-4">
        <div className="flex items-start gap-3">
          <span
            className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${getAvatarColor(0)}`}
          >
            {getInitialsFromName(account.contact.name)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900">
                {account.contact.name}
              </h2>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((open) => !open)}
                  className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                  aria-label="Account options"
                  aria-expanded={menuOpen}
                >
                  <IconDotsVertical size={18} />
                </button>
                {menuOpen ? (
                  <>
                    <button
                      type="button"
                      className="fixed inset-0 z-20 cursor-default"
                      aria-label="Close account options"
                      onClick={() => setMenuOpen(false)}
                    />
                    <div className="absolute left-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onNewJob();
                        }}
                        className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                      >
                        New Job
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onNewQuote();
                        }}
                        className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                      >
                        New Quote
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDownloadStatement()}
                        disabled={downloadingStatement}
                        className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        {downloadingStatement
                          ? "Preparing PDF…"
                          : "Download Statement"}
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-800">
                Contractor
              </span>
            </div>
            <p className="mt-0.5 text-sm text-gray-500">
              {[account.contact.phone, account.contact.email]
                .filter(Boolean)
                .join(" · ") || "No contact details yet"}
            </p>
            {statementError ? (
              <p className="mt-1 text-xs text-red-600">{statementError}</p>
            ) : null}
          </div>
        </div>
        <div className="mt-4 flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onDetailTab(tab.id)}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ${
                detailTab === tab.id
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {detailTab === "jobs" ? (
          <JobsTable
            title="Open Jobs"
            jobs={account.openJobs}
            empty="No open jobs."
          />
        ) : null}

        {detailTab === "invoices" ? (
          <InvoiceList invoices={account.invoices} />
        ) : null}

        {detailTab === "quotes" ? (
          <QuotesList quotes={account.quotes} />
        ) : null}

        {detailTab === "history" ? (
          <JobsTable
            title="Completed Jobs"
            jobs={account.closedJobs}
            empty="No completed jobs yet."
          />
        ) : null}

        {detailTab === "contacts" ? (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
              Contacts
            </p>
            {peopleLoading ? (
              <p className="text-sm text-gray-500">Loading…</p>
            ) : people.length === 0 ? (
              <p className="text-sm text-gray-500">
                No people on this account yet. Add them in Contacts.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100 rounded-md border border-gray-200">
                {people.map((person) => (
                  <li key={person.id} className="px-3 py-2.5 text-sm">
                    <p className="font-medium text-gray-900">{person.name}</p>
                    <p className="text-xs text-gray-500">
                      {[person.positions.join(", "), person.phone, person.email]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function JobsTable({
  title,
  jobs,
  empty,
  viewAll,
}: {
  title: string;
  jobs: WholesaleJob[];
  empty: string;
  viewAll?: () => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
          {title}
        </p>
        {viewAll ? (
          <button
            type="button"
            onClick={viewAll}
            className="text-xs font-medium text-burgundy hover:underline"
          >
            View all jobs
          </button>
        ) : null}
      </div>
      {jobs.length === 0 ? (
        <p className="text-sm text-gray-500">{empty}</p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} className="border-b border-gray-100 last:border-0">
                <td className="py-2.5">
                  <Link
                    href={`/jobs/${job.id}`}
                    className="font-medium text-gray-900 hover:text-burgundy"
                  >
                    {formatProductionJobNumber(job)} {job.name}
                  </Link>
                </td>
                <td className="py-2.5 text-right tabular-nums text-gray-700">
                  {formatCurrencyFull(Number(job.total_value))}
                </td>
                <td className="py-2.5 pl-3 text-right">
                  <JobStageBadge job={job} kanbanStatus={job.kanban_status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function InvoiceList({ invoices }: { invoices: InvoiceRow[] }) {
  if (invoices.length === 0) {
    return <p className="text-sm text-gray-500">No invoices on this account.</p>;
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-100 text-xs text-gray-500">
          <th className="pb-2 text-left font-medium">Invoice</th>
          <th className="pb-2 text-left font-medium">Project</th>
          <th className="pb-2 text-right font-medium">Balance</th>
          <th className="pb-2 text-right font-medium">Status</th>
        </tr>
      </thead>
      <tbody>
        {invoices.map((invoice) => (
          <tr key={invoice.id} className="border-b border-gray-50">
            <td className="py-2">
              <Link
                href={`/invoices/${invoice.id}`}
                className="font-medium text-gray-900 hover:text-burgundy"
              >
                {invoice.invoice_number}
              </Link>
            </td>
            <td className="py-2 text-gray-600">
              {invoice.jobs?.name?.trim() || "—"}
            </td>
            <td className="py-2 text-right tabular-nums text-gray-800">
              {formatCurrencyPrecise(Number(invoice.balance))}
            </td>
            <td className="py-2 text-right">
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                  INVOICE_STATUS_STYLES[invoice.status] ??
                  "bg-gray-100 text-gray-700"
                }`}
              >
                {INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function QuotesList({ quotes }: { quotes: Lead[] }) {
  if (quotes.length === 0) {
    return <p className="text-sm text-gray-500">No quotes on this account.</p>;
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-100 text-xs text-gray-500">
          <th className="pb-2 text-left font-medium">Quote</th>
          <th className="pb-2 text-left font-medium">Project</th>
          <th className="pb-2 text-right font-medium">Value</th>
          <th className="pb-2 text-right font-medium">Status</th>
        </tr>
      </thead>
      <tbody>
        {quotes.map((quote) => (
          <tr key={quote.id} className="border-b border-gray-50">
            <td className="py-2">
              <Link
                href={`/leads/${quote.id}`}
                className="font-medium text-gray-900 hover:text-burgundy"
              >
                {formatQuoteNumber(quote)}
              </Link>
            </td>
            <td className="py-2 text-gray-600">
              {quote.project_type?.trim() || "—"}
            </td>
            <td className="py-2 text-right tabular-nums text-gray-800">
              {formatCurrencyFull(Number(quote.est_value))}
            </td>
            <td className="py-2 text-right">
              <QuoteStatusBadge status={quote.status} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
