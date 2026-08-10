/**
 * Ensure every job has a SharePoint project folder under Jobs
 * (or under the contractor's Jobs folder when the contact is a Contractor).
 * Moves existing folders into the contractor folder when needed.
 *
 * Prerequisites (run in Supabase SQL Editor if not already applied):
 *   - 20260810000003_jobs_graph_folder_ids.sql (+ later job graph migrations)
 *   - 20260810000006_contacts_graph_contractor_folders.sql
 *
 * Run: npx tsx scripts/backfill-job-sharepoint-folders.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main() {
  loadEnvLocal();

  const { createAdminClient } = await import("../src/lib/supabase/admin");
  const { ensureContractorSharePointFolders } =
    await import("../src/lib/integrations/microsoft-graph-contractor-folders");
  const {
    ensureJobSharePointFolders,
  } = await import("../src/lib/integrations/microsoft-graph-job-folders");
  const { resolveJobsParentFolderId } =
    await import("../src/lib/integrations/microsoft-graph-contractor-folders");
  const { getConfiguredJobsFolder, microsoftGraphGet } =
    await import("../src/lib/integrations/microsoft-graph");
  const { moveSharePointDriveItem } =
    await import("../src/lib/integrations/microsoft-graph-sharepoint-files");
  const { sanitizeSharePointFolderName } =
    await import("../src/lib/integrations/microsoft-graph-quote-folders");

  const admin = createAdminClient();

  // 1) Contractor folders first
  const { data: contractors, error: cErr } = await admin
    .from("contacts")
    .select("id, name")
    .eq("contact_type", "Contractors")
    .order("name");
  if (cErr) {
    console.error("Failed to load contractors:", cErr.message);
    if (/graph_jobs_folder_item_id|column/i.test(cErr.message)) {
      console.error(
        "Run supabase/migrations/20260810000006_contacts_graph_contractor_folders.sql first."
      );
    }
    process.exit(1);
  }

  console.log(
    `Ensuring contractor folders for ${(contractors ?? []).length} contact(s)…`
  );
  for (const c of contractors ?? []) {
    try {
      await ensureContractorSharePointFolders(c.id);
      console.log(`  OK contractor ${c.name}`);
    } catch (err) {
      console.error(
        `  FAIL contractor ${c.name}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  // 2) All jobs
  const { data: jobs, error } = await admin
    .from("jobs")
    .select("id, name, customer_id, graph_drive_id, graph_folder_item_id")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to load jobs:", error.message);
    if (/graph_folder_item_id|column/i.test(error.message)) {
      console.error(
        "Run supabase/migrations/20260810000003_jobs_graph_folder_ids.sql first."
      );
    }
    process.exit(1);
  }

  const rows = jobs ?? [];
  const { jobsFolderId } = getConfiguredJobsFolder();
  console.log(`\nFound ${rows.length} job(s).`);
  console.log(
    `Already linked: ${rows.filter((r) => r.graph_folder_item_id).length}`
  );
  console.log(
    `Need create: ${rows.filter((r) => !r.graph_folder_item_id).length}`
  );

  let ok = 0;
  let moved = 0;
  let failed = 0;
  const failures: { id: string; name: string; error: string }[] = [];

  for (const job of rows) {
    const label = job.name;
    try {
      let ids = await ensureJobSharePointFolders(job.id);

      // If this job belongs to a contractor, move project folder under that contractor.
      const parent = await resolveJobsParentFolderId(job.customer_id);
      if (parent.parentFolderId !== jobsFolderId && ids.graph_folder_item_id) {
        const { data: item } = await microsoftGraphGet<{
          id?: string;
          name?: string;
          parentReference?: { id?: string; driveId?: string };
        }>(
          `/drives/${encodeURIComponent(ids.graph_drive_id)}/items/${encodeURIComponent(ids.graph_folder_item_id)}?$select=id,name,parentReference`,
          { timeoutMs: 20_000 }
        );
        const currentParent = item.parentReference?.id ?? null;
        if (currentParent && currentParent !== parent.parentFolderId) {
          const targetName = sanitizeSharePointFolderName(job.name);
          await moveSharePointDriveItem({
            driveId: ids.graph_drive_id,
            itemId: ids.graph_folder_item_id,
            newParentItemId: parent.parentFolderId,
            newName: targetName,
          });
          moved += 1;
          console.log(
            `MOVED ${label} → contractor parent ${parent.parentFolderId.slice(0, 8)}…`
          );
          ids = await ensureJobSharePointFolders(job.id);
        }
      }

      ok += 1;
      console.log(`OK  ${label}\n    folder=${ids.graph_folder_item_id}`);
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      failures.push({ id: job.id, name: job.name, error: message });
      console.error(`FAIL ${label}\n    ${message}`);
    }
  }

  console.log("\n--- Backfill summary ---");
  console.log(`Succeeded: ${ok}`);
  console.log(`Moved under contractor: ${moved}`);
  console.log(`Failed: ${failed}`);
  if (failures.length) {
    console.log("Failures:");
    for (const f of failures) {
      console.log(`- ${f.id} (${f.name}): ${f.error}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
