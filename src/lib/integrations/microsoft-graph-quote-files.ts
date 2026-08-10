import {
  MicrosoftGraphAuthError,
  microsoftGraphDelete,
  microsoftGraphGet,
  microsoftGraphPatch,
  microsoftGraphPutBinary,
} from "@/lib/integrations/microsoft-graph";
import {
  categoryFolderItemId,
  ensureQuoteSharePointFolders,
  parseQuoteSharePointCategory,
  type QuoteSharePointCategory,
} from "@/lib/integrations/microsoft-graph-quote-folders";
import {
  fileTypeFromName,
  formatFileSize,
  getInitials,
  type CompanyFile,
} from "@/lib/files";

type GraphDriveItem = {
  id?: string;
  name?: string;
  size?: number;
  webUrl?: string;
  file?: Record<string, unknown>;
  folder?: Record<string, unknown>;
  lastModifiedDateTime?: string;
  createdDateTime?: string;
  createdBy?: {
    user?: { displayName?: string };
  };
  "@microsoft.graph.downloadUrl"?: string;
};

type GraphListResponse = {
  value?: GraphDriveItem[];
  "@odata.nextLink"?: string;
};

function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function mapDriveItemToCompanyFile(
  item: GraphDriveItem,
  opts: { quoteId: string; category: QuoteSharePointCategory }
): CompanyFile | null {
  if (!item.id || !item.name || item.folder) return null;
  const uploadedBy =
    item.createdBy?.user?.displayName?.trim() || "SharePoint";
  const modifiedAt =
    item.lastModifiedDateTime ||
    item.createdDateTime ||
    new Date().toISOString();
  const downloadUrl = item["@microsoft.graph.downloadUrl"] ?? item.webUrl ?? null;

  return {
    id: item.id,
    name: item.name,
    category: "Shop Resources",
    modifiedAt,
    size: formatFileSize(Number(item.size) || 0),
    type: fileTypeFromName(item.name),
    uploadedBy,
    uploaderInitials: getInitials(uploadedBy),
    starred: false,
    isFolder: false,
    quoteId: opts.quoteId,
    drawingCategory: opts.category,
    url: downloadUrl,
  };
}

async function listChildren(driveId: string, folderItemId: string) {
  const items: GraphDriveItem[] = [];
  let next: string | null =
    `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(folderItemId)}/children?$top=200&$select=id,name,size,webUrl,file,folder,lastModifiedDateTime,createdDateTime,createdBy`;

  while (next) {
    const page: { data: GraphListResponse; status: number } =
      await microsoftGraphGet<GraphListResponse>(next, {
        timeoutMs: 30_000,
      });
    items.push(...(page.data.value ?? []));
    next = page.data["@odata.nextLink"] ?? null;
  }

  return items;
}

