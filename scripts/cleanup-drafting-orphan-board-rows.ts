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

  const { data: designJobs, error } = await admin
    .from("jobs")
    .select("id, name")
    .eq("stage", "design");
  if (error) throw new Error(error.message);

  const ids = (designJobs ?? []).map((j) => j.id);
  console.log(`Drafting jobs: ${ids.length}`);

  const { data: board } = await admin
    .from("production_jobs")
    .select("id, job_id")
    .in("job_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

  console.log(`Orphan board rows: ${(board ?? []).length}`);
  for (const row of board ?? []) {
    const job = (designJobs ?? []).find((j) => j.id === row.job_id);
    console.log(`  remove ${job?.name ?? row.job_id}`);
  }

  if ((board ?? []).length > 0) {
    const { error: delErr } = await admin
      .from("production_jobs")
      .delete()
      .in(
        "job_id",
        (board ?? []).map((b) => b.job_id)
      );
    if (delErr) throw new Error(delErr.message);
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
