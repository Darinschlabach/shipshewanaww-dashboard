"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  IconBook,
  IconChevronRight,
  IconClipboard,
  IconDotsVertical,
  IconFile,
  IconFileSpreadsheet,
  IconFileTypePdf,
  IconFolder,
  IconPhoto,
  IconSearch,
  IconShield,
  IconTool,
  IconLayersLinked,
  IconPaperclip,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react";
import {
  CATEGORY_CARDS,
  CATEGORY_STYLES,
  JOB_DRAWING_LABELS,
  MOCK_FILES,
  filterCompanyFiles,
  type CompanyFile,
  type CompanyFileCategory,
  type FileType,
  type FilesTab,
  type JobFilesTab,
} from "@/lib/files";
import { deleteJobFile, listJobFiles, uploadJobFiles } from "@/lib/job-files";
import {
  isMissingJobFilesTableError,
  localDeleteJobFile,
  localListJobFiles,
  localUploadJobFiles,
} from "@/lib/job-files-local";
import { deleteQuoteFile, listQuoteFiles, uploadQuoteFiles } from "@/lib/quote-files";
import {
  isMissingQuoteFilesTableError,
  localDeleteQuoteFile,
  localListQuoteFiles,
  localUploadQuoteFiles,
} from "@/lib/quote-files-local";
import ConfirmModal from "@/components/ConfirmModal";
import FilesSidebar from "@/components/files/FilesSidebar";
import { createClient } from "@/lib/supabase/client";

const COMPANY_FILE_TABS: { value: FilesTab; label: string }[] = [
  { value: "all", label: "All Files" },
  { value: "folders", label: "Folders" },
  { value: "shared", label: "Shared with Me" },
  { value: "recent", label: "Recent" },
  { value: "trash", label: "Trash" },
];

const ENTITY_FILE_TABS: { value: FilesTab; label: string }[] = [
  { value: "provided_drawings", label: "Provided Drawings" },
  { value: "production_drawings", label: "Production Drawings" },
  { value: "misc", label: "Misc." },
];

const CARD_ICONS: Record<string, typeof IconFolder> = {
  folder: IconFolder,
  clipboard: IconClipboard,
  wrench: IconTool,
  book: IconBook,
  layers: IconLayersLinked,
  shield: IconShield,
};

function isEntityFilesTab(tab: FilesTab): tab is JobFilesTab {
  return (
    tab === "provided_drawings" ||
    tab === "production_drawings" ||
    tab === "misc"
  );
}

function FileIcon({ type }: { type: FileType }) {
  const className = "shrink-0 text-gray-500";
  switch (type) {
    case "pdf":
      return <IconFileTypePdf size={18} className="text-red-500" />;
    case "image":
      return <IconPhoto size={18} className={className} />;
    case "spreadsheet":
      return <IconFileSpreadsheet size={18} className="text-green-600" />;
    case "folder":
      return <IconFolder size={18} className="text-amber-600" />;
    case "doc":
      return <IconFile size={18} className="text-blue-600" />;
    default:
      return <IconFile size={18} className={className} />;
  }
}

function fileCategoryLabel(file: CompanyFile, isEntity: boolean): string {
  if (isEntity && file.drawingCategory) {
    return JOB_DRAWING_LABELS[file.drawingCategory];
  }
  return file.category;
}

function isMissingEntityFilesTableError(
  kind: "job" | "quote",
  message: string | null | undefined
): boolean {
  return kind === "job"
    ? isMissingJobFilesTableError(message)
    : isMissingQuoteFilesTableError(message);
}

interface FilesViewProps {
  jobId?: string;
  quoteId?: string;
  showSidebar?: boolean;
  showCategoryCards?: boolean;
  onFileCountChange?: (count: number) => void;
}