export async function listQuoteSharePointFiles(opts: {
  quoteId: string;
  category?: QuoteSharePointCategory | null;
}): Promise<{ files: CompanyFile[]; error: string | null }> {
  try {
    const ids = await ensureQuoteSharePointFolders(opts.quoteId);
    const categories: QuoteSharePointCategory[] = opts.category
      ? [opts.category]
      : ["provided_drawings", "quote_forms", "misc"];

    const files: CompanyFile[] = [];
    for (const category of categories) {
      const folderId = categoryFolderItemId(ids, category);
      const children = await listChildren(ids.graph_drive_id, folderId);
      for (const item of children) {
        const mapped = mapDriveItemToCompanyFile(item, {
          quoteId: opts.quoteId,
          category,
        });
        if (mapped) {
          // Prefer webUrl for list; open action resolves downloadUrl on demand.
          if (!mapped.url && item.webUrl) mapped.url = item.webUrl;
          files.push(mapped);
        }
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
          : "Could not list SharePoint quote files.",
    };
  }
}

export async function uploadQuoteSharePointFiles(opts: {
  quoteId: string;
  category: QuoteSharePointCategory;
  files: File[];
  uploadedByName: string;
}): Promise<{ files: CompanyFile[]; error: string | null }> {
  try {
    const ids = await ensureQuoteSharePointFolders(opts.quoteId);
    const parentId = categoryFolderItemId(ids, opts.category);
    const created: CompanyFile[] = [];

    for (const file of opts.files) {
      const safeName = sanitizeFileName(file.name) || "upload.bin";
      const path =
        `/drives/${encodeURIComponent(ids.graph_drive_id)}/items/${encodeURIComponent(parentId)}:/${encodeURIComponent(safeName)}:/content?@microsoft.graph.conflictBehavior=rename`;

      const buffer = Buffer.from(await file.arrayBuffer());
      const { data } = await microsoftGraphPutBinary<GraphDriveItem>(path, buffer, {
        contentType: file.type || "application/octet-stream",
        timeoutMs: 120_000,
      });

      if (!data.id || !data.name) {
        return {
          files: created,
          error: "Microsoft Graph upload returned incomplete data.",
        };
      }

      created.push({
        id: data.id,
        name: data.name,
        category: "Shop Resources",
        modifiedAt:
          data.lastModifiedDateTime ||
          data.createdDateTime ||
          new Date().toISOString(),
        size: formatFileSize(Number(data.size) || file.size || 0),
        type: fileTypeFromName(data.name),
        uploadedBy: opts.uploadedByName || "SharePoint",
        uploaderInitials: getInitials(opts.uploadedByName || "SharePoint"),
        starred: false,
        isFolder: false,
        quoteId: opts.quoteId,
        drawingCategory: opts.category,
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

export async function deleteQuoteSharePointFile(opts: {
  quoteId: string;
  itemId: string;
}): Promise<{ error: string | null }> {
  try {
    const ids = await ensureQuoteSharePointFolders(opts.quoteId);
    await microsoftGraphDelete(
      `/drives/${encodeURIComponent(ids.graph_drive_id)}/items/${encodeURIComponent(opts.itemId)}`,
      { timeoutMs: 30_000 }
    );
    return { error: null };
  } catch (err) {
    if (err instanceof MicrosoftGraphAuthError && err.status === 404) {
      return { error: null };
    }
    return {
      error:
        err instanceof Error
          ? err.message
          : "Could not delete SharePoint file.",
    };
  }
}

export async function renameQuoteSharePointFile(opts: {
  quoteId: string;
  itemId: string;
  newName: string;
}): Promise<{ file: CompanyFile | null; error: string | null }> {
  const categoryHint = parseQuoteSharePointCategory("misc");
  try {
    const ids = await ensureQuoteSharePointFolders(opts.quoteId);
    const safeName = sanitizeFileName(opts.newName);
    if (!safeName) {
      return { file: null, error: "File name is required." };
    }

    const { data } = await microsoftGraphPatch<GraphDriveItem>(
      `/drives/${encodeURIComponent(ids.graph_drive_id)}/items/${encodeURIComponent(opts.itemId)}`,
      { name: safeName },
      { timeoutMs: 30_000 }
    );

    // Resolve which category folder this file lives in for UI tagging.
    let category: QuoteSharePointCategory = categoryHint ?? "misc";
    try {
      const { data: full } = await microsoftGraphGet<
        GraphDriveItem & { parentReference?: { id?: string } }
      >(
        `/drives/${encodeURIComponent(ids.graph_drive_id)}/items/${encodeURIComponent(opts.itemId)}?$select=id,name,size,webUrl,file,parentReference,lastModifiedDateTime,createdDateTime,createdBy`,
        { timeoutMs: 15_000 }
      );
      const parentId = full.parentReference?.id;
      if (parentId === ids.graph_provided_drawings_item_id) {
        category = "provided_drawings";
      } else if (parentId === ids.graph_quote_forms_item_id) {
        category = "quote_forms";
      } else if (parentId === ids.graph_misc_item_id) {
        category = "misc";
      }
      const mapped = mapDriveItemToCompanyFile(
        { ...full, ...data },
        { quoteId: opts.quoteId, category }
      );
      return { file: mapped, error: null };
    } catch {
      const mapped = mapDriveItemToCompanyFile(data, {
        quoteId: opts.quoteId,
        category,
      });
      return { file: mapped, error: null };
    }
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

export async function getQuoteSharePointFileOpenUrl(opts: {
  quoteId: string;
  itemId: string;
}): Promise<{ url: string | null; error: string | null }> {
  try {
    const ids = await ensureQuoteSharePointFolders(opts.quoteId);
    // Full item GET so Graph includes @microsoft.graph.downloadUrl.
    const { data } = await microsoftGraphGet<GraphDriveItem>(
      `/drives/${encodeURIComponent(ids.graph_drive_id)}/items/${encodeURIComponent(opts.itemId)}`,
      { timeoutMs: 20_000 }
    );
    const url =
      data["@microsoft.graph.downloadUrl"] ?? data.webUrl ?? null;
    return { url, error: url ? null : "No open URL available for this file." };
  } catch (err) {
    return {
      url: null,
      error:
        err instanceof Error
          ? err.message
          : "Could not resolve SharePoint file URL.",
    };
  }
}
