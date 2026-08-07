"use client";

import FilesView from "@/components/files/FilesView";

interface QuoteFilesTabProps {
  quoteId: string;
  onFileCountChange?: (count: number) => void;
}

export default function QuoteFilesTab({
  quoteId,
  onFileCountChange,
}: QuoteFilesTabProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <FilesView
        quoteId={quoteId}
        showSidebar={false}
        showCategoryCards={false}
        onFileCountChange={onFileCountChange}
      />
    </div>
  );
}
