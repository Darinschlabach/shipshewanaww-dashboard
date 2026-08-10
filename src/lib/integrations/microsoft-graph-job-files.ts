import {
  ensureJobSharePointFolders,
  isJobSharePointCategory,
  jobCategoryFolderItemId,
  productionDrawingSubfolderItemId,
  PRODUCTION_DRAWING_SUBFOLDERS,
  type JobSharePointCategory,
  type ProductionDrawingSubfolder,
} from "@/lib/integrations/microsoft-graph-job-folders";
import {
  deleteSharePointDriveItem,
  getSharePointDriveItemOpenUrl,
  listSharePointFolderFiles,
  mapSharePointFileToCompanyFile,
  renameSharePointDriveItem,
  uploadFileToSharePointFolder,
} from "@/lib/integrations/microsoft-graph-sharepoint-files";
import {
  fileTypeFromName,
  formatFileSize,
  getInitials,
  type CompanyFile,
} from "@/lib/files";
import { MicrosoftGraphAuthError } from "@/lib/integrations/microsoft-graph";

function productionRootFolders(
  ids: Awaited<ReturnType<typeof ensureJobSharePointFolders>>,
  jobId: string
): CompanyFile[] {
  return (
    Object.entries(PRODUCTION_DRAWING_SUBFOLDERS) as [
      ProductionDrawingSubfolder,
      string,
    ][]
  ).map(([key, name]) => ({
    id: productionDrawingSubfolderItemId(ids, key),
    name,
    category: "Shop Resources" as const,
    modifiedAt: new Date(0).toISOString(),
    size: "—",
    type: "folder" as const,
    uploadedBy: "SharePoint",
    uploaderInitials: getInitials("SharePoint"),
    starred: false,
    isFolder: true,
    jobId,
    drawingCategory: "production_drawings" as const,
    productionSubfolder: key,
    url: null,
  }));
}

async function listProductionSubfolderFiles(
  ids: Awaited<ReturnType<typeof ensureJobSharePointFolders>>,
  jobId: string,
  subfolder: ProductionDrawingSubfolder
): Promise<CompanyFile[]> {
  const folderId = productionDrawingSubfolderItemId(ids, subfolder);
  const listed = await listSharePointFolderFiles({
    driveId: ids.graph_drive_id,
    folderItemId: folderId,
    category: "production_drawings",
    jobId,
  });
  return listed.map((file) => ({
    ...file,
    productionSubfolder: subfolder,
  }));
}

export async function listJobSharePointFiles(opts: {
  jobId: string;
  category?: JobSharePointCategory | null;
  productionSubfolder?: ProductionDrawingSubfolder | null;
}): Promise<{ files: CompanyFile[]; error: string | null }> {
  try {
    const ids = await ensureJobSharePointFolders(opts.jobId);

    if (opts.category === "production_drawings" && !opts.productionSubfolder) {
      return { files: productionRootFolders(ids, opts.jobId), error: null };
    }

    if (opts.category === "production_drawings" && opts.productionSubfolder) {
      const listed = await listProductionSubfolderFiles(
        ids,
        opts.jobId,
        opts.productionSubfolder
      );
      return { files: listed, error: null };
    }

    const categories: JobSharePointCategory[] = opts.category
      ? [opts.category]
      : [
          "provided_drawings",
          "quote_forms",
          "misc",
          "cv_client_drawings",
          "appliance_specs",
          "purchase_orders",
          "invoices",
        ];

    const files: CompanyFile[] = [];
    for (const category of categories) {
      const folderId = jobCategoryFolderItemId(ids, category);
      const listed = await listSharePointFolderFiles({
        driveId: ids.graph_drive_id,
        folderItemId: folderId,
        category,
        jobId: opts.jobId,
      });
      files.push(...listed);
    }

    // Production Drawings: two folders + files inside each (for tab filtering).
    if (!opts.category) {
      files.push(...productionRootFolders(ids, opts.jobId));
      for (const key of Object.keys(
        PRODUCTION_DRAWING_SUBFOLDERS
      ) as ProductionDrawingSubfolder[]) {
        files.push(
          ...(await listProductionSubfolderFiles(ids, opts.jobId, key))
        );
      }
    }

    files.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
    return { files, error: null };
  } catch (err) {
    return {
      files: [],
      error:
        err instanceof Error
          ? err.message
          : "Could not list SharePoint job files.",
    };
  }
}

