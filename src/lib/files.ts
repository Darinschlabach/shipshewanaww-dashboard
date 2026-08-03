export type CompanyFileCategory =
  | "Company Forms"
  | "Installation Checklists"
  | "Shop Resources"
  | "Training Guides"
  | "Material Specs"
  | "Safety Documents";

export type FileType = "pdf" | "image" | "spreadsheet" | "folder" | "doc";

export type CompanyFilesTab = "all" | "folders" | "shared" | "recent" | "trash";
export type JobFilesTab =
  | "provided_drawings"
  | "production_drawings"
  | "misc";
export type FilesTab = CompanyFilesTab | JobFilesTab;

export interface CompanyFile {
  id: string;
  name: string;
  category: CompanyFileCategory;
  modifiedAt: string;
  size: string;
  type: FileType;
  uploadedBy: string;
  uploaderInitials: string;
  starred: boolean;
  isFolder: boolean;
  jobId?: string | null;
  shared?: boolean;
  trashed?: boolean;
  /** Job Files tab grouping */
  drawingCategory?: JobFilesTab;
  /** Local blob URL or remote URL for opening the file */
  url?: string | null;
}

export interface FileCategoryCard {
  id: string;
  label: CompanyFileCategory;
  fileCount: number;
  updatedLabel: string;
  iconKey: string;
  iconBg: string;
}

export interface PinnedFile {
  id: string;
  name: string;
}

export interface FileActivity {
  id: string;
  fileName: string;
  action: string;
  actor: string;
  timestamp: string;
  icon: "upload" | "edit" | "share" | "delete";
}

export const STORAGE_USED_GB = 21.2;
export const STORAGE_TOTAL_GB = 50;
export const FILES_TOTAL_COUNT = 63;
export const FILES_PAGE_SIZE = 10;

export const CATEGORY_CARDS: FileCategoryCard[] = [
  {
    id: "forms",
    label: "Company Forms",
    fileCount: 12,
    updatedLabel: "Updated May 10",
    iconKey: "folder",
    iconBg: "bg-red-100 text-red-600",
  },
  {
    id: "install",
    label: "Installation Checklists",
    fileCount: 8,
    updatedLabel: "Updated May 8",
    iconKey: "clipboard",
    iconBg: "bg-green-100 text-green-600",
  },
  {
    id: "shop",
    label: "Shop Resources",
    fileCount: 15,
    updatedLabel: "Updated May 12",
    iconKey: "wrench",
    iconBg: "bg-blue-100 text-blue-600",
  },
  {
    id: "training",
    label: "Training Guides",
    fileCount: 6,
    updatedLabel: "Updated Apr 28",
    iconKey: "book",
    iconBg: "bg-purple-100 text-purple-600",
  },
  {
    id: "materials",
    label: "Material Specs",
    fileCount: 14,
    updatedLabel: "Updated May 15",
    iconKey: "layers",
    iconBg: "bg-amber-100 text-amber-600",
  },
  {
    id: "safety",
    label: "Safety Documents",
    fileCount: 8,
    updatedLabel: "Updated May 5",
    iconKey: "shield",
    iconBg: "bg-teal-100 text-teal-600",
  },
];

export const CATEGORY_STYLES: Record<CompanyFileCategory, string> = {
  "Company Forms": "bg-red-50 text-red-700",
  "Installation Checklists": "bg-green-50 text-green-700",
  "Shop Resources": "bg-blue-50 text-blue-700",
  "Training Guides": "bg-purple-50 text-purple-700",
  "Material Specs": "bg-amber-50 text-amber-700",
  "Safety Documents": "bg-teal-50 text-teal-700",
};

export const PINNED_FILES: PinnedFile[] = [
  { id: "p1", name: "Customer Agreement Template.pdf" },
  { id: "p2", name: "Installation Checklist - Base Cabinets.pdf" },
  { id: "p3", name: "Shop Safety Guidelines.pdf" },
  { id: "p4", name: "Warranty Information Sheet.pdf" },
  { id: "p5", name: "Cabinet Door Styles Catalog.pdf" },
];

