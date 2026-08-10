/**
 * Graph-only verification for Quotes/SharePoint Quote Test structure.
 * Does not require DB migration columns.
 */
import { readFileSync } from "fs";
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
  const {
    getConfiguredQuotesFolder,
    microsoftGraphGet,
    microsoftGraphPost,
    microsoftGraphPutBinary,
  } = await import("../src/lib/integrations/microsoft-graph");

  const jobName = "SharePoint Quote Test";
  const subfolders = [
    "Customer Provided Drawings",
    "Quote Forms",
    "Misc",
  ] as const;

  const { driveId, quotesFolderId } = getConfiguredQuotesFolder();
  console.log("Quotes parent:", quotesFolderId);

  async function listChildren(parentId: string) {
    const { data } = await microsoftGraphGet<{
      value?: { id?: string; name?: string; folder?: unknown; file?: unknown }[];
    }>(
      `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(parentId)}/children?$top=200`
    );
    return data.value ?? [];
  }

  async function ensureFolder(parentId: string, name: string) {
    const existing = (await listChildren(parentId)).find(
      (c) => c.folder && c.name === name && c.id
    );
    if (existing?.id) return existing;
    const { data } = await microsoftGraphPost<{
      id?: string;
      name?: string;
      webUrl?: string;
    }>(
      `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(parentId)}/children`,
      {
        name,
        folder: {},
        "@microsoft.graph.conflictBehavior": "fail",
      }
    );
    return data;
  }

  const project = await ensureFolder(quotesFolderId, jobName);
  if (!project.id) throw new Error("No project folder id");
  console.log("PASS: Quotes/" + jobName, project.id, (project as { webUrl?: string }).webUrl);

  const again = await ensureFolder(quotesFolderId, jobName);
  if (again.id !== project.id) {
    throw new Error("Idempotency failed — duplicate project folder");
  }
  console.log("PASS: idempotent project folder");

  const ids: Record<string, string> = {};
  for (const name of subfolders) {
    const folder = await ensureFolder(project.id, name);
    if (!folder.id) throw new Error("missing " + name);
    ids[name] = folder.id;
  }
  const childNames = (await listChildren(project.id))
    .filter((c) => c.folder)
    .map((c) => c.name);
  for (const name of subfolders) {
    if (!childNames.includes(name)) throw new Error("missing subfolder " + name);
  }
  console.log("PASS: subfolders", childNames);

  // Misc software + explorer
  await microsoftGraphPutBinary(
    `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(ids.Misc)}:/notes-from-software.pdf:/content?@microsoft.graph.conflictBehavior=rename`,
    Buffer.from("software misc\n"),
    { contentType: "application/pdf" }
  );
  await microsoftGraphPutBinary(
    `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(ids.Misc)}:/measurements-from-explorer.pdf:/content?@microsoft.graph.conflictBehavior=rename`,
    Buffer.from("explorer misc\n"),
    { contentType: "application/pdf" }
  );
  const miscFiles = (await listChildren(ids.Misc))
    .filter((c) => c.file)
    .map((c) => c.name!);
  console.log("Misc:", miscFiles);
  if (
    !miscFiles.some((n) => n.includes("notes-from-software")) ||
    !miscFiles.some((n) => n.includes("measurements-from-explorer"))
  ) {
    throw new Error("Misc two-way failed");
  }
  console.log("PASS: Misc two-way");

  await microsoftGraphPutBinary(
    `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(ids["Customer Provided Drawings"])}:/drawing-software.pdf:/content?@microsoft.graph.conflictBehavior=rename`,
    Buffer.from("software drawing\n"),
    { contentType: "application/pdf" }
  );
  await microsoftGraphPutBinary(
    `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(ids["Customer Provided Drawings"])}:/drawing-explorer.pdf:/content?@microsoft.graph.conflictBehavior=rename`,
    Buffer.from("explorer drawing\n"),
    { contentType: "application/pdf" }
  );
  const drawingFiles = (await listChildren(ids["Customer Provided Drawings"]))
    .filter((c) => c.file)
    .map((c) => c.name!);
  console.log("Drawings:", drawingFiles);
  if (
    !drawingFiles.some((n) => n.includes("drawing-software")) ||
    !drawingFiles.some((n) => n.includes("drawing-explorer"))
  ) {
    throw new Error("Drawings two-way failed");
  }
  console.log("PASS: Customer Provided Drawings two-way");

  await microsoftGraphPutBinary(
    `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(ids["Quote Forms"])}:/form-software.pdf:/content?@microsoft.graph.conflictBehavior=rename`,
    Buffer.from("software form\n"),
    { contentType: "application/pdf" }
  );
  await microsoftGraphPutBinary(
    `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(ids["Quote Forms"])}:/form-explorer.pdf:/content?@microsoft.graph.conflictBehavior=rename`,
    Buffer.from("explorer form\n"),
    { contentType: "application/pdf" }
  );
  const formFiles = (await listChildren(ids["Quote Forms"]))
    .filter((c) => c.file)
    .map((c) => c.name!);
  console.log("Forms:", formFiles);
  if (
    !formFiles.some((n) => n.includes("form-software")) ||
    !formFiles.some((n) => n.includes("form-explorer"))
  ) {
    throw new Error("Forms two-way failed");
  }
  console.log("PASS: Quote Forms two-way");

  console.log("\nGRAPH STRUCTURE + TWO-WAY FILE TESTS PASSED");
  console.log("Project folder id:", project.id);
  console.log("webUrl:", (project as { webUrl?: string }).webUrl);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
