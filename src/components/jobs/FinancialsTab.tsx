"use client";

import { useState } from "react";
import JobFinancialsInvoices from "@/components/jobs/JobFinancialsInvoices";
import JobFinancialsQuotes from "@/components/jobs/JobFinancialsQuotes";

const FINANCIALS_SUB_TABS = ["Quotes", "Invoices"] as const;

type FinancialsSubTab = (typeof FINANCIALS_SUB_TABS)[number];

interface FinancialsTabProps {
  jobId: string;
}

export default function FinancialsTab({ jobId }: FinancialsTabProps) {
  const [subTab, setSubTab] = useState<FinancialsSubTab>("Quotes");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex shrink-0 flex-wrap gap-4 border-b border-gray-200 text-sm">
        {FINANCIALS_SUB_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setSubTab(tab)}
            className={`pb-2 ${
              subTab === tab
                ? "border-b-2 border-burgundy font-medium text-burgundy"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {subTab === "Quotes" ? (
        <JobFinancialsQuotes jobId={jobId} />
      ) : (
        <JobFinancialsInvoices jobId={jobId} />
      )}
    </div>
  );
}
