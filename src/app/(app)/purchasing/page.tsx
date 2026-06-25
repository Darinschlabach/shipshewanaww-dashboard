"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  IconAlertTriangle,
  IconBox,
  IconChevronLeft,
  IconChevronRight,
  IconColumns3,
  IconFileText,
  IconFilter,
  IconCircleCheck,
  IconSearch,
  IconStack2,
  IconTruck,
} from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/client";
import PageHeader from "@/components/PageHeader";
import PoStatusBadge from "@/components/PoStatusBadge";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import { formatCurrencyFull, formatDateLong } from "@/lib/utils";
import {
  DEFAULT_INVENTORY_ALERTS,
  countByPoDisplayStatus,
  formatPoNumber,
  getMonthlySpend,
  getReceivedPercent,
  getSpendTrend,
  getTopVendors,
  getUpcomingDeliveries,
  isActivePo,
  nextPoNumber,
  normalizePoDisplayStatus,
  sumByPoDisplayStatus,
  type PoDisplayStatus,
} from "@/lib/purchase-orders";
import type { PurchaseOrder, Job } from "@/lib/types";

const STATUS_FILTERS: { value: PoDisplayStatus | "all"; label: string }[] = [
  { value: "all", label: "All Status" },
  { value: "pending_approval", label: "Pending Approval" },
  { value: "on_order", label: "On Order" },
  { value: "partially_received", label: "Partially Received" },
  { value: "fully_received", label: "Fully Received" },
];

const DATE_RANGES = [
  { value: "", label: "Date Range" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "year", label: "This year" },
];

const PAGE_SIZE_OPTIONS = [10, 25, 50];

const selectClass =
  "rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-burgundy focus:outline-none focus:ring-1 focus:ring-burgundy";

