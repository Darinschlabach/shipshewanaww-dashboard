import {
  MicrosoftGraphAuthError,
  microsoftGraphDelete,
  microsoftGraphGet,
  microsoftGraphPatch,
  microsoftGraphPutBinary,
} from "@/lib/integrations/microsoft-graph";
import {
  fileTypeFromName,
  formatFileSize,
  getInitials,
  type CompanyFile,
  type JobFilesTab,
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
  createdBy?: { user?: { displayName?: string } };
  parentReference?: { driveId?: string; id?: string };
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

/**
 * Reusable SharePoint file helpers for Quotes, Jobs, and future modules
 * (CV drawings, POs, invoices, appliance specs, etc.).
 */

export async function listSharePointFolderChildren(opts: {
  driveId: string;
  folderItemId: string;
}): Promise<GraphDriveItem[]> {
  const items: GraphDriveItem[] = [];
  let next: string | null =
    `/drives/${encodeURIComponent(opts.driveId)}/items/${encodeURIComponent(opts.folderItemId)}/children?$top=200&$select=id,name,size,webUrl,file,folder,lastModifiedDateTime,createdDateTime,createdBy,parentReference`;

  while (next) {
    const page: { data: GraphListResponse; status: number } =
      await microsoftGraphGet<GraphListResponse>(next, { timeoutMs: 30_000 });
    items.push(...(page.data.value ?? []));
    next = page.data["@odata.nextLink"] ?? null;
  }
  return items;
}

export function mapSharePointFileToCompanyFile(
  item: GraphDriveItem,
  opts: {
    category: JobFilesTab;
    quoteId?: string;
    jobId?: string;
  }
): CompanyFile | null {
  if (!item.id || !item.name || item.folder) return null;
  const uploadedBy =
    item.createdBy?.user?.displayName?.trim() || "SharePoint";
  return {
    id: item.id,
    name: item.name,
    category: "Shop Resources",
    modifiedAt:
      item.lastModifiedDateTime ||
      item.createdDateTime ||
      new Date().toISOString(),
    size: formatFileSize(Number(item.size) || 0),
    type: fileTypeFromName(item.name),
    uploadedBy,
    uploaderInitials: getInitials(uploadedBy),
    starred: false,
    isFolder: false,
    quoteId: opts.quoteId,
    jobId: opts.jobId,
    drawingCategory: opts.category,
    url: item["@microsoft.graph.downloadUrl"] ?? item.webUrl ?? null,
  };
}

export async function listSharePointFolderFiles(opts: {
  driveId: string;
  folderItemId: string;
  category: JobFilesTab;
  quoteId?: string;
  jobId?: string;
}): Promise<CompanyFile[]> {
  const children = await listSharePointFolderChildren(opts);
  const files: CompanyFile[] = [];
  for (const item of children) {
    const mapped = mapSharePointFileToCompanyFile(item, opts);
    if (mapped) files.push(mapped);
  }
  files.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
  return files;
}

export async function uploadFileToSharePointFolder(opts: {
  driveId: string;
  folderItemId: string;
  fileName: string;
  body: BodyInit;
  contentType?: string;
  conflictBehavior?: "fail" | "replace" | "rename";
}): Promise<GraphDriveItem> {
  const safeName = sanitizeFileName(opts.fileName) || "upload.bin";
  const behavior = opts.conflictBehavior ?? "rename";
  const path =
    `/drives/${encodeURIComponent(opts.driveId)}/items/${encodeURIComponent(opts.folderItemId)}:/${encodeURIComponent(safeName)}:/content?@microsoft.graph.conflictBehavior=${behavior}`;

  const { data } = await microsoftGraphPutBinary<GraphDriveItem>(path, opts.body, {
    contentType: opts.contentType || "application/octet-stream",
    timeoutMs: 120_000,
  });

  if (!data.id || !data.name) {
    throw new Error("Microsoft Graph upload returned incomplete data.");
  }
  return data;
}

export async function deleteSharePointDriveItem(opts: {
  driveId: string;
  itemId: string;
}): Promise<void> {
  try {
    await microsoftGraphDelete(
      `/drives/${encodeURIComponent(opts.driveId)}/items/${encodeURIComponent(opts.itemId)}`,
      { timeoutMs: 30_000 }
    );
  } catch (err) {
    if (err instanceof MicrosoftGraphAuthError && err.status === 404) return;
    throw err;
  }
}

export async function renameSharePointDriveItem(opts: {
  driveId: string;
  itemId: string;
  newName: string;
}): Promise<GraphDriveItem> {
  const safeName = sanitizeFileName(opts.newName);
  if (!safeName) throw new Error("File name is required.");
  const { data } = await microsoftGraphPatch<GraphDriveItem>(
    `/drives/${encodeURIComponent(opts.driveId)}/items/${encodeURIComponent(opts.itemId)}`,
    { name: safeName },
    { timeoutMs: 30_000 }
  );
  return data;
}

export async function getSharePointDriveItemOpenUrl(opts: {
  driveId: string;
  itemId: string;
}): Promise<string | null> {
  const { data } = await microsoftGraphGet<GraphDriveItem>(
    `/drives/${encodeURIComponent(opts.driveId)}/items/${encodeURIComponent(opts.itemId)}`,
    { timeoutMs: 20_000 }
  );
  return data["@microsoft.graph.downloadUrl"] ?? data.webUrl ?? null;
}

export async function moveSharePointDriveItem(opts: {
  driveId: string;
  itemId: string;
  newParentItemId: string;
  newName?: string;
}): Promise<GraphDriveItem> {
  const body: Record<string, unknown> = {
    parentReference: { id: opts.newParentItemId },
  };
  if (opts.newName) body.name = opts.newName;

  const { data } = await microsoftGraphPatch<GraphDriveItem>(
    `/drives/${encodeURIComponent(opts.driveId)}/items/${encodeURIComponent(opts.itemId)}`,
    body,
    { timeoutMs: 60_000 }
  );
  if (!data.id) {
    throw new Error("Microsoft Graph move returned incomplete data.");
  }
  return data;
}
