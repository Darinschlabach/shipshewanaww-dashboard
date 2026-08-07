"use client";

import { useEffect, useState } from "react";
import { getQuickBooksAppBaseUrl } from "@/lib/integrations/quickbooks-urls";

export type QuickBooksSyncFields = {
  qb_id?: string | null;
  qb_sync_token?: string | null;
  qb_sync_status?: string | null;
  qb_last_synced_at?: string | null;
  qb_sync_error?: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  synced: "Synced",
  pending: "Pending",
  failed: "Failed",
  not_synced: "Not synced",
};

const STATUS_STYLES: Record<string, string> = {
  synced: "bg-green-50 text-green-800",
  pending: "bg-amber-50 text-amber-800",
  failed: "bg-red-50 text-red-700",
  not_synced: "bg-gray-100 text-gray-700",
};

function formatSyncedAt(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function viewUrl(
  entity: "customer" | "invoice" | "payment",
  qbId: string
): string {
  const base = getQuickBooksAppBaseUrl();
  if (entity === "customer") {
    return `${base}/app/customerdetail?nameId=${encodeURIComponent(qbId)}`;
  }
  if (entity === "payment") {
    return `${base}/app/recvpayment?txnId=${encodeURIComponent(qbId)}`;
  }
  return `${base}/app/invoice?txnId=${encodeURIComponent(qbId)}`;
}

export default function QuickBooksSyncStatusPanel({
  entity,
  fields,
  syncPath,
  onSynced,
  compact = false,
}: {
  entity: "customer" | "invoice" | "payment";
  fields: QuickBooksSyncFields;
  syncPath: string;
  onSynced?: (next: QuickBooksSyncFields) => void;
  /** Inline row actions for payment history */
  compact?: boolean;
}) {
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [local, setLocal] = useState(fields);

  useEffect(() => {
    setLocal(fields);
  }, [
    fields.qb_id,
    fields.qb_sync_status,
    fields.qb_last_synced_at,
    fields.qb_sync_error,
  ]);

  const status = String(local.qb_sync_status || "not_synced");
  const label = STATUS_LABELS[status] || status;
  const style = STATUS_STYLES[status] || STATUS_STYLES.not_synced;

  async function handleRetry() {
    setRetrying(true);
    setError(null);
    try {
      const res = await fetch(syncPath, { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        syncError?: string | null;
        data?: QuickBooksSyncFields;
      };
      if (!res.ok) {
        setError(json.error || "Retry failed.");
        setRetrying(false);
        return;
      }
      if (json.data) {
        setLocal(json.data);
        onSynced?.(json.data);
      }
      if (json.syncError) setError(json.syncError);
    } catch {
      setError("Retry failed.");
    }
    setRetrying(false);
  }

  if (compact) {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${style}`}
          >
            {label}
          </span>
          {(status === "failed" || status === "pending" || status === "not_synced") && (
            <button
              type="button"
              onClick={() => void handleRetry()}
              disabled={retrying}
              className="rounded border border-gray-300 bg-white px-2 py-0.5 text-[10px] font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
            >
              {retrying ? "…" : "Retry Sync"}
            </button>
          )}
        </div>
        {(local.qb_sync_error || error) && (
          <p className="max-w-[12rem] text-right text-[10px] text-red-600">
            {error || local.qb_sync_error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900">
          QuickBooks Sync
        </h3>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}
        >
          {label}
        </span>
      </div>

      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-gray-500">Last synced</dt>
          <dd className="text-right text-gray-900">
            {formatSyncedAt(local.qb_last_synced_at)}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-gray-500">QB Record ID</dt>
          <dd className="font-mono text-right text-xs text-gray-900">
            {local.qb_id || "—"}
          </dd>
        </div>
        {(local.qb_sync_error || error) && (
          <div>
            <dt className="text-gray-500">Last sync error</dt>
            <dd className="mt-1 text-sm text-red-600">
              {error || local.qb_sync_error}
            </dd>
          </div>
        )}
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void handleRetry()}
          disabled={retrying}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
        >
          {retrying ? "Syncing…" : "Retry Sync"}
        </button>
        {local.qb_id && (
          <a
            href={viewUrl(entity, local.qb_id)}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            View in QuickBooks
          </a>
        )}
      </div>
    </div>
  );
}
