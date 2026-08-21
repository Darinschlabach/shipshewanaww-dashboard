import {
  type CompanyFile,
  type JobFilesTab,
} from "@/lib/files";
import type {
  JobSharePointCategory,
  ProductionDrawingSubfolder,
} from "@/lib/integrations/microsoft-graph-job-folders";

function isJobSharePointCategory(
  value: JobFilesTab
): value is JobSharePointCategory {
  return (
    value === "provided_drawings" ||
    value === "quote_forms" ||
    value === "misc" ||
    value === "production_drawings" ||
    value === "cv_client_drawings" ||
    value === "appliance_specs" ||
    value === "purchase_orders" ||
    value === "invoices"
  );
}

export async function ensureJobSharePointFolder(jobId: string): Promise<{
  ok: boolean;
  error: string | null;
}> {
  try {
    const res = await fetch(
      `/api/jobs/${encodeURIComponent(jobId)}/sharepoint/ensure-folder`,
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

export async function renameJobSharePointFolderClient(opts: {
  jobId: string;
  jobName: string;
}): Promise<{ ok: boolean; error: string | null }> {
  try {
    const res = await fetch(
      `/api/jobs/${encodeURIComponent(opts.jobId)}/sharepoint/rename-folder`,
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

export async function convertQuoteSharePointToJobClient(opts: {
  quoteId: string;
  jobId: string;
}): Promise<{ ok: boolean; error: string | null }> {
  try {
    const res = await fetch(
      `/api/quotes/${encodeURIComponent(opts.quoteId)}/sharepoint/convert-to-job`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: opts.jobId }),
      }
    );
    const json = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || json.ok === false) {
      return {
        ok: false,
        error: json.error ?? "Could not move SharePoint folder to Jobs.",
      };
    }
    return { ok: true, error: null };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Could not move SharePoint folder to Jobs.",
    };
  }
}

export async function listJobFiles(jobId: string): Promise<{
  files: CompanyFile[];
  error: string | null;
}> {
  try {
    const res = await fetch(
      `/api/jobs/${encodeURIComponent(jobId)}/sharepoint/files`
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

export async function uploadJobFiles(opts: {
  jobId: string;
  drawingCategory: JobFilesTab;
  productionSubfolder?: ProductionDrawingSubfolder | null;
  files: File[];
  uploadedByName: string;
  uploadedById: string | null;
}): Promise<{ files: CompanyFile[]; error: string | null }> {
  const { jobId, drawingCategory, productionSubfolder, files, uploadedByName } =
    opts;
  if (files.length === 0) return { files: [], error: null };
  if (!isJobSharePointCategory(drawingCategory)) {
    return {
      files: [],
      error: "This file category is not available for jobs.",
    };
  }

  try {
    const form = new FormData();
    form.set("category", drawingCategory);
    form.set("uploadedByName", uploadedByName);
    if (productionSubfolder) {
      form.set("subfolder", productionSubfolder);
    }
    for (const file of files) {
      form.append("files", file, file.name);
    }

    const res = await fetch(
      `/api/jobs/${encodeURIComponent(jobId)}/sharepoint/files`,
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

export async function deleteJobSharePointFile(opts: {
  jobId: string;
  itemId: string;
}): Promise<{ error: string | null }> {
  try {
    const res = await fetch(
      `/api/jobs/${encodeURIComponent(opts.jobId)}/sharepoint/files/${encodeURIComponent(opts.itemId)}`,
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

/** @deprecated Use deleteJobSharePointFile */
export async function deleteJobFile(
  _fileId: string
): Promise<{ error: string | null }> {
  return {
    error:
      "Missing job context for SharePoint delete. Use deleteJobSharePointFile.",
  };
}

export async function renameJobSharePointFile(opts: {
  jobId: string;
  itemId: string;
  newName: string;
}): Promise<{ file: CompanyFile | null; error: string | null }> {
  try {
    const res = await fetch(
      `/api/jobs/${encodeURIComponent(opts.jobId)}/sharepoint/files/${encodeURIComponent(opts.itemId)}`,
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

export async function openJobSharePointFile(opts: {
  jobId: string;
  itemId: string;
}): Promise<{ url: string | null; error: string | null }> {
  try {
    const res = await fetch(
      `/api/jobs/${encodeURIComponent(opts.jobId)}/sharepoint/files/${encodeURIComponent(opts.itemId)}`
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