export const RECENT_ACTIVITY: FileActivity[] = [
  {
    id: "a1",
    fileName: "Finishing Standards Guide.pdf",
    action: "uploaded by",
    actor: "Nate R.",
    timestamp: "May 20, 2024 2:30 PM",
    icon: "upload",
  },
  {
    id: "a2",
    fileName: "Delivery & Site Access Form.pdf",
    action: "updated by",
    actor: "Nate R.",
    timestamp: "May 19, 2024 11:15 AM",
    icon: "edit",
  },
  {
    id: "a3",
    fileName: "Blum Hardware Spec Sheet.pdf",
    action: "shared with",
    actor: "Shop Team",
    timestamp: "May 18, 2024 4:45 PM",
    icon: "share",
  },
  {
    id: "a4",
    fileName: "Old Price List 2023.xlsx",
    action: "moved to trash by",
    actor: "Nate R.",
    timestamp: "May 17, 2024 9:00 AM",
    icon: "delete",
  },
];

export const MOCK_FILES: CompanyFile[] = [
  {
    id: "1",
    name: "Customer Agreement Template.pdf",
    category: "Company Forms",
    modifiedAt: "2024-05-10T09:15:00",
    size: "450 KB",
    type: "pdf",
    uploadedBy: "Nate R.",
    uploaderInitials: "NR",
    starred: true,
    isFolder: false,
  },
  {
    id: "2",
    name: "Installation Checklist - Base Cabinets.pdf",
    category: "Installation Checklists",
    modifiedAt: "2024-05-08T14:20:00",
    size: "320 KB",
    type: "pdf",
    uploadedBy: "Nate R.",
    uploaderInitials: "NR",
    starred: true,
    isFolder: false,
  },
  {
    id: "3",
    name: "Shop Safety Guidelines.pdf",
    category: "Safety Documents",
    modifiedAt: "2024-05-05T10:00:00",
    size: "1.2 MB",
    type: "pdf",
    uploadedBy: "Nate R.",
    uploaderInitials: "NR",
    starred: true,
    isFolder: false,
  },
  {
    id: "4",
    name: "Warranty Information Sheet.pdf",
    category: "Company Forms",
    modifiedAt: "2024-05-12T16:30:00",
    size: "280 KB",
    type: "pdf",
    uploadedBy: "Nate R.",
    uploaderInitials: "NR",
    starred: false,
    isFolder: false,
  },
  {
    id: "5",
    name: "Cabinet Door Styles Catalog.pdf",
    category: "Material Specs",
    modifiedAt: "2024-05-15T11:45:00",
    size: "4.8 MB",
    type: "pdf",
    uploadedBy: "Nate R.",
    uploaderInitials: "NR",
    starred: true,
    isFolder: false,
  },
  {
    id: "6",
    name: "Employee Onboarding Packet.pdf",
    category: "Training Guides",
    modifiedAt: "2024-04-28T09:00:00",
    size: "2.1 MB",
    type: "pdf",
    uploadedBy: "Nate R.",
    uploaderInitials: "NR",
    starred: false,
    isFolder: false,
  },
  {
    id: "7",
    name: "Finishing Standards Guide.pdf",
    category: "Shop Resources",
    modifiedAt: "2024-05-20T14:30:00",
    size: "890 KB",
    type: "pdf",
    uploadedBy: "Nate R.",
    uploaderInitials: "NR",
    starred: false,
    isFolder: false,
  },
  {
    id: "8",
    name: "Delivery & Site Access Form.pdf",
    category: "Company Forms",
    modifiedAt: "2024-05-19T11:15:00",
    size: "195 KB",
    type: "pdf",
    uploadedBy: "Nate R.",
    uploaderInitials: "NR",
    starred: false,
    isFolder: false,
  },
  {
    id: "9",
    name: "Blum Hardware Spec Sheet.pdf",
    category: "Material Specs",
    modifiedAt: "2024-05-18T16:45:00",
    size: "1.5 MB",
    type: "pdf",
    uploadedBy: "Nate R.",
    uploaderInitials: "NR",
    starred: false,
    isFolder: false,
  },
  {
    id: "10",
    name: "Change Order Template.docx",
    category: "Company Forms",
    modifiedAt: "2024-05-14T08:30:00",
    size: "125 KB",
    type: "doc",
    uploadedBy: "Nate R.",
    uploaderInitials: "NR",
    starred: false,
    isFolder: false,
  },
  {
    id: "11",
    name: "Job Site Photos",
    category: "Shop Resources",
    modifiedAt: "2024-05-16T13:00:00",
    size: "48 MB",
    type: "folder",
    uploadedBy: "Nate R.",
    uploaderInitials: "NR",
    starred: false,
    isFolder: true,
    jobId: "b0000001-0000-4000-8000-000000000001",
    drawingCategory: "misc",
  },
  {
    id: "12",
    name: "Shared with Designer - Smith Kitchen.pdf",
    category: "Material Specs",
    modifiedAt: "2024-05-17T10:00:00",
    size: "2.4 MB",
    type: "pdf",
    uploadedBy: "Nate R.",
    uploaderInitials: "NR",
    starred: false,
    isFolder: false,
    shared: true,
    jobId: "b0000001-0000-4000-8000-000000000001",
    drawingCategory: "provided_drawings",
  },
];

