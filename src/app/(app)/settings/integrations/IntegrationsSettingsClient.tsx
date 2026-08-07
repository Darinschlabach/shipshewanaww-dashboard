"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IconPlugConnected } from "@tabler/icons-react";
import Button from "@/components/Button";
import { createClient } from "@/lib/supabase/client";

type QuickBooksConnectionStatus = {
  connected: boolean;
  realmId: string | null;
  connectedAt: string | null;
  accessTokenExpiresAt: string | null;
};

export default function IntegrationsSettingsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isOwner, setIsOwner] = useState(false);
  const [loadingRole, setLoadingRole] = useState(true);
  const [status, setStatus] = useState<QuickBooksConnectionStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch("/api/integrations/quickbooks/status");
      const json = (await res.json()) as QuickBooksConnectionStatus & {
        error?: string;
      };
      if (!res.ok) {
        setError(json.error || "Could not load QuickBooks status.");
        setStatus(null);
      } else {
        setStatus(json);
      }
    } catch {
      setError("Could not load QuickBooks status.");
      setStatus(null);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadRole() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) {
        if (!cancelled) {
          setIsOwner(false);
          setLoadingRole(false);
        }
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (!cancelled) {
        setIsOwner(profile?.role === "owner");
        setLoadingRole(false);
      }
    }
    void loadRole();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isOwner) return;
    void loadStatus();
  }, [isOwner, loadStatus]);

  useEffect(() => {
    const connected = searchParams.get("connected");
    const err = searchParams.get("error");
    if (connected === "1") {
      setSuccess("QuickBooks connected successfully.");
      router.replace("/settings/integrations");
    } else if (err) {
      setError(err);
      router.replace("/settings/integrations");
    }
  }, [searchParams, router]);

  async function handleDisconnect() {
    setDisconnecting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/integrations/quickbooks/disconnect", {
        method: "POST",
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error || "Could not disconnect QuickBooks.");
      } else {
        setSuccess("QuickBooks disconnected.");
        await loadStatus();
      }
    } catch {
      setError("Could not disconnect QuickBooks.");
    } finally {
      setDisconnecting(false);
    }
  }

  if (loadingRole) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold text-gray-900">Integrations</h1>
        <p className="mt-2 text-sm text-gray-600">
          Only administrators can manage integrations.
        </p>
      </div>
    );
  }

  const connected = Boolean(status?.connected);

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold text-gray-900">Integrations</h1>
      <p className="mt-1 text-sm text-gray-600">
        Connect external services used by Shipshewana Woodworks.
      </p>

      {error ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {success}
        </p>
      ) : null}

      <section className="mt-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-md bg-burgundy/10 text-burgundy">
              <IconPlugConnected size={22} />
            </span>
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                QuickBooks Online
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Authorize QuickBooks so invoices and payments can sync later.
              </p>
              {loadingStatus ? (
                <p className="mt-3 text-sm text-gray-500">Checking status…</p>
              ) : connected ? (
                <div className="mt-3 space-y-1 text-sm text-gray-700">
                  <p>
                    <span className="font-medium text-emerald-700">Connected</span>
                  </p>
                  {status?.realmId ? (
                    <p className="text-gray-600">
                      Company ID (realm):{" "}
                      <span className="font-mono text-xs">{status.realmId}</span>
                    </p>
                  ) : null}
                  {status?.connectedAt ? (
                    <p className="text-gray-500">
                      Connected {new Date(status.connectedAt).toLocaleString()}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="mt-3 text-sm text-gray-500">Not connected</p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-2">
            {connected ? (
              <Button
                type="button"
                variant="secondary"
                disabled={disconnecting}
                onClick={() => {
                  void handleDisconnect();
                }}
              >
                {disconnecting ? "Disconnecting…" : "Disconnect"}
              </Button>
            ) : (
              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  window.location.href =
                    "/api/integrations/quickbooks/connect";
                }}
              >
                Connect QuickBooks
              </Button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