function SpendChart({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  const width = 240;
  const height = 64;
  const points = values.map((v, i) => {
    const x = (i / Math.max(values.length - 1, 1)) * width;
    const y = height - (v / max) * (height - 8) - 4;
    return `${x},${y}`;
  });
  const area = `${points.join(" ")} ${width},${height} 0,${height}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-16 w-full">
      <polygon points={area} fill="#6b1a2a" fillOpacity="0.15" />
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="#6b1a2a"
        strokeWidth="2"
      />
    </svg>
  );
}

function ReceivedBar({ percent }: { percent: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full rounded-full bg-burgundy"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-xs text-gray-600">{percent}%</span>
    </div>
  );
}

export default function PurchasingPage() {
  const searchParams = useSearchParams();
  const jobFilter = searchParams.get("job");

  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [dateRange, setDateRange] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    vendor: true,
    job: true,
    description: true,
    status: true,
    ordered: true,
    delivery: true,
    total: true,
    received: true,
  });
  const [form, setForm] = useState({
    item_name: "",
    job_id: jobFilter ?? "",
    vendor: "",
    amount: "",
    expected_delivery: "",
  });

  const load = useCallback(async () => {
    await fetch("/api/purchase-orders/archive", { method: "POST" });

    const supabase = createClient();
    let query = supabase
      .from("purchase_orders")
      .select("*, jobs(id, name)")
      .order("created_at", { ascending: false });

    if (jobFilter) query = query.eq("job_id", jobFilter);

    const [{ data }, { data: jobsData }] = await Promise.all([
      query,
      supabase.from("jobs").select("id, name").order("name"),
    ]);

    setOrders((data as PurchaseOrder[]) ?? []);
    setJobs((jobsData as Job[]) ?? []);
    setLoading(false);
  }, [jobFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const activeOrders = useMemo(
    () => orders.filter(isActivePo),
    [orders]
  );

  const vendors = useMemo(
    () => [...new Set(activeOrders.map((o) => o.vendor))].sort(),
    [activeOrders]
  );

  const stats = useMemo(
    () => ({
      total: activeOrders.length,
      totalValue: activeOrders.reduce((s, o) => s + Number(o.amount), 0),
      pending: countByPoDisplayStatus(activeOrders, "pending_approval"),
      pendingValue: sumByPoDisplayStatus(activeOrders, "pending_approval"),
      onOrder: countByPoDisplayStatus(activeOrders, "on_order"),
      onOrderValue: sumByPoDisplayStatus(activeOrders, "on_order"),
      partial: countByPoDisplayStatus(activeOrders, "partially_received"),
      partialValue: sumByPoDisplayStatus(activeOrders, "partially_received"),
      received: countByPoDisplayStatus(activeOrders, "fully_received"),
      receivedValue: sumByPoDisplayStatus(activeOrders, "fully_received"),
    }),
    [activeOrders]
  );

  const spend = useMemo(() => getMonthlySpend(activeOrders), [activeOrders]);
  const spendChange =
    spend.lastMonth > 0
      ? ((spend.thisMonth - spend.lastMonth) / spend.lastMonth) * 100
      : 0;
  const topVendors = useMemo(() => getTopVendors(activeOrders), [activeOrders]);
  const spendTrend = useMemo(() => getSpendTrend(activeOrders), [activeOrders]);
  const upcoming = useMemo(
    () => getUpcomingDeliveries(activeOrders),
    [activeOrders]
  );

  const pendingApprovals = useMemo(
    () =>
      activeOrders
        .filter((o) => normalizePoDisplayStatus(o) === "pending_approval")
        .slice(0, 5),
    [activeOrders]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return activeOrders.filter((po) => {
      const displayStatus = normalizePoDisplayStatus(po);
      if (statusFilter && displayStatus !== statusFilter) return false;
      if (vendorFilter && po.vendor !== vendorFilter) return false;

      if (dateRange) {
        const ref = po.ordered_at ?? po.created_at;
        const refDate = new Date(ref);
        const now = new Date();
        if (dateRange === "year") {
          if (refDate.getFullYear() !== now.getFullYear()) return false;
        } else {
          const days = parseInt(dateRange, 10);
          const cutoff = new Date(now);
          cutoff.setDate(cutoff.getDate() - days);
          if (refDate < cutoff) return false;
        }
      }

      if (!q) return true;
      return (
        formatPoNumber(po).toLowerCase().includes(q) ||
        po.vendor.toLowerCase().includes(q) ||
        po.item_name.toLowerCase().includes(q) ||
        (po.jobs?.name.toLowerCase().includes(q) ?? false)
      );
    });
  }, [activeOrders, search, statusFilter, vendorFilter, dateRange]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageOrders = filtered.slice(pageStart, pageStart + pageSize);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, vendorFilter, dateRange, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    await supabase.from("purchase_orders").insert({
      item_name: form.item_name,
      job_id: form.job_id,
      vendor: form.vendor,
      amount: parseFloat(form.amount) || 0,
      expected_delivery: form.expected_delivery || null,
      po_number: nextPoNumber(orders),
      received_percent: 0,
    });
    setShowModal(false);
    load();
  }

  function toggleColumn(key: keyof typeof visibleColumns) {
    setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const statItems = [
    {
      icon: IconFileText,
      iconClass: "text-blue-500",
      count: stats.total,
      label: "Total POs",
      value: formatCurrencyFull(stats.totalValue),
    },
    {
      icon: IconStack2,
      iconClass: "text-orange-500",
      count: stats.pending,
      label: "Pending Approval",
      value: formatCurrencyFull(stats.pendingValue),
    },
    {
      icon: IconBox,
      iconClass: "text-amber-500",
      count: stats.onOrder,
      label: "On Order",
      value: formatCurrencyFull(stats.onOrderValue),
    },
    {
      icon: IconTruck,
      iconClass: "text-green-500",
      count: stats.partial,
      label: "Partially Received",
      value: formatCurrencyFull(stats.partialValue),
    },
    {
      icon: IconCircleCheck,
      iconClass: "text-purple-500",
      count: stats.received,
      label: "Fully Received",
      value: formatCurrencyFull(stats.receivedValue),
    },
  ];

  return (
    <>
      <PageHeader
        title="Purchasing"
        subtitle="Manage purchase orders, vendors and incoming materials"
        rightSlot={
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="shrink-0 rounded-md bg-burgundy px-4 py-2 text-sm font-medium text-white hover:bg-burgundy/90"
          >
            + New Purchase Order
          </button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {statItems.map(({ icon: Icon, iconClass, count, label, value }) => (
          <div
            key={label}
            className="rounded-lg border border-gray-200 bg-white px-4 py-4"
          >
            <div className="flex items-start gap-3">
              <Icon size={22} className={`shrink-0 ${iconClass}`} stroke={1.5} />
              <div>
                <p className="text-2xl font-semibold text-gray-900">{count}</p>
                <p className="text-xs text-gray-500">{label}</p>
                <p className="mt-1 text-sm font-medium text-gray-700">{value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_280px]">
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px] flex-1">
              <IconSearch
                size={18}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="search"
                placeholder="Search POs by vendor, PO #, job…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-md border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-burgundy focus:outline-none focus:ring-1 focus:ring-burgundy"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={selectClass}
            >
              {STATUS_FILTERS.map((f) => (
                <option key={f.value} value={f.value === "all" ? "" : f.value}>
                  {f.label}
                </option>
              ))}
            </select>

            <select
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              className={selectClass}
            >
              <option value="">All Vendors</option>
              {vendors.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>

            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className={selectClass}
            >
              {DATE_RANGES.map((r) => (
                <option key={r.value || "all"} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <IconFilter size={16} />
              Filters
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowColumns((v) => !v)}
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <IconColumns3 size={16} />
                Columns
              </button>
              {showColumns && (
                <div className="absolute right-0 z-10 mt-1 w-44 rounded-md border border-gray-200 bg-white py-2 shadow-lg">
                  {(
                    [
                      ["vendor", "Vendor"],
                      ["job", "Job"],
                      ["description", "Description"],
                      ["status", "Status"],
                      ["ordered", "Ordered"],
                      ["delivery", "Est. Delivery"],
                      ["total", "Total"],
                      ["received", "Received"],
                    ] as const
                  ).map(([key, label]) => (
                    <label
                      key={key}
                      className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={visibleColumns[key]}
                        onChange={() => toggleColumn(key)}
                        className="rounded border-gray-300"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {jobFilter && (
            <p className="mb-4 text-sm text-gray-500">
              Filtered by job ·{" "}
              <a href="/purchasing" className="text-burgundy hover:underline">
                Clear filter
              </a>
            </p>
          )}

          {loading ? (
            <p className="text-gray-500">Loading…</p>
          ) : (
            <>
              <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                        PO #
                      </th>
                      {visibleColumns.vendor && (
                        <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                          Vendor
                        </th>
                      )}
                      {visibleColumns.job && (
                        <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                          Job
                        </th>
                      )}
                      {visibleColumns.description && (
                        <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                          Description
                        </th>
                      )}
                      {visibleColumns.status && (
                        <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                          Status
                        </th>
                      )}
                      {visibleColumns.ordered && (
                        <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                          Ordered
                        </th>
                      )}
                      {visibleColumns.delivery && (
                        <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                          Est. Delivery
                        </th>
                      )}
                      {visibleColumns.total && (
                        <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                          Total
                        </th>
                      )}
                      {visibleColumns.received && (
                        <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                          Received
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {pageOrders.map((po) => (
                      <tr
                        key={po.id}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="px-4 py-3 font-medium text-burgundy">
                          {formatPoNumber(po)}
                        </td>
                        {visibleColumns.vendor && (
                          <td className="px-4 py-3 text-gray-900">{po.vendor}</td>
                        )}
                        {visibleColumns.job && (
                          <td className="px-4 py-3 text-gray-600">
                            {po.jobs?.name ?? "—"}
                          </td>
                        )}
                        {visibleColumns.description && (
                          <td className="px-4 py-3 text-gray-600">
                            {po.item_name}
                          </td>
                        )}
                        {visibleColumns.status && (
                          <td className="px-4 py-3">
                            <PoStatusBadge po={po} />
                          </td>
                        )}
                        {visibleColumns.ordered && (
                          <td className="px-4 py-3 text-gray-600">
                            {po.ordered_at
                              ? formatDateLong(po.ordered_at.slice(0, 10))
                              : "—"}
                          </td>
                        )}
                        {visibleColumns.delivery && (
                          <td className="px-4 py-3 text-gray-600">
                            {formatDateLong(po.expected_delivery)}
                          </td>
                        )}
                        {visibleColumns.total && (
                          <td className="px-4 py-3 text-gray-900">
                            {formatCurrencyFull(Number(po.amount))}
                          </td>
                        )}
                        {visibleColumns.received && (
                          <td className="px-4 py-3">
                            <ReceivedBar percent={getReceivedPercent(po)} />
                          </td>
                        )}
                      </tr>
                    ))}
                    {pageOrders.length === 0 && (
                      <tr>
                        <td
                          colSpan={9}
                          className="px-4 py-8 text-center text-sm text-gray-500"
                        >
                          No purchase orders match your filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
                <p>
                  {filtered.length === 0
                    ? "No purchase orders to show"
                    : `Showing ${pageStart + 1} to ${Math.min(pageStart + pageSize, filtered.length)} of ${filtered.length} purchase order${filtered.length !== 1 ? "s" : ""}`}
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                    className="rounded-md border border-gray-300 p-1.5 hover:bg-gray-50 disabled:opacity-40"
                    aria-label="Previous page"
                  >
                    <IconChevronLeft size={16} />
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(
                      (p) =>
                        p === 1 ||
                        p === totalPages ||
                        Math.abs(p - safePage) <= 1
                    )
                    .reduce<(number | "ellipsis")[]>((acc, p, idx, arr) => {
                      if (idx > 0 && p - (arr[idx - 1] as number) > 1) {
                        acc.push("ellipsis");
                      }
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((item, idx) =>
                      item === "ellipsis" ? (
                        <span
                          key={`ellipsis-${idx}`}
                          className="px-1 text-gray-400"
                        >
                          …
                        </span>
                      ) : (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setPage(item)}
                          className={`min-w-[2rem] rounded-md border px-2 py-1 ${
                            item === safePage
                              ? "border-gray-900 bg-gray-900 text-white"
                              : "border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          {item}
                        </button>
                      )
                    )}

                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage >= totalPages}
                    className="rounded-md border border-gray-300 p-1.5 hover:bg-gray-50 disabled:opacity-40"
                    aria-label="Next page"
                  >
                    <IconChevronRight size={16} />
                  </button>

                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className={selectClass}
                  >
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>
                        {size} / page
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <h3 className="mb-4 text-sm font-semibold text-gray-900">
                Upcoming Deliveries
              </h3>
              {upcoming.length === 0 ? (
                <p className="text-sm text-gray-500">No upcoming deliveries.</p>
              ) : (
                <ul className="space-y-3">
                  {upcoming.map((po) => (
                    <li
                      key={po.id}
                      className="flex items-start justify-between gap-3 text-sm"
                    >
                      <div>
                        <p className="font-medium text-gray-900">
                          {formatDateLong(po.expected_delivery)}
                        </p>
                        <p className="text-gray-600">
                          {po.vendor} · {po.item_name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatPoNumber(po)} · {po.jobs?.name ?? "—"}
                        </p>
                      </div>
                      <span className="shrink-0 font-medium text-gray-900">
                        {formatCurrencyFull(Number(po.amount))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                className="mt-4 text-sm font-medium text-burgundy hover:underline"
              >
                View all upcoming
              </button>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <h3 className="mb-4 text-sm font-semibold text-gray-900">
                Inventory Alerts
              </h3>
              <ul className="space-y-3 text-sm text-gray-700">
                {DEFAULT_INVENTORY_ALERTS.map((alert) => (
                  <li key={alert} className="flex items-start gap-2">
                    <IconAlertTriangle
                      size={16}
                      className="mt-0.5 shrink-0 text-amber-500"
                    />
                    <span>{alert}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="mt-4 text-sm font-medium text-burgundy hover:underline"
              >
                View inventory
              </button>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-gray-900">
              Spend This Month
            </h3>
            <p className="mt-2 text-3xl font-semibold text-gray-900">
              {formatCurrencyFull(spend.thisMonth)}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              vs last month {formatCurrencyFull(spend.lastMonth)}
              {spendChange !== 0 && (
                <span
                  className={
                    spendChange >= 0 ? "text-green-600" : "text-red-600"
                  }
                >
                  {" "}
                  {spendChange >= 0 ? "↑" : "↓"}{" "}
                  {Math.abs(spendChange).toFixed(1)}%
                </span>
              )}
            </p>
            <div className="mt-4">
              <SpendChart values={spendTrend} />
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h3 className="mb-4 text-sm font-semibold text-gray-900">
              Top Vendors (This Month)
            </h3>
            {topVendors.length === 0 ? (
              <p className="text-sm text-gray-500">No vendor spend this month.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {topVendors.map(({ vendor, total }) => (
                  <li
                    key={vendor}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="text-gray-700">{vendor}</span>
                    <span className="font-medium text-gray-900">
                      {formatCurrencyFull(total)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              className="mt-4 text-sm font-medium text-burgundy hover:underline"
            >
              View all vendors
            </button>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h3 className="mb-4 text-sm font-semibold text-gray-900">
              Pending Approvals ({stats.pending})
            </h3>
            {pendingApprovals.length === 0 ? (
              <p className="text-sm text-gray-500">No pending approvals.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {pendingApprovals.map((po) => (
                  <li key={po.id}>
                    <p className="font-medium text-burgundy">
                      {formatPoNumber(po)}
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-gray-600">{po.vendor}</span>
                      <span className="font-medium text-gray-900">
                        {formatCurrencyFull(Number(po.amount))}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => setStatusFilter("pending_approval")}
              className="mt-4 text-sm font-medium text-burgundy hover:underline"
            >
              View all pending
            </button>
          </div>
        </aside>
      </div>

      {showModal && (
        <Modal title="New purchase order" onClose={() => setShowModal(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Description</label>
              <input
                required
                value={form.item_name}
                onChange={(e) =>
                  setForm({ ...form, item_name: e.target.value })
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Job</label>
              <select
                required
                value={form.job_id}
                onChange={(e) => setForm({ ...form, job_id: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">— Select —</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Vendor</label>
              <input
                required
                value={form.vendor}
                onChange={(e) => setForm({ ...form, vendor: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Total</label>
              <input
                type="number"
                required
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Est. delivery
              </label>
              <input
                type="date"
                value={form.expected_delivery}
                onChange={(e) =>
                  setForm({ ...form, expected_delivery: e.target.value })
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Create PO
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
