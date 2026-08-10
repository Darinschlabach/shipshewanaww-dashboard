import { createAdminClient } from "@/lib/supabase/admin";
import {
  deleteQboPayment,
  upsertQboCustomer,
  upsertQboInvoice,
  upsertQboPayment,
  voidQboInvoice,
  type ContactForQbo,
} from "@/lib/integrations/quickbooks-accounting";
import { getValidQuickBooksAccessToken } from "@/lib/integrations/quickbooks";

export type QbSyncStatus = "not_synced" | "pending" | "synced" | "failed";

export type SyncResult = {
  skipped: boolean;
  status: QbSyncStatus;
  qbId: string | null;
  syncToken: string | null;
  error: string | null;
};

type SyncColumns = {
  qb_id: string | null;
  qb_sync_token: string | null;
  qb_sync_status: QbSyncStatus;
  qb_last_synced_at: string | null;
  qb_sync_error: string | null;
};

function admin() {
  return createAdminClient();
}

async function setSyncState(
  table: "contacts" | "invoices" | "invoice_payments",
  id: string,
  patch: Partial<SyncColumns>
): Promise<void> {
  await admin().from(table).update(patch).eq("id", id);
}

async function markPending(
  table: "contacts" | "invoices" | "invoice_payments",
  id: string
): Promise<void> {
  await setSyncState(table, id, {
    qb_sync_status: "pending",
    qb_sync_error: null,
  });
}

function syncedResult(
  qbId: string,
  syncToken: string | null
): SyncResult {
  return {
    skipped: false,
    status: "synced",
    qbId,
    syncToken,
    error: null,
  };
}

function failedResult(error: string, qbId: string | null = null): SyncResult {
  return {
    skipped: false,
    status: "failed",
    qbId,
    syncToken: null,
    error,
  };
}

function skippedResult(): SyncResult {
  return {
    skipped: true,
    status: "not_synced",
    qbId: null,
    syncToken: null,
    error: null,
  };
}

export async function isQuickBooksConnected(): Promise<boolean> {
  try {
    const tokens = await getValidQuickBooksAccessToken();
    return Boolean(tokens);
  } catch (err) {
    console.error("QuickBooks connection check failed:", err);
    return false;
  }
}

export async function syncContactToQuickBooks(
  contactId: string
): Promise<SyncResult> {
  let connected = false;
  try {
    connected = await isQuickBooksConnected();
  } catch (err) {
    console.error("QuickBooks connection check failed:", err);
    return skippedResult();
  }

  if (!connected) {
    try {
      await setSyncState("contacts", contactId, {
        qb_sync_status: "not_synced",
        qb_sync_error: null,
      });
    } catch (err) {
      // Migrations/admin may be missing — contact CRUD must still succeed.
      console.error("Could not clear contact QB sync state:", err);
    }
    return skippedResult();
  }

  try {
    await markPending("contacts", contactId);
  } catch (err) {
    console.error("Could not mark contact pending for QB sync:", err);
    return failedResult(
      err instanceof Error ? err.message : "Could not mark contact pending."
    );
  }

  const { data: contact, error } = await admin()
    .from("contacts")
    .select(
      "id, name, email, phone, fax, address, contact_type, qb_id, qb_sync_token"
    )
    .eq("id", contactId)
    .single();

  if (error || !contact) {
    const message = error?.message || "Contact not found.";
    try {
      await setSyncState("contacts", contactId, {
        qb_sync_status: "failed",
        qb_sync_error: message,
      });
    } catch (err) {
      console.error("Could not mark contact sync failed:", err);
    }
    return failedResult(message);
  }

  // Only Customers map to QuickBooks Customer records (prevents vendor/employee duplicates).
  if (contact.contact_type && contact.contact_type !== "Customers") {
    await setSyncState("contacts", contactId, {
      qb_sync_status: "not_synced",
      qb_sync_error: null,
    });
    return skippedResult();
  }

  const result = await upsertQboCustomer(contact as ContactForQbo);
  if (result.skipped) {
    await setSyncState("contacts", contactId, {
      qb_sync_status: "not_synced",
      qb_sync_error: null,
    });
    return skippedResult();
  }

  if (result.error || !result.customer) {
    const message = result.error || "QuickBooks customer sync failed.";
    await setSyncState("contacts", contactId, {
      qb_sync_status: "failed",
      qb_sync_error: message,
    });
    return failedResult(message, contact.qb_id);
  }

  await setSyncState("contacts", contactId, {
    qb_id: result.customer.Id,
    qb_sync_token: result.customer.SyncToken,
    qb_sync_status: "synced",
    qb_last_synced_at: new Date().toISOString(),
    qb_sync_error: null,
  });

  return syncedResult(result.customer.Id, result.customer.SyncToken);
}

