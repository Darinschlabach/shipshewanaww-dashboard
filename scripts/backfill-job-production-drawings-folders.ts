/**
 * Ensure "Production Drawings" exists inside every Jobs project folder.
 * Run: npx tsx scripts/backfill-job-production-drawings-folders.ts
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
  const {
    getConfiguredJobsFolder,
    microsoftGraphGet,
    microsoftGraphPost,
  } = await import("../src/lib/integrations/microsoft-graph");
  const { listSharePointFolderChildren } =
    await import("../src/lib/integrations/microsoft-graph-sharepoint-files");

  const { driveId, jobsFolderId } = getConfiguredJobsFolder();
  const projects = (
    await listSharePointFolderChildren({
      driveId,
      folderItemId: jobsFolderId,
    })
  ).filter((c) => c.folder && c.id && c.name);

  console.log(`Found ${projects.length} job project folder(s).`);
  let created = 0;
  let existed = 0;

  for (const project of projects) {
    const kids = await listSharePointFolderChildren({
      driveId,
      folderItemId: project.id!,
    });
    const has = kids.some(
      (k) => k.folder && k.name === "Production Drawings"
    );
    if (has) {
      existed += 1;
      console.log(`OK     ${project.name}`);
      continue;
    }
    await microsoftGraphPost(
      `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(project.id!)}/children`,
      {
        name: "Production Drawings",
        folder: {},
        "@microsoft.graph.conflictBehavior": "fail",
      }
    );
    created += 1;
    console.log(`CREATED ${project.name}/Production Drawings`);
  }

  console.log(`\nCreated: ${created}; already present: ${existed}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
