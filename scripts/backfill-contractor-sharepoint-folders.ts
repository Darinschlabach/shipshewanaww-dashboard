/**
 * Ensure each Contractor contact has a named folder under Jobs and Quotes.
 *
 * Prerequisites: run
 *   supabase/migrations/20260810000006_contacts_graph_contractor_folders.sql
 * in the Supabase SQL Editor.
 *
 * Run: npx tsx scripts/backfill-contractor-sharepoint-folders.ts
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
  const { ensureContractorSharePointFolders } =
    await import("../src/lib/integrations/microsoft-graph-contractor-folders");

  const admin = createAdminClient();
  const { data: contacts, error } = await admin
    .from("contacts")
    .select("id, name, contact_type")
    .eq("contact_type", "Contractors")
    .order("name");

  if (error) throw new Error(error.message);
  const list = contacts ?? [];
  console.log(`Ensuring SharePoint folders for ${list.length} contractor(s)…`);

  let ok = 0;
  let failed = 0;
  for (const contact of list) {
    try {
      const ids = await ensureContractorSharePointFolders(contact.id);
      if (!ids) {
        console.log(`SKIP ${contact.name} (not a contractor)`);
        continue;
      }
      console.log(
        `OK  ${contact.name} → Jobs=${ids.graph_jobs_folder_item_id.slice(0, 8)}… Quotes=${ids.graph_quotes_folder_item_id.slice(0, 8)}…`
      );
      ok += 1;
    } catch (err) {
      failed += 1;
      console.error(
        `FAIL ${contact.name}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  console.log(`\nDone. ok=${ok} failed=${failed}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
