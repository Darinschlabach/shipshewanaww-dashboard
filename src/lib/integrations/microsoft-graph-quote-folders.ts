import {
  MicrosoftGraphAuthError,
  getConfiguredQuotesFolder,
  microsoftGraphGet,
  microsoftGraphPatch,
  microsoftGraphPost,
} from "@/lib/integrations/microsoft-graph";
import { resolveQuotesParentFolderId } from "@/lib/integrations/microsoft-graph-contractor-folders";
import type { JobFilesTab } from "@/lib/files";
import { createAdminClient } from "@/lib/supabase/admin";

export const QUOTE_SHAREPOINT_SUBFOLDERS = {
  provided_drawings: "Customer Provided Drawings",
  quote_forms: "Quotes",
  misc: "Misc",
} as const satisfies Partial<Record<JobFilesTab, string>>;

export type QuoteSharePointCategory = keyof typeof QUOTE_SHAREPOINT_SUBFOLDERS;

export type QuoteGraphFolderIds = {
  graph_drive_id: string;
  graph_folder_item_id: string;
  graph_web_url: string | null;
  graph_provided_drawings_item_id: string;
  graph_quote_forms_item_id: string;
  graph_misc_item_id: string;
};

type GraphDriveItem = {
  id?: string;
  name?: string;
  webUrl?: string;
  folder?: Record<string, unknown>;
  file?: Record<string, unknown>;
  parentReference?: { driveId?: string; id?: string };
};

type GraphListResponse = {
  value?: GraphDriveItem[];
  "@odata.nextLink"?: string;
};

type LeadGraphRow = {
  id: string;
  project_type: string;
  contact_id: string | null;
  graph_drive_id: string | null;
  graph_folder_item_id: string | null;
  graph_web_url: string | null;
  graph_provided_drawings_item_id: string | null;
  graph_quote_forms_item_id: string | null;
  graph_misc_item_id: string | null;
};

/** SharePoint forbids these characters in item names. */
export function sanitizeSharePointFolderName(name: string): string {
  const cleaned = name
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .replace(/\.+$/, "");
  return cleaned.slice(0, 200) || "Untitled Quote";
}

function isQuoteSharePointCategory(
  value: string
): value is QuoteSharePointCategory {
  return value in QUOTE_SHAREPOINT_SUBFOLDERS;
}

export function categoryFolderItemId(
  ids: QuoteGraphFolderIds,
  category: QuoteSharePointCategory
): string {
  switch (category) {
    case "provided_drawings":
      return ids.graph_provided_drawings_item_id;
    case "quote_forms":
      return ids.graph_quote_forms_item_id;
    case "misc":
      return ids.graph_misc_item_id;
  }
}

