/** Client-safe QuickBooks URL helpers (no server secrets). */

export function getQuickBooksEnvironment(): "sandbox" | "production" {
  const env = (process.env.NEXT_PUBLIC_INTUIT_ENVIRONMENT ||
    process.env.INTUIT_ENVIRONMENT ||
    "sandbox"
  ).toLowerCase();
  if (env === "production" || env === "prod") return "production";
  return "sandbox";
}

export function getQuickBooksApiBaseUrl(): string {
  return getQuickBooksEnvironment() === "production"
    ? "https://quickbooks.api.intuit.com"
    : "https://sandbox-quickbooks.api.intuit.com";
}

export function getQuickBooksAppBaseUrl(): string {
  return getQuickBooksEnvironment() === "production"
    ? "https://app.qbo.intuit.com"
    : "https://app.sandbox.qbo.intuit.com";
}
