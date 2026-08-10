/**
 * Delete SharePoint folders for seed/demo quotes and clear graph IDs.
 * Run: npx tsx scripts/delete-demo-quote-sharepoint-folders.ts
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

function isDemoLead(row: {
  id: string;
  project_type: string | null;
}): boolean {
  if (String(row.id).startsWith("c0000001-")) return true;
  return /^(Kitchen remodel|Master bathroom|Mudroom|Home office)( \d+)?$/i.test(
    (row.project_type ?? "").trim()
  );
}

async function main() {
  loadEnvLocal();

  const { createAdminClient } = await import("../src/lib/supabase/admin");
  const {
    MicrosoftGraphAuthError,
    getConfiguredQuotesFolder,
    microsoftGraphDelete,
  } = await import("../src/lib/integrations/microsoft-graph");

  const admin = createAdminClient();
  const { driveId } = getConfiguredQuotesFolder();

  const { data, error } = await admin
    .from("leads")
    .select(
      "id, project_type, customer_name, status, graph_drive_id, graph_folder_item_id"
    )
    .order("created_at");

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  const demos = (data ?? []).filter(isDemoLead);
  console.log(`Found ${demos.length} demo quote(s) to clean up.`);

  let deleted = 0;
  let cleared = 0;
  let failed = 0;

  for (const lead of demos) {
    const label = `${lead.customer_name} — ${lead.project_type}`;
    const folderId = lead.graph_folder_item_id;
    const itemDriveId = lead.graph_drive_id || driveId;

    if (folderId) {
      try {
        await microsoftGraphDelete(
          `/drives/${encodeURIComponent(itemDriveId)}/items/${encodeURIComponent(folderId)}`,
          { timeoutMs: 30_000 }
        );
        deleted += 1;
        console.log(`DELETED folder ${label} (${folderId})`);
      } catch (err) {
        if (err instanceof MicrosoftGraphAuthError && err.status === 404) {
          console.log(`Already gone: ${label}`);
        } else {
          failed += 1;
          console.error(
            `FAIL delete ${label}:`,
            err instanceof Error ? err.message : err
          );
          continue;
        }
      }
    } else {
      console.log(`No folder id stored for ${label}`);
    }

    const { error: clearError } = await admin
      .from("leads")
      .update({
        graph_drive_id: null,
        graph_folder_item_id: null,
        graph_web_url: null,
        graph_provided_drawings_item_id: null,
        graph_quote_forms_item_id: null,
        graph_misc_item_id: null,
      })
      .eq("id", lead.id);

    if (clearError) {
      failed += 1;
      console.error(`FAIL clear DB ${label}:`, clearError.message);
    } else {
      cleared += 1;
      console.log(`Cleared graph IDs for ${label}`);
    }
  }

  console.log("\n--- Summary ---");
  console.log(`Folders deleted: ${deleted}`);
  console.log(`DB rows cleared: ${cleared}`);
  console.log(`Failures: ${failed}`);
  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