async function listAllChildren(
  driveId: string,
  parentItemId: string
): Promise<GraphDriveItem[]> {
  const items: GraphDriveItem[] = [];
  let next: string | null =
    `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(parentItemId)}/children?$top=200&$select=id,name,webUrl,folder,file,parentReference`;

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

async function findChildFolderByName(
  driveId: string,
  parentItemId: string,
  folderName: string
): Promise<GraphDriveItem | null> {
  const children = await listAllChildren(driveId, parentItemId);
  const match = children.find(
    (item) => item.folder && item.name === folderName && item.id
  );
  return match ?? null;
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

  // Migrate legacy "Quote Forms" folder name if present.
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

async function loadLead(quoteId: string): Promise<LeadGraphRow> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("leads")
    .select(
      "id, project_type, contact_id, graph_drive_id, graph_folder_item_id, graph_web_url, graph_provided_drawings_item_id, graph_quote_forms_item_id, graph_misc_item_id"
    )
    .eq("id", quoteId)
    .maybeSingle();

  if (error) {
    if (/graph_folder_item_id|schema cache|column/i.test(error.message)) {
      throw new Error(
        `${error.message} Run supabase/migrations/20260810000002_leads_graph_folder_ids.sql in the Supabase SQL Editor, then retry.`
      );
    }
    throw new Error(error.message);
  }
  if (!data) {
    throw new Error("Quote not found.");
  }
  return data as LeadGraphRow;
}

async function saveLeadGraphIds(
  quoteId: string,
  ids: QuoteGraphFolderIds
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("leads")
    .update({
      graph_drive_id: ids.graph_drive_id,
      graph_folder_item_id: ids.graph_folder_item_id,
      graph_web_url: ids.graph_web_url,
      graph_provided_drawings_item_id: ids.graph_provided_drawings_item_id,
      graph_quote_forms_item_id: ids.graph_quote_forms_item_id,
      graph_misc_item_id: ids.graph_misc_item_id,
    })
    .eq("id", quoteId);

  if (error) {
    if (/graph_folder_item_id|schema cache|column/i.test(error.message)) {
      throw new Error(
        `${error.message} Run supabase/migrations/20260810000002_leads_graph_folder_ids.sql in the Supabase SQL Editor, then retry.`
      );
    }
    throw new Error(error.message);
  }
}

/**
 * Idempotently ensures the quote project folder and three category subfolders exist
 * under the Quotes root (or the contractor's Quotes folder), then persists DriveItem IDs.
 */
export async function ensureQuoteSharePointFolders(
  quoteId: string
): Promise<QuoteGraphFolderIds> {
  const lead = await loadLead(quoteId);
  const { driveId: configuredDriveId } = getConfiguredQuotesFolder();
  const parent = await resolveQuotesParentFolderId(lead.contact_id);
  const driveId = parent.driveId || configuredDriveId;
  const parentFolderId = parent.parentFolderId;
  const folderName = sanitizeSharePointFolderName(lead.project_type);

  let projectFolder: GraphDriveItem | null = null;

  if (lead.graph_folder_item_id) {
    try {
      const existing = await getDriveItem(
        lead.graph_drive_id || driveId,
        lead.graph_folder_item_id
      );
      if (existing.id && existing.folder) {
        projectFolder = existing;
      }
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
      // Reuse only if unclaimed or already claimed by this quote.
      const admin = createAdminClient();
      const { data: owner } = await admin
        .from("leads")
        .select("id")
        .eq("graph_folder_item_id", byName.id)
        .neq("id", quoteId)
        .maybeSingle();

      if (!owner) {
        projectFolder = byName;
      } else {
        // Same job name already used by another quote — create a uniquely named folder.
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
    throw new Error("Could not resolve quote SharePoint folder.");
  }

  const resolvedDriveId =
    projectFolder.parentReference?.driveId ?? lead.graph_drive_id ?? driveId;

  const provided = await ensureNamedSubfolder(
    resolvedDriveId,
    projectFolder.id,
    QUOTE_SHAREPOINT_SUBFOLDERS.provided_drawings,
    lead.graph_provided_drawings_item_id
  );
  const forms = await ensureNamedSubfolder(
    resolvedDriveId,
    projectFolder.id,
    QUOTE_SHAREPOINT_SUBFOLDERS.quote_forms,
    lead.graph_quote_forms_item_id
  );
  const misc = await ensureNamedSubfolder(
    resolvedDriveId,
    projectFolder.id,
    QUOTE_SHAREPOINT_SUBFOLDERS.misc,
    lead.graph_misc_item_id
  );

  if (!provided.id || !forms.id || !misc.id) {
    throw new Error("Could not ensure quote SharePoint category folders.");
  }

  const ids: QuoteGraphFolderIds = {
    graph_drive_id: resolvedDriveId,
    graph_folder_item_id: projectFolder.id,
    graph_web_url: projectFolder.webUrl ?? lead.graph_web_url ?? null,
    graph_provided_drawings_item_id: provided.id,
    graph_quote_forms_item_id: forms.id,
    graph_misc_item_id: misc.id,
  };

  await saveLeadGraphIds(quoteId, ids);
  return ids;
}

/**
 * Renames the quote SharePoint folder to match the Job Name, using DriveItem ID.
 * Does not create a second folder.
 */
export async function renameQuoteSharePointFolder(opts: {
  quoteId: string;
  newJobName: string;
}): Promise<QuoteGraphFolderIds> {
  const ids = await ensureQuoteSharePointFolders(opts.quoteId);
  const nextName = sanitizeSharePointFolderName(opts.newJobName);

  try {
    const { data } = await microsoftGraphPatch<GraphDriveItem>(
      `/drives/${encodeURIComponent(ids.graph_drive_id)}/items/${encodeURIComponent(ids.graph_folder_item_id)}`,
      { name: nextName },
      { timeoutMs: 30_000 }
    );

    const updated: QuoteGraphFolderIds = {
      ...ids,
      graph_web_url: data.webUrl ?? ids.graph_web_url,
    };
    await saveLeadGraphIds(opts.quoteId, updated);
    return updated;
  } catch (err) {
    if (
      err instanceof MicrosoftGraphAuthError &&
      (err.status === 409 ||
        /nameAlreadyExists|already exists/i.test(err.message))
    ) {
      // Keep DriveItem relationship; name collision is non-fatal.
      return ids;
    }
    throw err;
  }
}

export function parseQuoteSharePointCategory(
  value: string | null | undefined
): QuoteSharePointCategory | null {
  if (!value) return null;
  return isQuoteSharePointCategory(value) ? value : null;
}
