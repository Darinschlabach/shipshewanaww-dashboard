"use client";

import { useMemo, useState } from "react";
import {
  IconBook,
  IconChevronLeft,
  IconChevronRight,
  IconClipboard,
  IconDotsVertical,
  IconFile,
  IconFileSpreadsheet,
  IconFileTypePdf,
  IconFilter,
  IconFolder,
  IconFolderPlus,
  IconLayoutGrid,
  IconList,
  IconPhoto,
  IconSearch,
  IconShield,
  IconStar,
  IconStarFilled,
  IconTool,
  IconLayersLinked,
} from "@tabler/icons-react";
import {
  CATEGORY_CARDS,
  CATEGORY_STYLES,
  FILES_PAGE_SIZE,
  FILES_TOTAL_COUNT,
  MOCK_FILES,
  filterCompanyFiles,
  formatFileDateTime,
  type CompanyFileCategory,
  type FileType,
  type FilesTab,
} from "@/lib/files";
import FilesSidebar from "@/components/files/FilesSidebar";

const FILE_TABS: { value: FilesTab; label: string }[] = [
  { value: "all", label: "All Files" },
  { value: "folders", label: "Folders" },
  { value: "shared", label: "Shared with Me" },
  { value: "recent", label: "Recent" },
  { value: "trash", label: "Trash" },
];

const CARD_ICONS: Record<string, typeof IconFolder> = {
  folder: IconFolder,
  clipboard: IconClipboard,
  wrench: IconTool,
  book: IconBook,
  layers: IconLayersLinked,
  shield: IconShield,
};

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

interface FilesViewProps {
  jobId?: string;
  showSidebar?: boolean;
  showCategoryCards?: boolean;
}

export default function FilesView({
  jobId,
  showSidebar = true,
  showCategoryCards = true,
}: FilesViewProps) {
  const [tab, setTab] = useState<FilesTab>("all");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CompanyFileCategory | null>(
    null
  );
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(FILES_PAGE_SIZE);

  const scopeFiles = useMemo(
    () => (jobId ? MOCK_FILES.filter((f) => f.jobId === jobId) : MOCK_FILES),
    [jobId]
  );

  const filtered = useMemo(
    () =>
      filterCompanyFiles(scopeFiles, {
        tab,
        search,
        category: categoryFilter,
        jobId,
      }),
    [scopeFiles, tab, search, categoryFilter, jobId]
  );

  const displayTotal = jobId ? filtered.length : FILES_TOTAL_COUNT;
  const totalPages = Math.max(1, Math.ceil(displayTotal / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageFiles = filtered.slice(pageStart, pageStart + pageSize);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
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
              setPage(1);
            }}
            className="w-full rounded-md border border-gray-300 py-2.5 pl-10 pr-3 text-sm focus:border-burgundy focus:outline-none focus:ring-1 focus:ring-burgundy"
          />
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <IconFilter size={16} />
          Filters
        </button>
        <div className="flex rounded-md border border-gray-300">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={`rounded-l-md px-2.5 py-2 ${
              viewMode === "grid"
                ? "bg-burgundy text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
            aria-label="Grid view"
          >
            <IconLayoutGrid size={18} />
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`rounded-r-md border-l border-gray-300 px-2.5 py-2 ${
              viewMode === "list"
                ? "bg-burgundy text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
            aria-label="List view"
          >
            <IconList size={18} />
          </button>
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
                  setPage(1);
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
            ? "grid grid-cols-1 gap-4 xl:grid-cols-[1fr_280px]"
            : ""
        }
      >
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="flex gap-1 border-b border-gray-200 px-4">
            {FILE_TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => {
                  setTab(t.value);
                  setPage(1);
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

          {viewMode === "list" ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Modified</th>
                    <th className="px-4 py-3">Size</th>
                    <th className="px-4 py-3">Uploaded By</th>
                    <th className="w-10 px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {pageFiles.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-10 text-center text-gray-500"
                      >
                        No files found.
                      </td>
                    </tr>
                  ) : (
                    pageFiles.map((file) => (
                      <tr
                        key={file.id}
                        className="border-b border-gray-50 hover:bg-gray-50/80"
                      >
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-2">
                            <FileIcon type={file.type} />
                            <span className="font-medium text-gray-900">
                              {file.name}
                            </span>
                            {file.starred ? (
                              <IconStarFilled
                                size={14}
                                className="shrink-0 text-amber-400"
                              />
                            ) : (
                              <IconStar
                                size={14}
                                className="shrink-0 text-gray-300"
                              />
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${CATEGORY_STYLES[file.category]}`}
                          >
                            {file.category}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                          {formatFileDateTime(file.modifiedAt)}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{file.size}</td>
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
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            className="rounded p-1 text-gray-400 hover:bg-gray-100"
                            aria-label="File actions"
                          >
                            <IconDotsVertical size={18} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 md:grid-cols-4">
              {pageFiles.map((file) => (
                <div
                  key={file.id}
                  className="rounded-lg border border-gray-200 p-3 hover:border-burgundy/30 hover:shadow-sm"
                >
                  <div className="mb-2 flex items-start justify-between">
                    <FileIcon type={file.type} />
                    {file.starred && (
                      <IconStarFilled size={14} className="text-amber-400" />
                    )}
                  </div>
                  <p className="truncate text-sm font-medium text-gray-900">
                    {file.name}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">{file.size}</p>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-4 py-3">
            <p className="text-sm text-gray-600">
              Showing {displayTotal === 0 ? 0 : pageStart + 1} to{" "}
              {Math.min(pageStart + pageSize, displayTotal)} of {displayTotal}{" "}
              files
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded border border-gray-300 px-2 py-1 text-sm disabled:opacity-40"
              >
                <IconChevronLeft size={16} />
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(
                (n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    className={`min-w-[2rem] rounded px-2 py-1 text-sm ${
                      n === safePage
                        ? "bg-burgundy text-white"
                        : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {n}
                  </button>
                )
              )}
              {totalPages > 7 && (
                <>
                  <span className="text-gray-400">…</span>
                  <button
                    type="button"
                    onClick={() => setPage(totalPages)}
                    className={`min-w-[2rem] rounded px-2 py-1 text-sm ${
                      safePage === totalPages
                        ? "bg-burgundy text-white"
                        : "border border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {totalPages}
                  </button>
                </>
              )}
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded border border-gray-300 px-2 py-1 text-sm disabled:opacity-40"
              >
                <IconChevronRight size={16} />
              </button>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="rounded border border-gray-300 px-2 py-1 text-sm"
              >
                {[10, 25, 50].map((n) => (
                  <option key={n} value={n}>
                    {n} / page
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {showSidebar && <FilesSidebar />}
      </div>
    </div>
  );
}
