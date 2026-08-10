/**
 * Move existing quote project folders under their contractor's Quotes folder
 * when the quote contact is a Contractor.
 *
 * Run: npx tsx scripts/backfill-nest-quotes-under-contractors.ts
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
  const {
    ensureContractorSharePointFolders,
    resolveQuotesParentFolderId,
  } = await import("../src/lib/integrations/microsoft-graph-contractor-folders");
  const { moveSharePointDriveItem } =
    await import("../src/lib/integrations/microsoft-graph-sharepoint-files");
  const {
    ensureQuoteSharePointFolders,
    sanitizeSharePointFolderName,
  } = await import("../src/lib/integrations/microsoft-graph-quote-folders");

  const admin = createAdminClient();
  const { driveId, quotesFolderId } = getConfiguredQuotesFolder();

  // Ensure contractor folders exist first.
  const { data: contractors, error: cErr } = await admin
    .from("contacts")
    .select("id, name")
    .eq("contact_type", "Contractors")
    .order("name");
  if (cErr) throw new Error(cErr.message);

  console.log(`Ensuring ${(contractors ?? []).length} contractor Quotes folders…`);
  for (const c of contractors ?? []) {
    await ensureContractorSharePointFolders(c.id);
    console.log(`  OK ${c.name}`);
  }

  const { data: leads, error } = await admin
    .from("leads")
    .select(
      "id, project_type, status, contact_id, graph_drive_id, graph_folder_item_id"
    )
    .not("graph_folder_item_id", "is", null)
    .not("contact_id", "is", null)
    .order("project_type");

  if (error) throw new Error(error.message);

  let moved = 0;
  let already = 0;
  let skipped = 0;
  let failed = 0;

  for (const lead of leads ?? []) {
    if (!lead.contact_id || !lead.graph_folder_item_id) {
      skipped += 1;
      continue;
    }

    const { data: contact } = await admin
      .from("contacts")
      .select("id, name, contact_type")
      .eq("id", lead.contact_id)
      .maybeSingle();

    if (!contact || contact.contact_type !== "Contractors") {
      skipped += 1;
      continue;
    }

    // Skip converted quotes that already live under Jobs (not Quotes tree).
    if (lead.status === "converted") {
      try {
        const { data: item } = await microsoftGraphGet<{
          parentReference?: { id?: string };
          name?: string;
        }>(
          `/drives/${encodeURIComponent(lead.graph_drive_id || driveId)}/items/${encodeURIComponent(lead.graph_folder_item_id)}?$select=id,name,parentReference`,
          { timeoutMs: 20_000 }
        );
        // If not under Quotes root and not under a Quotes contractor folder, leave it.
        const parent = await resolveQuotesParentFolderId(lead.contact_id);
        if (
          item.parentReference?.id !== quotesFolderId &&
          item.parentReference?.id !== parent.parentFolderId
        ) {
          console.log(
            `SKIP ${lead.project_type} (converted, not under Quotes tree)`
          );
          skipped += 1;
          continue;
        }
      } catch {
        skipped += 1;
        continue;
      }
    }

    try {
      const parent = await resolveQuotesParentFolderId(lead.contact_id);
      const { data: item } = await microsoftGraphGet<{
        id?: string;
        name?: string;
        parentReference?: { id?: string };
      }>(
        `/drives/${encodeURIComponent(lead.graph_drive_id || driveId)}/items/${encodeURIComponent(lead.graph_folder_item_id)}?$select=id,name,parentReference`,
        { timeoutMs: 20_000 }
      );

      const currentParent = item.parentReference?.id ?? null;
      if (currentParent === parent.parentFolderId) {
        already += 1;
        console.log(
          `OK   ${lead.project_type} already under ${contact.name}`
        );
        continue;
      }

      if (currentParent !== quotesFolderId) {
        console.log(
          `SKIP ${lead.project_type}: parent is neither Quotes root nor ${contact.name}`
        );
        skipped += 1;
        continue;
      }

      const targetName = sanitizeSharePointFolderName(lead.project_type);
      await moveSharePointDriveItem({
        driveId: lead.graph_drive_id || driveId,
        itemId: lead.graph_folder_item_id,
        newParentItemId: parent.parentFolderId,
        newName: targetName,
      });
      await ensureQuoteSharePointFolders(lead.id);
      moved += 1;
      console.log(`MOVED ${lead.project_type} → ${contact.name}`);
    } catch (err) {
      failed += 1;
      console.error(
        `FAIL ${lead.project_type}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  // Also ensure any contractor quotes that never got a folder yet.
  const { data: unlinked } = await admin
    .from("leads")
    .select("id, project_type, contact_id, graph_folder_item_id, status")
    .is("graph_folder_item_id", null)
    .not("contact_id", "is", null)
    .neq("status", "converted");

  let created = 0;
  for (const lead of unlinked ?? []) {
    const { data: contact } = await admin
      .from("contacts")
      .select("contact_type, name")
      .eq("id", lead.contact_id!)
      .maybeSingle();
    if (!contact || contact.contact_type !== "Contractors") continue;
    try {
      await ensureQuoteSharePointFolders(lead.id);
      created += 1;
      console.log(`CREATE ${lead.project_type} under ${contact.name}`);
    } catch (err) {
      failed += 1;
      console.error(
        `FAIL create ${lead.project_type}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  console.log("\n--- Summary ---");
  console.log(`Moved: ${moved}`);
  console.log(`Already nested: ${already}`);
  console.log(`Created: ${created}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed: ${failed}`);
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
