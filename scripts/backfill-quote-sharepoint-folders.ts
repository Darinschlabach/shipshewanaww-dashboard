/**
 * Backfill SharePoint quote folders for existing leads.
 * Idempotent: reuses stored DriveItem IDs or matching unclaimed Job Name folders.
 *
 * Run: npx tsx scripts/backfill-quote-sharepoint-folders.ts
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
  const { ensureQuoteSharePointFolders } =
    await import("../src/lib/integrations/microsoft-graph-quote-folders");

  const admin = createAdminClient();

  const { data: leads, error } = await admin
    .from("leads")
    .select("id, project_type, status, quote_number, graph_folder_item_id")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to load quotes:", error.message);
    if (/graph_folder_item_id|column/i.test(error.message)) {
      console.error(
        "Run supabase/migrations/20260810000002_leads_graph_folder_ids.sql first."
      );
    }
    process.exit(1);
  }

  const rows = leads ?? [];
  console.log(`Found ${rows.length} quote(s).`);
  console.log(
    `Already linked: ${rows.filter((r) => r.graph_folder_item_id).length}`
  );
  console.log(
    `Need ensure: ${rows.filter((r) => !r.graph_folder_item_id).length}`
  );

  let ok = 0;
  let failed = 0;
  const failures: { id: string; name: string; error: string }[] = [];

  for (const lead of rows) {
    const label = `${lead.quote_number ?? lead.id} — ${lead.project_type}`;
    try {
      const folder = await ensureQuoteSharePointFolders(lead.id);
      ok += 1;
      console.log(
        `OK  ${label}\n    folder=${folder.graph_folder_item_id}`
      );
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      failures.push({
        id: lead.id,
        name: lead.project_type,
        error: message,
      });
      console.error(`FAIL ${label}\n    ${message}`);
    }
  }

  console.log("\n--- Backfill summary ---");
  console.log(`Succeeded: ${ok}`);
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
