"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  IconArrowLeft,
  IconCheck,
  IconCopy,
  IconFolder,
  IconFolderPlus,
  IconRefresh,
  IconSearch,
} from "@tabler/icons-react";
import Button from "@/components/Button";
import { createClient } from "@/lib/supabase/client";

type SiteSummary = {
  id: string;
  name: string;
  displayName: string;
  webUrl: string | null;
};

type DriveSummary = {
  id: string;
  name: string;
  driveType: string | null;
  webUrl: string | null;
  siteId: string;
};

type FolderSummary = {
  id: string;
  name: string;
  driveId: string;
  webUrl: string | null;
  childCount: number | null;
  lastModifiedDateTime: string | null;
};

type Breadcrumb = {
  id: string | null;
  name: string;
};

type ApiError = {
  error?: string;
  graphStatus?: number;
};

function formatApiError(json: ApiError, fallback: string): string {
  const message = json.error?.trim() || fallback;
  if (json.graphStatus) {
    return `Graph HTTP ${json.graphStatus}: ${message}`;
  }
  return message;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      title={`Copy ${label}`}
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1200);
        });
      }}
      className="inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[11px] text-gray-600 hover:border-burgundy hover:text-burgundy"
    >
      <IconCopy size={12} />
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function MonoId({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="break-all rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-800">
        {value}
      </code>
      <CopyButton value={value} label={label} />
    </div>
  );
}

type TestFolderResult = {
  name: string;
  id: string;
  driveId: string;
  parentFolderId: string;
  webUrl: string | null;
};

