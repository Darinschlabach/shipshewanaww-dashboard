"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  IconChevronLeft,
  IconChevronRight,
  IconCheckbox,
  IconFilter,
  IconFlag,
  IconPencil,
  IconSearch,
  IconShoppingCart,
  IconTrash,
  IconTruck,
} from "@tabler/icons-react";
import Button from "@/components/Button";
import PoDetailView, { type PoDetailData } from "@/components/jobs/PoDetailView";
import { createClient } from "@/lib/supabase/client";
import {
  buildJobPurchaseOrderInsert,
  dbRowToJobPurchaseOrder,
  isMissingColumnError,
  nextJobPoNumber,
  purchaseOrderInsertErrorMessage,
  type JobPoStatus,
  type JobPoType,
  type JobPurchaseOrder,
} from "@/lib/job-purchase-orders";
import type { Contact, PurchaseOrder as DbPurchaseOrder } from "@/lib/types";

type PoFilter = "All Purchase Orders" | "Confirmed" | "Delivered" | "Flagged";
type PurchasingView = "list" | "detail";

const PO_FILTER_OPTIONS: { key: PoFilter; label: string }[] = [
  { key: "All Purchase Orders", label: "All Purchase Orders" },
  { key: "Confirmed", label: "Confirmed" },
  { key: "Delivered", label: "Delivered" },
  { key: "Flagged", label: "Flagged" },
];

const PO_TYPE_OPTIONS: JobPoType[] = ["Doors", "Drawers", "Plywood", "Hardware"];

function matchesPoFilter(po: JobPurchaseOrder, filter: PoFilter): boolean {
  switch (filter) {
    case "All Purchase Orders":
      return true;
    case "Confirmed":
      return true;
    case "Delivered":
      return po.status === "Received";
    case "Flagged":
      return po.status === "Overdue";
  }
}

