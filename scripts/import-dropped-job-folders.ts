/**
 * Import SharePoint job folders that were dropped into Jobs (non-template layout):
 * create app jobs, ensure template folders, move files into matching categories.
 *
 * Run: npx tsx scripts/import-dropped-job-folders.ts
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

type DestKey =
  | "provided_drawings"
  | "quote_forms"
  | "misc"
  | "face_frame_drawings"
  | "assembly_drawings"
  | "cv_client_drawings"
  | "appliance_specs"
  | "purchase_orders"
  | "invoices"
  | "skip_template";

function normalizeFolderName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function mapSourceFolderToDest(name: string): DestKey | "recurse_production" | null {
  const n = normalizeFolderName(name);

  if (
    n === "customer provided drawings" ||
    n === "customer provided drawings and photos" ||
    n === "customer drawings" ||
    n === "customer provided drawings photos"
  ) {
    return "provided_drawings";
  }
  if (n === "quotes" || n === "quote" || n === "quote forms") {
    return "quote_forms";
  }
  if (n === "misc" || n === "miscellaneous") return "misc";
  if (n === "production drawings") return "recurse_production";
  if (n === "face frame drawings" || n === "faceframe drawings") {
    return "face_frame_drawings";
  }
  if (n === "assembly drawings") return "assembly_drawings";
  if (
    n === "cv client drawings" ||
    n === "cabinet vision client drawings" ||
    n === "client drawings"
  ) {
    return "cv_client_drawings";
  }
  if (n === "appliance specs" || n === "appliances") {
    return "appliance_specs";
  }
  if (
    n === "purchase orders" ||
    n === "vendor pos" ||
    n === "vendor po s" ||
    n === "pos"
  ) {
    return "purchase_orders";
  }
  if (n === "invoices" || n === "invoice") return "invoices";

  // Template folders themselves — don't treat as legacy sources to delete/remap
  if (
    n === "customer provided drawings" ||
    n === "production drawings"
  ) {
    return "skip_template";
  }

  // Everything else (Job Specs, Parts List, Door & Drawer List, room folders, etc.)
  // → Misc
  return "misc";
}

async function main() {
  loadEnvLocal();
  const { createAdminClient } = await import("../src/lib/supabase/admin");
  const {
    getConfiguredJobsFolder,
    microsoftGraphGet,
  } = await import("../src/lib/integrations/microsoft-graph");
  const {
    listSharePointFolderChildren,
    moveSharePointDriveItem,
    deleteSharePointDriveItem,
  } = await import("../src/lib/integrations/microsoft-graph-sharepoint-files");
  const {
    ensureJobSharePointFolders,
    JOB_SHAREPOINT_SUBFOLDERS,
    PRODUCTION_DRAWING_SUBFOLDERS,
  } = await import("../src/lib/integrations/microsoft-graph-job-folders");

  const admin = createAdminClient();
  const { driveId, jobsFolderId } = getConfiguredJobsFolder();

  const { data: jobs } = await admin
    .from("jobs")
    .select("id, name, graph_folder_item_id");
  const { data: contractors } = await admin
    .from("contacts")
    .select("id, name, graph_jobs_folder_item_id")
    .eq("contact_type", "Contractors");

  const linkedIds = new Set(
    (jobs ?? []).map((j) => j.graph_folder_item_id).filter(Boolean) as string[]
  );
  const contractorFolderIds = new Set(
    (contractors ?? [])
      .map((c) => c.graph_jobs_folder_item_id)
      .filter(Boolean) as string[]
  );
  const jobsByName = new Map(
    (jobs ?? []).map((j) => [j.name.toLowerCase(), j] as const)
  );

  const rootKids = (
    await listSharePointFolderChildren({
      driveId,
      folderItemId: jobsFolderId,
    })
  ).filter((k) => k.folder && k.id && k.name);

  type Candidate = { name: string; folderId: string };
  const candidates: Candidate[] = [];

  for (const kid of rootKids) {
    if (contractorFolderIds.has(kid.id!)) continue;
    if (linkedIds.has(kid.id!)) continue;
    candidates.push({ name: kid.name!, folderId: kid.id! });
  }

  console.log(`Found ${candidates.length} unlinked Jobs-root folder(s) to import.\n`);

  const TEMPLATE_NAMES = new Set<string>([
    ...Object.values(JOB_SHAREPOINT_SUBFOLDERS),
    ...Object.values(PRODUCTION_DRAWING_SUBFOLDERS),
  ]);

  async function moveAllFilesRecursive(
    sourceFolderId: string,
    destFolderId: string,
    label: string
  ): Promise<number> {
    let moved = 0;
    const kids = await listSharePointFolderChildren({
      driveId,
      folderItemId: sourceFolderId,
    });

    for (const kid of kids) {
      if (!kid.id || !kid.name) continue;
      if (kid.folder) {
        // Nested legacy folder → flatten files into dest
        moved += await moveAllFilesRecursive(kid.id, destFolderId, `${label}/${kid.name}`);
        // Try delete empty nested folder later
        continue;
      }
      if (!kid.file) continue;
      try {
        await moveSharePointDriveItem({
          driveId,
          itemId: kid.id,
          newParentItemId: destFolderId,
        });
        moved += 1;
        console.log(`    move ${label}/${kid.name}`);
      } catch (err) {
        // Name collision — rename then move
        const stamp = Date.now().toString().slice(-4);
        const parts = kid.name.split(".");
        const renamed =
          parts.length > 1
            ? `${parts.slice(0, -1).join(".")} (${stamp}).${parts[parts.length - 1]}`
            : `${kid.name} (${stamp})`;
        try {
          await moveSharePointDriveItem({
            driveId,
            itemId: kid.id,
            newParentItemId: destFolderId,
            newName: renamed,
          });
          moved += 1;
          console.log(`    move ${label}/${kid.name} → ${renamed}`);
        } catch (err2) {
          console.error(
            `    FAIL move ${label}/${kid.name}:`,
            err2 instanceof Error ? err2.message : err2
          );
        }
      }
    }
    return moved;
  }

  async function deleteEmptyFolderTree(folderId: string): Promise<void> {
    const kids = await listSharePointFolderChildren({
      driveId,
      folderItemId: folderId,
    });
    for (const kid of kids) {
      if (kid.folder && kid.id) {
        await deleteEmptyFolderTree(kid.id);
      }
    }
    const after = await listSharePointFolderChildren({
      driveId,
      folderItemId: folderId,
    });
    if (after.length === 0) {
      await deleteSharePointDriveItem({ driveId, itemId: folderId });
    }
  }

  async function reshapeProjectFolder(
    projectFolderId: string,
    ids: Awaited<ReturnType<typeof ensureJobSharePointFolders>>
  ): Promise<number> {
    const dest: Record<DestKey, string> = {
      provided_drawings: ids.graph_provided_drawings_item_id,
      quote_forms: ids.graph_quote_forms_item_id,
      misc: ids.graph_misc_item_id,
      face_frame_drawings: ids.graph_face_frame_drawings_item_id,
      assembly_drawings: ids.graph_assembly_drawings_item_id,
      cv_client_drawings: ids.graph_cv_client_drawings_item_id,
      appliance_specs: ids.graph_appliance_specs_item_id,
      purchase_orders: ids.graph_purchase_orders_item_id,
      invoices: ids.graph_invoices_item_id,
      skip_template: projectFolderId,
    };

    let totalMoved = 0;
    const kids = await listSharePointFolderChildren({
      driveId,
      folderItemId: projectFolderId,
    });

    // Loose files at project root → Misc
    for (const kid of kids) {
      if (kid.file && kid.id && kid.name) {
        try {
          await moveSharePointDriveItem({
            driveId,
            itemId: kid.id,
            newParentItemId: dest.misc,
          });
          totalMoved += 1;
          console.log(`    move root/${kid.name} → Misc`);
        } catch (err) {
          console.error(
            `    FAIL root file ${kid.name}:`,
            err instanceof Error ? err.message : err
          );
        }
      }
    }

    // Refresh children after root file moves
    const folders = (
      await listSharePointFolderChildren({
        driveId,
        folderItemId: projectFolderId,
      })
    ).filter((k) => k.folder && k.id && k.name);

    for (const folder of folders) {
      const mapped = mapSourceFolderToDest(folder.name!);

      // Already a template top-level folder — may still need production nesting cleanup
      if (
        folder.name === JOB_SHAREPOINT_SUBFOLDERS.production_drawings ||
        mapped === "recurse_production"
      ) {
        // If this IS our template production folder, only move misplaced siblings inside it
        if (folder.id === ids.graph_production_drawings_item_id) {
          const prodKids = await listSharePointFolderChildren({
            driveId,
            folderItemId: folder.id!,
          });
          for (const pk of prodKids) {
            if (!pk.folder || !pk.id || !pk.name) {
              if (pk.file && pk.id) {
                // Loose file in Production Drawings → Misc? or leave. Put in Misc for safety? Better Face Frame? → Misc
                await moveSharePointDriveItem({
                  driveId,
                  itemId: pk.id,
                  newParentItemId: dest.misc,
                });
                totalMoved += 1;
              }
              continue;
            }
            const nestedMap = mapSourceFolderToDest(pk.name);
            if (
              nestedMap === "face_frame_drawings" &&
              pk.id !== ids.graph_face_frame_drawings_item_id
            ) {
              totalMoved += await moveAllFilesRecursive(
                pk.id,
                dest.face_frame_drawings,
                pk.name
              );
              try {
                await deleteEmptyFolderTree(pk.id);
              } catch {
                /* ignore */
              }
            } else if (
              nestedMap === "assembly_drawings" &&
              pk.id !== ids.graph_assembly_drawings_item_id
            ) {
              totalMoved += await moveAllFilesRecursive(
                pk.id,
                dest.assembly_drawings,
                pk.name
              );
              try {
                await deleteEmptyFolderTree(pk.id);
              } catch {
                /* ignore */
              }
            } else if (
              pk.id !== ids.graph_face_frame_drawings_item_id &&
              pk.id !== ids.graph_assembly_drawings_item_id
            ) {
              // Unknown nested under Production → Misc
              totalMoved += await moveAllFilesRecursive(
                pk.id,
                dest.misc,
                pk.name
              );
              try {
                await deleteEmptyFolderTree(pk.id);
              } catch {
                /* ignore */
              }
            }
          }
          continue;
        }

        // Legacy Production Drawings folder (different id) — map contents then delete
        const prodKids = await listSharePointFolderChildren({
          driveId,
          folderItemId: folder.id!,
        });
        for (const pk of prodKids) {
          if (pk.folder && pk.id && pk.name) {
            const nestedMap = mapSourceFolderToDest(pk.name);
            if (nestedMap === "face_frame_drawings") {
              totalMoved += await moveAllFilesRecursive(
                pk.id,
                dest.face_frame_drawings,
                pk.name
              );
            } else if (nestedMap === "assembly_drawings") {
              totalMoved += await moveAllFilesRecursive(
                pk.id,
                dest.assembly_drawings,
                pk.name
              );
            } else {
              totalMoved += await moveAllFilesRecursive(
                pk.id,
                dest.misc,
                pk.name
              );
            }
          } else if (pk.file && pk.id) {
            await moveSharePointDriveItem({
              driveId,
              itemId: pk.id,
              newParentItemId: dest.misc,
            });
            totalMoved += 1;
          }
        }
        try {
          await deleteEmptyFolderTree(folder.id!);
        } catch {
          /* ignore */
        }
        continue;
      }

      // Template destination folders we just created — leave in place
      const isExactTemplateDest =
        folder.id === ids.graph_provided_drawings_item_id ||
        folder.id === ids.graph_quote_forms_item_id ||
        folder.id === ids.graph_misc_item_id ||
        folder.id === ids.graph_production_drawings_item_id ||
        folder.id === ids.graph_cv_client_drawings_item_id ||
        folder.id === ids.graph_appliance_specs_item_id ||
        folder.id === ids.graph_purchase_orders_item_id ||
        folder.id === ids.graph_invoices_item_id;

      if (isExactTemplateDest) continue;

      if (!mapped || mapped === "skip_template") continue;

      const destId = dest[mapped];
      // If source folder name matches template but is a different DriveItem
      // (legacy duplicate), move contents into the real template folder.
      totalMoved += await moveAllFilesRecursive(
        folder.id!,
        destId,
        folder.name!
      );
      try {
        await deleteEmptyFolderTree(folder.id!);
        console.log(`    removed empty legacy folder: ${folder.name}`);
      } catch (err) {
        console.log(
          `    keep legacy folder ${folder.name} (not empty or delete failed)`
        );
      }
    }

    return totalMoved;
  }

  let created = 0;
  let reshapedExisting = 0;
  let failed = 0;

  for (const candidate of candidates) {
    console.log(`\n=== ${candidate.name} ===`);
    try {
      // Verify folder still exists
      await microsoftGraphGet(
        `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(candidate.folderId)}?$select=id,name,webUrl`,
        { timeoutMs: 20_000 }
      );

      const existing = jobsByName.get(candidate.name.toLowerCase());
      let jobId: string;

      if (existing?.id && existing.graph_folder_item_id) {
        // Duplicate name — merge imported folder into existing job folder, then delete orphan
        console.log(
          `  existing job found (${existing.id}); merging into linked folder then removing orphan`
        );
        jobId = existing.id;
        const ids = await ensureJobSharePointFolders(jobId);

        // Move everything from orphan project into existing template via temp reshape:
        // First reshape orphan in place into template folders on the orphan,
        // then move template category contents into the real job folders.
        // Simpler: move all orphan files into matching categories on the EXISTING job.
        const orphanKids = await listSharePointFolderChildren({
          driveId,
          folderItemId: candidate.folderId,
        });

        // Ensure template on orphan too so mapping is easier — actually map directly
        for (const kid of orphanKids) {
          if (kid.file && kid.id) {
            await moveSharePointDriveItem({
              driveId,
              itemId: kid.id,
              newParentItemId: ids.graph_misc_item_id,
            });
          }
        }
        const orphanFolders = (
          await listSharePointFolderChildren({
            driveId,
            folderItemId: candidate.folderId,
          })
        ).filter((k) => k.folder && k.id && k.name);

        for (const folder of orphanFolders) {
          const mapped = mapSourceFolderToDest(folder.name!);
          let destId = ids.graph_misc_item_id;
          if (mapped === "provided_drawings") destId = ids.graph_provided_drawings_item_id;
          else if (mapped === "quote_forms") destId = ids.graph_quote_forms_item_id;
          else if (mapped === "face_frame_drawings")
            destId = ids.graph_face_frame_drawings_item_id;
          else if (mapped === "assembly_drawings")
            destId = ids.graph_assembly_drawings_item_id;
          else if (mapped === "cv_client_drawings")
            destId = ids.graph_cv_client_drawings_item_id;
          else if (mapped === "appliance_specs")
            destId = ids.graph_appliance_specs_item_id;
          else if (mapped === "purchase_orders")
            destId = ids.graph_purchase_orders_item_id;
          else if (mapped === "invoices") destId = ids.graph_invoices_item_id;
          else if (mapped === "recurse_production") {
            const prodKids = await listSharePointFolderChildren({
              driveId,
              folderItemId: folder.id!,
            });
            for (const pk of prodKids) {
              if (pk.folder && pk.id && pk.name) {
                const nm = mapSourceFolderToDest(pk.name);
                const d =
                  nm === "face_frame_drawings"
                    ? ids.graph_face_frame_drawings_item_id
                    : nm === "assembly_drawings"
                      ? ids.graph_assembly_drawings_item_id
                      : ids.graph_misc_item_id;
                await moveAllFilesRecursive(pk.id, d, pk.name);
              } else if (pk.file && pk.id) {
                await moveSharePointDriveItem({
                  driveId,
                  itemId: pk.id,
                  newParentItemId: ids.graph_misc_item_id,
                });
              }
            }
            try {
              await deleteEmptyFolderTree(folder.id!);
            } catch {
              /* ignore */
            }
            continue;
          }
          await moveAllFilesRecursive(folder.id!, destId, folder.name!);
          try {
            await deleteEmptyFolderTree(folder.id!);
          } catch {
            /* ignore */
          }
        }
        try {
          await deleteEmptyFolderTree(candidate.folderId);
          console.log(`  deleted orphan folder ${candidate.name}`);
        } catch {
          console.log(`  orphan folder not empty; left in place`);
        }
        reshapedExisting += 1;
        continue;
      }

      // Create new job linked to this folder
      const { data: job, error: jobErr } = await admin
        .from("jobs")
        .insert({
          name: candidate.name,
          customer_id: null,
          stage: "design",
          total_value: 0,
          notes: "Imported from SharePoint Jobs folder.",
          graph_drive_id: driveId,
          graph_folder_item_id: candidate.folderId,
        })
        .select("id, name")
        .single();

      if (jobErr || !job) {
        throw new Error(jobErr?.message || "Job insert failed");
      }
      jobId = job.id;

      const ids = await ensureJobSharePointFolders(jobId);
      const moved = await reshapeProjectFolder(candidate.folderId, ids);
      console.log(`  created job ${jobId}; moved ${moved} file(s)`);
      created += 1;
      jobsByName.set(candidate.name.toLowerCase(), {
        id: jobId,
        name: candidate.name,
        graph_folder_item_id: candidate.folderId,
      });
      linkedIds.add(candidate.folderId);
    } catch (err) {
      failed += 1;
      console.error(
        `  FAIL ${candidate.name}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  console.log("\n--- Summary ---");
  console.log(`Created jobs: ${created}`);
  console.log(`Merged into existing: ${reshapedExisting}`);
  console.log(`Failed: ${failed}`);
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
