"use client";

import FilesView from "@/components/files/FilesView";

interface FilesTabProps {
  jobId: string;
}

export default function FilesTab({ jobId }: FilesTabProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <FilesView
        jobId={jobId}
        showSidebar={false}
        showCategoryCards={false}
      />
    </div>
  );
}