export async function syncInvoiceToQuickBooks(
  invoiceId: string
): Promise<SyncResult> {
  const connected = await isQuickBooksConnected();
  if (!connected) {
    await setSyncState("invoices", invoiceId, {
      qb_sync_status: "not_synced",
      qb_sync_error: null,
    });
    return skippedResult();
  }

  await markPending("invoices", invoiceId);

  const { data: invoice, error } = await admin()
    .from("invoices")
    .select(
      "id, invoice_number, invoice_date, due_date, customer_id, customer_name, qb_id, qb_sync_token"
    )
    .eq("id", invoiceId)
    .single();

  if (error || !invoice) {
    const message = error?.message || "Invoice not found.";
    await setSyncState("invoices", invoiceId, {
      qb_sync_status: "failed",
      qb_sync_error: message,
    });
    return failedResult(message);
  }

  if (!invoice.customer_id) {
    const message = "Invoice has no customer; cannot sync to QuickBooks.";
    await setSyncState("invoices", invoiceId, {
      qb_sync_status: "failed",
      qb_sync_error: message,
    });
    return failedResult(message, invoice.qb_id);
  }

  const customerSync = await syncContactToQuickBooks(invoice.customer_id);
  if (customerSync.skipped) {
    await setSyncState("invoices", invoiceId, {
      qb_sync_status: "not_synced",
      qb_sync_error: null,
    });
    return skippedResult();
  }
  if (customerSync.status === "failed" || !customerSync.qbId) {
    const message =
      customerSync.error || "Could not sync customer to QuickBooks.";
    await setSyncState("invoices", invoiceId, {
      qb_sync_status: "failed",
      qb_sync_error: message,
    });
    return failedResult(message, invoice.qb_id);
  }

  const { data: lines } = await admin()
    .from("invoice_line_items")
    .select("description, qty, unit_price, sort_order")
    .eq("invoice_id", invoiceId)
    .order("sort_order", { ascending: true });

  // Invoice only — never creates a Payment. QB Balance stays full until LinkedTxn payments.
  const result = await upsertQboInvoice({
    qbId: invoice.qb_id,
    syncToken: invoice.qb_sync_token,
    docNumber: invoice.invoice_number,
    txnDate: String(invoice.invoice_date).slice(0, 10),
    dueDate: invoice.due_date
      ? String(invoice.due_date).slice(0, 10)
      : null,
    customerQbId: customerSync.qbId,
    lines: (lines ?? []).map((line) => ({
      description: line.description || "Line item",
      qty: Number(line.qty) || 1,
      unit_price: Number(line.unit_price) || 0,
    })),
  });

  if (result.skipped) {
    await setSyncState("invoices", invoiceId, {
      qb_sync_status: "not_synced",
      qb_sync_error: null,
    });
    return skippedResult();
  }

  if (result.error || !result.invoice) {
    const message = result.error || "QuickBooks invoice sync failed.";
    await setSyncState("invoices", invoiceId, {
      qb_sync_status: "failed",
      qb_sync_error: message,
    });
    return failedResult(message, invoice.qb_id);
  }

  await setSyncState("invoices", invoiceId, {
    qb_id: result.invoice.Id,
    qb_sync_token: result.invoice.SyncToken,
    qb_sync_status: "synced",
    qb_last_synced_at: new Date().toISOString(),
    qb_sync_error: null,
  });

  return syncedResult(result.invoice.Id, result.invoice.SyncToken);
}

/**
 * Soft-void the QuickBooks invoice (accounting best practice).
 * Linked QB payments are deleted first so void succeeds on partially/fully paid invoices.
 */
export async function voidInvoiceInQuickBooks(
  invoiceId: string
): Promise<SyncResult> {
  const { data: invoice } = await admin()
    .from("invoices")
    .select("id, qb_id, qb_sync_token")
    .eq("id", invoiceId)
    .maybeSingle();

  if (!invoice?.qb_id) {
    return skippedResult();
  }

  const connected = await isQuickBooksConnected();
  if (!connected) {
    return skippedResult();
  }

  const { data: payments } = await admin()
    .from("invoice_payments")
    .select("id, qb_id")
    .eq("invoice_id", invoiceId);

  for (const payment of payments ?? []) {
    if (!payment.qb_id) continue;
    const deleted = await deletePaymentInQuickBooks(payment.id);
    if (deleted.status === "failed") {
      const message =
        deleted.error ||
        "Could not remove linked QuickBooks payment before voiding invoice.";
      await setSyncState("invoices", invoiceId, {
        qb_sync_status: "failed",
        qb_sync_error: message,
      });
      return failedResult(message, invoice.qb_id);
    }
  }

  const result = await voidQboInvoice({
    qbId: invoice.qb_id,
    syncToken: invoice.qb_sync_token,
  });

  if (result.skipped) return skippedResult();

  if (result.error) {
    await setSyncState("invoices", invoiceId, {
      qb_sync_status: "failed",
      qb_sync_error: result.error,
    });
    return failedResult(result.error, invoice.qb_id);
  }

  await setSyncState("invoices", invoiceId, {
    qb_sync_status: "synced",
    qb_last_synced_at: new Date().toISOString(),
    qb_sync_error: null,
  });

  return syncedResult(invoice.qb_id, invoice.qb_sync_token);
}

