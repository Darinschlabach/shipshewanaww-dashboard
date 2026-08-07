import { getValidQuickBooksAccessToken } from "@/lib/integrations/quickbooks";
import {
  getQuickBooksApiBaseUrl,
  getQuickBooksAppBaseUrl,
} from "@/lib/integrations/quickbooks-urls";

export type QboEntityRef = { value: string; name?: string };

export type QboCustomer = {
  Id: string;
  SyncToken: string;
  DisplayName?: string;
  PrimaryEmailAddr?: { Address?: string };
  PrimaryPhone?: { FreeFormNumber?: string };
  Fax?: { FreeFormNumber?: string };
  BillAddr?: {
    Line1?: string;
    City?: string;
    CountrySubDivisionCode?: string;
    PostalCode?: string;
    Country?: string;
  };
  ShipAddr?: {
    Line1?: string;
    City?: string;
    CountrySubDivisionCode?: string;
    PostalCode?: string;
    Country?: string;
  };
  Notes?: string;
};

export type QboInvoice = {
  Id: string;
  SyncToken: string;
  DocNumber?: string;
  TotalAmt?: number;
  Balance?: number;
};

export type QboPayment = {
  Id: string;
  SyncToken: string;
  TotalAmt?: number;
  PaymentRefNum?: string;
};

export type QboItem = {
  Id: string;
  SyncToken: string;
  Name?: string;
};

function qboBaseUrl(): string {
  return getQuickBooksApiBaseUrl();
}

export function qboAppBaseUrl(): string {
  return getQuickBooksAppBaseUrl();
}

async function getAuthContext(): Promise<{
  accessToken: string;
  realmId: string;
} | null> {
  const tokens = await getValidQuickBooksAccessToken();
  if (!tokens) return null;
  return { accessToken: tokens.accessToken, realmId: tokens.realmId };
}

