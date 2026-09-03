import type { Invoice, InvoiceRow } from "@/lib/invoices";
import { normalizeQuoteStatus } from "@/lib/quotes";
import type { Contact, Job, Lead } from "@/lib/types";

export type WholesaleJob = Job & {
  kanban_status?: string | null;
};

export interface WholesaleAccount {
  contact: Contact;
  outstanding: number;
  outstanding30Plus: number;
  openJobs: WholesaleJob[];
  closedJobs: WholesaleJob[];
  invoices: InvoiceRow[];
  quotes: Lead[];
  lastActivity: string | null;
}

function invoiceHasBalance(invoice: Invoice): boolean {
  return (
    Number(invoice.balance) > 0 &&
    (invoice.status === "open" || invoice.status === "overdue")
  );
}

function invoiceAgeDays(invoice: Invoice): number {
  const ref = invoice.due_date || invoice.invoice_date;
  const due = new Date(`${ref}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.floor((today.getTime() - due.getTime()) / 86400000);
}

export function isOpenWholesaleJob(job: Pick<Job, "stage">): boolean {
  return job.stage !== "complete" && job.stage !== "quote";
}

export function buildWholesaleAccounts(
  contacts: Contact[],
  jobs: WholesaleJob[],
  invoices: Invoice[],
  quotes: Lead[] = []
): WholesaleAccount[] {
  const jobsByCustomer = new Map<string, WholesaleJob[]>();
  for (const job of jobs) {
    if (!job.customer_id) continue;
    const list = jobsByCustomer.get(job.customer_id) ?? [];
    list.push(job);
    jobsByCustomer.set(job.customer_id, list);
  }

  const jobById = new Map(jobs.map((job) => [job.id, job]));

  const invoicesByCustomer = new Map<string, InvoiceRow[]>();
  for (const invoice of invoices) {
    if (!invoice.customer_id) continue;
    const job = invoice.job_id ? jobById.get(invoice.job_id) : null;
    const list = invoicesByCustomer.get(invoice.customer_id) ?? [];
    list.push({
      ...invoice,
      jobs: job
        ? { id: job.id, name: job.name, created_at: job.created_at }
        : (invoice as InvoiceRow).jobs ?? null,
    });
    invoicesByCustomer.set(invoice.customer_id, list);
  }

  const quotesByContact = new Map<string, Lead[]>();
  function addQuoteToContact(contactId: string, quote: Lead) {
    const list = quotesByContact.get(contactId) ?? [];
    if (list.some((existing) => existing.id === quote.id)) return;
    list.push(quote);
    quotesByContact.set(contactId, list);
  }

  for (const quote of quotes) {
    // Approved / converted quotes have moved to drafting/production —
    // keep them off the wholesale Quotes tab.
    if (
      quote.status === "converted" ||
      quote.converted_job_id ||
      normalizeQuoteStatus(quote.status) === "approved"
    ) {
      continue;
    }
    if (quote.contact_id) {
      addQuoteToContact(quote.contact_id, quote);
    }
  }

  for (const [, list] of quotesByContact) {
    list.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }

  return contacts
    .map((contact) => {
      const accountJobs = jobsByCustomer.get(contact.id) ?? [];
      const accountInvoices = invoicesByCustomer.get(contact.id) ?? [];
      const accountQuotes = quotesByContact.get(contact.id) ?? [];
      const openJobs = accountJobs.filter(isOpenWholesaleJob);
      const closedJobs = accountJobs.filter((job) => job.stage === "complete");
      const outstandingInvoices = accountInvoices.filter(invoiceHasBalance);
      const outstanding = outstandingInvoices.reduce(
        (sum, invoice) => sum + Number(invoice.balance),
        0
      );
      const outstanding30Plus = outstandingInvoices
        .filter((invoice) => invoiceAgeDays(invoice) >= 30)
        .reduce((sum, invoice) => sum + Number(invoice.balance), 0);

      const activityDates = [
        contact.updated_at,
        ...accountJobs.map((job) => job.updated_at),
        ...accountInvoices.map((invoice) => invoice.updated_at),
        ...accountQuotes.map((quote) => quote.updated_at),
      ].filter(Boolean);

      return {
        contact,
        outstanding,
        outstanding30Plus,
        openJobs,
        closedJobs,
        invoices: accountInvoices,
        quotes: accountQuotes,
        lastActivity:
          activityDates.sort((a, b) => b.localeCompare(a))[0] ?? null,
      };
    })
    .sort((a, b) => a.contact.name.localeCompare(b.contact.name));
}

export function wholesaleAccountStats(accounts: WholesaleAccount[]) {
  const withOutstanding = accounts.filter((account) => account.outstanding > 0);
  const with30Plus = accounts.filter((account) => account.outstanding30Plus > 0);
  const openJobCount = accounts.reduce(
    (sum, account) => sum + account.openJobs.length,
    0
  );
  const activeCount = accounts.filter(
    (account) =>
      account.openJobs.length > 0 ||
      account.invoices.length > 0 ||
      account.quotes.length > 0 ||
      account.closedJobs.length > 0
  ).length;

  return {
    totalOutstanding: withOutstanding.reduce(
      (sum, account) => sum + account.outstanding,
      0
    ),
    outstandingCustomerCount: withOutstanding.length,
    total30Plus: with30Plus.reduce(
      (sum, account) => sum + account.outstanding30Plus,
      0
    ),
    plus30CustomerCount: with30Plus.length,
    openJobCount,
    activeCount,
  };
}
