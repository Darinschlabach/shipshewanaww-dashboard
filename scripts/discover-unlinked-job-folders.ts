/**
 * Discover folders under SharePoint Jobs that are not yet linked as app jobs.
 * Run: npx tsx scripts/discover-unlinked-job-folders.ts
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
  const { getConfiguredJobsFolder } =
    await import("../src/lib/integrations/microsoft-graph");
  const { listSharePointFolderChildren } =
    await import("../src/lib/integrations/microsoft-graph-sharepoint-files");

  const admin = createAdminClient();
  const { driveId, jobsFolderId } = getConfiguredJobsFolder();

  const { data: jobs } = await admin
    .from("jobs")
    .select("id, name, graph_folder_item_id, customer_id");
  const { data: contractors } = await admin
    .from("contacts")
    .select("id, name, graph_jobs_folder_item_id")
    .eq("contact_type", "Contractors");

  const linkedIds = new Set(
    (jobs ?? []).map((j) => j.graph_folder_item_id).filter(Boolean)
  );
  const contractorFolderIds = new Set(
    (contractors ?? [])
      .map((c) => c.graph_jobs_folder_item_id)
      .filter(Boolean)
  );
  const jobNames = new Set((jobs ?? []).map((j) => j.name.toLowerCase()));

  const rootKids = (
    await listSharePointFolderChildren({
      driveId,
      folderItemId: jobsFolderId,
    })
  ).filter((k) => k.folder && k.id && k.name);

  console.log(`Jobs root has ${rootKids.length} folder(s)\n`);

  type Candidate = {
    name: string;
    id: string;
    parentLabel: string;
    parentId: string;
  };
  const candidates: Candidate[] = [];

  for (const kid of rootKids) {
    if (contractorFolderIds.has(kid.id!)) {
      console.log(`CONTRACTOR ${kid.name}`);
      const nested = (
        await listSharePointFolderChildren({
          driveId,
          folderItemId: kid.id!,
        })
      ).filter((k) => k.folder && k.id && k.name);
      for (const n of nested) {
        const linked = linkedIds.has(n.id!);
        const nameMatch = jobNames.has(n.name!.toLowerCase());
        console.log(
          `  ${linked ? "LINKED" : nameMatch ? "NAME-MATCH" : "NEW?"} ${n.name} (${n.id})`
        );
        if (!linked) {
          candidates.push({
            name: n.name!,
            id: n.id!,
            parentLabel: kid.name!,
            parentId: kid.id!,
          });
        }
      }
      continue;
    }

    const linked = linkedIds.has(kid.id!);
    const nameMatch = jobNames.has(kid.name!.toLowerCase());
    console.log(
      `${linked ? "LINKED" : nameMatch ? "NAME-MATCH" : "NEW?"} ${kid.name} (${kid.id})`
    );
    if (!linked) {
      candidates.push({
        name: kid.name!,
        id: kid.id!,
        parentLabel: "Jobs root",
        parentId: jobsFolderId,
      });
    }
  }

  console.log("\n=== Unlinked candidates ===");
  for (const c of candidates) {
    console.log(`- ${c.name} under ${c.parentLabel}`);
    const kids = await listSharePointFolderChildren({
      driveId,
      folderItemId: c.id,
    });
    for (const k of kids) {
      const kind = k.folder ? "DIR" : "FILE";
      console.log(`    [${kind}] ${k.name}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
