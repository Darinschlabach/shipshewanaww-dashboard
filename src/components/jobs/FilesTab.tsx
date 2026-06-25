"use client";

import FilesView from "@/components/files/FilesView";

interface FilesTabProps {
  jobId: string;
}

export default function FilesTab({ jobId }: FilesTabProps) {
  return (
    <FilesView
      jobId={jobId}
      showSidebar={false}
      showCategoryCards={false}
    />
  );
}
