import {
  resolveJobsParentFolderId,
} from "@/lib/integrations/microsoft-graph-contractor-folders";
import { moveSharePointDriveItem } from "@/lib/integrations/microsoft-graph-sharepoint-files";
import {
  ensureQuoteSharePointFolders,
  sanitizeSharePointFolderName,
  type QuoteGraphFolderIds,
} from "@/lib/integrations/microsoft-graph-quote-folders";
import type { JobFilesTab } from "@/lib/files";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  MicrosoftGraphAuthError,
  getConfiguredJobsFolder,
  microsoftGraphGet,
  microsoftGraphPatch,
  microsoftGraphPost,
} from "@/lib/integrations/microsoft-graph";

/** All SharePoint folders for a Job project. */
export const JOB_SHAREPOINT_SUBFOLDERS = {
  provided_drawings: "Customer Provided Drawings",
  quote_forms: "Quotes",
  misc: "Misc",
  production_drawings: "Production Drawings",
  cv_client_drawings: "CV Client Drawings",
  appliance_specs: "Appliance Specs",
  purchase_orders: "Purchase Orders",
  invoices: "Invoices",
} as const satisfies Partial<Record<JobFilesTab, string>>;

/** Nested folders inside Production Drawings. */
export const PRODUCTION_DRAWING_SUBFOLDERS = {
  face_frame_drawings: "Face Frame Drawings",
  assembly_drawings: "Assembly Drawings",
} as const;

export type ProductionDrawingSubfolder =
  keyof typeof PRODUCTION_DRAWING_SUBFOLDERS;

export type JobSharePointCategory = keyof typeof JOB_SHAREPOINT_SUBFOLDERS;

export type JobGraphFolderIds = {
  graph_drive_id: string;
  graph_folder_item_id: string;
  graph_web_url: string | null;
  graph_provided_drawings_item_id: string;
  graph_quote_forms_item_id: string;
  graph_misc_item_id: string;
  graph_production_drawings_item_id: string;
  graph_face_frame_drawings_item_id: string;
  graph_assembly_drawings_item_id: string;
  graph_cv_client_drawings_item_id: string;
  graph_appliance_specs_item_id: string;
  graph_purchase_orders_item_id: string;
  graph_invoices_item_id: string;
};

type GraphDriveItem = {
  id?: string;
  name?: string;
  webUrl?: string;
  folder?: Record<string, unknown>;
  parentReference?: { driveId?: string; id?: string };
};

type GraphListResponse = {
  value?: GraphDriveItem[];
  "@odata.nextLink"?: string;
};

type JobGraphRow = {
  id: string;
  name: string;
  customer_id: string | null;
  graph_drive_id: string | null;
  graph_folder_item_id: string | null;
  graph_web_url: string | null;
  graph_provided_drawings_item_id: string | null;
  graph_quote_forms_item_id: string | null;
  graph_misc_item_id: string | null;
  graph_production_drawings_item_id: string | null;
  graph_face_frame_drawings_item_id: string | null;
  graph_assembly_drawings_item_id: string | null;
  graph_cv_client_drawings_item_id: string | null;
  graph_appliance_specs_item_id: string | null;
  graph_purchase_orders_item_id: string | null;
  graph_invoices_item_id: string | null;
};

export function isJobSharePointCategory(
  value: string
): value is JobSharePointCategory {
  return value in JOB_SHAREPOINT_SUBFOLDERS;
}

export function jobCategoryFolderItemId(
  ids: JobGraphFolderIds,
  category: JobSharePointCategory
): string {
  switch (category) {
    case "provided_drawings":
      return ids.graph_provided_drawings_item_id;
    case "quote_forms":
      return ids.graph_quote_forms_item_id;
    case "misc":
      return ids.graph_misc_item_id;
    case "production_drawings":
      return ids.graph_production_drawings_item_id;
    case "cv_client_drawings":
      return ids.graph_cv_client_drawings_item_id;
    case "appliance_specs":
      return ids.graph_appliance_specs_item_id;
    case "purchase_orders":
      return ids.graph_purchase_orders_item_id;
    case "invoices":
      return ids.graph_invoices_item_id;
  }
}

