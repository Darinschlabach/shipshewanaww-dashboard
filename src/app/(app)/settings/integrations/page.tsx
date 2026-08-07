import { Suspense } from "react";
import IntegrationsSettingsPage from "./IntegrationsSettingsClient";

export default function IntegrationsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6">
          <p className="text-sm text-gray-500">Loading…</p>
        </div>
      }
    >
      <IntegrationsSettingsPage />
    </Suspense>
  );
}