export async function syncPaymentToQuickBooks(
  paymentId: string
): Promise<SyncResult> {
  const connected = await isQuickBooksConnected();
  if (!connected) {
    await setSyncState("invoice_payments", paymentId, {
      qb_sync_status: "not_synced",
      qb_sync_error: null,
    });
    return skippedResult();
  }

  await markPending("invoice_payments", paymentId);

  const { data: payment, error } = await admin()
    .from("invoice_payments")
    .select(
      "id, invoice_id, amount, paid_at, method, reference, qb_id, qb_sync_token"
    )
    .eq("id", paymentId)
    .single();

  if (error || !payment) {
    const message = error?.message || "Payment not found.";
    await setSyncState("invoice_payments", paymentId, {
      qb_sync_status: "failed",
      qb_sync_error: message,
    });
    return failedResult(message);
  }

  const invoiceSync = await syncInvoiceToQuickBooks(payment.invoice_id);
  if (invoiceSync.skipped) {
    await setSyncState("invoice_payments", paymentId, {
      qb_sync_status: "not_synced",
      qb_sync_error: null,
    });
    return skippedResult();
  }
  if (invoiceSync.status === "failed" || !invoiceSync.qbId) {
    const message =
      invoiceSync.error || "Could not sync invoice before payment.";
    await setSyncState("invoice_payments", paymentId, {
      qb_sync_status: "failed",
      qb_sync_error: message,
    });
    return failedResult(message, payment.qb_id);
  }

  const { data: invoice } = await admin()
    .from("invoices")
    .select("customer_id")
    .eq("id", payment.invoice_id)
    .single();

  if (!invoice?.customer_id) {
    const message = "Invoice has no customer for payment sync.";
    await setSyncState("invoice_payments", paymentId, {
      qb_sync_status: "failed",
      qb_sync_error: message,
    });
    return failedResult(message, payment.qb_id);
  }

  const { data: contact } = await admin()
    .from("contacts")
    .select("qb_id")
    .eq("id", invoice.customer_id)
    .single();

  if (!contact?.qb_id) {
    const message = "Customer is missing a QuickBooks ID.";
    await setSyncState("invoice_payments", paymentId, {
      qb_sync_status: "failed",
      qb_sync_error: message,
    });
    return failedResult(message, payment.qb_id);
  }

  const result = await upsertQboPayment({
    qbId: payment.qb_id,
    syncToken: payment.qb_sync_token,
    customerQbId: contact.qb_id,
    invoiceQbId: invoiceSync.qbId,
    amount: Number(payment.amount) || 0,
    txnDate: String(payment.paid_at).slice(0, 10),
    localPaymentId: payment.id,
    paymentMethod: payment.method,
    reference: payment.reference ?? null,
  });

  if (result.skipped) {
    await setSyncState("invoice_payments", paymentId, {
      qb_sync_status: "not_synced",
      qb_sync_error: null,
    });
    return skippedResult();
  }

  if (result.error || !result.payment) {
    const message = result.error || "QuickBooks payment sync failed.";
    await setSyncState("invoice_payments", paymentId, {
      qb_sync_status: "failed",
      qb_sync_error: message,
    });
    return failedResult(message, payment.qb_id);
  }

  await setSyncState("invoice_payments", paymentId, {
    qb_id: result.payment.Id,
    qb_sync_token: result.payment.SyncToken,
    qb_sync_status: "synced",
    qb_last_synced_at: new Date().toISOString(),
    qb_sync_error: null,
  });

  return syncedResult(result.payment.Id, result.payment.SyncToken);
}

export async function deletePaymentInQuickBooks(
  paymentId: string
): Promise<SyncResult> {
  const { data: payment } = await admin()
    .from("invoice_payments")
    .select("id, qb_id, qb_sync_token")
    .eq("id", paymentId)
    .maybeSingle();

  if (!payment?.qb_id) {
    return skippedResult();
  }

  const connected = await isQuickBooksConnected();
  if (!connected) {
    return skippedResult();
  }

  const result = await deleteQboPayment({
    qbId: payment.qb_id,
    syncToken: payment.qb_sync_token,
  });

  if (result.skipped) return skippedResult();

  if (result.error) {
    await setSyncState("invoice_payments", paymentId, {
      qb_sync_status: "failed",
      qb_sync_error: result.error,
    });
    return failedResult(result.error, payment.qb_id);
  }

  return syncedResult(payment.qb_id, payment.qb_sync_token);
}

/** Void mapped QuickBooks invoices for a job before local cascade delete. */
export async function voidInvoicesForJobInQuickBooks(
  jobId: string
): Promise<{ errors: string[] }> {
  const { data: invoices } = await admin()
    .from("invoices")
    .select("id, qb_id")
    .eq("job_id", jobId);

  const errors: string[] = [];
  for (const invoice of invoices ?? []) {
    if (!invoice.qb_id) continue;
    const result = await voidInvoiceInQuickBooks(invoice.id);
    if (result.status === "failed" && result.error) {
      errors.push(`${invoice.id}: ${result.error}`);
    }
  }
  return { errors };
}
