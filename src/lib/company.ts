export const COMPANY = {
  name: "Shipshewana Woodworks",
  contactName: "Darin Schlabach",
  phone: "260-350-5937",
  address: "7720 W 200 N, Shipshewana, IN 46565",
  email: "Darin@shipshewanawoodworks.com",
  tagline: "Custom Cabinetry",
  logoPath: "/shipshewana-logo-dark.png",
} as const;

export const QUOTE_FOOTER_TERMS = `This quote is based on the specifications and selections noted above. Price may be adjusted if materials become unavailable or if scope changes. Thank you for considering Shipshewana Woodworks for your custom cabinetry needs.`;

export const QUOTE_FOOTER_TAGLINE = "Handcrafted for Your Home. Built to Last.";

export const QUOTE_FOOTER_SUBTAG = "FAMILY-OWNED • QUALITY CRAFTSMANSHIP • PERSONAL SERVICE";

/** Indiana state sales tax applied to quote PDF totals. */
export const QUOTE_SALES_TAX_RATE = 0.07;

export function quoteSalesTax(subtotal: number, includeTax: boolean): number {
  return includeTax ? subtotal * QUOTE_SALES_TAX_RATE : 0;
}

/** Whole percent from 0 to 100. Empty or invalid input is no discount. */
export function quoteDiscountPercent(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(100, value);
}

export function quoteDiscountAmount(subtotal: number, percent: number): number {
  const pct = quoteDiscountPercent(percent);
  if (pct === 0 || !Number.isFinite(subtotal)) return 0;
  return Math.round(subtotal * (pct / 100) * 100) / 100;
}

export function formatQuoteDiscountPercent(percent: number): string {
  const rounded = Math.round(quoteDiscountPercent(percent) * 100) / 100;
  return `${rounded}%`;
}

/** Invoice tax. Unchecked keeps the existing whole-dollar total. */
export function invoiceTaxTotals(
  subtotal: number,
  discount: number,
  includeTax: boolean
): { tax: number; total: number } {
  const net = subtotal - discount;
  if (!includeTax) {
    return { tax: 0, total: Math.floor(net) };
  }
  const tax = Math.round(Math.max(0, net) * QUOTE_SALES_TAX_RATE * 100) / 100;
  const total = Math.round((net + tax) * 100) / 100;
  return { tax, total };
}

export const QUOTE_PROPOSAL_LEGAL =
  "All material guaranteed to be as specified. All work to be completed in a workmanlike manner according to standard practices. Any alteration or deviation from above specifications involving extra cost will be executed only upon written orders and will become an extra charge over and above the estimate. All agreements contingent upon strikes, accidents or delays beyond our control. Owner to carry fire, tornado and other necessary insurance.";

export const QUOTE_ACCEPTANCE_TEXT =
  "The above prices, specifications and conditions are satisfactory and are hereby accepted. You are authorized to the work as specified. Payment will be made as outlined above.";

export const QUOTE_PDF_TERMS_BAR =
  "Terms: • Balance due on delivery • Quote valid 30 days • Prices subject to change";
