/**
 * Ensure Face Frame Drawings + Assembly Drawings exist under Production Drawings
 * for every job that already has a SharePoint project folder.
 *
 * Prerequisites: run
 *   supabase/migrations/20260810000005_jobs_graph_production_drawing_subfolders.sql
 * in the Supabase SQL Editor.
 *
 * Run: npx tsx scripts/backfill-job-production-drawing-subfolders.ts
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
  const { ensureJobSharePointFolders } =
    await import("../src/lib/integrations/microsoft-graph-job-folders");

  const admin = createAdminClient();
  const { data: jobs, error } = await admin
    .from("jobs")
    .select("id, name, graph_folder_item_id")
    .not("graph_folder_item_id", "is", null)
    .order("name");

  if (error) throw new Error(error.message);
  const list = jobs ?? [];
  console.log(`Ensuring production drawing subfolders for ${list.length} job(s)…`);

  let ok = 0;
  let failed = 0;
  for (const job of list) {
    try {
      const ids = await ensureJobSharePointFolders(job.id);
      console.log(
        `OK  ${job.name} → Face Frame=${ids.graph_face_frame_drawings_item_id.slice(0, 8)}… Assembly=${ids.graph_assembly_drawings_item_id.slice(0, 8)}…`
      );
      ok += 1;
    } catch (err) {
      failed += 1;
      console.error(
        `FAIL ${job.name}:`,
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
