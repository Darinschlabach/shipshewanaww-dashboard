"use client";

import { useMemo, useState } from "react";
import {
  IconAlertTriangle,
  IconArrowNarrowRight,
  IconBox,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconCurrencyDollar,
  IconDots,
  IconFilter,
  IconSearch,
  IconShoppingCart,
} from "@tabler/icons-react";
import Button from "@/components/Button";

type PoStatus = "Received" | "Partial" | "Open" | "Overdue";
type PoFilter = "All Purchase Orders" | "Open" | "Received" | "Partial" | "Closed";

interface PurchaseOrder {
  id: string;
  po: string;
  vendor: string;
  category: string;
  categoryStyle: string;
  orderDate: string;
  expected: string;
  expectedOverdue?: boolean;
  total: number;
  received: number;
  status: PoStatus;
}

interface ItemOnOrder {
  id: string;
  item: string;
  vendor: string;
  po: string;
  ordered: number;
  receivedQty: number;
  unit: string;
  expected: string;
  expectedOverdue?: boolean;
  status: PoStatus;
}

const VENDORS = [
  { name: "Carter Lumber", amount: 3245.8 },
  { name: "WoodPro Hardware", amount: 1287.45 },
  { name: "Frontier Components", amount: 2156.2 },
  { name: "Hettich America", amount: 892.11 },
  { name: "Wilsonart", amount: 1161.0 },
];

const CATEGORY_BREAKDOWN = [
  { label: "Lumber & Panels", percent: 44, color: "#ec4899" },
  { label: "Cabinet Parts", percent: 26, color: "#a855f7" },
  { label: "Hardware", percent: 14, color: "#3b82f6" },
  { label: "Finishes & Supplies", percent: 9, color: "#f59e0b" },
  { label: "Other", percent: 7, color: "#9ca3af" },
];

const PURCHASE_ORDERS: PurchaseOrder[] = [
  {
    id: "7",
    po: "PO-1007",
    vendor: "Carter Lumber",
    category: "Lumber & Panels",
    categoryStyle: "bg-pink-50 text-pink-700",
    orderDate: "2024-05-10",
    expected: "2024-05-20",
    total: 1842.5,
    received: 1842.5,
    status: "Received",
  },
  {
    id: "6",
    po: "PO-1006",
    vendor: "WoodPro Hardware",
    category: "Hardware",
    categoryStyle: "bg-blue-50 text-blue-700",
    orderDate: "2024-05-12",
    expected: "2024-05-22",
    total: 987.45,
    received: 620.0,
    status: "Partial",
  },
  {
    id: "5",
    po: "PO-1005",
    vendor: "Frontier Components",
    category: "Cabinet Parts",
    categoryStyle: "bg-purple-50 text-purple-700",
    orderDate: "2024-05-14",
    expected: "2024-05-24",
    total: 2156.2,
    received: 2156.2,
    status: "Received",
  },
  {
    id: "4",
    po: "PO-1004",
    vendor: "Hettich America",
    category: "Hardware",
    categoryStyle: "bg-blue-50 text-blue-700",
    orderDate: "2024-05-15",
    expected: "2024-05-25",
    expectedOverdue: true,
    total: 892.11,
    received: 0,
    status: "Overdue",
  },
  {
    id: "3",
    po: "PO-1003",
    vendor: "Wilsonart",
    category: "Finishes & Supplies",
    categoryStyle: "bg-amber-50 text-amber-700",
    orderDate: "2024-05-16",
    expected: "2024-05-28",
    total: 1161.0,
    received: 0,
    status: "Open",
  },
  {
    id: "2",
    po: "PO-1002",
    vendor: "Carter Lumber",
    category: "Lumber & Panels",
    categoryStyle: "bg-pink-50 text-pink-700",
    orderDate: "2024-05-08",
    expected: "2024-05-18",
    total: 1403.3,
    received: 1403.3,
    status: "Received",
  },
  {
    id: "1",
    po: "PO-1001",
    vendor: "Frontier Components",
    category: "Cabinet Parts",
    categoryStyle: "bg-purple-50 text-purple-700",
    orderDate: "2024-05-06",
    expected: "2024-05-20",
    total: 300.0,
    received: 0,
    status: "Open",
  },
];

const ITEMS_ON_ORDER: ItemOnOrder[] = [
  {
    id: "1",
    item: '3/4" White Melamine',
    vendor: "Carter Lumber",
    po: "PO-1006",
    ordered: 12,
    receivedQty: 8,
    unit: "sheets",
    expected: "2024-05-22",
    status: "Partial",
  },
  {
    id: "2",
    item: "Grass Hinges 110°",
    vendor: "Hettich America",
    po: "PO-1004",
    ordered: 24,
    receivedQty: 0,
    unit: "each",
    expected: "2024-05-25",
    expectedOverdue: true,
    status: "Open",
  },
  {
    id: "3",
    item: '5/8" Maple Plywood',
    vendor: "Carter Lumber",
    po: "PO-1002",
    ordered: 6,
    receivedQty: 0,
    unit: "sheets",
    expected: "2024-05-18",
    expectedOverdue: true,
    status: "Overdue",
  },
];

