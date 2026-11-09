"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { fetchSettings, fetchVariables, type CostingSettings, type CostingVariable } from "@/lib/costing/db";
import { ensureCostingSamples, ensureSampleCabinet } from "@/lib/costing/seed";
import { catalogueHref, catalogueItems, catalogueNav, type CatalogueSectionId } from "@/components/costing/catalogue-nav";

type CatalogueContextValue = {
  settings: CostingSettings | null;
  variables: CostingVariable[];
  reloadShared: () => Promise<void>;
  refreshCounts: () => Promise<void>;
};

const CatalogueContext = createContext<CatalogueContextValue | null>(null);

export function useCatalogue() {
  const value = useContext(CatalogueContext);
  if (!value) throw new Error("useCatalogue must be used inside the costing catalogue");
  return value;
}

export default function CostingCatalogue({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [access, setAccess] = useState<"loading" | "admin" | "denied">("loading");
  const [settings, setSettings] = useState<CostingSettings | null>(null);
  const [variables, setVariables] = useState<CostingVariable[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [counts, setCounts] = useState<Partial<Record<CatalogueSectionId, number>>>({});

  const refreshCounts = useCallback(async () => {
    const supabase = createClient();
    const entries = await Promise.all(
      catalogueItems.map(async (item) => {
        const { count, error } = await supabase.from(item.table).select("*", { count: "exact", head: true });
        return [item.id, error ? 0 : (count ?? 0)] as const;
      })
    );
    setCounts(Object.fromEntries(entries));
  }, []);

  const reloadShared = useCallback(async () => {
    const [settingsResult, variableResult] = await Promise.all([fetchSettings(), fetchVariables()]);
    setSettings(settingsResult.row);
    setVariables(variableResult.rows);
    const sharedError = settingsResult.error ?? variableResult.error;
    if (sharedError) setNotice(sharedError);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        if (!cancelled) setAccess("denied");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userData.user.id)
        .maybeSingle();
      if (cancelled) return;
      if (profile?.role !== "owner") {
        setAccess("denied");
        return;
      }
      const seedError = await ensureCostingSamples();
      const templateError = await ensureSampleCabinet();
      if (cancelled) return;
      setNotice(seedError ?? templateError);
      setAccess("admin");
      await Promise.all([reloadShared(), refreshCounts()]);
    }
    void start();
    return () => {
      cancelled = true;
    };
  }, [refreshCounts, reloadShared]);

  const catalogue = useMemo(
    () => ({ settings, variables, reloadShared, refreshCounts }),
    [settings, variables, reloadShared, refreshCounts]
  );

  if (access !== "admin") {
    return (
      <div className="fixed inset-y-0 right-0 left-[190px] z-20 flex items-center justify-center bg-[#F5F0E8] p-6">
        {access === "loading" ? (
          <p className="text-sm text-gray-500">Loading costing catalogue…</p>
        ) : (
          <section className="max-w-lg rounded-xl border border-[#E6D9C8] bg-white p-6">
            <h1 className="text-xl font-semibold text-gray-900">Administrators only</h1>
            <p className="mt-2 text-sm text-gray-600">
              The costing catalogue is a test library for the shop administrator.
            </p>
          </section>
        )}
      </div>
    );
  }

  return (
    <CatalogueContext.Provider value={catalogue}>
      <div className="fixed inset-y-0 right-0 left-[190px] z-20 flex bg-[#F5F0E8]">
        <nav className="flex w-[220px] shrink-0 flex-col overflow-y-auto border-r border-[#E6D9C8] bg-[#FBF8F4] px-3 py-4">
          {catalogueNav.map((group) => (
            <div key={group.label} className="mb-5">
              <p className="mb-1.5 px-2 text-[10px] font-semibold tracking-[0.16em] text-[#A89888] uppercase">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const href = catalogueHref(item.id);
                  const active = pathname === href;
                  const Icon = item.icon;
                  const count = counts[item.id];
                  return (
                    <li key={item.id}>
                      <Link
                        href={href}
                        aria-current={active ? "page" : undefined}
                        className={`flex items-center gap-2 rounded-lg px-2 py-2 text-sm ${
                          active ? "bg-burgundy font-medium text-white" : "text-gray-700 hover:bg-white"
                        }`}
                      >
                        <Icon size={16} stroke={1.75} className={active ? "text-white" : "text-burgundy"} />
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        <span className={`text-xs tabular-nums ${active ? "text-white/75" : "text-gray-400"}`}>
                          {count ?? "–"}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="shrink-0 border-b border-[#E6D9C8] bg-white/85 px-6 py-3">
            <h1 className="text-xl leading-tight font-semibold text-gray-900">Costing Catalogue (Test)</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Parts, materials, and schedules for component-based cabinet costing.
            </p>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            {notice ? (
              <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{notice}</p>
            ) : null}
            {children}
          </div>
        </div>
      </div>
    </CatalogueContext.Provider>
  );
}
