import { createClient } from "@/lib/supabase/client";
import {
  fileTypeFromFile,
  formatFileSize,
  getInitials,
  type CompanyFile,
  type FileType,
  type JobFilesTab,
} from "@/lib/files";

export type JobFileRow = {
  id: string;
  job_id: string;
  name: string;
  storage_path: string;
  drawing_category: JobFilesTab;
  file_type: FileType;
  size_bytes: number;
  uploaded_by_id: string | null;
  uploaded_by_name: string;
  created_at: string;
};

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.\-()+ ]+/g, "_").slice(0, 180);
}

export async function listJobFiles(jobId: string): Promise<{
  files: CompanyFile[];
  error: string | null;
}> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("job_files")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });

  if (error) {
    return { files: [], error: error.message };
  }

  const rows = (data as JobFileRow[]) ?? [];

  const files = await Promise.all(
    rows.map(async (row) => {
      let url: string | null = null;
      try {
        const { data: signed, error: signError } = await supabase.storage
          .from("job-files")
          .createSignedUrl(row.storage_path, 60 * 60 * 24);
        url = signError ? null : (signed?.signedUrl ?? null);
      } catch {
        url = null;
      }

      return {
        id: row.id,
        name: row.name,
        category: "Shop Resources" as const,
        modifiedAt: row.created_at,
        size: formatFileSize(Number(row.size_bytes) || 0),
        type: row.file_type,
        uploadedBy: row.uploaded_by_name,
        uploaderInitials: getInitials(row.uploaded_by_name),
        starred: false,
        isFolder: false,
        jobId: row.job_id,
        drawingCategory: row.drawing_category,
        url,
      } satisfies CompanyFile;
    })
  );

  return { files, error: null };
}

export async function uploadJobFiles(opts: {
  jobId: string;
  drawingCategory: JobFilesTab;
  files: File[];
  uploadedByName: string;
  uploadedById: string | null;
}): Promise<{ files: CompanyFile[]; error: string | null }> {
  const {
    jobId,
    drawingCategory,
    files,
    uploadedByName,
    uploadedById,
  } = opts;
  if (files.length === 0) return { files: [], error: null };

  const supabase = createClient();
  const created: CompanyFile[] = [];

  for (const file of files) {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const storagePath = `${jobId}/${drawingCategory}/${id}-${sanitizeFileName(file.name)}`;

    const { error: uploadError } = await supabase.storage
      .from("job-files")
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || undefined,
      });

    if (uploadError) {
      return {
        files: created,
        error: uploadError.message,
      };
    }

    const fileType = fileTypeFromFile(file);
    const { data: row, error: insertError } = await supabase
      .from("job_files")
      .insert({
        id,
        job_id: jobId,
        name: file.name,
        storage_path: storagePath,
        drawing_category: drawingCategory,
        file_type: fileType,
        size_bytes: file.size,
        uploaded_by_id: uploadedById,
        uploaded_by_name: uploadedByName,
      })
      .select("*")
      .single();

    if (insertError || !row) {
      await supabase.storage.from("job-files").remove([storagePath]);
      return {
        files: created,
        error: insertError?.message ?? "Could not save file metadata.",
      };
    }

    const saved = row as JobFileRow;
    const { data: signed } = await supabase.storage
      .from("job-files")
      .createSignedUrl(saved.storage_path, 60 * 60 * 24);

    created.push({
      id: saved.id,
      name: saved.name,
      category: "Shop Resources",
      modifiedAt: saved.created_at,
      size: formatFileSize(Number(saved.size_bytes) || 0),
      type: saved.file_type,
      uploadedBy: saved.uploaded_by_name,
      uploaderInitials: getInitials(saved.uploaded_by_name),
      starred: false,
      isFolder: false,
      jobId: saved.job_id,
      drawingCategory: saved.drawing_category,
      url: signed?.signedUrl ?? URL.createObjectURL(file),
    });
  }

  return { files: created, error: null };
}

export async function deleteJobFile(fileId: string): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("job_files")
    .select("storage_path")
    .eq("id", fileId)
    .maybeSingle();

  if (error && !error.message.toLowerCase().includes("job_files")) {
    return { error: error.message };
  }

  if (data?.storage_path) {
    const { error: storageError } = await supabase.storage
      .from("job-files")
      .remove([data.storage_path as string]);
    if (storageError) {
      return { error: storageError.message };
    }
    const { error: deleteError } = await supabase
      .from("job_files")
      .delete()
      .eq("id", fileId);
    if (deleteError) {
      return { error: deleteError.message };
    }
  }

  return { error: null };
}
