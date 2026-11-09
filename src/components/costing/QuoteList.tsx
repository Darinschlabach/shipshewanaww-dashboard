"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/components/ConfirmModal";
import PageHeader from "@/components/PageHeader";
import { fetchSettings } from "@/lib/costing/db";
import {
  createQuote,
  deleteQuote,
  fetchContactNames,
  fetchQuoteSummaries,
  type QuoteSummary,
} from "@/lib/costing/quotes";
import { roundMoney } from "@/lib/costing/calculate";
import { formatCurrencyPrecise, formatDateLong } from "@/lib/utils";
import { Field, inputClass, matchesSearch, parseRequiredNumber } from "@/components/costing/ui";

export default function QuoteList() {
  const router = useRouter();
  const [rows, setRows] = useState<QuoteSummary[]>([]);
  const [contacts, setContacts] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [margin, setMargin] = useState("30");
  const [contactId, setContactId] = useState<string | null>(null);
  const [contactQuery, setContactQuery] = useState("");
  const [pendingDelete, setPendingDelete] = useState<QuoteSummary | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const [quotes, people, settings] = await Promise.all([
      fetchQuoteSummaries(),
      fetchContactNames(),
      fetchSettings(),
    ]);
    setRows(quotes.rows);
    setContacts(people);
    setError(quotes.error ?? settings.error);
    if (settings.row) setMargin(String(settings.row.default_margin_pct));
  }

  useEffect(() => {
    void load();
  }, []);

  const visible = useMemo(
    () => rows.filter((row) => matchesSearch(search, [row.name, row.contact_name, row.status])),
    [rows, search]
  );
  const contactMatches = contacts
    .filter((row) => matchesSearch(contactQuery, [row.name]))
    .slice(0, 8);

  async function create() {
    const marginPct = parseRequiredNumber(margin, "margin");
    if (!name.trim()) {
      setError("Enter a quote name");
      return;
    }
    if (typeof marginPct === "string") {
      setError(marginPct);
      return;
    }
    if (marginPct < 0 || marginPct >= 100) {
      setError("Margin must be from 0 up to, but not including, 100%");
      return;
    }
    setSaving(true);
    const created = await createQuote({
      name,
      contact_id: contactId,
      margin_pct: marginPct,
    });
    setSaving(false);
    if (created.error || !created.id) {
      setError(created.error ?? "Could not create the quote");
      return;
    }
    router.push(`/costing-quotes/${created.id}`);
  }

  async function remove(quote: QuoteSummary) {
    const message = await deleteQuote(quote.id);
    setPendingDelete(null);
    if (message) setError(message);
    await load();
  }

  return (
    <section>
      <PageHeader
        title="Costing Quotes (Test)"
        subtitle="Component costs with prices frozen on each cabinet. Separate from the live quotes."
      />
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">New quote</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_minmax(0,1fr)_auto] md:items-end">
          <Field label="Name">
            <input value={name} onChange={(event) => setName(event.target.value)} className={inputClass} />
          </Field>
          <Field label="Margin %">
            <input value={margin} onChange={(event) => setMargin(event.target.value)} className={inputClass} />
          </Field>
          <Field label="Customer">
            <input
              value={contactQuery}
              onChange={(event) => {
                setContactQuery(event.target.value);
                setContactId(null);
              }}
              placeholder="Search contacts"
              className={inputClass}
            />
          </Field>
          <button
            type="button"
            onClick={() => void create()}
            disabled={saving}
            className="rounded-md bg-burgundy px-4 py-2 text-sm font-medium text-white hover:bg-burgundy/90 disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create"}
          </button>
        </div>
        {contactQuery && !contactId ? (
          <ul className="mt-2 max-w-md rounded-md border border-gray-200 bg-white">
            {contactMatches.map((contact) => (
              <li key={contact.id}>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-cream"
                  onClick={() => {
                    setContactId(contact.id);
                    setContactQuery(contact.name);
                  }}
                >
                  {contact.name}
                </button>
              </li>
            ))}
            {!contactMatches.length ? (
              <li className="px-3 py-2 text-sm text-gray-500">No matching contacts</li>
            ) : null}
          </ul>
        ) : null}
      </div>
      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search quotes"
        className={`${inputClass} mb-3 max-w-xs`}
      />
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2">Quote</th>
              <th className="px-4 py-2">Customer</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Total cost</th>
              <th className="px-4 py-2">Sell price</th>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id} className="border-t border-gray-100">
                <td className="px-4 py-3">
                  <Link href={`/costing-quotes/${row.id}`} className="font-medium text-burgundy">
                    {row.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-700">{row.contact_name ?? "—"}</td>
                <td className="px-4 py-3 capitalize">{row.status}</td>
                <td className="px-4 py-3">{money(row.total_cost)}</td>
                <td className="px-4 py-3">{money(row.sell_price)}</td>
                <td className="px-4 py-3">{formatDateLong(row.created_at)}</td>
                <td className="px-4 py-3 text-right">
                  <button type="button" className="text-sm text-red-700" onClick={() => setPendingDelete(row)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {!visible.length ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">
                  No costing quotes yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {pendingDelete ? (
        <ConfirmModal
          title={`Delete ${pendingDelete.name}?`}
          body="This removes the test quote, its rooms, and its cabinets."
          confirmLabel="Delete"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void remove(pendingDelete)}
        />
      ) : null}
    </section>
  );
}

function money(value: number) {
  return formatCurrencyPrecise(roundMoney(value));
}
