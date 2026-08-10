/**
 * One-off SharePoint quote folder E2E test.
 * Run: npx tsx scripts/test-quote-sharepoint.ts
 */
import { readFileSync, writeFileSync, unlinkSync } from "fs";
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
  const {
    ensureQuoteSharePointFolders,
    QUOTE_SHAREPOINT_SUBFOLDERS,
  } = await import("../src/lib/integrations/microsoft-graph-quote-folders");
  const {
    listQuoteSharePointFiles,
    uploadQuoteSharePointFiles,
  } = await import("../src/lib/integrations/microsoft-graph-quote-files");
  const {
    getConfiguredQuotesFolder,
    microsoftGraphGet,
    microsoftGraphPutBinary,
  } = await import("../src/lib/integrations/microsoft-graph");

  const admin = createAdminClient();
  const jobName = "SharePoint Quote Test";

  // Ensure migration columns exist by attempting a no-op update pattern via select.
  const { error: schemaError } = await admin
    .from("leads")
    .select("id, graph_folder_item_id")
    .limit(1);
  if (schemaError) {
    console.error(
      "SCHEMA ERROR — run supabase/migrations/20260810000002_leads_graph_folder_ids.sql first:",
      schemaError.message
    );
    process.exit(1);
  }

  // Clean any prior test lead with this exact name (keep SharePoint folder for idempotency check).
  const { data: existing } = await admin
    .from("leads")
    .select("id")
    .eq("project_type", jobName);
  if (existing?.length) {
    for (const row of existing) {
      await admin.from("leads").delete().eq("id", row.id);
    }
    console.log(`Deleted ${existing.length} prior test lead(s).`);
  }

  const { data: lead, error: insertError } = await admin
    .from("leads")
    .insert({
      customer_name: "SharePoint Test Customer",
      project_type: jobName,
      est_value: 0,
      status: "draft",
      quote_number: `Q-TEST-${Date.now()}`,
    })
    .select("id")
    .single();

  if (insertError || !lead) {
    console.error("Failed to create test quote:", insertError?.message);
    process.exit(1);
  }
  console.log("Created quote", lead.id);

  const folder = await ensureQuoteSharePointFolders(lead.id);
  console.log("Ensured folder:", {
    folderItemId: folder.graph_folder_item_id,
    webUrl: folder.graph_web_url,
    provided: folder.graph_provided_drawings_item_id,
    forms: folder.graph_quote_forms_item_id,
    misc: folder.graph_misc_item_id,
  });

  // Idempotency: ensure again should not create duplicates.
  const again = await ensureQuoteSharePointFolders(lead.id);
  if (again.graph_folder_item_id !== folder.graph_folder_item_id) {
    console.error("FAIL: ensure created a different project folder on retry");
    process.exit(1);
  }
  console.log("PASS: ensure is idempotent");

  const { driveId } = getConfiguredQuotesFolder();
  const { data: children } = await microsoftGraphGet<{
    value?: { id?: string; name?: string; folder?: unknown }[];
  }>(
    `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(folder.graph_folder_item_id)}/children?$select=id,name,folder`
  );
  const names = (children.value ?? [])
    .filter((c) => c.folder)
    .map((c) => c.name)
    .sort();
  const expected = Object.values(QUOTE_SHAREPOINT_SUBFOLDERS).sort();
  console.log("Subfolders:", names);
  if (JSON.stringify(names) !== JSON.stringify(expected)) {
    // Allow extra folders but require the three expected ones.
    for (const name of expected) {
      if (!names.includes(name)) {
        console.error("FAIL: missing subfolder", name);
        process.exit(1);
      }
    }
  }
  console.log("PASS: required subfolders present");

  // Upload from software into Misc
  const miscFile = new File(
    [Buffer.from("software upload misc notes\n")],
    "notes-from-software.pdf",
    { type: "application/pdf" }
  );
  const uploadMisc = await uploadQuoteSharePointFiles({
    quoteId: lead.id,
    category: "misc",
    files: [miscFile],
    uploadedByName: "E2E Test",
  });
  if (uploadMisc.error || uploadMisc.files.length === 0) {
    console.error("FAIL: software Misc upload:", uploadMisc.error);
    process.exit(1);
  }
  console.log("PASS: uploaded notes-from-software.pdf to Misc", uploadMisc.files[0].id);

  // Simulate File Explorer add into Misc
  const explorerPath =
    `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(folder.graph_misc_item_id)}:/measurements-from-explorer.pdf:/content?@microsoft.graph.conflictBehavior=rename`;
  await microsoftGraphPutBinary(
    explorerPath,
    Buffer.from("explorer upload misc measurements\n"),
    { contentType: "application/pdf", timeoutMs: 60_000 }
  );
  console.log("PASS: simulated File Explorer upload to Misc");

  const miscList = await listQuoteSharePointFiles({
    quoteId: lead.id,
    category: "misc",
  });
  const miscNames = miscList.files.map((f) => f.name);
  console.log("Misc files:", miscNames);
  if (!miscNames.some((n) => n.includes("notes-from-software"))) {
    console.error("FAIL: software file missing from Misc list");
    process.exit(1);
  }
  if (!miscNames.some((n) => n.includes("measurements-from-explorer"))) {
    console.error("FAIL: explorer file missing from Misc list");
    process.exit(1);
  }
  console.log("PASS: Misc two-way visibility");

  // Customer Provided Drawings
  const drawingsUpload = await uploadQuoteSharePointFiles({
    quoteId: lead.id,
    category: "provided_drawings",
    files: [
      new File([Buffer.from("drawing from software\n")], "drawing-software.pdf", {
        type: "application/pdf",
      }),
    ],
    uploadedByName: "E2E Test",
  });
  if (drawingsUpload.error) {
    console.error("FAIL: drawings upload", drawingsUpload.error);
    process.exit(1);
  }
  await microsoftGraphPutBinary(
    `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(folder.graph_provided_drawings_item_id)}:/drawing-explorer.pdf:/content?@microsoft.graph.conflictBehavior=rename`,
    Buffer.from("drawing from explorer\n"),
    { contentType: "application/pdf", timeoutMs: 60_000 }
  );
  const drawingsList = await listQuoteSharePointFiles({
    quoteId: lead.id,
    category: "provided_drawings",
  });
  const drawingNames = drawingsList.files.map((f) => f.name);
  console.log("Drawings files:", drawingNames);
  if (
    !drawingNames.some((n) => n.includes("drawing-software")) ||
    !drawingNames.some((n) => n.includes("drawing-explorer"))
  ) {
    console.error("FAIL: Customer Provided Drawings two-way");
    process.exit(1);
  }
  console.log("PASS: Customer Provided Drawings two-way visibility");

  // Quote Forms
  const formsUpload = await uploadQuoteSharePointFiles({
    quoteId: lead.id,
    category: "quote_forms",
    files: [
      new File([Buffer.from("form from software\n")], "form-software.pdf", {
        type: "application/pdf",
      }),
    ],
    uploadedByName: "E2E Test",
  });
  if (formsUpload.error) {
    console.error("FAIL: forms upload", formsUpload.error);
    process.exit(1);
  }
  await microsoftGraphPutBinary(
    `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(folder.graph_quote_forms_item_id)}:/form-explorer.pdf:/content?@microsoft.graph.conflictBehavior=rename`,
    Buffer.from("form from explorer\n"),
    { contentType: "application/pdf", timeoutMs: 60_000 }
  );
  const formsList = await listQuoteSharePointFiles({
    quoteId: lead.id,
    category: "quote_forms",
  });
  const formNames = formsList.files.map((f) => f.name);
  console.log("Forms files:", formNames);
  if (
    !formNames.some((n) => n.includes("form-software")) ||
    !formNames.some((n) => n.includes("form-explorer"))
  ) {
    console.error("FAIL: Quote Forms two-way");
    process.exit(1);
  }
  console.log("PASS: Quote Forms two-way visibility");

  console.log("\nALL SHAREPOINT QUOTE TESTS PASSED");
  console.log("Quote id:", lead.id);
  console.log("Folder webUrl:", folder.graph_web_url);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
