"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

export default function CostingGate({ children }: { children: ReactNode }) {
  const [access, setAccess] = useState<"loading" | "admin" | "denied">("loading");

  useEffect(() => {
    let cancelled = false;
    async function check() {
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
      setAccess(profile?.role === "owner" ? "admin" : "denied");
    }
    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  if (access === "loading") {
    return <p className="text-sm text-gray-500">Loading costing quotes…</p>;
  }
  if (access === "denied") {
    return (
      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-gray-900">Administrators only</h1>
        <p className="mt-2 text-sm text-gray-600">
          Costing quotes are a test page for the shop administrator.
        </p>
      </section>
    );
  }
  return children;
}