export async function qboRequest<T>(
  path: string,
  init?: RequestInit & { query?: Record<string, string> }
): Promise<{ data: T | null; error: string | null; skipped: boolean }> {
  const auth = await getAuthContext();
  if (!auth) {
    return { data: null, error: null, skipped: true };
  }

  const url = new URL(
    `${qboBaseUrl()}/v3/company/${auth.realmId}${path}`
  );
  url.searchParams.set("minorversion", "75");
  if (init?.query) {
    for (const [key, value] of Object.entries(init.query)) {
      url.searchParams.set(key, value);
    }
  }

  const { query: _query, ...fetchInit } = init ?? {};
  const response = await fetch(url.toString(), {
    ...fetchInit,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth.accessToken}`,
      ...(fetchInit.headers ?? {}),
    },
  });

  const json = (await response.json().catch(() => ({}))) as {
    Fault?: { Error?: Array<{ Message?: string; Detail?: string; code?: string }> };
  } & T;

  if (!response.ok) {
    const fault = json.Fault?.Error?.[0];
    const message =
      fault?.Detail ||
      fault?.Message ||
      `QuickBooks request failed (${response.status})`;
    return { data: null, error: message, skipped: false };
  }

  return { data: json as T, error: null, skipped: false };
}

export async function qboQuery<T>(
  sql: string
): Promise<{ rows: T[]; error: string | null; skipped: boolean }> {
  const result = await qboRequest<{ QueryResponse?: Record<string, T[]> }>(
    "/query",
    { method: "GET", query: { query: sql } }
  );
  if (result.skipped || result.error || !result.data) {
    return { rows: [], error: result.error, skipped: result.skipped };
  }
  const response = result.data.QueryResponse ?? {};
  const key = Object.keys(response).find((k) => Array.isArray(response[k]));
  return {
    rows: key ? response[key] ?? [] : [],
    error: null,
    skipped: false,
  };
}

function escapeQboString(value: string): string {
  return value.replace(/'/g, "\\'");
}

function isStaleObjectError(error: string | null | undefined): boolean {
  if (!error) return false;
  const lower = error.toLowerCase();
  return (
    lower.includes("stale object") ||
    lower.includes("sync token") ||
    lower.includes("object version")
  );
}

/** Stable PaymentRefNum (≤21 chars) derived from local payment UUID for idempotent retries. */
export function paymentRefNumFromLocalId(paymentId: string): string {
  return paymentId.replace(/-/g, "").slice(0, 21);
}

export async function findOrCreateServiceItem(): Promise<{
  item: QboItem | null;
  error: string | null;
  skipped: boolean;
}> {
  const configured = process.env.INTUIT_SERVICE_ITEM_ID?.trim();
  if (configured) {
    const read = await qboRequest<{ Item?: QboItem }>(`/item/${configured}`, {
      method: "GET",
    });
    if (read.data?.Item) {
      return { item: read.data.Item, error: null, skipped: false };
    }
  }

  const existing = await qboQuery<QboItem>(
    "select * from Item where Name = 'Services' maxresults 1"
  );
  if (existing.skipped) return { item: null, error: null, skipped: true };
  if (existing.error) return { item: null, error: existing.error, skipped: false };
  if (existing.rows[0]) {
    return { item: existing.rows[0], error: null, skipped: false };
  }

  const created = await qboRequest<{ Item?: QboItem }>("/item", {
    method: "POST",
    body: JSON.stringify({
      Name: "Services",
      Type: "Service",
      IncomeAccountRef: { name: "Services", value: "1" },
    }),
  });

  if (created.error) {
    const anyService = await qboQuery<QboItem>(
      "select * from Item where Type = 'Service' maxresults 1"
    );
    if (anyService.rows[0]) {
      return { item: anyService.rows[0], error: null, skipped: false };
    }
    return { item: null, error: created.error, skipped: false };
  }

  return { item: created.data?.Item ?? null, error: null, skipped: false };
}

export type ContactForQbo = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  fax: string | null;
  address: string | null;
  qb_id: string | null;
  qb_sync_token: string | null;
};

function splitPersonName(fullName: string): {
  givenName?: string;
  familyName?: string;
} {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return {};
  return {
    givenName: parts[0],
    familyName: parts.slice(1).join(" "),
  };
}

function contactPayload(contact: ContactForQbo) {
  const displayName = contact.name.trim() || "Customer";
  const { givenName, familyName } = splitPersonName(displayName);
  const payload: Record<string, unknown> = {
    DisplayName: displayName,
  };

  // Single local `name` field maps to DisplayName; also fill person/company slots when possible.
  if (givenName && familyName) {
    payload.GivenName = givenName;
    payload.FamilyName = familyName;
  } else {
    payload.CompanyName = displayName;
  }

  if (contact.email?.trim()) {
    payload.PrimaryEmailAddr = { Address: contact.email.trim() };
  }
  if (contact.phone?.trim()) {
    payload.PrimaryPhone = { FreeFormNumber: contact.phone.trim() };
  }
  if (contact.fax?.trim()) {
    payload.Fax = { FreeFormNumber: contact.fax.trim() };
  }
  if (contact.address?.trim()) {
    const addr = { Line1: contact.address.trim() };
    payload.BillAddr = addr;
    payload.ShipAddr = addr;
  }
  return payload;
}

async function readQboCustomer(
  qbId: string
): Promise<{ customer: QboCustomer | null; error: string | null; skipped: boolean }> {
  const read = await qboRequest<{ Customer?: QboCustomer }>(`/customer/${qbId}`, {
    method: "GET",
  });
  return {
    customer: read.data?.Customer ?? null,
    error: read.error,
    skipped: read.skipped,
  };
}

export async function upsertQboCustomer(contact: ContactForQbo): Promise<{
  customer: QboCustomer | null;
  error: string | null;
  skipped: boolean;
}> {
  if (contact.qb_id) {
    let syncToken = contact.qb_sync_token || "0";
    let updated = await qboRequest<{ Customer?: QboCustomer }>("/customer", {
      method: "POST",
      body: JSON.stringify({
        ...contactPayload(contact),
        Id: contact.qb_id,
        SyncToken: syncToken,
        sparse: true,
      }),
    });

    if (updated.error && isStaleObjectError(updated.error)) {
      const fresh = await readQboCustomer(contact.qb_id);
      if (fresh.customer) {
        syncToken = fresh.customer.SyncToken;
        updated = await qboRequest<{ Customer?: QboCustomer }>("/customer", {
          method: "POST",
          body: JSON.stringify({
            ...contactPayload(contact),
            Id: contact.qb_id,
            SyncToken: syncToken,
            sparse: true,
          }),
        });
      }
    }

    if (!updated.error && updated.data?.Customer) {
      return {
        customer: updated.data.Customer,
        error: null,
        skipped: false,
      };
    }
    // Fall through to find/create if update failed (e.g. deleted remotely)
  }

  const name = escapeQboString(contact.name.trim() || "Customer");
  const byName = await qboQuery<QboCustomer>(
    `select * from Customer where DisplayName = '${name}' maxresults 1`
  );
  if (byName.skipped) return { customer: null, error: null, skipped: true };
  if (byName.error) return { customer: null, error: byName.error, skipped: false };

  if (byName.rows[0]) {
    const existing = byName.rows[0];
    const updated = await qboRequest<{ Customer?: QboCustomer }>("/customer", {
      method: "POST",
      body: JSON.stringify({
        ...contactPayload(contact),
        Id: existing.Id,
        SyncToken: existing.SyncToken,
        sparse: true,
      }),
    });
    if (updated.error) {
      return { customer: existing, error: null, skipped: false };
    }
    return {
      customer: updated.data?.Customer ?? existing,
      error: null,
      skipped: false,
    };
  }

  if (contact.email?.trim()) {
    const email = escapeQboString(contact.email.trim());
    const byEmail = await qboQuery<QboCustomer>(
      `select * from Customer where PrimaryEmailAddr = '${email}' maxresults 1`
    );
    if (byEmail.rows[0]) {
      const existing = byEmail.rows[0];
      const updated = await qboRequest<{ Customer?: QboCustomer }>("/customer", {
        method: "POST",
        body: JSON.stringify({
          ...contactPayload(contact),
          Id: existing.Id,
          SyncToken: existing.SyncToken,
          sparse: true,
        }),
      });
      return {
        customer: updated.data?.Customer ?? existing,
        error: updated.error,
        skipped: false,
      };
    }
  }

  const created = await qboRequest<{ Customer?: QboCustomer }>("/customer", {
    method: "POST",
    body: JSON.stringify(contactPayload(contact)),
  });
  return {
    customer: created.data?.Customer ?? null,
    error: created.error,
    skipped: created.skipped,
  };
}

export type InvoiceLineForQbo = {
  description: string;
  qty: number;
  unit_price: number;
};

async function readQboInvoice(
  qbId: string
): Promise<{ invoice: QboInvoice | null; error: string | null; skipped: boolean }> {
  const read = await qboRequest<{ Invoice?: QboInvoice }>(`/invoice/${qbId}`, {
    method: "GET",
  });
  return {
    invoice: read.data?.Invoice ?? null,
    error: read.error,
    skipped: read.skipped,
  };
}

async function findInvoiceByDocNumber(
  docNumber: string
): Promise<{ invoice: QboInvoice | null; error: string | null; skipped: boolean }> {
  const escaped = escapeQboString(docNumber);
  const found = await qboQuery<QboInvoice>(
    `select * from Invoice where DocNumber = '${escaped}' maxresults 1`
  );
  if (found.skipped) return { invoice: null, error: null, skipped: true };
  if (found.error) return { invoice: null, error: found.error, skipped: false };
  return { invoice: found.rows[0] ?? null, error: null, skipped: false };
}

export async function upsertQboInvoice(opts: {
  qbId: string | null;
  syncToken: string | null;
  docNumber: string;
  txnDate: string;
  dueDate: string | null;
  customerQbId: string;
  lines: InvoiceLineForQbo[];
  /** Optional discount amount (positive). Applied as a DiscountLineDetail. */
  discountAmount?: number | null;
  /** Optional tax amount already included via TaxCode — left unset so QB invoice stays open. */
  privateNote?: string | null;
}): Promise<{
  invoice: QboInvoice | null;
  error: string | null;
  skipped: boolean;
}> {
  const itemResult = await findOrCreateServiceItem();
  if (itemResult.skipped) {
    return { invoice: null, error: null, skipped: true };
  }
  if (!itemResult.item) {
    return {
      invoice: null,
      error: itemResult.error || "Could not resolve QuickBooks Service item.",
      skipped: false,
    };
  }

  const lines =
    opts.lines.length > 0
      ? opts.lines
      : [{ description: "Invoice", qty: 1, unit_price: 0 }];

  const qboLines: Record<string, unknown>[] = lines.map((line, index) => ({
    Amount: Number(line.qty) * Number(line.unit_price),
    DetailType: "SalesItemLineDetail",
    Description: line.description || "Line item",
    SalesItemLineDetail: {
      ItemRef: { value: itemResult.item!.Id },
      Qty: Number(line.qty) || 1,
      UnitPrice: Number(line.unit_price) || 0,
    },
    LineNum: index + 1,
  }));

  const discount = Number(opts.discountAmount) || 0;
  if (discount > 0) {
    qboLines.push({
      Amount: discount,
      DetailType: "DiscountLineDetail",
      Description: "Discount",
      DiscountLineDetail: {
        PercentBased: false,
      },
    });
  }

  const buildPayload = (
    qbId: string | null,
    syncToken: string | null
  ): Record<string, unknown> => {
    const payload: Record<string, unknown> = {
      DocNumber: opts.docNumber,
      TxnDate: opts.txnDate,
      CustomerRef: { value: opts.customerQbId },
      Line: qboLines,
    };
    if (opts.dueDate) payload.DueDate = opts.dueDate;
    if (opts.privateNote?.trim()) payload.PrivateNote = opts.privateNote.trim();
    // Do not set Balance, Deposit, or Payment — invoice stays open until LinkedTxn payments apply.
    if (qbId) {
      payload.Id = qbId;
      payload.SyncToken = syncToken || "0";
      payload.sparse = false;
    }
    return payload;
  };

  let qbId = opts.qbId;
  let syncToken = opts.syncToken;

  // Idempotent create: reuse existing invoice with the same DocNumber.
  if (!qbId) {
    const existing = await findInvoiceByDocNumber(opts.docNumber);
    if (existing.skipped) {
      return { invoice: null, error: null, skipped: true };
    }
    if (existing.error) {
      return { invoice: null, error: existing.error, skipped: false };
    }
    if (existing.invoice) {
      qbId = existing.invoice.Id;
      syncToken = existing.invoice.SyncToken;
    }
  }

  let result = await qboRequest<{ Invoice?: QboInvoice }>("/invoice", {
    method: "POST",
    body: JSON.stringify(buildPayload(qbId, syncToken)),
  });

  if (result.error && qbId && isStaleObjectError(result.error)) {
    const fresh = await readQboInvoice(qbId);
    if (fresh.invoice) {
      result = await qboRequest<{ Invoice?: QboInvoice }>("/invoice", {
        method: "POST",
        body: JSON.stringify(
          buildPayload(fresh.invoice.Id, fresh.invoice.SyncToken)
        ),
      });
    }
  }

  return {
    invoice: result.data?.Invoice ?? null,
    error: result.error,
    skipped: result.skipped,
  };
}

export async function voidQboInvoice(opts: {
  qbId: string;
  syncToken: string | null;
}): Promise<{ error: string | null; skipped: boolean }> {
  let syncToken = opts.syncToken || "0";
  let result = await qboRequest<{ Invoice?: QboInvoice }>("/invoice", {
    method: "POST",
    query: { operation: "void" },
    body: JSON.stringify({
      Id: opts.qbId,
      SyncToken: syncToken,
    }),
  });

  if (result.error && isStaleObjectError(result.error)) {
    const fresh = await readQboInvoice(opts.qbId);
    if (fresh.invoice) {
      syncToken = fresh.invoice.SyncToken;
      result = await qboRequest<{ Invoice?: QboInvoice }>("/invoice", {
        method: "POST",
        query: { operation: "void" },
        body: JSON.stringify({
          Id: opts.qbId,
          SyncToken: syncToken,
        }),
      });
    }
  }

  return { error: result.error, skipped: result.skipped };
}

async function readQboPayment(
  qbId: string
): Promise<{ payment: QboPayment | null; error: string | null; skipped: boolean }> {
  const read = await qboRequest<{ Payment?: QboPayment }>(`/payment/${qbId}`, {
    method: "GET",
  });
  return {
    payment: read.data?.Payment ?? null,
    error: read.error,
    skipped: read.skipped,
  };
}

async function findPaymentByRefNum(
  refNum: string
): Promise<{ payment: QboPayment | null; error: string | null; skipped: boolean }> {
  const escaped = escapeQboString(refNum);
  const found = await qboQuery<QboPayment>(
    `select * from Payment where PaymentRefNum = '${escaped}' maxresults 1`
  );
  if (found.skipped) return { payment: null, error: null, skipped: true };
  if (found.error) return { payment: null, error: found.error, skipped: false };
  return { payment: found.rows[0] ?? null, error: null, skipped: false };
}

export async function upsertQboPayment(opts: {
  qbId: string | null;
  syncToken: string | null;
  customerQbId: string;
  invoiceQbId: string;
  amount: number;
  txnDate: string;
  /** Local payment UUID — used for PaymentRefNum idempotency key. */
  localPaymentId: string;
  paymentMethod?: string | null;
  reference?: string | null;
}): Promise<{
  payment: QboPayment | null;
  error: string | null;
  skipped: boolean;
}> {
  const idempotencyRef = paymentRefNumFromLocalId(opts.localPaymentId);
  const noteParts = [
    opts.paymentMethod?.trim() ? `Method: ${opts.paymentMethod.trim()}` : null,
    opts.reference?.trim() ? `Ref: ${opts.reference.trim()}` : null,
  ].filter(Boolean);

  const buildPayload = (
    qbId: string | null,
    syncToken: string | null
  ): Record<string, unknown> => {
    const payload: Record<string, unknown> = {
      TotalAmt: Number(opts.amount),
      CustomerRef: { value: opts.customerQbId },
      TxnDate: opts.txnDate,
      // Idempotency key — never confuse with Intuit Payments "Payout sent" merchant status.
      PaymentRefNum: idempotencyRef,
      Line: [
        {
          Amount: Number(opts.amount),
          LinkedTxn: [
            {
              TxnId: opts.invoiceQbId,
              TxnType: "Invoice",
            },
          ],
        },
      ],
    };
    if (noteParts.length > 0) {
      payload.PrivateNote = noteParts.join(" · ");
    }
    // Prefer human-visible check # in PaymentRefNum only when no qb id yet would collide;
    // keep stable idempotencyRef so retries never create duplicates.
    if (opts.reference?.trim() && opts.reference.trim().length <= 21) {
      // Store check # in PrivateNote already; PaymentRefNum stays idempotent.
    }
    if (qbId) {
      payload.Id = qbId;
      payload.SyncToken = syncToken || "0";
      payload.sparse = false;
    }
    return payload;
  };

  let qbId = opts.qbId;
  let syncToken = opts.syncToken;

  if (!qbId) {
    const existing = await findPaymentByRefNum(idempotencyRef);
    if (existing.skipped) {
      return { payment: null, error: null, skipped: true };
    }
    if (existing.error) {
      return { payment: null, error: existing.error, skipped: false };
    }
    if (existing.payment) {
      qbId = existing.payment.Id;
      syncToken = existing.payment.SyncToken;
    }
  }

  let result = await qboRequest<{ Payment?: QboPayment }>("/payment", {
    method: "POST",
    body: JSON.stringify(buildPayload(qbId, syncToken)),
  });

  if (result.error && qbId && isStaleObjectError(result.error)) {
    const fresh = await readQboPayment(qbId);
    if (fresh.payment) {
      result = await qboRequest<{ Payment?: QboPayment }>("/payment", {
        method: "POST",
        body: JSON.stringify(
          buildPayload(fresh.payment.Id, fresh.payment.SyncToken)
        ),
      });
    }
  }

  return {
    payment: result.data?.Payment ?? null,
    error: result.error,
    skipped: result.skipped,
  };
}

export async function deleteQboPayment(opts: {
  qbId: string;
  syncToken: string | null;
}): Promise<{ error: string | null; skipped: boolean }> {
  let syncToken = opts.syncToken || "0";
  let result = await qboRequest<{ Payment?: QboPayment }>("/payment", {
    method: "POST",
    query: { operation: "delete" },
    body: JSON.stringify({
      Id: opts.qbId,
      SyncToken: syncToken,
    }),
  });

  if (result.error && isStaleObjectError(result.error)) {
    const fresh = await readQboPayment(opts.qbId);
    if (fresh.payment) {
      syncToken = fresh.payment.SyncToken;
      result = await qboRequest<{ Payment?: QboPayment }>("/payment", {
        method: "POST",
        query: { operation: "delete" },
        body: JSON.stringify({
          Id: opts.qbId,
          SyncToken: syncToken,
        }),
      });
    }
  }

  // Already deleted remotely is success for idempotent delete.
  if (
    result.error &&
    /not found|could not find|object not found/i.test(result.error)
  ) {
    return { error: null, skipped: false };
  }

  return { error: result.error, skipped: result.skipped };
}
