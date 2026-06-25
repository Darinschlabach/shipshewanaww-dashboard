"use client";

import {
  IconChevronDown,
  IconDots,
  IconFolderPlus,
} from "@tabler/icons-react";
import PageHeader from "@/components/PageHeader";
import FilesView from "@/components/files/FilesView";

export default function FilesPage() {
  return (
    <>
      <PageHeader
        title="Files"
        subtitle="Company files, templates and resources"
        rightSlot={
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <IconFolderPlus size={16} />
              New Folder
            </button>
            <button
              type="button"
              className="flex items-center gap-1 rounded-md bg-burgundy px-4 py-2 text-sm font-medium text-white hover:bg-burgundy/90"
            >
              + Upload
              <IconChevronDown size={16} />
            </button>
            <button
              type="button"
              className="rounded-md border border-gray-300 bg-white p-2 text-gray-600 hover:bg-gray-50"
              aria-label="More options"
            >
              <IconDots size={18} />
            </button>
          </div>
        }
      />

      <FilesView />
    </>
  );
}