export function productionDrawingSubfolderItemId(
  ids: JobGraphFolderIds,
  subfolder: ProductionDrawingSubfolder
): string {
  switch (subfolder) {
    case "face_frame_drawings":
      return ids.graph_face_frame_drawings_item_id;
    case "assembly_drawings":
      return ids.graph_assembly_drawings_item_id;
  }
}

export function isProductionDrawingSubfolder(
  value: string
): value is ProductionDrawingSubfolder {
  return value in PRODUCTION_DRAWING_SUBFOLDERS;
}

async function listAllChildren(
  driveId: string,
  parentItemId: string
): Promise<GraphDriveItem[]> {
  const items: GraphDriveItem[] = [];
  let next: string | null =
    `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(parentItemId)}/children?$top=200&$select=id,name,webUrl,folder,parentReference`;

  while (next) {
    const page: { data: GraphListResponse; status: number } =
      await microsoftGraphGet<GraphListResponse>(next, { timeoutMs: 30_000 });
    items.push(...(page.data.value ?? []));
    next = page.data["@odata.nextLink"] ?? null;
  }
  return items;
}

async function findChildFolderByName(
  driveId: string,
  parentItemId: string,
  folderName: string
): Promise<GraphDriveItem | null> {
  const children = await listAllChildren(driveId, parentItemId);
  return (
    children.find((item) => item.folder && item.name === folderName && item.id) ??
    null
  );
}

async function createChildFolder(
  driveId: string,
  parentItemId: string,
  folderName: string,
  conflictBehavior: "fail" | "rename" = "fail"
): Promise<GraphDriveItem> {
  const path = `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(parentItemId)}/children`;
  try {
    const { data } = await microsoftGraphPost<GraphDriveItem>(
      path,
      {
        name: folderName,
        folder: {},
        "@microsoft.graph.conflictBehavior": conflictBehavior,
      },
      { timeoutMs: 30_000 }
    );
    if (!data.id || !data.name) {
      throw new Error("Microsoft Graph created a folder but returned incomplete data.");
    }
    return data;
  } catch (err) {
    if (
      conflictBehavior === "fail" &&
      err instanceof MicrosoftGraphAuthError &&
      (err.status === 409 ||
        /nameAlreadyExists|already exists/i.test(err.message))
    ) {
      const existing = await findChildFolderByName(
        driveId,
        parentItemId,
        folderName
      );
      if (existing?.id) return existing;
    }
    throw err;
  }
}

async function getDriveItem(
  driveId: string,
  itemId: string
): Promise<GraphDriveItem> {
  const { data } = await microsoftGraphGet<GraphDriveItem>(
    `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}?$select=id,name,webUrl,folder,parentReference`,
    { timeoutMs: 20_000 }
  );
  return data;
}

async function ensureNamedSubfolder(
  driveId: string,
  parentItemId: string,
  folderName: string,
  existingId: string | null | undefined
): Promise<GraphDriveItem> {
  if (existingId) {
    try {
      const item = await getDriveItem(driveId, existingId);
      if (item.id && item.folder) {
        if (item.name && item.name !== folderName) {
          try {
            const { data } = await microsoftGraphPatch<GraphDriveItem>(
              `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(item.id)}`,
              { name: folderName },
              { timeoutMs: 30_000 }
            );
            return { ...item, ...data, name: data.name ?? folderName };
          } catch (err) {
            if (
              !(
                err instanceof MicrosoftGraphAuthError &&
                (err.status === 409 ||
                  /nameAlreadyExists|already exists/i.test(err.message))
              )
            ) {
              throw err;
            }
          }
        }
        return item;
      }
    } catch (err) {
      if (!(err instanceof MicrosoftGraphAuthError && err.status === 404)) {
        throw err;
      }
    }
  }

  const found = await findChildFolderByName(driveId, parentItemId, folderName);
  if (found?.id) return found;

  if (folderName === "Quotes") {
    const legacy = await findChildFolderByName(
      driveId,
      parentItemId,
      "Quote Forms"
    );
    if (legacy?.id) {
      const { data } = await microsoftGraphPatch<GraphDriveItem>(
        `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(legacy.id)}`,
        { name: "Quotes" },
        { timeoutMs: 30_000 }
      );
      return { ...legacy, ...data, name: data.name ?? "Quotes" };
    }
  }

  return createChildFolder(driveId, parentItemId, folderName);
}