const PO_FILTERS: { key: PoFilter; label: string; count?: number }[] = [
  { key: "All Purchase Orders", label: "All Purchase Orders" },
  { key: "Open", label: "Open", count: 3 },
  { key: "Received", label: "Received", count: 3 },
  { key: "Partial", label: "Partial", count: 1 },
  { key: "Closed", label: "Closed", count: 0 },
];

const STATUS_STYLES: Record<PoStatus, string> = {
  Received: "bg-green-50 text-green-700",
  Partial: "bg-amber-50 text-amber-700",
  Open: "bg-blue-50 text-blue-700",
  Overdue: "bg-red-50 text-red-700",
};

const TOTAL_PO_VALUE = 8742.56;
const RECEIVED_VALUE = 5482.3;
const PENDING_VALUE = 3260.26;

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function StatusBadge({ status }: { status: PoStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

function CategoryDonut() {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex items-center gap-3">
      <div className="relative h-24 w-24 shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          {CATEGORY_BREAKDOWN.map((cat) => {
            const dash = (cat.percent / 100) * circumference;
            const segment = (
              <circle
                key={cat.label}
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke={cat.color}
                strokeWidth="14"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
              />
            );
            offset += dash;
            return segment;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] font-semibold text-gray-900">
            {formatMoney(TOTAL_PO_VALUE)}
          </span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-1 text-[10px]">
        {CATEGORY_BREAKDOWN.map((cat) => (
          <li key={cat.label} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5 text-gray-600">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: cat.color }}
              />
              <span className="truncate">{cat.label}</span>
            </span>
            <span className="shrink-0 font-medium text-gray-900">{cat.percent}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface PurchasingTabProps {
  jobId: string;
}

export default function PurchasingTab({ jobId: _jobId }: PurchasingTabProps) {
  const [poFilter, setPoFilter] = useState<PoFilter>("All Purchase Orders");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filteredOrders = useMemo(() => {
    let list = PURCHASE_ORDERS;
    if (poFilter !== "All Purchase Orders") {
      if (poFilter === "Closed") return [];
      if (poFilter === "Open") {
        list = list.filter(
          (po) => po.status === "Open" || po.status === "Overdue"
        );
      } else {
        list = list.filter((po) => po.status === poFilter);
      }
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (po) =>
          po.po.toLowerCase().includes(q) ||
          po.vendor.toLowerCase().includes(q) ||
          po.category.toLowerCase().includes(q)
      );
    }
    return list;
  }, [poFilter, search]);

  const receivedPercent = Math.round((RECEIVED_VALUE / TOTAL_PO_VALUE) * 100);
  const pendingPercent = 100 - receivedPercent;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
          <div className="mb-1 flex items-start justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Purchase Orders
            </span>
            <IconShoppingCart size={18} className="text-blue-600" />
          </div>
          <p className="text-xl font-semibold text-gray-900">7</p>
          <p className="text-[10px] text-gray-500">Total POs</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
          <div className="mb-1 flex items-start justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Total PO Value
            </span>
            <IconCurrencyDollar size={18} className="text-green-600" />
          </div>
          <p className="text-xl font-semibold text-gray-900">
            {formatMoney(TOTAL_PO_VALUE)}
          </p>
          <p className="text-[10px] text-gray-500">Total of all POs</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
          <div className="mb-1 flex items-start justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Received Value
            </span>
            <IconBox size={18} className="text-purple-600" />
          </div>
          <p className="text-xl font-semibold text-gray-900">
            {formatMoney(RECEIVED_VALUE)}
          </p>
          <p className="text-[10px] text-gray-500">
            {receivedPercent}% of PO value
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
          <div className="mb-1 flex items-start justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Pending Value
            </span>
            <IconClock size={18} className="text-amber-600" />
          </div>
          <p className="text-xl font-semibold text-gray-900">
            {formatMoney(PENDING_VALUE)}
          </p>
          <p className="text-[10px] text-gray-500">
            {pendingPercent}% of PO value
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
          <div className="mb-1 flex items-start justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Overdue Orders
            </span>
            <IconAlertTriangle size={18} className="text-red-600" />
          </div>
          <p className="text-xl font-semibold text-gray-900">1</p>
          <p className="text-[10px] text-red-600">Needs attention</p>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 xl:grid-cols-12">
        <div className="flex min-h-0 flex-col gap-2 xl:col-span-3">
          <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white">
            <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-3 py-2">
              <h3 className="text-sm font-semibold text-gray-900">Vendors</h3>
              <Button variant="primary" className="!px-2 !py-0.5 !text-[10px]">
                + New vendor
              </Button>
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto px-3 py-1">
              {VENDORS.map((v) => (
                <li
                  key={v.name}
                  className="flex items-center justify-between border-b border-gray-50 py-1.5 text-xs last:border-0"
                >
                  <span className="text-gray-800">{v.name}</span>
                  <span className="font-medium text-gray-900">
                    {formatMoney(v.amount)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="shrink-0 border-t border-gray-100 px-3 py-1.5">
              <button
                type="button"
                className="inline-flex items-center gap-0.5 text-xs text-burgundy hover:underline"
              >
                View all vendors
                <IconArrowNarrowRight size={14} />
              </button>
            </div>
          </div>

          <div className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-2.5">
            <h3 className="mb-2 text-sm font-semibold text-gray-900">
              Purchase Categories
            </h3>
            <CategoryDonut />
            <button
              type="button"
              className="mt-2 inline-flex items-center gap-0.5 text-xs text-burgundy hover:underline"
            >
              View category breakdown
              <IconArrowNarrowRight size={14} />
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-2 xl:col-span-9">
          <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white">
            <div className="shrink-0 border-b border-gray-100 px-3 py-2">
              <div className="mb-2 flex flex-wrap gap-3 text-xs">
                {PO_FILTERS.map(({ key, label, count }) => {
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
                      {label}
                      {count !== undefined ? ` (${count})` : ""}
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
                  <Button variant="primary" className="!px-2.5 !py-1 !text-xs">
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
                    <th className="px-3 py-2 font-medium">Expected</th>
                    <th className="px-3 py-2 font-medium">Total</th>
                    <th className="px-3 py-2 font-medium">Received</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="w-8 px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((po) => (
                    <tr
                      key={po.id}
                      className="border-b border-gray-100 last:border-0 hover:bg-gray-50/80"
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
                      <td className="px-3 py-1.5 font-medium text-gray-900">
                        {formatMoney(po.total)}
                      </td>
                      <td className="px-3 py-1.5 text-gray-700">
                        {formatMoney(po.received)}
                      </td>
                      <td className="px-3 py-1.5">
                        <StatusBadge status={po.status} />
                      </td>
                      <td className="px-3 py-1.5">
                        <button
                          type="button"
                          className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                          aria-label={`Actions for ${po.po}`}
                        >
                          <IconDots size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
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

          <div className="flex shrink-0 flex-col rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-3 py-2">
              <h3 className="text-sm font-semibold text-gray-900">
                Items on Order ({ITEMS_ON_ORDER.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-[10px] uppercase text-gray-500">
                    <th className="px-3 py-1.5 font-medium">Item</th>
                    <th className="px-3 py-1.5 font-medium">Vendor</th>
                    <th className="px-3 py-1.5 font-medium">PO #</th>
                    <th className="px-3 py-1.5 font-medium">Ordered</th>
                    <th className="px-3 py-1.5 font-medium">Received</th>
                    <th className="px-3 py-1.5 font-medium">Unit</th>
                    <th className="px-3 py-1.5 font-medium">Expected</th>
                    <th className="px-3 py-1.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {ITEMS_ON_ORDER.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-gray-50 last:border-0"
                    >
                      <td className="px-3 py-1.5 font-medium text-gray-900">
                        {item.item}
                      </td>
                      <td className="px-3 py-1.5 text-gray-700">{item.vendor}</td>
                      <td className="px-3 py-1.5 text-gray-700">{item.po}</td>
                      <td className="px-3 py-1.5 text-gray-700">{item.ordered}</td>
                      <td className="px-3 py-1.5 text-gray-700">
                        {item.receivedQty}
                      </td>
                      <td className="px-3 py-1.5 text-gray-600">{item.unit}</td>
                      <td
                        className={`px-3 py-1.5 whitespace-nowrap ${
                          item.expectedOverdue
                            ? "font-medium text-red-600"
                            : "text-gray-600"
                        }`}
                      >
                        {formatDate(item.expected)}
                      </td>
                      <td className="px-3 py-1.5">
                        <StatusBadge status={item.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-3 py-2">
              <button
                type="button"
                className="inline-flex items-center gap-0.5 text-xs text-burgundy hover:underline"
              >
                View all items on order
                <IconArrowNarrowRight size={14} />
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-0.5 text-xs font-medium text-burgundy hover:underline"
              >
                Receive items
                <IconArrowNarrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
