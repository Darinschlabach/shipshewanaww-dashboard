/**
 * E2E: Quote → Job SharePoint folder move + job subfolders + two-way files.
 * Run: npx tsx scripts/test-quote-to-job-sharepoint.ts
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
  const { convertQuoteSharePointFolderToJob, JOB_SHAREPOINT_SUBFOLDERS } =
    await import("../src/lib/integrations/microsoft-graph-job-folders");
  const {
    uploadFileToSharePointFolder,
    listSharePointFolderChildren,
  } = await import("../src/lib/integrations/microsoft-graph-sharepoint-files");
  const {
    getConfiguredJobsFolder,
    getConfiguredQuotesFolder,
    microsoftGraphGet,
    microsoftGraphPutBinary,
  } = await import("../src/lib/integrations/microsoft-graph");
  const { uploadJobSharePointFiles, listJobSharePointFiles } =
    await import("../src/lib/integrations/microsoft-graph-job-files");

  const admin = createAdminClient();
  const jobName = "Job Folder Test";

  // Schema check
  const { error: schemaError } = await admin
    .from("jobs")
    .select("id, graph_folder_item_id")
    .limit(1);
  if (schemaError) {
    console.error(
      "SCHEMA ERROR — run supabase/migrations/20260810000003_jobs_graph_folder_ids.sql first:",
      schemaError.message
    );
    process.exit(1);
  }

  // Clean prior test lead/job
  const { data: oldLeads } = await admin
    .from("leads")
    .select("id, converted_job_id")
    .eq("project_type", jobName);
  for (const lead of oldLeads ?? []) {
    if (lead.converted_job_id) {
      await admin.from("jobs").delete().eq("id", lead.converted_job_id);
    }
    await admin.from("leads").delete().eq("id", lead.id);
  }
  const { data: oldJobs } = await admin
    .from("jobs")
    .select("id")
    .eq("name", jobName);
  for (const job of oldJobs ?? []) {
    await admin.from("jobs").delete().eq("id", job.id);
  }

  const { data: lead, error: leadErr } = await admin
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
  if (leadErr || !lead) {
    console.error("Create quote failed:", leadErr?.message);
    process.exit(1);
  }
  console.log("Created quote", lead.id);

  const quoteFolder = await ensureQuoteSharePointFolders(lead.id);
  console.log("Quote folder", quoteFolder.graph_folder_item_id);

  const { driveId, quotesFolderId } = getConfiguredQuotesFolder();
  const { jobsFolderId } = getConfiguredJobsFolder();

  const quoteChildren = await listSharePointFolderChildren({
    driveId: quoteFolder.graph_drive_id,
    folderItemId: quoteFolder.graph_folder_item_id,
  });
  const quoteSubNames = quoteChildren
    .filter((c) => c.folder)
    .map((c) => c.name)
    .sort();
  console.log("Quote subfolders:", quoteSubNames);
  for (const name of ["Customer Provided Drawings", "Quotes", "Misc"]) {
    if (!quoteSubNames.includes(name)) {
      throw new Error(`Missing quote subfolder: ${name}`);
    }
  }
  console.log("PASS: quote has 3 required folders");

  await uploadFileToSharePointFolder({
    driveId: quoteFolder.graph_drive_id,
    folderItemId: quoteFolder.graph_misc_item_id,
    fileName: "misc-before-convert.pdf",
    body: Buffer.from("misc before convert\n"),
    contentType: "application/pdf",
  });
  console.log("PASS: uploaded misc-before-convert.pdf");

  const { data: job, error: jobErr } = await admin
    .from("jobs")
    .insert({
      name: jobName,
      stage: "design",
      total_value: 0,
      notes: "",
    })
    .select("id")
    .single();
  if (jobErr || !job) {
    console.error("Create job failed:", jobErr?.message);
    process.exit(1);
  }
  console.log("Created job", job.id);

  const converted = await convertQuoteSharePointFolderToJob({
    quoteId: lead.id,
    jobId: job.id,
  });
  console.log("Converted folder", converted.graph_folder_item_id);

  if (converted.graph_folder_item_id !== quoteFolder.graph_folder_item_id) {
    throw new Error("DriveItem ID changed during move — expected same ID");
  }
  console.log("PASS: DriveItem ID preserved");

  // Verify not under Quotes
  const { data: afterMove } = await microsoftGraphGet<{
    parentReference?: { id?: string };
    name?: string;
  }>(
    `/drives/${encodeURIComponent(converted.graph_drive_id)}/items/${encodeURIComponent(converted.graph_folder_item_id)}?$select=id,name,parentReference`
  );
  if (afterMove.parentReference?.id === quotesFolderId) {
    throw new Error("Folder still under Quotes parent");
  }
  if (afterMove.parentReference?.id !== jobsFolderId) {
    throw new Error(
      `Folder parent is not Jobs parent (got ${afterMove.parentReference?.id})`
    );
  }
  console.log("PASS: folder moved under Jobs parent");

  // Confirm not listed as child of Quotes by this ID
  const quotesChildren = await listSharePointFolderChildren({
    driveId,
    folderItemId: quotesFolderId,
  });
  if (quotesChildren.some((c) => c.id === converted.graph_folder_item_id)) {
    throw new Error("Folder still appears under Quotes children");
  }
  console.log("PASS: disappeared from Quotes parent");

  const jobChildren = await listSharePointFolderChildren({
    driveId: converted.graph_drive_id,
    folderItemId: converted.graph_folder_item_id,
  });
  const jobSubNames = jobChildren
    .filter((c) => c.folder)
    .map((c) => c.name!)
    .sort();
  console.log("Job subfolders:", jobSubNames);
  for (const name of Object.values(JOB_SHAREPOINT_SUBFOLDERS)) {
    if (!jobSubNames.includes(name)) {
      throw new Error(`Missing job subfolder: ${name}`);
    }
  }
  console.log("PASS: all 7 job folders present");

  const miscFiles = await listSharePointFolderChildren({
    driveId: converted.graph_drive_id,
    folderItemId: converted.graph_misc_item_id,
  });
  if (!miscFiles.some((f) => f.file && f.name?.includes("misc-before-convert"))) {
    throw new Error("Misc file lost after conversion");
  }
  console.log("PASS: Misc file preserved");

  const upload = await uploadJobSharePointFiles({
    jobId: job.id,
    category: "appliance_specs",
    files: [
      new File(
        [Buffer.from("appliance from software\n")],
        "appliance-software.pdf",
        { type: "application/pdf" }
      ),
    ],
    uploadedByName: "E2E",
  });
  if (upload.error) throw new Error(upload.error);
  console.log("PASS: uploaded appliance-software.pdf via job API path");

  const applianceList = await listJobSharePointFiles({
    jobId: job.id,
    category: "appliance_specs",
  });
  if (
    !applianceList.files.some((f) => f.name.includes("appliance-software"))
  ) {
    throw new Error("Appliance Specs software file missing");
  }
  console.log("PASS: Appliance Specs software→SharePoint");

  await microsoftGraphPutBinary(
    `/drives/${encodeURIComponent(converted.graph_drive_id)}/items/${encodeURIComponent(converted.graph_cv_client_drawings_item_id)}:/cv-explorer.pdf:/content?@microsoft.graph.conflictBehavior=rename`,
    Buffer.from("cv from explorer\n"),
    { contentType: "application/pdf" }
  );
  const cvList = await listJobSharePointFiles({
    jobId: job.id,
    category: "cv_client_drawings",
  });
  if (!cvList.files.some((f) => f.name.includes("cv-explorer"))) {
    throw new Error("CV Client Drawings explorer file missing");
  }
  console.log("PASS: CV Client Drawings File Explorer→software");

  // Idempotent retry
  const again = await convertQuoteSharePointFolderToJob({
    quoteId: lead.id,
    jobId: job.id,
  });
  if (again.graph_folder_item_id !== converted.graph_folder_item_id) {
    throw new Error("Retry created a different folder ID");
  }
  console.log("PASS: convert retry is idempotent");

  await admin
    .from("leads")
    .update({
      status: "converted",
      converted_job_id: job.id,
      job_id: job.id,
    })
    .eq("id", lead.id);

  console.log("\nALL QUOTE→JOB SHAREPOINT TESTS PASSED");
  console.log("Job id:", job.id);
  console.log("Folder webUrl:", converted.graph_web_url);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
