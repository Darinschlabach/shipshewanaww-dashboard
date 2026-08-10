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
  const { data, error } = await admin
    .from("leads")
    .select(
      "id, project_type, status, quote_number, customer_name, created_at, graph_folder_item_id"
    )
    .order("created_at");

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  const demoish = (data ?? []).filter(
    (r) =>
      /kitchen remodel|master bathroom|mudroom|home office/i.test(
        r.project_type ?? ""
      ) || String(r.id).startsWith("c0000001-")
  );

  console.log("All leads count:", data?.length ?? 0);
  console.log("\nRoom-name / seed quotes:");
  for (const r of demoish) {
    console.log(
      JSON.stringify({
        id: r.id,
        name: r.project_type,
        status: r.status,
        quote_number: r.quote_number,
        customer: r.customer_name,
        created: r.created_at,
        folder: r.graph_folder_item_id,
      })
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
