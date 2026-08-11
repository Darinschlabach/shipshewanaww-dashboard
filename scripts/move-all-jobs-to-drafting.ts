/**
 * Move all jobs to Drafting (stage = design) and remove production board rows.
 * Run: npx tsx scripts/move-all-jobs-to-drafting.ts
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
  const admin = createAdminClient();

  const { data: before, error: listErr } = await admin
    .from("jobs")
    .select("id, name, stage");
  if (listErr) throw new Error(listErr.message);

  const rows = before ?? [];
  console.log(`Found ${rows.length} job(s).`);
  for (const j of rows) {
    console.log(`  ${j.name}: ${j.stage}`);
  }

  const { error: updateErr } = await admin
    .from("jobs")
    .update({ stage: "design" })
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (updateErr) throw new Error(updateErr.message);

  const { error: boardErr } = await admin
    .from("production_jobs")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (boardErr) {
    console.warn("Could not clear production board:", boardErr.message);
  } else {
    console.log("Cleared production board entries.");
  }

  const { data: after } = await admin.from("jobs").select("id, name, stage");
  const stillNotDesign = (after ?? []).filter((j) => j.stage !== "design");
  console.log(`\nUpdated to Drafting: ${(after ?? []).length - stillNotDesign.length}`);
  if (stillNotDesign.length) {
    console.log("Still not Drafting:");
    for (const j of stillNotDesign) console.log(`  ${j.name}: ${j.stage}`);
    process.exit(1);
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