async function loadJob(jobId: string): Promise<JobGraphRow> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("jobs")
    .select(
      "id, name, customer_id, graph_drive_id, graph_folder_item_id, graph_web_url, graph_provided_drawings_item_id, graph_quote_forms_item_id, graph_misc_item_id, graph_production_drawings_item_id, graph_face_frame_drawings_item_id, graph_assembly_drawings_item_id, graph_cv_client_drawings_item_id, graph_appliance_specs_item_id, graph_purchase_orders_item_id, graph_invoices_item_id"
    )
    .eq("id", jobId)
    .maybeSingle();

  if (error) {
    if (
      /graph_face_frame_drawings_item_id|graph_assembly_drawings_item_id|schema cache|column/i.test(
        error.message
      )
    ) {
      throw new Error(
        `${error.message} Run supabase/migrations/20260810000005_jobs_graph_production_drawing_subfolders.sql in the Supabase SQL Editor, then retry.`
      );
    }
    if (/graph_folder_item_id|schema cache|column/i.test(error.message)) {
      throw new Error(
        `${error.message} Run supabase/migrations/20260810000003_jobs_graph_folder_ids.sql in the Supabase SQL Editor, then retry.`
      );
    }
    throw new Error(error.message);
  }
  if (!data) throw new Error("Job not found.");
  return data as JobGraphRow;
}

async function saveJobGraphIds(
  jobId: string,
  ids: JobGraphFolderIds
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("jobs")
    .update({
      graph_drive_id: ids.graph_drive_id,
      graph_folder_item_id: ids.graph_folder_item_id,
      graph_web_url: ids.graph_web_url,
      graph_provided_drawings_item_id: ids.graph_provided_drawings_item_id,
      graph_quote_forms_item_id: ids.graph_quote_forms_item_id,
      graph_misc_item_id: ids.graph_misc_item_id,
      graph_production_drawings_item_id: ids.graph_production_drawings_item_id,
      graph_face_frame_drawings_item_id: ids.graph_face_frame_drawings_item_id,
      graph_assembly_drawings_item_id: ids.graph_assembly_drawings_item_id,
      graph_cv_client_drawings_item_id: ids.graph_cv_client_drawings_item_id,
      graph_appliance_specs_item_id: ids.graph_appliance_specs_item_id,
      graph_purchase_orders_item_id: ids.graph_purchase_orders_item_id,
      graph_invoices_item_id: ids.graph_invoices_item_id,
    })
    .eq("id", jobId);

  if (error) {
    if (
      /graph_face_frame_drawings_item_id|graph_assembly_drawings_item_id|schema cache|column/i.test(
        error.message
      )
    ) {
      throw new Error(
        `${error.message} Run supabase/migrations/20260810000005_jobs_graph_production_drawing_subfolders.sql in the Supabase SQL Editor, then retry.`
      );
    }
    if (/graph_folder_item_id|schema cache|column/i.test(error.message)) {
      throw new Error(
        `${error.message} Run supabase/migrations/20260810000003_jobs_graph_folder_ids.sql in the Supabase SQL Editor, then retry.`
      );
    }
    throw new Error(error.message);
  }
}

