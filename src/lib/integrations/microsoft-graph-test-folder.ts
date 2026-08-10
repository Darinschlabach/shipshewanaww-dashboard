import {
  getConfiguredJobsFolder,
  getConfiguredQuotesFolder,
  microsoftGraphPost,
} from "@/lib/integrations/microsoft-graph";

export const GRAPH_TEST_JOB_FOLDER_NAME = "GRAPH TEST - DELETE ME";
export const GRAPH_TEST_QUOTE_FOLDER_NAME = "GRAPH TEST QUOTE - DELETE ME";

/** @deprecated Use GRAPH_TEST_JOB_FOLDER_NAME */
export const GRAPH_TEST_FOLDER_NAME = GRAPH_TEST_JOB_FOLDER_NAME;

export type CreatedGraphFolder = {
  name: string;
  id: string;
  driveId: string;
  parentFolderId: string;
  webUrl: string | null;
};

type GraphDriveItem = {
  id?: string;
  name?: string;
  webUrl?: string;
  parentReference?: { driveId?: string; id?: string };
};

async function createTestFolderInParent(opts: {
  driveId: string;
  parentFolderId: string;
  folderName: string;
}): Promise<CreatedGraphFolder> {
  const { driveId, parentFolderId, folderName } = opts;

  const path = `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(parentFolderId)}/children`;

  const { data } = await microsoftGraphPost<GraphDriveItem>(
    path,
    {
      name: folderName,
      folder: {},
      "@microsoft.graph.conflictBehavior": "rename",
    },
    { timeoutMs: 30_000 }
  );

  if (!data.id || !data.name) {
    throw new Error("Microsoft Graph created a folder but returned incomplete data.");
  }

  return {
    name: data.name,
    id: data.id,
    driveId: data.parentReference?.driveId ?? driveId,
    parentFolderId: data.parentReference?.id ?? parentFolderId,
    webUrl: data.webUrl ?? null,
  };
}

/**
 * Creates a temporary test folder inside the configured Jobs folder.
 * POST /drives/{drive-id}/items/{parent-item-id}/children
 */
export async function createTestJobFolder(): Promise<CreatedGraphFolder> {
  const { driveId, jobsFolderId } = getConfiguredJobsFolder();

  return createTestFolderInParent({
    driveId,
    parentFolderId: jobsFolderId,
    folderName: GRAPH_TEST_JOB_FOLDER_NAME,
  });
}

/**
 * Creates a temporary test folder inside the configured Quotes folder.
 * POST /drives/{drive-id}/items/{parent-item-id}/children
 */
export async function createTestQuoteFolder(): Promise<CreatedGraphFolder> {
  const { driveId, quotesFolderId } = getConfiguredQuotesFolder();

  return createTestFolderInParent({
    driveId,
    parentFolderId: quotesFolderId,
    folderName: GRAPH_TEST_QUOTE_FOLDER_NAME,
  });
}
