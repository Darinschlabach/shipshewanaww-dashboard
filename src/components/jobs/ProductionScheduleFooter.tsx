"use client";

import { useState } from "react";

interface ProductionScheduleFooterProps {
  onSave: () => Promise<{ error?: string }>;
  onCancel: () => void;
}

export default function ProductionScheduleFooter({
  onSave,
  onCancel,
}: ProductionScheduleFooterProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await onSave();
    setSaving(false);
    if (result.error) {
      setError(result.error);
    }
  }

  return (
    <div className="shrink-0 border-t border-gray-200 bg-white px-4 py-3">
      {error ? (
        <p className="mb-2 text-xs text-red-600">{error}</p>
      ) : null}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="rounded-md bg-burgundy px-4 py-2 text-sm font-medium text-white hover:bg-burgundy/90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