export default function FilesView({
  jobId,
  quoteId,
  showSidebar = true,
  showCategoryCards = true,
  onFileCountChange,
}: FilesViewProps) {
  const ownerKind = jobId ? "job" : quoteId ? "quote" : null;
  const ownerId = jobId ?? quoteId ?? null;
  const isEntityFiles = Boolean(ownerKind && ownerId);
  const fileTabs = isEntityFiles ? ENTITY_FILE_TABS : COMPANY_FILE_TABS;
  const [tab, setTab] = useState<FilesTab>(
    isEntityFiles ? "provided_drawings" : "all"
  );
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CompanyFileCategory | null>(
    null
  );
  const [entityFiles, setEntityFiles] = useState<CompanyFile[]>([]);
  const [uploaderName, setUploaderName] = useState("User");
  const [uploaderId, setUploaderId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [menuFileId, setMenuFileId] = useState<string | null>(null);
  const [filePendingDelete, setFilePendingDelete] = useState<CompanyFile | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  useEffect(() => {
    if (!isEntityFiles) return;
    let cancelled = false;
    async function loadUploader() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      const name =
        profile?.full_name?.trim() ||
        (user.user_metadata?.full_name as string | undefined)?.trim() ||
        user.email?.split("@")[0] ||
        "User";
      if (!cancelled) {
        setUploaderName(name);
        setUploaderId(user.id);
      }
    }
    void loadUploader();
    return () => {
      cancelled = true;
    };
  }, [isEntityFiles]);

  useEffect(() => {
    onFileCountChange?.(entityFiles.length);
  }, [entityFiles.length, onFileCountChange]);

  useEffect(() => {
    if (!ownerId || !ownerKind) {
      setEntityFiles([]);
      return;
    }
    let cancelled = false;
    async function loadFiles() {
      setLoadingFiles(true);
      setUploadError(null);
      try {
        const remote =
          ownerKind === "job"
            ? await listJobFiles(ownerId!)
            : await listQuoteFiles(ownerId!);
        let local: CompanyFile[] = [];
        try {
          local =
            ownerKind === "job"
              ? await localListJobFiles(ownerId!)
              : await localListQuoteFiles(ownerId!);
        } catch (err) {
          console.error("Local entity files load failed:", err);
        }
        if (cancelled) return;

        if (!remote.error) {
          const byId = new Map<string, CompanyFile>();
          for (const file of local) byId.set(file.id, file);
          for (const file of remote.files) byId.set(file.id, file);
          setEntityFiles(
            [...byId.values()].sort((a, b) =>
              b.modifiedAt.localeCompare(a.modifiedAt)
            )
          );
        } else if (isMissingEntityFilesTableError(ownerKind!, remote.error)) {
          setEntityFiles(local);
        } else {
          setUploadError(remote.error);
          setEntityFiles(local);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Entity files load failed:", err);
          setUploadError(
            err instanceof Error ? err.message : "Could not load files."
          );
        }
      } finally {
        if (!cancelled) setLoadingFiles(false);
      }
    }
    void loadFiles();
    return () => {
      cancelled = true;
    };
  }, [ownerId, ownerKind]);

  function openFile(file: CompanyFile) {
    if (file.isFolder || !file.url) return;
    window.open(file.url, "_blank", "noopener,noreferrer");
  }

  const scopeFiles = useMemo(() => {
    if (!isEntityFiles) return MOCK_FILES;
    return entityFiles;
  }, [isEntityFiles, entityFiles]);

  const pageFiles = useMemo(
    () =>
      filterCompanyFiles(scopeFiles, {
        tab,
        search,
        category: categoryFilter,
        jobId,
        quoteId,
      }),
    [scopeFiles, tab, search, categoryFilter, jobId, quoteId]
  );

  const addFiles = useCallback(
    (fileList: FileList | File[]) => {
      if (!ownerId || !ownerKind || !isEntityFilesTab(tab) || uploading) return;
      const files = Array.from(fileList);
      if (files.length === 0) return;

      void (async () => {
        setUploading(true);
        setUploadError(null);

        const remote =
          ownerKind === "job"
            ? await uploadJobFiles({
                jobId: ownerId,
                drawingCategory: tab,
                files,
                uploadedByName: uploaderName,
                uploadedById: uploaderId,
              })
            : await uploadQuoteFiles({
                quoteId: ownerId,
                drawingCategory: tab,
                files,
                uploadedByName: uploaderName,
                uploadedById: uploaderId,
              });

        if (!remote.error && remote.files.length > 0) {
          setEntityFiles((prev) => [...remote.files, ...prev]);
          setUploading(false);
          return;
        }

        if (
          remote.error &&
          !isMissingEntityFilesTableError(ownerKind, remote.error)
        ) {
          setUploadError(remote.error);
        }

        try {
          const localCreated =
            ownerKind === "job"
              ? await localUploadJobFiles({
                  jobId: ownerId,
                  drawingCategory: tab,
                  files,
                  uploadedByName: uploaderName,
                  uploadedById: uploaderId,
                })
              : await localUploadQuoteFiles({
                  quoteId: ownerId,
                  drawingCategory: tab,
                  files,
                  uploadedByName: uploaderName,
                  uploadedById: uploaderId,
                });
          setEntityFiles((prev) => [...localCreated, ...prev]);
        } catch (err) {
          setUploadError(
            err instanceof Error ? err.message : "Could not save file locally."
          );
        }
        setUploading(false);
      })();
    },
    [ownerId, ownerKind, tab, uploaderName, uploaderId, uploading]
  );

  function openFilePicker() {
    if (!isEntityFiles) return;
    fileInputRef.current?.click();
  }

  async function confirmDeleteFile() {
    if (!filePendingDelete || !isEntityFiles || !ownerKind) return;
    const fileId = filePendingDelete.id;
    const fileUrl = filePendingDelete.url;

    setDeleting(true);
    setUploadError(null);

    const remote =
      ownerKind === "job"
        ? await deleteJobFile(fileId)
        : await deleteQuoteFile(fileId);
    if (
      remote.error &&
      !isMissingEntityFilesTableError(ownerKind, remote.error)
    ) {
      setUploadError(remote.error);
      setDeleting(false);
      return;
    }

    try {
      if (ownerKind === "job") {
        await localDeleteJobFile(fileId);
      } else {
        await localDeleteQuoteFile(fileId);
      }
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Could not delete file locally."
      );
      setDeleting(false);
      return;
    }

    if (fileUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(fileUrl);
    }

    setEntityFiles((prev) => prev.filter((file) => file.id !== fileId));
    setFilePendingDelete(null);
    setMenuFileId(null);
    setDeleting(false);
  }

  function handleDragEnter(e: DragEvent) {
    if (!isEntityFiles) return;
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current += 1;
    if (e.dataTransfer.types.includes("Files")) setDragging(true);
  }

  function handleDragLeave(e: DragEvent) {
    if (!isEntityFiles) return;
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  }

  function handleDragOver(e: DragEvent) {
    if (!isEntityFiles) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  }

  function handleDrop(e: DragEvent) {
    if (!isEntityFiles) return;
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = 0;
    setDragging(false);
    if (e.dataTransfer.files?.length) {
      addFiles(e.dataTransfer.files);
    }
  }

  const activeCategoryLabel = isEntityFilesTab(tab)
    ? JOB_DRAWING_LABELS[tab]
    : "files";

  return (
    <div
      className={
        isEntityFiles
          ? "flex h-full min-h-0 flex-col gap-3"
          : "space-y-4"
      }
    >
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <IconSearch
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="search"
            placeholder="Search files and folders..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
            className="w-full rounded-md border border-gray-300 py-2.5 pl-10 pr-3 text-sm focus:border-burgundy focus:outline-none focus:ring-1 focus:ring-burgundy"
          />
        </div>
      </div>

      {showCategoryCards && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {CATEGORY_CARDS.map((card) => {
            const Icon = CARD_ICONS[card.iconKey] ?? IconFolder;
            const active = categoryFilter === card.label;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => {
                  setCategoryFilter(active ? null : card.label);
                }}
                className={`flex flex-col rounded-lg border bg-white p-4 text-left transition-shadow hover:shadow-sm ${
                  active
                    ? "border-burgundy ring-1 ring-burgundy"
                    : "border-gray-200"
                }`}
              >
                <span
                  className={`mb-3 flex h-10 w-10 items-center justify-center rounded-full ${card.iconBg}`}
                >
                  <Icon size={20} />
                </span>
                <span className="text-sm font-medium text-gray-900">
                  {card.label}
                </span>
                <span className="mt-0.5 text-xs text-gray-500">
                  {card.fileCount} Files
                </span>
                <span className="mt-2 flex items-center justify-between text-xs text-gray-400">
                  {card.updatedLabel}
                  <IconChevronRight size={14} />
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div
        className={
          showSidebar
            ? "grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[1fr_280px]"
            : isEntityFiles
              ? "flex min-h-0 flex-1 flex-col"
              : ""
        }
      >
        <div
          className={`flex min-h-0 flex-col rounded-lg border border-gray-200 bg-white ${
            isEntityFiles ? "flex-1" : ""
          }`}
        >
          <div className="flex shrink-0 gap-1 border-b border-gray-200 px-4">
            {fileTabs.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => {
                  setTab(t.value);
                }}
                className={`border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
                  tab === t.value
                    ? "border-burgundy text-burgundy"
                    : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {isEntityFiles ? (
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          ) : null}

          {uploadError ? (
            <p className="shrink-0 border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">
              {uploadError}
            </p>
          ) : null}

          <div
            className={`relative flex min-h-0 flex-1 flex-col ${
              isEntityFiles
                ? dragging
                  ? "bg-burgundy/5 ring-2 ring-inset ring-burgundy"
                  : ""
                : "min-h-[220px]"
            }`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {loadingFiles ? (
              <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-12 text-sm text-gray-500">
                Loading files…
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className={`min-h-0 flex-1 overflow-auto ${isEntityFiles ? "pb-16" : ""}`}>
                  <table className="w-full min-w-[700px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3">Size</th>
                        <th className="px-4 py-3">Uploaded By</th>
                        <th className="w-10 px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {pageFiles.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-0">
                            <div className="flex min-h-[12rem] flex-col items-center justify-center gap-1 px-6 py-16 text-center">
                              {isEntityFiles ? (
                                <div className="flex flex-col items-center gap-2">
                                  <p className="text-sm font-medium text-gray-700">
                                    {uploading
                                      ? "Uploading…"
                                      : `Drop files here for ${activeCategoryLabel}`}
                                  </p>
                                  {!uploading ? (
                                    <IconUpload
                                      size={28}
                                      stroke={1.5}
                                      className="text-gray-500"
                                    />
                                  ) : null}
                                </div>
                              ) : (
                                <p className="text-sm text-gray-500">
                                  No files found.
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : (
                        pageFiles.map((file) => (
                          <tr
                            key={file.id}
                            className={`border-b border-gray-50 hover:bg-gray-50/80 ${
                              file.url && !file.isFolder
                                ? "cursor-pointer"
                                : ""
                            }`}
                            onClick={() => openFile(file)}
                          >
                            <td className="px-4 py-3">
                              <span className="flex items-center gap-2">
                                <FileIcon type={file.type} />
                                <span
                                  className={`font-medium ${
                                    file.url && !file.isFolder
                                      ? "text-burgundy hover:underline"
                                      : "text-gray-900"
                                  }`}
                                >
                                  {file.name}
                                </span>
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                  isEntityFiles
                                    ? "bg-burgundy/10 text-burgundy"
                                    : CATEGORY_STYLES[file.category]
                                }`}
                              >
                                {fileCategoryLabel(file, isEntityFiles)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-600">
                              {file.size}
                            </td>
                            <td className="px-4 py-3">
                              <span className="flex items-center gap-2">
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-burgundy/10 text-xs font-medium text-burgundy">
                                  {file.uploaderInitials}
                                </span>
                                <span className="text-gray-700">
                                  {file.uploadedBy}
                                </span>
                              </span>
                            </td>
                            <td className="relative px-4 py-3">
                              {isEntityFiles ? (
                                <div className="relative">
                                  <button
                                    type="button"
                                    className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                                    aria-label="File actions"
                                    aria-expanded={menuFileId === file.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setMenuFileId((id) =>
                                        id === file.id ? null : file.id
                                      );
                                    }}
                                  >
                                    <IconDotsVertical size={18} />
                                  </button>
                                  {menuFileId === file.id ? (
                                    <>
                                      <button
                                        type="button"
                                        className="fixed inset-0 z-[70] cursor-default"
                                        aria-label="Close file actions"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setMenuFileId(null);
                                        }}
                                      />
                                      <div className="absolute right-0 top-full z-[71] mt-1 w-32 overflow-hidden rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                                        <button
                                          type="button"
                                          aria-label="Delete file"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setMenuFileId(null);
                                            setFilePendingDelete(file);
                                          }}
                                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                                        >
                                          Delete
                                          <IconTrash size={14} />
                                        </button>
                                      </div>
                                    </>
                                  ) : null}
                                </div>
                              ) : null}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {isEntityFiles ? (
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-end p-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openFilePicker();
                      }}
                      disabled={uploading}
                      className="pointer-events-auto inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50 hover:text-burgundy disabled:opacity-60"
                    >
                      <IconPaperclip size={16} />
                      {uploading ? "Uploading…" : "Attach file"}
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {showSidebar && <FilesSidebar />}
      </div>

      {filePendingDelete ? (
        <ConfirmModal
          title="Delete file?"
          body="Are you sure you want to delete this item? It will be permanently deleted."
          confirmLabel="Yes, delete"
          cancelLabel="Cancel"
          loading={deleting}
          onCancel={() => {
            if (deleting) return;
            setFilePendingDelete(null);
          }}
          onConfirm={() => {
            void confirmDeleteFile();
          }}
        />
      ) : null}
    </div>
  );
}