async function ensureAllJobSubfolders(
  driveId: string,
  projectFolderId: string,
  existing: Partial<JobGraphRow> | QuoteGraphFolderIds
): Promise<Omit<JobGraphFolderIds, "graph_drive_id" | "graph_folder_item_id" | "graph_web_url">> {
  const provided = await ensureNamedSubfolder(
    driveId,
    projectFolderId,
    JOB_SHAREPOINT_SUBFOLDERS.provided_drawings,
    "graph_provided_drawings_item_id" in existing
      ? existing.graph_provided_drawings_item_id
      : null
  );
  const quotes = await ensureNamedSubfolder(
    driveId,
    projectFolderId,
    JOB_SHAREPOINT_SUBFOLDERS.quote_forms,
    "graph_quote_forms_item_id" in existing
      ? existing.graph_quote_forms_item_id
      : null
  );
  const misc = await ensureNamedSubfolder(
    driveId,
    projectFolderId,
    JOB_SHAREPOINT_SUBFOLDERS.misc,
    "graph_misc_item_id" in existing ? existing.graph_misc_item_id : null
  );
  const production = await ensureNamedSubfolder(
    driveId,
    projectFolderId,
    JOB_SHAREPOINT_SUBFOLDERS.production_drawings,
    "graph_production_drawings_item_id" in existing
      ? existing.graph_production_drawings_item_id
      : null
  );
  const faceFrame = await ensureNamedSubfolder(
    driveId,
    production.id!,
    PRODUCTION_DRAWING_SUBFOLDERS.face_frame_drawings,
    "graph_face_frame_drawings_item_id" in existing
      ? existing.graph_face_frame_drawings_item_id
      : null
  );
  const assembly = await ensureNamedSubfolder(
    driveId,
    production.id!,
    PRODUCTION_DRAWING_SUBFOLDERS.assembly_drawings,
    "graph_assembly_drawings_item_id" in existing
      ? existing.graph_assembly_drawings_item_id
      : null
  );
  const cv = await ensureNamedSubfolder(
    driveId,
    projectFolderId,
    JOB_SHAREPOINT_SUBFOLDERS.cv_client_drawings,
    "graph_cv_client_drawings_item_id" in existing
      ? existing.graph_cv_client_drawings_item_id
      : null
  );
  const appliances = await ensureNamedSubfolder(
    driveId,
    projectFolderId,
    JOB_SHAREPOINT_SUBFOLDERS.appliance_specs,
    "graph_appliance_specs_item_id" in existing
      ? existing.graph_appliance_specs_item_id
      : null
  );
  const pos = await ensureNamedSubfolder(
    driveId,
    projectFolderId,
    JOB_SHAREPOINT_SUBFOLDERS.purchase_orders,
    "graph_purchase_orders_item_id" in existing
      ? existing.graph_purchase_orders_item_id
      : null
  );
  const invoices = await ensureNamedSubfolder(
    driveId,
    projectFolderId,
    JOB_SHAREPOINT_SUBFOLDERS.invoices,
    "graph_invoices_item_id" in existing
      ? existing.graph_invoices_item_id
      : null
  );

  if (
    !provided.id ||
    !quotes.id ||
    !misc.id ||
    !production.id ||
    !faceFrame.id ||
    !assembly.id ||
    !cv.id ||
    !appliances.id ||
    !pos.id ||
    !invoices.id
  ) {
    throw new Error("Could not ensure all job SharePoint category folders.");
  }

  return {
    graph_provided_drawings_item_id: provided.id,
    graph_quote_forms_item_id: quotes.id,
    graph_misc_item_id: misc.id,
    graph_production_drawings_item_id: production.id,
    graph_face_frame_drawings_item_id: faceFrame.id,
    graph_assembly_drawings_item_id: assembly.id,
    graph_cv_client_drawings_item_id: cv.id,
    graph_appliance_specs_item_id: appliances.id,
    graph_purchase_orders_item_id: pos.id,
    graph_invoices_item_id: invoices.id,
  };
}

/**
 * Idempotently ensures a job project folder under Jobs (or the contractor's Jobs
 * folder) with all category folders (including Face Frame Drawings and Assembly
 * Drawings under Production Drawings).
 * Used for jobs created directly (not from a quote).
 */
