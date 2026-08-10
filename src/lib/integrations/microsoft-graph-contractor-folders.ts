import {
  MicrosoftGraphAuthError,
  getConfiguredJobsFolder,
  getConfiguredQuotesFolder,
  microsoftGraphGet,
  microsoftGraphPatch,
  microsoftGraphPost,
} from "@/lib/integrations/microsoft-graph";
import { createAdminClient } from "@/lib/supabase/admin";

export type ContractorGraphFolderIds = {
  graph_drive_id: string;
  graph_jobs_folder_item_id: string;
  graph_quotes_folder_item_id: string;
  graph_jobs_folder_web_url: string | null;
  graph_quotes_folder_web_url: string | null;
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

type ContactGraphRow = {
  id: string;
  name: string;
  contact_type: string;
  graph_drive_id: string | null;
  graph_jobs_folder_item_id: string | null;
  graph_quotes_folder_item_id: string | null;
  graph_jobs_folder_web_url: string | null;
  graph_quotes_folder_web_url: string | null;
};

function sanitizeContractorFolderName(name: string): string {
  const cleaned = name
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .replace(/\.+$/, "");
  return cleaned.slice(0, 200) || "Untitled Contractor";
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
      throw new Error(
        "Microsoft Graph created a folder but returned incomplete data."
      );
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

async function ensureNamedFolder(
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

  return createChildFolder(driveId, parentItemId, folderName);
}

async function loadContact(contactId: string): Promise<ContactGraphRow> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("contacts")
    .select(
      "id, name, contact_type, graph_drive_id, graph_jobs_folder_item_id, graph_quotes_folder_item_id, graph_jobs_folder_web_url, graph_quotes_folder_web_url"
    )
    .eq("id", contactId)
    .maybeSingle();

  if (error) {
    if (
      /graph_jobs_folder_item_id|graph_quotes_folder_item_id|schema cache|column/i.test(
        error.message
      )
    ) {
      throw new Error(
        `${error.message} Run supabase/migrations/20260810000006_contacts_graph_contractor_folders.sql in the Supabase SQL Editor, then retry.`
      );
    }
    throw new Error(error.message);
  }
  if (!data) throw new Error("Contact not found.");
  return data as ContactGraphRow;
}

async function saveContactGraphIds(
  contactId: string,
  ids: ContractorGraphFolderIds
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("contacts")
    .update({
      graph_drive_id: ids.graph_drive_id,
      graph_jobs_folder_item_id: ids.graph_jobs_folder_item_id,
      graph_quotes_folder_item_id: ids.graph_quotes_folder_item_id,
      graph_jobs_folder_web_url: ids.graph_jobs_folder_web_url,
      graph_quotes_folder_web_url: ids.graph_quotes_folder_web_url,
    })
    .eq("id", contactId);

  if (error) {
    if (
      /graph_jobs_folder_item_id|graph_quotes_folder_item_id|schema cache|column/i.test(
        error.message
      )
    ) {
      throw new Error(
        `${error.message} Run supabase/migrations/20260810000006_contacts_graph_contractor_folders.sql in the Supabase SQL Editor, then retry.`
      );
    }
    throw new Error(error.message);
  }
}

/**
 * Ensures a contractor has a named folder under both Jobs and Quotes roots.
 * No-op (returns null) for non-contractor contacts.
 */
export async function ensureContractorSharePointFolders(
  contactId: string
): Promise<ContractorGraphFolderIds | null> {
  const contact = await loadContact(contactId);
  if (contact.contact_type !== "Contractors") {
    return null;
  }

  const { driveId, jobsFolderId } = getConfiguredJobsFolder();
  const { quotesFolderId } = getConfiguredQuotesFolder();
  const folderName = sanitizeContractorFolderName(contact.name);

  const jobsFolder = await ensureNamedFolder(
    driveId,
    jobsFolderId,
    folderName,
    contact.graph_jobs_folder_item_id
  );
  const quotesFolder = await ensureNamedFolder(
    driveId,
    quotesFolderId,
    folderName,
    contact.graph_quotes_folder_item_id
  );

  if (!jobsFolder.id || !quotesFolder.id) {
    throw new Error("Could not ensure contractor SharePoint folders.");
  }

  const ids: ContractorGraphFolderIds = {
    graph_drive_id:
      jobsFolder.parentReference?.driveId ??
      quotesFolder.parentReference?.driveId ??
      contact.graph_drive_id ??
      driveId,
    graph_jobs_folder_item_id: jobsFolder.id,
    graph_quotes_folder_item_id: quotesFolder.id,
    graph_jobs_folder_web_url:
      jobsFolder.webUrl ?? contact.graph_jobs_folder_web_url ?? null,
    graph_quotes_folder_web_url:
      quotesFolder.webUrl ?? contact.graph_quotes_folder_web_url ?? null,
  };

  await saveContactGraphIds(contactId, ids);
  return ids;
}

/**
 * Returns the Jobs parent folder for a contact: contractor folder if Contractors,
 * otherwise the configured Jobs root. Null contactId → Jobs root.
 */
export async function resolveJobsParentFolderId(
  contactId: string | null | undefined
): Promise<{ driveId: string; parentFolderId: string }> {
  const { driveId, jobsFolderId } = getConfiguredJobsFolder();
  if (!contactId) {
    return { driveId, parentFolderId: jobsFolderId };
  }

  const contact = await loadContact(contactId);
  if (contact.contact_type !== "Contractors") {
    return { driveId, parentFolderId: jobsFolderId };
  }

  const ensured = await ensureContractorSharePointFolders(contactId);
  if (!ensured) {
    return { driveId, parentFolderId: jobsFolderId };
  }
  return {
    driveId: ensured.graph_drive_id || driveId,
    parentFolderId: ensured.graph_jobs_folder_item_id,
  };
}

/**
 * Returns the Quotes parent folder for a contact: contractor folder if Contractors,
 * otherwise the configured Quotes root. Null contactId → Quotes root.
 */
export async function resolveQuotesParentFolderId(
  contactId: string | null | undefined
): Promise<{ driveId: string; parentFolderId: string }> {
  const { driveId, quotesFolderId } = getConfiguredQuotesFolder();
  if (!contactId) {
    return { driveId, parentFolderId: quotesFolderId };
  }

  const contact = await loadContact(contactId);
  if (contact.contact_type !== "Contractors") {
    return { driveId, parentFolderId: quotesFolderId };
  }

  const ensured = await ensureContractorSharePointFolders(contactId);
  if (!ensured) {
    return { driveId, parentFolderId: quotesFolderId };
  }
  return {
    driveId: ensured.graph_drive_id || driveId,
    parentFolderId: ensured.graph_quotes_folder_item_id,
  };
}
