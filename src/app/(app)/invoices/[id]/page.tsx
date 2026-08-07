"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import InvoiceDetailView from "@/components/invoices/InvoiceDetailView";
import type { InvoiceDetailRow } from "@/lib/invoice-detail";
import {
  buildInvoicesFromJobs,
  getSyntheticJobId,
  isSyntheticInvoiceId,
  type InvoiceRow,
} from "@/lib/invoices";
import type { Contact, Job } from "@/lib/types";

async function attachInvoiceRelations(
  supabase: ReturnType<typeof createClient>,
  invoice: InvoiceRow
): Promise<InvoiceDetailRow> {
  let row: InvoiceDetailRow = { ...invoice };

  if (invoice.job_id) {
    const { data: job } = await supabase
      .from("jobs")
      .select("id, name, created_at")
      .eq("id", invoice.job_id)
      .maybeSingle();
    if (job) row = { ...row, jobs: job };
  }

  if (invoice.customer_id) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("id, name, email, phone, address")
      .eq("id", invoice.customer_id)
      .maybeSingle();
    if (contact) row = { ...row, contacts: contact as Contact };
  }

  return row;
}

async function loadInvoiceRow(
  supabase: ReturnType<typeof createClient>,
  id: string
): Promise<InvoiceDetailRow | null> {
  const syntheticJobId = getSyntheticJobId(id);

  if (syntheticJobId) {
    const { data: byJob } = await supabase
      .from("invoices")
      .select("*")
      .eq("job_id", syntheticJobId)
      .maybeSingle();

    if (byJob) {
      return attachInvoiceRelations(supabase, byJob as InvoiceRow);
    }

    const { data: job } = await supabase
      .from("jobs")
      .select("*, contacts(*)")
      .eq("id", syntheticJobId)
      .maybeSingle();

    if (!job) return null;

    const [built] = buildInvoicesFromJobs([
      job as Job & { contacts: Contact | null },
    ]);
    return built ?? null;
  }

  const { data } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;

  return attachInvoiceRelations(supabase, data as InvoiceRow);
}

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [invoice, setInvoice] = useState<InvoiceDetailRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const row = await loadInvoiceRow(supabase, id);
      setInvoice(row);
    } catch (err) {
      console.error("Invoice detail load failed:", err);
      setInvoice(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete() {
    if (!invoice) return;
    setDeleting(true);

    let ok = false;
    let syncError: string | null = null;

    if (isSyntheticInvoiceId(invoice.id) && invoice.job_id) {
      const res = await fetch(
        `/api/invoices?job_id=${encodeURIComponent(invoice.job_id)}`,
        { method: "DELETE" }
      );
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        syncError?: string | null;
      };
      ok = res.ok && json.ok !== false;
      syncError = json.syncError ?? null;
    } else if (!isSyntheticInvoiceId(invoice.id)) {
      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: "DELETE",
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        syncError?: string | null;
      };
      ok = res.ok && json.ok !== false;
      syncError = json.syncError ?? null;
    } else {
      ok = true;
    }

    setDeleting(false);

    if (ok) {
      router.push("/invoices");
      return;
    }

    if (syncError) {
      window.alert(
        `Invoice was kept locally because QuickBooks void failed:\n${syncError}`
      );
    }
  }

  if (loading) {
    return <p className="text-gray-500">Loading…</p>;
  }

  if (!invoice) {
    return (
      <div>
        <p className="text-gray-500">Invoice not found.</p>
        <Link
          href="/invoices"
          className="mt-2 inline-block text-sm text-burgundy hover:underline"
        >
          Back to Invoices
        </Link>
      </div>
    );
  }

  return (
    <InvoiceDetailView
      invoice={invoice}
      onDelete={handleDelete}
      deleting={deleting}
    />
  );
}
