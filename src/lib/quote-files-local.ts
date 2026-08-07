import {
  fileTypeFromFile,
  formatFileSize,
  getInitials,
  type CompanyFile,
  type FileType,
  type JobFilesTab,
} from "@/lib/files";

const DB_NAME = "sww-quote-files";
const DB_VERSION = 1;
const STORE = "files";

type LocalQuoteFileRecord = {
  id: string;
  quoteId: string;
  name: string;
  drawingCategory: JobFilesTab;
  fileType: FileType;
  sizeBytes: number;
  uploadedByName: string;
  uploadedById: string | null;
  createdAt: string;
  blob: Blob;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("quoteId", "quoteId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
  });
}

function recordToCompanyFile(record: LocalQuoteFileRecord): CompanyFile {
  return {
    id: record.id,
    name: record.name,
    category: "Shop Resources",
    modifiedAt: record.createdAt,
    size: formatFileSize(record.sizeBytes),
    type: record.fileType,
    uploadedBy: record.uploadedByName,
    uploaderInitials: getInitials(record.uploadedByName),
    starred: false,
    isFolder: false,
    quoteId: record.quoteId,
    drawingCategory: record.drawingCategory,
    url: URL.createObjectURL(record.blob),
  };
}

export async function localListQuoteFiles(quoteId: string): Promise<CompanyFile[]> {
  const db = await openDb();
  const records = await new Promise<LocalQuoteFileRecord[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const index = store.index("quoteId");
    const request = index.getAll(quoteId);
    request.onsuccess = () => resolve((request.result as LocalQuoteFileRecord[]) ?? []);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB read failed"));
  });
  db.close();

  return records
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(recordToCompanyFile);
}

export async function localUploadQuoteFiles(opts: {
  quoteId: string;
  drawingCategory: JobFilesTab;
  files: File[];
  uploadedByName: string;
  uploadedById: string | null;
}): Promise<CompanyFile[]> {
  const {
    quoteId,
    drawingCategory,
    files,
    uploadedByName,
    uploadedById,
  } = opts;
  if (files.length === 0) return [];

  const db = await openDb();
  const created: CompanyFile[] = [];

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);

    for (const file of files) {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const record: LocalQuoteFileRecord = {
        id,
        quoteId,
        name: file.name,
        drawingCategory,
        fileType: fileTypeFromFile(file),
        sizeBytes: file.size,
        uploadedByName,
        uploadedById,
        createdAt: new Date().toISOString(),
        blob: file,
      };
      store.put(record);
      created.push(recordToCompanyFile(record));
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB write failed"));
  });

  db.close();
  return created;
}

export async function localDeleteQuoteFile(fileId: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(fileId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB delete failed"));
  });
  db.close();
}

export function isMissingQuoteFilesTableError(message: string | null | undefined): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes("quote_files") &&
    (lower.includes("does not exist") ||
      lower.includes("schema cache") ||
      lower.includes("could not find the table") ||
      lower.includes("pgrst205"))
  );
}
