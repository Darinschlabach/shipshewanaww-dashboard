/**
 * Rename SharePoint "Quote Forms" subfolders to "Quotes" for all linked quotes.
 * Run: npx tsx scripts/rename-quote-forms-folders-to-quotes.ts
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
  const { ensureQuoteSharePointFolders } =
    await import("../src/lib/integrations/microsoft-graph-quote-folders");
  const {
    MicrosoftGraphAuthError,
    microsoftGraphGet,
    microsoftGraphPatch,
  } = await import("../src/lib/integrations/microsoft-graph");

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("leads")
    .select("id, project_type, quote_number, graph_drive_id, graph_quote_forms_item_id")
    .not("graph_folder_item_id", "is", null)
    .order("created_at");

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  const rows = data ?? [];
  console.log(`Updating ${rows.length} quote folder(s)…`);

  let renamed = 0;
  let already = 0;
  let failed = 0;

  for (const lead of rows) {
    const label = `${lead.quote_number ?? lead.id} — ${lead.project_type}`;
    try {
      // Ensure (also renames legacy "Quote Forms" → "Quotes" via helper).
      const ids = await ensureQuoteSharePointFolders(lead.id);

      const { data: item } = await microsoftGraphGet<{
        id?: string;
        name?: string;
      }>(
        `/drives/${encodeURIComponent(ids.graph_drive_id)}/items/${encodeURIComponent(ids.graph_quote_forms_item_id)}?$select=id,name`,
        { timeoutMs: 20_000 }
      );

      if (item.name === "Quotes") {
        already += 1;
        console.log(`OK   ${label} (already Quotes)`);
        continue;
      }

      await microsoftGraphPatch(
        `/drives/${encodeURIComponent(ids.graph_drive_id)}/items/${encodeURIComponent(ids.graph_quote_forms_item_id)}`,
        { name: "Quotes" },
        { timeoutMs: 30_000 }
      );
      renamed += 1;
      console.log(`RENAMED ${label}: "${item.name}" → Quotes`);
    } catch (err) {
      failed += 1;
      const message =
        err instanceof MicrosoftGraphAuthError || err instanceof Error
          ? err.message
          : String(err);
      console.error(`FAIL ${label}: ${message}`);
    }
  }

  console.log("\n--- Summary ---");
  console.log(`Renamed: ${renamed}`);
  console.log(`Already Quotes: ${already}`);
  console.log(`Failed: ${failed}`);
  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
