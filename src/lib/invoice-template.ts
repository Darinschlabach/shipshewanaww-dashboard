export type InvoicePdfTemplate = "standard" | "advance";

export type InvoiceTemplateSettings = {
  template: InvoicePdfTemplate;
  downPaymentPercent: number | null;
  downPaymentSaved: boolean;
};

const DEFAULT_SETTINGS: InvoiceTemplateSettings = {
  template: "standard",
  downPaymentPercent: null,
  downPaymentSaved: false,
};

function storageKey(invoiceId: string) {
  return `invoice-pdf-template:${invoiceId}`;
}

export function parseDownPaymentPercent(value: string): number | null {
  const numeric = Number.parseFloat(value);
  if (!Number.isFinite(numeric)) return null;
  if (numeric < 0 || numeric > 100) return null;
  return Math.round(numeric * 100) / 100;
}

export function downPaymentAmount(total: number, percent: number | null): number | null {
  if (percent == null) return null;
  return Math.round(total * (percent / 100) * 100) / 100;
}

export function loadInvoiceTemplateSettings(
  invoiceId: string
): InvoiceTemplateSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(storageKey(invoiceId));
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<InvoiceTemplateSettings>;
    const template =
      parsed.template === "advance" ? "advance" : "standard";
    const percent =
      typeof parsed.downPaymentPercent === "number" &&
      Number.isFinite(parsed.downPaymentPercent)
        ? parsed.downPaymentPercent
        : null;
    return {
      template,
      downPaymentPercent: percent,
      downPaymentSaved: Boolean(parsed.downPaymentSaved) && percent != null,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveInvoiceTemplateSettings(
  invoiceId: string,
  settings: InvoiceTemplateSettings
) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(invoiceId), JSON.stringify(settings));
}
