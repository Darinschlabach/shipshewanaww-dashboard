"use client";

import DashboardView from "@/components/dashboard/DashboardView";

export default function DashboardPage() {
  return (
    <div className="mx-auto flex h-[calc(100vh-2.5rem)] min-h-0 max-w-[1400px] flex-col overflow-hidden">
      <DashboardView />
    </div>
  );
}
