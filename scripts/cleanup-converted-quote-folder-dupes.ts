/**
 * Remove leftover Quotes folders for converted jobs (duplicates created when
 * job folders were ensured without moving the original quote folders).
 *
 * Run: npx tsx scripts/cleanup-converted-quote-folder-dupes.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnvLocal() {
  const text = readFileSync(resolve(".env.local"), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    let k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    )
      v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}

async function main() {
  loadEnvLocal();
  const { createAdminClient } = await import("../src/lib/supabase/admin");
  const {
    getConfiguredQuotesFolder,
    microsoftGraphGet,
  } = await import("../src/lib/integrations/microsoft-graph");
  const { deleteSharePointDriveItem } =
    await import("../src/lib/integrations/microsoft-graph-sharepoint-files");
  const { ensureJobSharePointFolders } =
    await import("../src/lib/integrations/microsoft-graph-job-folders");

  const admin = createAdminClient();
  const { driveId, quotesFolderId } = getConfiguredQuotesFolder();

  const { data: leads, error } = await admin
    .from("leads")
    .select("id, project_type, status, graph_folder_item_id, graph_drive_id")
    .eq("status", "converted")
    .not("graph_folder_item_id", "is", null);

  if (error) throw new Error(error.message);

  let cleaned = 0;
  let skipped = 0;

  for (const lead of leads ?? []) {
    if (!lead.graph_folder_item_id) continue;

    let parentId: string | null = null;
    try {
      const { data } = await microsoftGraphGet<{
        parentReference?: { id?: string };
      }>(
        `/drives/${encodeURIComponent(lead.graph_drive_id || driveId)}/items/${encodeURIComponent(lead.graph_folder_item_id)}?$select=id,parentReference`,
        { timeoutMs: 20_000 }
      );
      parentId = data.parentReference?.id ?? null;
    } catch (err) {
      console.log(
        `SKIP ${lead.project_type}: cannot load lead folder (${err instanceof Error ? err.message : err})`
      );
      skipped += 1;
      continue;
    }

    if (parentId !== quotesFolderId) {
      skipped += 1;
      continue;
    }

    const { data: job } = await admin
      .from("jobs")
      .select("id, name, graph_folder_item_id")
      .eq("name", lead.project_type)
      .maybeSingle();

    if (!job?.id || !job.graph_folder_item_id) {
      console.log(
        `SKIP ${lead.project_type}: still under Quotes but no matching job folder`
      );
      skipped += 1;
      continue;
    }

    if (job.graph_folder_item_id === lead.graph_folder_item_id) {
      skipped += 1;
      continue;
    }

    console.log(
      `CLEAN ${lead.project_type}: delete Quotes ${lead.graph_folder_item_id}, keep Jobs ${job.graph_folder_item_id}`
    );

    await deleteSharePointDriveItem({
      driveId: lead.graph_drive_id || driveId,
      itemId: lead.graph_folder_item_id,
    });

    const jobIds = await ensureJobSharePointFolders(job.id);
    await admin
      .from("leads")
      .update({
        graph_drive_id: jobIds.graph_drive_id,
        graph_folder_item_id: jobIds.graph_folder_item_id,
        graph_web_url: jobIds.graph_web_url,
        graph_provided_drawings_item_id: jobIds.graph_provided_drawings_item_id,
        graph_quote_forms_item_id: jobIds.graph_quote_forms_item_id,
        graph_misc_item_id: jobIds.graph_misc_item_id,
      })
      .eq("id", lead.id);

    cleaned += 1;
  }

  console.log(`\nDone. cleaned=${cleaned} skipped=${skipped}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