const STATUS_STYLES: Record<JobPoStatus, string> = {
  Received: "bg-green-50 text-green-700",
  Partial: "bg-amber-50 text-amber-700",
  Open: "bg-blue-50 text-blue-700",
  Overdue: "bg-red-50 text-red-700",
};

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function StatusBadge({ status }: { status: JobPoStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

interface PurchasingTabProps {
  jobId: string;
  isActive?: boolean;
  onFullScreenModeChange?: (enabled: boolean) => void;
}

export default function PurchasingTab({
  jobId,
  isActive = true,
  onFullScreenModeChange,
}: PurchasingTabProps) {
  const [view, setView] = useState<PurchasingView>("list");
  const [activePoId, setActivePoId] = useState<string | null>(null);
  const [purchaseOrders, setPurchaseOrders] = useState<JobPurchaseOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [poFilter, setPoFilter] = useState<PoFilter>("All Purchase Orders");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showNewPoModal, setShowNewPoModal] = useState(false);
  const [creatingPo, setCreatingPo] = useState(false);
  const [vendorContacts, setVendorContacts] = useState<Contact[]>([]);
  const [vendorsLoading, setVendorsLoading] = useState(true);
  const [newPoVendor, setNewPoVendor] = useState("");
  const [newPoType, setNewPoType] = useState<JobPoType>("Doors");
  const [newPoTitle, setNewPoTitle] = useState("");

  const loadPurchaseOrders = useCallback(async () => {
    setOrdersLoading(true);
    setOrdersError(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("purchase_orders")
      .select("*")
      .eq("job_id", jobId)
      .neq("status", "archived")
      .order("created_at", { ascending: false });

    if (error) {
      setOrdersError("Could not load purchase orders. Please refresh the page.");
      setOrdersLoading(false);
      return;
    }

    setPurchaseOrders(
      ((data as DbPurchaseOrder[]) ?? []).map(dbRowToJobPurchaseOrder)
    );
    setOrdersLoading(false);
  }, [jobId]);

  const loadVendorContacts = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("contacts")
      .select("*")
      .eq("contact_type", "Vendors")
      .order("name");
    const vendors = (data as Contact[]) ?? [];
    setVendorContacts(vendors);
    setVendorsLoading(false);
    setNewPoVendor((currentVendor) => currentVendor || vendors[0]?.name || "");
  }, []);

  useEffect(() => {
    if (!isActive) return;

    void loadPurchaseOrders();

    function handleFocus() {
      void loadPurchaseOrders();
    }

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [isActive, loadPurchaseOrders]);

  useEffect(() => {
    loadVendorContacts();
  }, [loadVendorContacts]);

  useEffect(() => {
    onFullScreenModeChange?.(isActive && view !== "list");
    return () => onFullScreenModeChange?.(false);
  }, [isActive, onFullScreenModeChange, view]);

  const filteredOrders = useMemo(() => {
    let list = purchaseOrders;
    if (poFilter !== "All Purchase Orders") {
      list = list.filter((po) => matchesPoFilter(po, poFilter));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (po) =>
          po.po.toLowerCase().includes(q) ||
          po.title.toLowerCase().includes(q) ||
          po.vendor.toLowerCase().includes(q) ||
          po.category.toLowerCase().includes(q)
      );
    }
    return list;
  }, [poFilter, purchaseOrders, search]);

  const allPoCount = purchaseOrders.length;
  const confirmedPoCount = purchaseOrders.length;
  const deliveredPoCount = purchaseOrders.filter(
    (po) => po.status === "Received"
  ).length;
  const flaggedPoCount = purchaseOrders.filter(
    (po) => po.status === "Overdue"
  ).length;

  const poFilterCounts: Record<PoFilter, number> = {
    "All Purchase Orders": allPoCount,
    Confirmed: confirmedPoCount,
    Delivered: deliveredPoCount,
    Flagged: flaggedPoCount,
  };

  function closeNewPoModal() {
    setShowNewPoModal(false);
  }

  function toIsoDate(daysFromToday: number) {
    const date = new Date();
    date.setDate(date.getDate() + daysFromToday);
    return date.toISOString().slice(0, 10);
  }

  function toPoDetailData(po: JobPurchaseOrder): PoDetailData {
    return {
      id: po.id,
      poNumber: po.po,
      title: po.title,
      vendor: po.vendor,
      lineItems: [],
      isDraft: po.isDraft ?? false,
    };
  }

  const activePo = useMemo(
    () => purchaseOrders.find((po) => po.id === activePoId) ?? null,
    [activePoId, purchaseOrders]
  );

  async function handleCreatePo(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = newPoTitle.trim();
    if (!title || creatingPo) return;

    const today = toIsoDate(0);
    const expected = toIsoDate(10);
    setCreatingPo(true);
    setActionError(null);

    const supabase = createClient();
    const { data: existing } = await supabase
      .from("purchase_orders")
      .select("*")
      .eq("job_id", jobId);

    const poNumber = nextJobPoNumber((existing as DbPurchaseOrder[]) ?? []);
    const insertPayload = buildJobPurchaseOrderInsert(jobId, {
      title,
      vendor: newPoVendor,
      poType: newPoType,
      poNumber,
      orderDate: today,
      expectedDelivery: expected,
    });

    let { data, error } = await supabase
      .from("purchase_orders")
      .insert(insertPayload)
      .select("*")
      .single();

    if (error && isMissingColumnError(error.message)) {
      const corePayload = buildJobPurchaseOrderInsert(jobId, {
        title,
        vendor: newPoVendor,
        poType: newPoType,
        orderDate: today,
        expectedDelivery: expected,
      });
      ({ data, error } = await supabase
        .from("purchase_orders")
        .insert(corePayload)
        .select("*")
        .single());
    }

    setCreatingPo(false);

    if (error || !data) {
      setActionError(
        purchaseOrderInsertErrorMessage(
          error?.message ?? "Unknown error creating purchase order."
        )
      );
      return;
    }

    await loadPurchaseOrders();
    const created = dbRowToJobPurchaseOrder(data as DbPurchaseOrder);
    closeNewPoModal();
    setActivePoId(created.id);
    setView("detail");
    setNewPoTitle("");
    setNewPoType("Doors");
    setNewPoVendor(vendorContacts[0]?.name ?? "");
  }

  function handleOpenPo(poId: string) {
    setActivePoId(poId);
    setView("detail");
  }

  function handleBackToList() {
    setView("list");
    setActivePoId(null);
  }

  async function handleDeletePo(poId: string) {
    setActionError(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("purchase_orders")
      .delete()
      .eq("id", poId);

    if (error) {
      setActionError("Could not delete purchase order. Please try again.");
      return;
    }

    await loadPurchaseOrders();
    if (activePoId === poId) {
      handleBackToList();
    }
  }

  if (view === "detail" && activePo) {
    return (
      <PoDetailView
        po={toPoDetailData(activePo)}
        vendorContacts={vendorContacts}
        jobId={jobId}
        onBack={handleBackToList}
        onCancel={handleBackToList}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {ordersError || actionError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {actionError ?? ordersError}
        </div>
      ) : null}
      <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
          <div className="mb-1 flex items-start justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Purchase Orders
            </span>
            <IconShoppingCart size={18} className="text-blue-600" />
          </div>
          <p className="text-xl font-semibold text-gray-900">{allPoCount}</p>
          <p className="text-[10px] text-gray-500">Total POs</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
          <div className="mb-1 flex items-start justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Confirmed POs
            </span>
            <IconCheckbox size={18} className="text-green-600" />
          </div>
          <p className="text-xl font-semibold text-gray-900">
            {confirmedPoCount}
          </p>
          <p className="text-[10px] text-gray-500">Total Confirmed POs</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
          <div className="mb-1 flex items-start justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Delivered POs
            </span>
            <IconTruck size={18} className="text-purple-600" />
          </div>
          <p className="text-xl font-semibold text-gray-900">{deliveredPoCount}</p>
          <p className="text-[10px] text-gray-500">Total Delivered POs</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
          <div className="mb-1 flex items-start justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Flagged POs
            </span>
            <IconFlag size={18} className="text-red-600" />
          </div>
          <p className="text-xl font-semibold text-gray-900">{flaggedPoCount}</p>
          <p className="text-[10px] text-red-600">Needs attention</p>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2">
        <div className="flex min-h-0 flex-col gap-2">
          <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white">
            <div className="shrink-0 border-b border-gray-100 px-3 py-2">
              <div className="mb-2 flex flex-wrap gap-3 text-xs">
                {PO_FILTER_OPTIONS.map(({ key, label }) => {
                  const active = poFilter === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setPoFilter(key);
                        setPage(1);
                      }}
                      className={`pb-1 ${
                        active
                          ? "border-b-2 border-burgundy font-medium text-burgundy"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      {label} ({poFilterCounts[key]})
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-gray-900">
                  All Purchase Orders
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <IconSearch
                      size={14}
                      className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      type="search"
                      placeholder="Search POs..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-36 rounded border border-gray-200 py-1 pl-7 pr-2 text-xs focus:border-burgundy focus:outline-none focus:ring-1 focus:ring-burgundy"
                    />
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                  >
                    <IconFilter size={14} />
                    Filter
                  </button>
                  <Button
                    variant="primary"
                    className="!px-2.5 !py-1 !text-xs"
                    onClick={() => setShowNewPoModal(true)}
                  >
                    + New PO
                  </Button>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full min-w-[780px] text-left text-xs">
                <thead className="sticky top-0 z-10 bg-gray-50">
                  <tr className="border-b border-gray-200 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                    <th className="px-3 py-2 font-medium">PO #</th>
                    <th className="px-3 py-2 font-medium">Vendor</th>
                    <th className="px-3 py-2 font-medium">Category</th>
                    <th className="px-3 py-2 font-medium">Order Date</th>
                    <th className="px-3 py-2 font-medium">Delivery</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="w-8 px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {ordersLoading ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-xs text-gray-500">
                        Loading purchase orders…
                      </td>
                    </tr>
                  ) : filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-xs text-gray-500">
                        No purchase orders yet.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((po) => (
                    <tr
                      key={po.id}
                      className="group border-b border-gray-100 last:border-0 hover:bg-gray-50/80"
                      onClick={() => handleOpenPo(po.id)}
                    >
                      <td className="px-3 py-1.5 font-medium text-gray-900">
                        {po.po}
                      </td>
                      <td className="px-3 py-1.5 text-gray-700">{po.vendor}</td>
                      <td className="px-3 py-1.5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${po.categoryStyle}`}
                        >
                          {po.category}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-gray-600">
                        {formatDate(po.orderDate)}
                      </td>
                      <td
                        className={`px-3 py-1.5 whitespace-nowrap ${
                          po.expectedOverdue
                            ? "font-medium text-red-600"
                            : "text-gray-600"
                        }`}
                      >
                        {formatDate(po.expected)}
                      </td>
                      <td className="px-3 py-1.5">
                        <StatusBadge status={po.status} />
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleOpenPo(po.id);
                            }}
                            className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-burgundy"
                            aria-label={`Open ${po.po}`}
                          >
                            <IconPencil size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleDeletePo(po.id);
                            }}
                            className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-red-600"
                            aria-label={`Delete ${po.po}`}
                          >
                            <IconTrash size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-3 py-2">
              <p className="text-[10px] text-gray-500">
                Showing 1 to {filteredOrders.length} of {filteredOrders.length}{" "}
                POs
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={page <= 1}
                  className="flex h-7 w-7 items-center justify-center rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                >
                  <IconChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  className="flex h-7 min-w-[1.75rem] items-center justify-center rounded border border-burgundy bg-burgundy px-1.5 text-xs text-white"
                >
                  1
                </button>
                <button
                  type="button"
                  disabled
                  className="flex h-7 w-7 items-center justify-center rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                >
                  <IconChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showNewPoModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="border-b border-gray-100 px-4 py-3">
              <h3 className="text-base font-semibold text-gray-900">New Purchase Order</h3>
            </div>
            <form onSubmit={handleCreatePo} className="space-y-3 px-4 py-4">
              <div className="space-y-1">
                <label htmlFor="new-po-title" className="text-xs font-medium text-gray-700">
                  PO Title
                </label>
                <input
                  id="new-po-title"
                  type="text"
                  value={newPoTitle}
                  onChange={(e) => setNewPoTitle(e.target.value)}
                  placeholder="Enter PO title..."
                  required
                  className="w-full rounded border border-gray-200 px-2.5 py-2 text-sm text-gray-900 focus:border-burgundy focus:outline-none focus:ring-1 focus:ring-burgundy"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="new-po-vendor" className="text-xs font-medium text-gray-700">
                  Vendor
                </label>
                <select
                  id="new-po-vendor"
                  value={newPoVendor}
                  onChange={(e) => setNewPoVendor(e.target.value)}
                  disabled={vendorsLoading || vendorContacts.length === 0}
                  className="w-full rounded border border-gray-200 px-2.5 py-2 text-sm text-gray-900 focus:border-burgundy focus:outline-none focus:ring-1 focus:ring-burgundy"
                >
                  {vendorContacts.map((vendor) => (
                    <option key={vendor.id} value={vendor.name}>
                      {vendor.name}
                    </option>
                  ))}
                </select>
                {!vendorsLoading && vendorContacts.length === 0 ? (
                  <p className="text-xs text-gray-500">
                    No vendor contacts found. Add contacts with type `Vendors`.
                  </p>
                ) : null}
              </div>

              <div className="space-y-1">
                <label htmlFor="new-po-type" className="text-xs font-medium text-gray-700">
                  PO Type
                </label>
                <select
                  id="new-po-type"
                  value={newPoType}
                  onChange={(e) => setNewPoType(e.target.value as JobPoType)}
                  className="w-full rounded border border-gray-200 px-2.5 py-2 text-sm text-gray-900 focus:border-burgundy focus:outline-none focus:ring-1 focus:ring-burgundy"
                >
                  {PO_TYPE_OPTIONS.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" onClick={closeNewPoModal}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={vendorsLoading || vendorContacts.length === 0 || creatingPo}
                >
                  {creatingPo ? "Creating…" : "Create PO"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
