import type { SupabaseClient } from "@supabase/supabase-js";

/** Auto-archive POs delivered 30+ days ago */
export async function autoArchivePurchaseOrders(supabase: SupabaseClient) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  await supabase
    .from("purchase_orders")
    .update({ status: "archived", archived_at: new Date().toISOString() })
    .eq("status", "delivered")
    .lt("delivered_at", cutoff.toISOString());
}