export function filterCompanyFiles(
  files: CompanyFile[],
  opts: {
    tab: FilesTab;
    search: string;
    category?: CompanyFileCategory | null;
    jobId?: string;
  }
): CompanyFile[] {
  let list = files.filter((f) => !f.trashed);

  if (opts.jobId) {
    list = list.filter((f) => f.jobId === opts.jobId);
  }

  switch (opts.tab) {
    case "folders":
      list = list.filter((f) => f.isFolder);
      break;
    case "shared":
      list = list.filter((f) => f.shared);
      break;
    case "recent":
      list = [...list].sort(
        (a, b) =>
          new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
      );
      break;
    case "trash":
      list = files.filter((f) => f.trashed);
      break;
    case "provided_drawings":
    case "production_drawings":
    case "misc":
      list = list
        .filter((f) => (f.drawingCategory ?? "misc") === opts.tab)
        .sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
        );
      break;
    default:
      break;
  }

  if (opts.category) {
    list = list.filter((f) => f.category === opts.category);
  }

  if (opts.search.trim()) {
    const q = opts.search.toLowerCase();
    list = list.filter((f) => f.name.toLowerCase().includes(q));
  }

  return list;
}

export function formatFileDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

export function fileTypeFromFile(file: File): FileType {
  const name = file.name.toLowerCase();
  const mime = file.type.toLowerCase();
  if (mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(name)) {
    return "image";
  }
  if (
    mime.includes("spreadsheet") ||
    mime.includes("excel") ||
    /\.(xlsx?|csv)$/.test(name)
  ) {
    return "spreadsheet";
  }
  if (mime === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (
    mime.includes("word") ||
    /\.(docx?|rtf|txt)$/.test(name)
  ) {
    return "doc";
  }
  return "doc";
}

export const JOB_DRAWING_LABELS: Record<JobFilesTab, string> = {
  provided_drawings: "Provided Drawings",
  production_drawings: "Production Drawings",
  misc: "Misc.",
};

export function createJobUploadedFile(opts: {
  file: File;
  jobId: string;
  drawingCategory: JobFilesTab;
  uploadedBy: string;
}): CompanyFile {
  const { file, jobId, drawingCategory, uploadedBy } = opts;
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `upload-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: file.name,
    category: "Shop Resources",
    modifiedAt: new Date().toISOString(),
    size: formatFileSize(file.size),
    type: fileTypeFromFile(file),
    uploadedBy,
    uploaderInitials: getInitials(uploadedBy),
    starred: false,
    isFolder: false,
    jobId,
    drawingCategory,
    url: URL.createObjectURL(file),
  };
}

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
