/**
 * Re-sort files that landed in Misc into better categories by filename hints.
 * Focused cleanup after import-dropped-job-folders.ts.
 *
 * Run: npx tsx scripts/cleanup-imported-job-misc-sorting.ts
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

function guessDest(
  fileName: string
):
  | "face_frame_drawings"
  | "assembly_drawings"
  | "cv_client_drawings"
  | "appliance_specs"
  | "purchase_orders"
  | "quote_forms"
  | "provided_drawings"
  | null {
  const n = fileName.toLowerCase();
  if (/face\s*frame/.test(n)) return "face_frame_drawings";
  if (/assembly/.test(n)) return "assembly_drawings";
  if (/client\s*drawing|plan\s*drawing|3d\s/.test(n)) return "cv_client_drawings";
  if (
    /spec\s*sheet|quick[- ]reference|dishwasher|microwave|range|oven|refer|hood|appliance/.test(
      n
    )
  ) {
    return "appliance_specs";
  }
  if (
    /\bpo\b|purchase\s*order|spruce\s*lawn|accunique|mullwoods|vendor|order\s*form|cabinet\s*order/.test(
      n
    )
  ) {
    return "purchase_orders";
  }
  if (/quote|estimate|proposal|ssw\s*-|sww\s*-/.test(n)) return "quote_forms";
  if (/email|photo|img_|\.jpg$|\.jpeg$|\.png$/i.test(n)) {
    return "provided_drawings";
  }
  return null;
}

async function main() {
  loadEnvLocal();
  const { createAdminClient } = await import("../src/lib/supabase/admin");
  const { listSharePointFolderChildren, moveSharePointDriveItem } =
    await import("../src/lib/integrations/microsoft-graph-sharepoint-files");
  const { ensureJobSharePointFolders } =
    await import("../src/lib/integrations/microsoft-graph-job-folders");

  const admin = createAdminClient();
  const names = ["White", "Tohulka", "Jerry Suszko", "Macdonalds Residence"];

  const { data: jobs } = await admin
    .from("jobs")
    .select("id, name")
    .in("name", names);

  let moved = 0;
  for (const job of jobs ?? []) {
    console.log(`\n=== ${job.name} ===`);
    const ids = await ensureJobSharePointFolders(job.id);
    const dest = {
      face_frame_drawings: ids.graph_face_frame_drawings_item_id,
      assembly_drawings: ids.graph_assembly_drawings_item_id,
      cv_client_drawings: ids.graph_cv_client_drawings_item_id,
      appliance_specs: ids.graph_appliance_specs_item_id,
      purchase_orders: ids.graph_purchase_orders_item_id,
      quote_forms: ids.graph_quote_forms_item_id,
      provided_drawings: ids.graph_provided_drawings_item_id,
    } as const;

    const miscFiles = (
      await listSharePointFolderChildren({
        driveId: ids.graph_drive_id,
        folderItemId: ids.graph_misc_item_id,
      })
    ).filter((f) => f.file && f.id && f.name);

    for (const file of miscFiles) {
      const where = guessDest(file.name!);
      if (!where) continue;
      await moveSharePointDriveItem({
        driveId: ids.graph_drive_id,
        itemId: file.id!,
        newParentItemId: dest[where],
      });
      moved += 1;
      console.log(`  ${file.name} → ${where}`);
    }
  }

  console.log(`\nRe-sorted ${moved} file(s) out of Misc.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