export async function ensureJobSharePointFolders(
  jobId: string
): Promise<JobGraphFolderIds> {
  const job = await loadJob(jobId);
  const { driveId: configuredDriveId } = getConfiguredJobsFolder();
  const parent = await resolveJobsParentFolderId(job.customer_id);
  const driveId = parent.driveId || configuredDriveId;
  const parentFolderId = parent.parentFolderId;
  const folderName = sanitizeSharePointFolderName(job.name);

  let projectFolder: GraphDriveItem | null = null;

  if (job.graph_folder_item_id) {
    try {
      const existing = await getDriveItem(
        job.graph_drive_id || driveId,
        job.graph_folder_item_id
      );
      if (existing.id && existing.folder) projectFolder = existing;
    } catch (err) {
      if (!(err instanceof MicrosoftGraphAuthError && err.status === 404)) {
        throw err;
      }
    }
  }

  if (!projectFolder) {
    const byName = await findChildFolderByName(
      driveId,
      parentFolderId,
      folderName
    );
    if (byName?.id) {
      const admin = createAdminClient();
      const { data: owner } = await admin
        .from("jobs")
        .select("id")
        .eq("graph_folder_item_id", byName.id)
        .neq("id", jobId)
        .maybeSingle();
      if (!owner) projectFolder = byName;
      else {
        projectFolder = await createChildFolder(
          driveId,
          parentFolderId,
          folderName,
          "rename"
        );
      }
    }
  }

  if (!projectFolder) {
    projectFolder = await createChildFolder(driveId, parentFolderId, folderName);
  }
  if (!projectFolder.id) {
    throw new Error("Could not resolve job SharePoint folder.");
  }

  const resolvedDriveId =
    projectFolder.parentReference?.driveId ?? job.graph_drive_id ?? driveId;

  const sub = await ensureAllJobSubfolders(
    resolvedDriveId,
    projectFolder.id,
    job
  );

  const ids: JobGraphFolderIds = {
    graph_drive_id: resolvedDriveId,
    graph_folder_item_id: projectFolder.id,
    graph_web_url: projectFolder.webUrl ?? job.graph_web_url ?? null,
    ...sub,
  };
  await saveJobGraphIds(jobId, ids);
  return ids;
}

/**
 * Moves an existing job project folder under the correct Jobs parent for its
 * current customer_id (contractor folder vs Jobs root). Idempotent.
 */
export async function relocateJobSharePointFolderForContact(
  jobId: string
): Promise<JobGraphFolderIds> {
  const job = await loadJob(jobId);
  const ids = await ensureJobSharePointFolders(jobId);
  const parent = await resolveJobsParentFolderId(job.customer_id);
  const driveId = parent.driveId || ids.graph_drive_id;
  const targetParentId = parent.parentFolderId;

  const current = await getDriveItem(driveId, ids.graph_folder_item_id);
  const currentParent = current.parentReference?.id ?? null;
  if (currentParent === targetParentId) {
    return ids;
  }

  const jobName = sanitizeSharePointFolderName(job.name);
  let moved: GraphDriveItem;
  try {
    moved = await moveSharePointDriveItem({
      driveId,
      itemId: ids.graph_folder_item_id,
      newParentItemId: targetParentId,
      newName: jobName,
    });
  } catch (err) {
    if (
      err instanceof MicrosoftGraphAuthError &&
      (err.status === 409 ||
        /nameAlreadyExists|already exists/i.test(err.message))
    ) {
      moved = await moveSharePointDriveItem({
        driveId,
        itemId: ids.graph_folder_item_id,
        newParentItemId: targetParentId,
      });
    } else {
      throw err;
    }
  }

  const verified = await getDriveItem(driveId, moved.id!);
  if (verified.parentReference?.id !== targetParentId) {
    throw new Error(
      "SharePoint folder move failed: job folder is not under the expected parent."
    );
  }

  const next: JobGraphFolderIds = {
    ...ids,
    graph_drive_id:
      verified.parentReference?.driveId ?? ids.graph_drive_id ?? driveId,
    graph_folder_item_id: moved.id!,
    graph_web_url: verified.webUrl ?? moved.webUrl ?? ids.graph_web_url,
  };
  await saveJobGraphIds(jobId, next);
  return next;
}

/**
 * Moves the quote's SharePoint project folder into Jobs (or the contractor's Jobs
 * folder) using the same DriveItem ID, ensures job-only subfolders, and stores IDs.
 * Idempotent and does not duplicate files.
 */