function TestFolderResultPanel({ folder }: { folder: TestFolderResult }) {
  return (
    <div className="mt-3 space-y-2 rounded-md border border-emerald-200 bg-emerald-50 p-3">
      <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-900">
        <IconCheck size={16} />
        Test folder created
      </p>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-emerald-800">
          Folder name
        </p>
        <p className="text-sm text-gray-900">{folder.name}</p>
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-emerald-800">
          DriveItem ID
        </p>
        <MonoId value={folder.id} label="DriveItem ID" />
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-emerald-800">
          Parent DriveItem ID
        </p>
        <MonoId value={folder.parentFolderId} label="parent DriveItem ID" />
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-emerald-800">
          webUrl
        </p>
        {folder.webUrl ? (
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={folder.webUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-sm text-burgundy hover:underline"
            >
              {folder.webUrl}
            </a>
            <CopyButton value={folder.webUrl} label="web URL" />
          </div>
        ) : (
          <p className="text-sm text-gray-600">—</p>
        )}
      </div>
    </div>
  );
}

export default function MicrosoftGraphDiscoveryClient() {
  const [isOwner, setIsOwner] = useState(false);
  const [loadingRole, setLoadingRole] = useState(true);

  const [siteQuery, setSiteQuery] = useState("");
  const [sites, setSites] = useState<SiteSummary[]>([]);
  const [loadingSites, setLoadingSites] = useState(false);
  const [sitesError, setSitesError] = useState<string | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);

  const [drives, setDrives] = useState<DriveSummary[]>([]);
  const [loadingDrives, setLoadingDrives] = useState(false);
  const [drivesError, setDrivesError] = useState<string | null>(null);
  const [selectedDriveId, setSelectedDriveId] = useState<string | null>(null);

  const [folders, setFolders] = useState<FolderSummary[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [foldersError, setFoldersError] = useState<string | null>(null);
  const [path, setPath] = useState<Breadcrumb[]>([{ id: null, name: "Root" }]);

  const [jobsSelection, setJobsSelection] = useState<{
    driveId: string;
    folderId: string;
    folderName: string;
  } | null>(null);

  const [creatingTestJobFolder, setCreatingTestJobFolder] = useState(false);
  const [testJobFolderError, setTestJobFolderError] = useState<string | null>(null);
  const [testJobFolder, setTestJobFolder] = useState<TestFolderResult | null>(null);

  const [creatingTestQuoteFolder, setCreatingTestQuoteFolder] = useState(false);
  const [testQuoteFolderError, setTestQuoteFolderError] = useState<string | null>(
    null
  );
  const [testQuoteFolder, setTestQuoteFolder] = useState<TestFolderResult | null>(
    null
  );

  const selectedSite =
    sites.find((site) => site.id === selectedSiteId) ?? null;
  const selectedDrive =
    drives.find((drive) => drive.id === selectedDriveId) ?? null;
  const currentParentId = path[path.length - 1]?.id ?? null;

  useEffect(() => {
    let cancelled = false;
    async function loadRole() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) {
        if (!cancelled) {
          setIsOwner(false);
          setLoadingRole(false);
        }
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (!cancelled) {
        setIsOwner(profile?.role === "owner");
        setLoadingRole(false);
      }
    }
    void loadRole();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadSites = useCallback(async (q?: string) => {
    setLoadingSites(true);
    setSitesError(null);
    try {
      const query = q?.trim();
      const qs = query ? `?q=${encodeURIComponent(query)}` : "";
      const res = await fetch(`/api/integrations/microsoft-graph/sites${qs}`);
      const json = (await res.json()) as ApiError & {
        sites?: SiteSummary[];
        ok?: boolean;
      };
      if (!res.ok || json.ok === false) {
        setSites([]);
        setSitesError(formatApiError(json, "Could not load SharePoint sites."));
        return;
      }
      setSites(json.sites ?? []);
      if ((json.sites ?? []).length === 0) {
        setSitesError(
          "No SharePoint sites were returned. Try a search term (for example your company name), and confirm Sites.ReadWrite.All has admin consent."
        );
      }
    } catch {
      setSites([]);
      setSitesError("Could not load SharePoint sites.");
    } finally {
      setLoadingSites(false);
    }
  }, []);

  const loadDrives = useCallback(async (siteId: string) => {
    setLoadingDrives(true);
    setDrivesError(null);
    setDrives([]);
    setSelectedDriveId(null);
    setFolders([]);
    setPath([{ id: null, name: "Root" }]);
    try {
      const res = await fetch(
        `/api/integrations/microsoft-graph/site-drives?siteId=${encodeURIComponent(siteId)}`
      );
      const json = (await res.json()) as ApiError & {
        drives?: DriveSummary[];
        ok?: boolean;
      };
      if (!res.ok || json.ok === false) {
        setDrives([]);
        setDrivesError(
          formatApiError(json, "Could not load document libraries for this site.")
        );
        return;
      }
      setDrives(json.drives ?? []);
      if ((json.drives ?? []).length === 0) {
        setDrivesError(
          "This site returned no document libraries/drives. Confirm the site is correct and Files.ReadWrite.All / Sites.ReadWrite.All are consented."
        );
      }
    } catch {
      setDrives([]);
      setDrivesError("Could not load document libraries for this site.");
    } finally {
      setLoadingDrives(false);
    }
  }, []);

  const loadFolders = useCallback(
    async (driveId: string, itemId: string | null) => {
      setLoadingFolders(true);
      setFoldersError(null);
      try {
        const qs = itemId
          ? `?itemId=${encodeURIComponent(itemId)}`
          : "";
        const res = await fetch(
          `/api/integrations/microsoft-graph/drives/${encodeURIComponent(driveId)}/children${qs}`
        );
        const json = (await res.json()) as ApiError & {
          folders?: FolderSummary[];
          ok?: boolean;
        };
        if (!res.ok || json.ok === false) {
          setFolders([]);
          setFoldersError(
            formatApiError(json, "Could not load folders for this drive.")
          );
          return;
        }
        setFolders(json.folders ?? []);
      } catch {
        setFolders([]);
        setFoldersError("Could not load folders for this drive.");
      } finally {
        setLoadingFolders(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!isOwner) return;
    void loadSites();
  }, [isOwner, loadSites]);

  useEffect(() => {
    if (!selectedDriveId) {
      setFolders([]);
      return;
    }
    void loadFolders(selectedDriveId, currentParentId);
  }, [selectedDriveId, currentParentId, loadFolders]);

  function selectSite(siteId: string) {
    setSelectedSiteId(siteId);
    setJobsSelection(null);
    void loadDrives(siteId);
  }

  function selectDrive(driveId: string) {
    setSelectedDriveId(driveId);
    setPath([{ id: null, name: "Root" }]);
    setFoldersError(null);
    setJobsSelection(null);
  }

  function openFolder(folder: FolderSummary) {
    setPath((prev) => [...prev, { id: folder.id, name: folder.name }]);
  }

  function jumpToBreadcrumb(index: number) {
    setPath((prev) => prev.slice(0, index + 1));
  }

  function selectAsJobsFolder(folder: FolderSummary) {
    setJobsSelection({
      driveId: folder.driveId,
      folderId: folder.id,
      folderName: folder.name,
    });
  }

  async function handleCreateTestJobFolder() {
    setCreatingTestJobFolder(true);
    setTestJobFolderError(null);
    setTestJobFolder(null);
    try {
      const res = await fetch(
        "/api/integrations/microsoft-graph/create-test-folder",
        { method: "POST" }
      );
      const json = (await res.json()) as ApiError & {
        ok?: boolean;
        folder?: TestFolderResult;
      };
      if (!res.ok || json.ok === false || !json.folder) {
        setTestJobFolderError(
          formatApiError(json, "Could not create the Graph test job folder.")
        );
        return;
      }
      setTestJobFolder(json.folder);
    } catch {
      setTestJobFolderError("Could not create the Graph test job folder.");
    } finally {
      setCreatingTestJobFolder(false);
    }
  }

  async function handleCreateTestQuoteFolder() {
    setCreatingTestQuoteFolder(true);
    setTestQuoteFolderError(null);
    setTestQuoteFolder(null);
    try {
      const res = await fetch(
        "/api/integrations/microsoft-graph/create-test-quote-folder",
        { method: "POST" }
      );
      const json = (await res.json()) as ApiError & {
        ok?: boolean;
        folder?: TestFolderResult;
      };
      if (!res.ok || json.ok === false || !json.folder) {
        setTestQuoteFolderError(
          formatApiError(json, "Could not create the Graph test quote folder.")
        );
        return;
      }
      setTestQuoteFolder(json.folder);
    } catch {
      setTestQuoteFolderError("Could not create the Graph test quote folder.");
    } finally {
      setCreatingTestQuoteFolder(false);
    }
  }

  if (loadingRole) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-600">
          Owner access is required for Microsoft Graph discovery.
        </p>
        <Link
          href="/admin?tab=integrations"
          className="mt-3 inline-flex items-center gap-1 text-sm text-burgundy hover:underline"
        >
          <IconArrowLeft size={14} />
          Back to Integrations
        </Link>
      </div>
    );
  }

  const envSnippet = jobsSelection
    ? `MICROSOFT_DRIVE_ID=${jobsSelection.driveId}\nMICROSOFT_JOBS_FOLDER_ID=${jobsSelection.folderId}`
    : "";

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/admin?tab=integrations"
            className="mb-2 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-burgundy"
          >
            <IconArrowLeft size={14} />
            Integrations
          </Link>
          <h1 className="text-xl font-semibold text-gray-900">
            Microsoft Graph discovery
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">
            Setup utility: pick the SharePoint site, document library, then browse
            to your permanent <span className="font-medium">Jobs</span> folder.
            Secrets and access tokens stay server-side.
          </p>
        </div>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">
          Test configured parent folders
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-gray-600">
          Temporary admin tests create folders directly inside your configured
          Quotes and Jobs parent folders using server-side Graph credentials.
        </p>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-md border border-gray-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Create Test Quote Folder
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  Creates{" "}
                  <span className="font-medium">GRAPH TEST QUOTE - DELETE ME</span>{" "}
                  inside{" "}
                  <code className="text-xs">MICROSOFT_QUOTES_FOLDER_ID</code>.
                </p>
              </div>
              <Button
                type="button"
                variant="primary"
                disabled={creatingTestQuoteFolder}
                onClick={() => {
                  void handleCreateTestQuoteFolder();
                }}
              >
                <span className="inline-flex items-center gap-1.5">
                  <IconFolderPlus size={16} />
                  {creatingTestQuoteFolder
                    ? "Creating…"
                    : "Create Test Quote Folder"}
                </span>
              </Button>
            </div>

            {testQuoteFolderError ? (
              <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {testQuoteFolderError}
              </p>
            ) : null}

            {testQuoteFolder ? (
              <TestFolderResultPanel folder={testQuoteFolder} />
            ) : null}
          </div>

          <div className="rounded-md border border-gray-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Create Test Job Folder
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  Creates{" "}
                  <span className="font-medium">GRAPH TEST - DELETE ME</span> inside{" "}
                  <code className="text-xs">MICROSOFT_JOBS_FOLDER_ID</code>.
                </p>
              </div>
              <Button
                type="button"
                variant="primary"
                disabled={creatingTestJobFolder}
                onClick={() => {
                  void handleCreateTestJobFolder();
                }}
              >
                <span className="inline-flex items-center gap-1.5">
                  <IconFolderPlus size={16} />
                  {creatingTestJobFolder
                    ? "Creating…"
                    : "Create Test Job Folder"}
                </span>
              </Button>
            </div>

            {testJobFolderError ? (
              <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {testJobFolderError}
              </p>
            ) : null}

            {testJobFolder ? (
              <TestFolderResultPanel folder={testJobFolder} />
            ) : null}
          </div>
        </div>
      </section>

      {jobsSelection ? (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-900">
                <IconCheck size={16} />
                Selected Jobs folder: {jobsSelection.folderName}
              </p>
              <p className="mt-1 text-xs text-emerald-800">
                Copy these into `.env.local` (server-only). Do not use NEXT_PUBLIC_.
              </p>
            </div>
            <CopyButton value={envSnippet} label="env values" />
          </div>
          <div className="mt-3 space-y-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-800">
                MICROSOFT_DRIVE_ID
              </p>
              <MonoId value={jobsSelection.driveId} label="MICROSOFT_DRIVE_ID" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-800">
                MICROSOFT_JOBS_FOLDER_ID
              </p>
              <MonoId
                value={jobsSelection.folderId}
                label="MICROSOFT_JOBS_FOLDER_ID"
              />
            </div>
            <pre className="overflow-x-auto rounded border border-emerald-200 bg-white p-3 text-xs text-gray-800">
              {envSnippet}
            </pre>
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border border-gray-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              1. SharePoint sites
            </h2>
            <p className="text-xs text-gray-500">
              Search/discover sites, then select the company site that holds Jobs.
            </p>
          </div>
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void loadSites(siteQuery);
            }}
          >
            <div className="relative">
              <IconSearch
                size={16}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                value={siteQuery}
                onChange={(e) => setSiteQuery(e.target.value)}
                placeholder="Search sites (optional)"
                className="rounded-md border border-gray-300 py-1.5 pl-8 pr-3 text-sm focus:border-burgundy focus:outline-none focus:ring-1 focus:ring-burgundy"
              />
            </div>
            <Button type="submit" variant="secondary" disabled={loadingSites}>
              <span className="inline-flex items-center gap-1.5">
                <IconRefresh size={14} />
                {loadingSites ? "Searching…" : "Search"}
              </span>
            </Button>
          </form>
        </div>

        {sitesError ? (
          <p className="border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {sitesError}
          </p>
        ) : null}

        {loadingSites ? (
          <p className="px-4 py-6 text-sm text-gray-500">Loading sites…</p>
        ) : sites.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">
            No sites loaded yet. Try searching for your company or SharePoint
            site name.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-2">Site name</th>
                  <th className="px-4 py-2">Site ID</th>
                  <th className="px-4 py-2">Web URL</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {sites.map((site) => {
                  const selected = site.id === selectedSiteId;
                  return (
                    <tr
                      key={site.id}
                      className={`border-b border-gray-50 ${
                        selected ? "bg-burgundy/5" : "hover:bg-gray-50/80"
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">
                          {site.displayName}
                        </div>
                        {site.name !== site.displayName ? (
                          <div className="text-xs text-gray-500">{site.name}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <MonoId value={site.id} label="site ID" />
                      </td>
                      <td className="px-4 py-3">
                        {site.webUrl ? (
                          <a
                            href={site.webUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block max-w-[240px] truncate text-xs text-burgundy hover:underline"
                          >
                            {site.webUrl}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          type="button"
                          variant={selected ? "primary" : "secondary"}
                          onClick={() => selectSite(site.id)}
                        >
                          {selected ? "Selected" : "Select"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">
            2. Document libraries / drives
          </h2>
          <p className="text-xs text-gray-500">
            {selectedSite
              ? `Libraries for ${selectedSite.displayName} via GET /sites/{site-id}/drives`
              : "Select a SharePoint site first."}
          </p>
        </div>

        {!selectedSite ? (
          <p className="px-4 py-6 text-sm text-gray-500">No site selected.</p>
        ) : drivesError ? (
          <p className="px-4 py-3 text-sm text-red-700">{drivesError}</p>
        ) : null}

        {selectedSite && loadingDrives ? (
          <p className="px-4 py-6 text-sm text-gray-500">Loading drives…</p>
        ) : null}

        {selectedSite && !loadingDrives && drives.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-2">Drive name</th>
                  <th className="px-4 py-2">Drive ID</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Web URL</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {drives.map((drive) => {
                  const selected = drive.id === selectedDriveId;
                  return (
                    <tr
                      key={drive.id}
                      className={`border-b border-gray-50 ${
                        selected ? "bg-burgundy/5" : "hover:bg-gray-50/80"
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {drive.name}
                      </td>
                      <td className="px-4 py-3">
                        <MonoId value={drive.id} label="drive ID" />
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {drive.driveType || "—"}
                      </td>
                      <td className="px-4 py-3">
                        {drive.webUrl ? (
                          <a
                            href={drive.webUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block max-w-[220px] truncate text-xs text-burgundy hover:underline"
                          >
                            {drive.webUrl}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          type="button"
                          variant={selected ? "primary" : "secondary"}
                          onClick={() => selectDrive(drive.id)}
                        >
                          {selected ? "Selected" : "Inspect"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">
            3. Browse folders
          </h2>
          <p className="text-xs text-gray-500">
            {selectedDrive
              ? `${selectedDrive.name} — open folders until you find Jobs, then use “Use this as Jobs folder”.`
              : "Select a drive/document library first."}
          </p>
        </div>

        {!selectedDrive ? (
          <p className="px-4 py-6 text-sm text-gray-500">No drive selected.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-4 py-2 text-sm">
              {path.map((crumb, index) => (
                <span
                  key={`${crumb.id ?? "root"}-${index}`}
                  className="flex items-center gap-2"
                >
                  {index > 0 ? <span className="text-gray-300">/</span> : null}
                  <button
                    type="button"
                    onClick={() => jumpToBreadcrumb(index)}
                    className={
                      index === path.length - 1
                        ? "font-medium text-gray-900"
                        : "text-burgundy hover:underline"
                    }
                  >
                    {crumb.name}
                  </button>
                </span>
              ))}
              <button
                type="button"
                className="ml-auto inline-flex items-center gap-1 text-xs text-gray-500 hover:text-burgundy"
                onClick={() =>
                  void loadFolders(selectedDrive.id, currentParentId)
                }
                disabled={loadingFolders}
              >
                <IconRefresh size={14} />
                Refresh
              </button>
            </div>

            {foldersError ? (
              <p className="px-4 py-3 text-sm text-red-700">{foldersError}</p>
            ) : null}

            {loadingFolders ? (
              <p className="px-4 py-6 text-sm text-gray-500">Loading folders…</p>
            ) : folders.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-500">
                No folders in this location.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-2">Folder name</th>
                      <th className="px-4 py-2">DriveItem ID</th>
                      <th className="px-4 py-2">Drive ID</th>
                      <th className="px-4 py-2">Web URL</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {folders.map((folder) => {
                      const isJobs =
                        folder.name.trim().toLowerCase() === "jobs";
                      const isSelected =
                        jobsSelection?.folderId === folder.id;
                      return (
                        <tr
                          key={folder.id}
                          className={`border-b border-gray-50 hover:bg-gray-50/80 ${
                            isJobs ? "bg-amber-50/70" : ""
                          }`}
                        >
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-2 font-medium text-gray-900">
                              <IconFolder
                                size={16}
                                className={
                                  isJobs ? "text-amber-600" : "text-gray-500"
                                }
                              />
                              {folder.name}
                              {isJobs ? (
                                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                                  Likely target
                                </span>
                              ) : null}
                            </span>
                            {folder.childCount != null ? (
                              <span className="mt-0.5 block text-xs text-gray-500">
                                {folder.childCount} items
                              </span>
                            ) : null}
                          </td>
                          <td className="px-4 py-3">
                            <MonoId value={folder.id} label="DriveItem ID" />
                          </td>
                          <td className="px-4 py-3">
                            <MonoId value={folder.driveId} label="Drive ID" />
                          </td>
                          <td className="px-4 py-3">
                            {folder.webUrl ? (
                              <div className="space-y-1">
                                <a
                                  href={folder.webUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block max-w-[220px] truncate text-xs text-burgundy hover:underline"
                                >
                                  {folder.webUrl}
                                </a>
                                <CopyButton
                                  value={folder.webUrl}
                                  label="web URL"
                                />
                              </div>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
                              <Button
                                type="button"
                                variant="secondary"
                                onClick={() => openFolder(folder)}
                              >
                                Open
                              </Button>
                              <Button
                                type="button"
                                variant={isSelected ? "primary" : "secondary"}
                                onClick={() => selectAsJobsFolder(folder)}
                              >
                                {isSelected
                                  ? "Selected as Jobs"
                                  : "Use this as Jobs folder"}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
