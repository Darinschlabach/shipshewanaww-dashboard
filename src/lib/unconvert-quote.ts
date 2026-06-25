import type { SupabaseClient } from "@supabase/supabase-js";
import type { Job, Lead } from "@/lib/types";

export async function unconvertQuoteFromJob(
  supabase: SupabaseClient,
  quote: Pick<Lead, "id" | "converted_job_id">,
  job?: Pick<Job, "name" | "total_value" | "notes"> | null
): Promise<{ error: string | null }> {
  const jobId = quote.converted_job_id;
  if (!jobId) {
    return { error: "This quote is not linked to a job." };
  }

  const update: Record<string, unknown> = {
    status: "approved",
    converted_job_id: null,
    job_id: null,
  };
  if (job) {
    update.project_type = job.name;
    update.est_value = job.total_value;
    update.notes = job.notes;
  }

  const { error: updateError } = await supabase
    .from("leads")
    .update(update)
    .eq("id", quote.id);

  if (updateError) return { error: updateError.message };

  const { error: deleteError } = await supabase
    .from("jobs")
    .delete()
    .eq("id", jobId);

  if (deleteError) return { error: deleteError.message };

  return { error: null };
}