export async function convertQuoteSharePointFolderToJob(opts: {
  quoteId: string;
  jobId: string;
}): Promise<JobGraphFolderIds> {
  const job = await loadJob(opts.jobId);

  // Already converted/linked — only ensure subfolders.
  if (job.graph_folder_item_id) {
    return ensureJobSharePointFolders(opts.jobId);
  }

  const quoteFolders = await ensureQuoteSharePointFolders(opts.quoteId);
  const { driveId: configuredDriveId } = getConfiguredJobsFolder();
  const jobsParent = await resolveJobsParentFolderId(job.customer_id);
  const driveId = jobsParent.driveId || configuredDriveId;
  const targetParentId = jobsParent.parentFolderId;
  const jobName = sanitizeSharePointFolderName(job.name);

  const current = await getDriveItem(
    quoteFolders.graph_drive_id || driveId,
    quoteFolders.graph_folder_item_id
  );

  const parentId = current.parentReference?.id ?? null;
  const alreadyInPlace = parentId === targetParentId;

  let moved: GraphDriveItem = current;
  if (!alreadyInPlace) {
    // Prefer keeping the same DriveItem ID via move.
    try {
      moved = await moveSharePointDriveItem({
        driveId: quoteFolders.graph_drive_id || driveId,
        itemId: quoteFolders.graph_folder_item_id,
        newParentItemId: targetParentId,
        newName: jobName,
      });
    } catch (err) {
      if (
        err instanceof MicrosoftGraphAuthError &&
        (err.status === 409 ||
          /nameAlreadyExists|already exists/i.test(err.message))
      ) {
        // Move without rename, then rename with conflict rename behavior if needed.
        moved = await moveSharePointDriveItem({
          driveId: quoteFolders.graph_drive_id || driveId,
          itemId: quoteFolders.graph_folder_item_id,
          newParentItemId: targetParentId,
        });
        try {
          const { data } = await microsoftGraphPatch<GraphDriveItem>(
            `/drives/${encodeURIComponent(quoteFolders.graph_drive_id || driveId)}/items/${encodeURIComponent(moved.id!)}`,
            { name: jobName },
            { timeoutMs: 30_000 }
          );
          moved = { ...moved, ...data };
        } catch {
          // Keep existing name if rename collides.
        }
      } else {
        throw err;
      }
    }
  } else if (current.name !== jobName) {
    try {
      const { data } = await microsoftGraphPatch<GraphDriveItem>(
        `/drives/${encodeURIComponent(quoteFolders.graph_drive_id || driveId)}/items/${encodeURIComponent(current.id!)}`,
        { name: jobName },
        { timeoutMs: 30_000 }
      );
      moved = { ...current, ...data };
    } catch {
      moved = current;
    }
  }

  if (!moved.id) {
    throw new Error("SharePoint folder move did not return a DriveItem ID.");
  }

  // Verify parent is the expected Jobs parent (root or contractor folder).
  const verified = await getDriveItem(
    quoteFolders.graph_drive_id || driveId,
    moved.id
  );
  if (verified.parentReference?.id !== targetParentId) {
    throw new Error(
      "SharePoint folder move failed: project folder is not under the expected Jobs parent."
    );
  }

  const resolvedDriveId =
    verified.parentReference?.driveId ??
    quoteFolders.graph_drive_id ??
    driveId;

  const sub = await ensureAllJobSubfolders(resolvedDriveId, moved.id, {
    ...quoteFolders,
    ...job,
  });

  const ids: JobGraphFolderIds = {
    graph_drive_id: resolvedDriveId,
    graph_folder_item_id: moved.id,
    graph_web_url: verified.webUrl ?? moved.webUrl ?? quoteFolders.graph_web_url,
    ...sub,
  };

  await saveJobGraphIds(opts.jobId, ids);

  // Keep quote pointing at the same DriveItem (historical link).
  const admin = createAdminClient();
  await admin
    .from("leads")
    .update({
      graph_drive_id: ids.graph_drive_id,
      graph_folder_item_id: ids.graph_folder_item_id,
      graph_web_url: ids.graph_web_url,
      graph_provided_drawings_item_id: ids.graph_provided_drawings_item_id,
      graph_quote_forms_item_id: ids.graph_quote_forms_item_id,
      graph_misc_item_id: ids.graph_misc_item_id,
    })
    .eq("id", opts.quoteId);

  return ids;
}