export async function uploadJobSharePointFiles(opts: {
  jobId: string;
  category: JobSharePointCategory;
  productionSubfolder?: ProductionDrawingSubfolder | null;
  files: File[];
  uploadedByName: string;
}): Promise<{ files: CompanyFile[]; error: string | null }> {
  try {
    if (opts.category === "production_drawings" && !opts.productionSubfolder) {
      return {
        files: [],
        error:
          "Open Face Frame Drawings or Assembly Drawings before uploading.",
      };
    }

    const ids = await ensureJobSharePointFolders(opts.jobId);
    const parentId =
      opts.category === "production_drawings" && opts.productionSubfolder
        ? productionDrawingSubfolderItemId(ids, opts.productionSubfolder)
        : jobCategoryFolderItemId(ids, opts.category);
    const created: CompanyFile[] = [];

    for (const file of opts.files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const data = await uploadFileToSharePointFolder({
        driveId: ids.graph_drive_id,
        folderItemId: parentId,
        fileName: file.name,
        body: buffer,
        contentType: file.type || "application/octet-stream",
      });

      created.push({
        id: data.id!,
        name: data.name!,
        category: "Shop Resources",
        modifiedAt:
          data.lastModifiedDateTime ||
          data.createdDateTime ||
          new Date().toISOString(),
        size: formatFileSize(Number(data.size) || file.size || 0),
        type: fileTypeFromName(data.name!),
        uploadedBy: opts.uploadedByName || "SharePoint",
        uploaderInitials: getInitials(opts.uploadedByName || "SharePoint"),
        starred: false,
        isFolder: false,
        jobId: opts.jobId,
        drawingCategory: opts.category,
        productionSubfolder: opts.productionSubfolder ?? undefined,
        url: data.webUrl ?? null,
      });
    }

    return { files: created, error: null };
  } catch (err) {
    return {
      files: [],
      error:
        err instanceof Error
          ? err.message
          : "Could not upload file to SharePoint.",
    };
  }
}

export async function deleteJobSharePointFile(opts: {
  jobId: string;
  itemId: string;
}): Promise<{ error: string | null }> {
  try {
    const ids = await ensureJobSharePointFolders(opts.jobId);
    await deleteSharePointDriveItem({
      driveId: ids.graph_drive_id,
      itemId: opts.itemId,
    });
    return { error: null };
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Could not delete SharePoint file.",
    };
  }
}

export async function renameJobSharePointFile(opts: {
  jobId: string;
  itemId: string;
  newName: string;
}): Promise<{ file: CompanyFile | null; error: string | null }> {
  try {
    const ids = await ensureJobSharePointFolders(opts.jobId);
    const data = await renameSharePointDriveItem({
      driveId: ids.graph_drive_id,
      itemId: opts.itemId,
      newName: opts.newName,
    });

    let category: JobSharePointCategory = "misc";
    let productionSubfolder: ProductionDrawingSubfolder | undefined;
    const parentId = data.parentReference?.id;
    if (parentId === ids.graph_provided_drawings_item_id) {
      category = "provided_drawings";
    } else if (parentId === ids.graph_quote_forms_item_id) {
      category = "quote_forms";
    } else if (parentId === ids.graph_misc_item_id) {
      category = "misc";
    } else if (parentId === ids.graph_face_frame_drawings_item_id) {
      category = "production_drawings";
      productionSubfolder = "face_frame_drawings";
    } else if (parentId === ids.graph_assembly_drawings_item_id) {
      category = "production_drawings";
      productionSubfolder = "assembly_drawings";
    } else if (parentId === ids.graph_production_drawings_item_id) {
      category = "production_drawings";
    } else if (parentId === ids.graph_cv_client_drawings_item_id) {
      category = "cv_client_drawings";
    } else if (parentId === ids.graph_appliance_specs_item_id) {
      category = "appliance_specs";
    } else if (parentId === ids.graph_purchase_orders_item_id) {
      category = "purchase_orders";
    } else if (parentId === ids.graph_invoices_item_id) {
      category = "invoices";
    }

    const mapped = mapSharePointFileToCompanyFile(data, {
      category,
      jobId: opts.jobId,
    });
    if (!mapped) {
      return { file: null, error: "Could not map renamed SharePoint file." };
    }
    return {
      file: { ...mapped, productionSubfolder },
      error: null,
    };
  } catch (err) {
    return {
      file: null,
      error:
        err instanceof Error
          ? err.message
          : "Could not rename SharePoint file.",
    };
  }
}

export async function getJobSharePointFileOpenUrl(opts: {
  jobId: string;
  itemId: string;
}): Promise<{ url: string | null; error: string | null }> {
  try {
    const ids = await ensureJobSharePointFolders(opts.jobId);
    const url = await getSharePointDriveItemOpenUrl({
      driveId: ids.graph_drive_id,
      itemId: opts.itemId,
    });
    return { url, error: url ? null : "No open URL available for this file." };
  } catch (err) {
    if (err instanceof MicrosoftGraphAuthError) {
      return { url: null, error: err.message };
    }
    return {
      url: null,
      error:
        err instanceof Error
          ? err.message
          : "Could not resolve SharePoint file URL.",
    };
  }
}

export { isJobSharePointCategory };
