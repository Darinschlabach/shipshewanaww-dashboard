import { jsonError, jsonOk, requireApiUser } from "@/lib/api-auth";
import { syncPaymentToQuickBooks } from "@/lib/integrations/quickbooks-sync";

export async function POST(
  _request: Request,
  {
    params,
  }: { params: Promise<{ id: string; paymentId: string }> }
) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;

  const { id: invoiceId, paymentId } = await params;
  const sync = await syncPaymentToQuickBooks(paymentId);
  const { data, error } = await auth.supabase
    .from("invoice_payments")
    .select("*")
    .eq("id", paymentId)
    .eq("invoice_id", invoiceId)
    .single();

  if (error || !data) {
    return jsonError(error?.message || "Payment not found.", 404);
  }

  return jsonOk({
    data,
    syncError: sync.status === "failed" ? sync.error : null,
    syncStatus: sync.status,
  });
}
