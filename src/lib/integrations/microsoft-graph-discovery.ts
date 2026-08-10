import {
  MicrosoftGraphAuthError,
  microsoftGraphGet,
} from "@/lib/integrations/microsoft-graph";

export type GraphSiteSummary = {
  id: string;
  name: string;
  displayName: string;
  webUrl: string | null;
};

export type GraphDriveSummary = {
  id: string;
  name: string;
  driveType: string | null;
  webUrl: string | null;
  siteId: string;
};

export type GraphFolderSummary = {
  id: string;
  name: string;
  driveId: string;
  webUrl: string | null;
  childCount: number | null;
  lastModifiedDateTime: string | null;
};

type GraphListResponse<T> = {
  value?: T[];
  "@odata.nextLink"?: string;
};

type GraphSite = {
  id?: string;
  displayName?: string;
  name?: string;
  webUrl?: string;
};

type GraphDrive = {
  id?: string;
  name?: string;
  driveType?: string;
  webUrl?: string;
};

type GraphDriveItem = {
  id?: string;
  name?: string;
  webUrl?: string;
  folder?: { childCount?: number };
  parentReference?: { driveId?: string };
  lastModifiedDateTime?: string;
};

async function getAllPages<T>(
  initialPath: string,
  opts?: { maxPages?: number; timeoutMs?: number }
): Promise<T[]> {
  const items: T[] = [];
  let next: string | null = initialPath;
  const maxPages = opts?.maxPages ?? 5;
  let pages = 0;

  while (next && pages < maxPages) {
    pages += 1;
    const page: { data: GraphListResponse<T>; status: number } =
      await microsoftGraphGet<GraphListResponse<T>>(next, {
        timeoutMs: opts?.timeoutMs ?? 20_000,
      });
    if (Array.isArray(page.data.value)) {
      items.push(...page.data.value);
    }
    next = page.data["@odata.nextLink"] ?? null;
  }

  return items;
}

function mapSite(site: GraphSite): GraphSiteSummary | null {
  if (!site.id) return null;
  const displayName = site.displayName?.trim() || site.name?.trim() || "Untitled site";
  return {
    id: site.id,
    name: site.name?.trim() || displayName,
    displayName,
    webUrl: site.webUrl ?? null,
  };
}

function mapDrive(drive: GraphDrive, siteId: string): GraphDriveSummary | null {
  if (!drive.id || !drive.name) return null;
  return {
    id: drive.id,
    name: drive.name,
    driveType: drive.driveType ?? null,
    webUrl: drive.webUrl ?? null,
    siteId,
  };
}

/**
 * Lists SharePoint sites available to the app (application permissions).
 * Includes the tenant root site, then a Graph site search.
 */
export async function listSharePointSites(opts?: {
  search?: string | null;
}): Promise<GraphSiteSummary[]> {
  const byId = new Map<string, GraphSiteSummary>();
  const search = opts?.search?.trim() || "*";

  try {
    const { data: root } = await microsoftGraphGet<GraphSite>(
      "/sites/root?$select=id,displayName,name,webUrl",
      { timeoutMs: 15_000 }
    );
    const mapped = mapSite(root);
    if (mapped) byId.set(mapped.id, mapped);
  } catch (err) {
    if (!(err instanceof MicrosoftGraphAuthError)) throw err;
    // Continue with search if root fails.
  }

  const query = encodeURIComponent(search);
  try {
    const sites = await getAllPages<GraphSite>(
      `/sites?search=${query}&$select=id,displayName,name,webUrl&$top=50`,
      { maxPages: 4, timeoutMs: 20_000 }
    );

    for (const site of sites) {
      const mapped = mapSite(site);
      if (mapped) byId.set(mapped.id, mapped);
    }
  } catch (err) {
    if (!(err instanceof MicrosoftGraphAuthError)) throw err;
    if (byId.size === 0) throw err;
  }

  return [...byId.values()].sort((a, b) =>
    a.displayName.localeCompare(b.displayName, undefined, {
      sensitivity: "base",
    })
  );
}

/** Lists document libraries for a SharePoint site: GET /sites/{site-id}/drives */
export async function listSiteDrives(siteId: string): Promise<GraphDriveSummary[]> {
  const id = siteId.trim();
  if (!id) {
    throw new MicrosoftGraphAuthError("siteId is required.", 400);
  }

  const drives = await getAllPages<GraphDrive>(
    `/sites/${encodeURIComponent(id)}/drives?$top=50`,
    { maxPages: 3, timeoutMs: 20_000 }
  );

  return drives
    .map((drive) => mapDrive(drive, id))
    .filter((drive): drive is GraphDriveSummary => Boolean(drive))
    .sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
}

/** Lists folder children under a drive root or folder item. */
export async function listDriveFolders(opts: {
  driveId: string;
  parentItemId?: string | null;
}): Promise<GraphFolderSummary[]> {
  const driveId = opts.driveId.trim();
  if (!driveId) {
    throw new MicrosoftGraphAuthError("driveId is required.", 400);
  }

  const parentItemId = opts.parentItemId?.trim() || null;
  const path = parentItemId
    ? `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(parentItemId)}/children?$top=200`
    : `/drives/${encodeURIComponent(driveId)}/root/children?$top=200`;

  const items = await getAllPages<GraphDriveItem>(path, {
    maxPages: 5,
    timeoutMs: 20_000,
  });

  return items
    .filter((item) => Boolean(item.folder) && Boolean(item.id) && Boolean(item.name))
    .map((item) => ({
      id: item.id as string,
      name: item.name as string,
      driveId: item.parentReference?.driveId ?? driveId,
      webUrl: item.webUrl ?? null,
      childCount:
        typeof item.folder?.childCount === "number"
          ? item.folder.childCount
          : null,
      lastModifiedDateTime: item.lastModifiedDateTime ?? null,
    }))
    .sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
}

export function graphErrorPayload(err: unknown): {
  message: string;
  graphStatus: number;
  details: unknown;
} {
  if (err instanceof MicrosoftGraphAuthError) {
    return {
      message: err.message,
      graphStatus: err.status,
      details: err.details,
    };
  }
  return {
    message:
      err instanceof Error ? err.message : "Microsoft Graph request failed.",
    graphStatus: 500,
    details: null,
  };
}
