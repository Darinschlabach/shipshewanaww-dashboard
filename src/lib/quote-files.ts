import {
  type CompanyFile,
  type JobFilesTab,
} from "@/lib/files";
import type { QuoteSharePointCategory } from "@/lib/integrations/microsoft-graph-quote-folders";

function isQuoteSharePointCategory(
  value: JobFilesTab
): value is QuoteSharePointCategory {
  return (
    value === "provided_drawings" ||
    value === "quote_forms" ||
    value === "misc"
  );
}

export async function ensureQuoteSharePointFolder(quoteId: string): Promise<{
  ok: boolean;
  error: string | null;
}> {
  try {
    const res = await fetch(
      `/api/quotes/${encodeURIComponent(quoteId)}/sharepoint/ensure-folder`,
      { method: "POST" }
    );
    const json = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || json.ok === false) {
      return { ok: false, error: json.error ?? "Could not ensure SharePoint folder." };
    }
    return { ok: true, error: null };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Could not ensure SharePoint folder.",
    };
  }
}

export async function renameQuoteSharePointFolderClient(opts: {
  quoteId: string;
  jobName: string;
}): Promise<{ ok: boolean; error: string | null }> {
  try {
    const res = await fetch(
      `/api/quotes/${encodeURIComponent(opts.quoteId)}/sharepoint/rename-folder`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobName: opts.jobName }),
      }
    );
    const json = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || json.ok === false) {
      return {
        ok: false,
        error: json.error ?? "Could not rename SharePoint folder.",
      };
    }
    return { ok: true, error: null };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Could not rename SharePoint folder.",
    };
  }
}

export async function listQuoteFiles(quoteId: string): Promise<{
  files: CompanyFile[];
  error: string | null;
}> {
  try {
    const res = await fetch(
      `/api/quotes/${encodeURIComponent(quoteId)}/sharepoint/files`
    );
    const json = (await res.json()) as {
      ok?: boolean;
      error?: string;
      files?: CompanyFile[];
    };
    if (!res.ok || json.ok === false) {
      return { files: [], error: json.error ?? "Could not load SharePoint files." };
    }
    return { files: json.files ?? [], error: null };
  } catch (err) {
    return {
      files: [],
      error:
        err instanceof Error
          ? err.message
          : "Could not load SharePoint files.",
    };
  }
}

export async function uploadQuoteFiles(opts: {
  quoteId: string;
  drawingCategory: JobFilesTab;
  files: File[];
  uploadedByName: string;
  uploadedById: string | null;
}): Promise<{ files: CompanyFile[]; error: string | null }> {
  const { quoteId, drawingCategory, files, uploadedByName } = opts;
  if (files.length === 0) return { files: [], error: null };
  if (!isQuoteSharePointCategory(drawingCategory)) {
    return {
      files: [],
      error: "This file category is not available for quotes.",
    };
  }

  try {
    const form = new FormData();
    form.set("category", drawingCategory);
    form.set("uploadedByName", uploadedByName);
    for (const file of files) {
      form.append("files", file, file.name);
    }

    const res = await fetch(
      `/api/quotes/${encodeURIComponent(quoteId)}/sharepoint/files`,
      { method: "POST", body: form }
    );
    const json = (await res.json()) as {
      ok?: boolean;
      error?: string;
      files?: CompanyFile[];
    };
    if (!res.ok || json.ok === false) {
      return {
        files: json.files ?? [],
        error: json.error ?? "Could not upload to SharePoint.",
      };
    }
    return { files: json.files ?? [], error: null };
  } catch (err) {
    return {
      files: [],
      error:
        err instanceof Error
          ? err.message
          : "Could not upload to SharePoint.",
    };
  }
}

export async function deleteQuoteFile(fileId: string): Promise<{ error: string | null }> {
  // Prefer deleteQuoteSharePointFile with quoteId when available.
  return {
    error:
      "Missing quote context for SharePoint delete. Use deleteQuoteSharePointFile.",
  };
}

export async function deleteQuoteSharePointFile(opts: {
  quoteId: string;
  itemId: string;
}): Promise<{ error: string | null }> {
  try {
    const res = await fetch(
      `/api/quotes/${encodeURIComponent(opts.quoteId)}/sharepoint/files/${encodeURIComponent(opts.itemId)}`,
      { method: "DELETE" }
    );
    const json = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || json.ok === false) {
      return { error: json.error ?? "Could not delete SharePoint file." };
    }
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

export async function renameQuoteSharePointFile(opts: {
  quoteId: string;
  itemId: string;
  newName: string;
}): Promise<{ file: CompanyFile | null; error: string | null }> {
  try {
    const res = await fetch(
      `/api/quotes/${encodeURIComponent(opts.quoteId)}/sharepoint/files/${encodeURIComponent(opts.itemId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: opts.newName }),
      }
    );
    const json = (await res.json()) as {
      ok?: boolean;
      error?: string;
      file?: CompanyFile;
    };
    if (!res.ok || json.ok === false || !json.file) {
      return {
        file: null,
        error: json.error ?? "Could not rename SharePoint file.",
      };
    }
    return { file: json.file, error: null };
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

export async function openQuoteSharePointFile(opts: {
  quoteId: string;
  itemId: string;
}): Promise<{ url: string | null; error: string | null }> {
  try {
    const res = await fetch(
      `/api/quotes/${encodeURIComponent(opts.quoteId)}/sharepoint/files/${encodeURIComponent(opts.itemId)}`
    );
    const json = (await res.json()) as {
      ok?: boolean;
      error?: string;
      url?: string;
    };
    if (!res.ok || json.ok === false || !json.url) {
      return { url: null, error: json.error ?? "Could not open file." };
    }
    return { url: json.url, error: null };
  } catch (err) {
    return {
      url: null,
      error: err instanceof Error ? err.message : "Could not open file.",
    };
  }
}
