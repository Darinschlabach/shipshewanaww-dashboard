/**
 * Graph-level Quote→Job move test (no jobs.graph_* columns required).
 * Still creates a real quote lead + SharePoint folders.
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
  const { JOB_SHAREPOINT_SUBFOLDERS } =
    await import("../src/lib/integrations/microsoft-graph-job-folders");
  const {
    moveSharePointDriveItem,
    listSharePointFolderChildren,
    uploadFileToSharePointFolder,
  } = await import("../src/lib/integrations/microsoft-graph-sharepoint-files");
  const {
    getConfiguredJobsFolder,
    getConfiguredQuotesFolder,
    microsoftGraphGet,
    microsoftGraphPost,
    microsoftGraphPutBinary,
  } = await import("../src/lib/integrations/microsoft-graph");

  const admin = createAdminClient();
  const jobName = "Job Folder Test";

  const { data: old } = await admin
    .from("leads")
    .select("id")
    .eq("project_type", jobName);
  for (const row of old ?? []) {
    await admin.from("leads").delete().eq("id", row.id);
  }

  const { data: lead, error } = await admin
    .from("leads")
    .insert({
      customer_name: "Job Folder Test Customer",
      project_type: jobName,
      est_value: 0,
      status: "draft",
      quote_number: `Q-TEST-JOB-${Date.now()}`,
    })
    .select("id")
    .single();
  if (error || !lead) throw new Error(error?.message ?? "lead create failed");

  const quote = await ensureQuoteSharePointFolders(lead.id);
  const { driveId, quotesFolderId } = getConfiguredQuotesFolder();
  const { jobsFolderId } = getConfiguredJobsFolder();

  const before = await listSharePointFolderChildren({
    driveId: quote.graph_drive_id,
    folderItemId: quote.graph_folder_item_id,
  });
  for (const name of ["Customer Provided Drawings", "Quotes", "Misc"]) {
    if (!before.some((c) => c.folder && c.name === name)) {
      throw new Error(`Missing ${name}`);
    }
  }
  console.log("PASS: quote structure");

  await uploadFileToSharePointFolder({
    driveId: quote.graph_drive_id,
    folderItemId: quote.graph_misc_item_id,
    fileName: "misc-before-convert.pdf",
    body: Buffer.from("keep me\n"),
    contentType: "application/pdf",
  });
  console.log("PASS: misc file uploaded");

  const moved = await moveSharePointDriveItem({
    driveId: quote.graph_drive_id,
    itemId: quote.graph_folder_item_id,
    newParentItemId: jobsFolderId,
    newName: jobName,
  });
  if (moved.id !== quote.graph_folder_item_id) {
    throw new Error("DriveItem ID changed");
  }
  console.log("PASS: moved with same DriveItem ID");

  const { data: verified } = await microsoftGraphGet<{
    parentReference?: { id?: string };
  }>(
    `/drives/${encodeURIComponent(quote.graph_drive_id)}/items/${encodeURIComponent(moved.id!)}?$select=parentReference`
  );
  if (verified.parentReference?.id !== jobsFolderId) {
    throw new Error("Not under Jobs");
  }
  if (verified.parentReference?.id === quotesFolderId) {
    throw new Error("Still under Quotes");
  }
  console.log("PASS: under Jobs, gone from Quotes parent");

  async function ensureChild(name: string) {
    const kids = await listSharePointFolderChildren({
      driveId: quote.graph_drive_id,
      folderItemId: moved.id!,
    });
    const existing = kids.find((k) => k.folder && k.name === name);
    if (existing?.id) return existing.id;
    const { data } = await microsoftGraphPost<{ id?: string }>(
      `/drives/${encodeURIComponent(quote.graph_drive_id)}/items/${encodeURIComponent(moved.id!)}/children`,
      {
        name,
        folder: {},
        "@microsoft.graph.conflictBehavior": "fail",
      }
    );
    return data.id!;
  }

  const ids: Record<string, string> = {};
  for (const name of Object.values(JOB_SHAREPOINT_SUBFOLDERS)) {
    ids[name] = await ensureChild(name);
  }
  // idempotent second pass
  for (const name of Object.values(JOB_SHAREPOINT_SUBFOLDERS)) {
    const again = await ensureChild(name);
    if (again !== ids[name]) throw new Error(`Duplicate folder created: ${name}`);
  }
  console.log("PASS: 7 folders present, no duplicates on retry");

  const misc = await listSharePointFolderChildren({
    driveId: quote.graph_drive_id,
    folderItemId: ids.Misc,
  });
  if (!misc.some((f) => f.name?.includes("misc-before-convert"))) {
    throw new Error("Misc file lost");
  }
  console.log("PASS: misc file preserved");

  await uploadFileToSharePointFolder({
    driveId: quote.graph_drive_id,
    folderItemId: ids["Appliance Specs"],
    fileName: "appliance-software.pdf",
    body: Buffer.from("appliance\n"),
    contentType: "application/pdf",
  });
  const appliances = await listSharePointFolderChildren({
    driveId: quote.graph_drive_id,
    folderItemId: ids["Appliance Specs"],
  });
  if (!appliances.some((f) => f.name?.includes("appliance-software"))) {
    throw new Error("appliance upload missing");
  }
  console.log("PASS: Appliance Specs software upload");

  await microsoftGraphPutBinary(
    `/drives/${encodeURIComponent(quote.graph_drive_id)}/items/${encodeURIComponent(ids["CV Client Drawings"])}:/cv-explorer.pdf:/content?@microsoft.graph.conflictBehavior=rename`,
    Buffer.from("cv explorer\n"),
    { contentType: "application/pdf" }
  );
  const cvs = await listSharePointFolderChildren({
    driveId: quote.graph_drive_id,
    folderItemId: ids["CV Client Drawings"],
  });
  if (!cvs.some((f) => f.name?.includes("cv-explorer"))) {
    throw new Error("cv explorer missing");
  }
  console.log("PASS: CV Client Drawings explorer upload visible");

  console.log("\nGRAPH QUOTE→JOB FLOW TESTS PASSED");
  console.log("Folder id:", moved.id);
  console.log(
    "NOTE: Run 20260810000003_jobs_graph_folder_ids.sql to enable job DB linking + Files UI path."
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
