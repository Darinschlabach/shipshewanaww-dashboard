"use client";

import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import {
  IconPencil,
  IconTrash,
} from "@tabler/icons-react";
import Button from "@/components/Button";
import PoMaterialCataloguePanel from "@/components/jobs/PoMaterialCataloguePanel";
import { createClient } from "@/lib/supabase/client";
import {
  MATERIAL_CATALOGUE_DRAG_MIME,
  parseMaterialCatalogueDrag,
  type MaterialCatalogueDragPayload,
} from "@/lib/po-material-catalogue-drag";
import type { Contact } from "@/lib/types";
export interface PoLineItem {
  id: string;
  description: string;
  qty: number;
  catalogueId?: string;
}
export interface PoDetailData {
  id: string;
  poNumber: string;
  title: string;
  vendor: string;
  lineItems: PoLineItem[];
  isDraft: boolean;
}

interface PoDetailViewProps {
  po: PoDetailData;
  vendorContacts: Contact[];
  jobId: string;
  onBack: () => void;
  onCancel: () => void;
}

const inputClass =  "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-burgundy focus:outline-none focus:ring-1 focus:ring-burgundy";

const labelClass = "mb-1 block text-xs font-medium text-gray-700";

const qtyInputClass =
  "w-16 rounded border border-gray-200 px-2 py-1 text-xs text-gray-900 focus:border-burgundy focus:outline-none focus:ring-1 focus:ring-burgundy";

export default function PoDetailView({
  po,
  vendorContacts,
  jobId,
  onBack,
  onCancel,
}: PoDetailViewProps) {
  const [vendor, setVendor] = useState(po.vendor);
  const [lineItems, setLineItems] = useState<PoLineItem[]>(po.lineItems);
  const [jobLabel, setJobLabel] = useState("Loading job…");
  const [jobNumber, setJobNumber] = useState("");
  const [editingQtyId, setEditingQtyId] = useState<string | null>(null);
  const [editingQtyValue, setEditingQtyValue] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const selectedVendor = useMemo(
    () => vendorContacts.find((c) => c.name === vendor),
    [vendor, vendorContacts]
  );

  useEffect(() => {
    async function loadJob() {
      const supabase = createClient();
      const { data } = await supabase
        .from("jobs")
        .select("name")
        .eq("id", jobId)
        .single();
      if (data?.name) {
        setJobLabel(data.name as string);
        setJobNumber(`#J-${jobId.slice(0, 5).toUpperCase()}`);
      } else {
        setJobLabel("Current job");
        setJobNumber("");
      }
    }
    void loadJob();
  }, [jobId]);

  function startEditQty(item: PoLineItem) {
    setEditingQtyId(item.id);
    setEditingQtyValue(String(item.qty));
  }

  function saveEditQty(itemId: string) {
    const parsed = Number.parseInt(editingQtyValue, 10);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      setLineItems((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, qty: parsed } : item
        )
      );
    }
    setEditingQtyId(null);
    setEditingQtyValue("");
  }

  function cancelEditQty() {
    setEditingQtyId(null);
    setEditingQtyValue("");
  }

  function handleDeleteLineItem(itemId: string) {
    setLineItems((prev) => prev.filter((item) => item.id !== itemId));
    if (editingQtyId === itemId) {
      cancelEditQty();
    }
  }

  const addLineItemFromCatalogue = useCallback(
    (payload: MaterialCatalogueDragPayload) => {
      setLineItems((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          description: payload.name,
          qty: 1,
          catalogueId: payload.id,
        },
      ]);
    },
    []
  );

  function handleLineItemsDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (e.dataTransfer.types.includes(MATERIAL_CATALOGUE_DRAG_MIME)) {
      e.dataTransfer.dropEffect = "copy";
      setIsDragOver(true);
    }
  }

  function handleLineItemsDragLeave(e: DragEvent<HTMLDivElement>) {
    const related = e.relatedTarget as Node | null;
    if (!related || !e.currentTarget.contains(related)) {
      setIsDragOver(false);
    }
  }

  function handleLineItemsDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    const payload = parseMaterialCatalogueDrag(e.dataTransfer);
    if (!payload) return;
    addLineItemFromCatalogue(payload);
  }
  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto">
      <button
        type="button"
        onClick={onBack}
        className="mb-3 inline-block text-left text-sm text-gray-500 hover:text-burgundy"
      >
        ← Back to Purchase Orders
      </button>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold text-gray-900">
            Purchase Order #{po.poNumber}
          </h1>
          <button
            type="button"
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-burgundy"
            aria-label="Edit PO number"
          >
            <IconPencil size={16} />
          </button>
          {po.isDraft ? (
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
              Draft
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button">Save Draft</Button>
          <Button type="button" variant="primary">
            Submit PO
          </Button>
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <div>
              <label className={labelClass}>
                Vendor <span className="text-red-500">*</span>
              </label>
              <select
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                className={inputClass}
              >
                {vendorContacts.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
              {(selectedVendor?.address || selectedVendor?.phone) && (
                <p className="mt-1 text-xs text-gray-500">
                  {[selectedVendor.address, selectedVendor.phone]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className={labelClass}>Job / Project</label>
              <select className={inputClass} defaultValue={jobId}>
                <option value={jobId}>{jobLabel}</option>
              </select>
              {jobNumber ? (
                <p className="mt-1 text-xs text-gray-500">{jobNumber}</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="mb-4 grid min-h-[360px] grid-cols-2 overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div
          className={`flex min-w-0 flex-col border-r border-gray-200 transition-colors ${
            isDragOver
              ? "bg-burgundy/[0.04] ring-2 ring-inset ring-burgundy/40"
              : ""
          }`}
          onDragOver={handleLineItemsDragOver}
          onDragLeave={handleLineItemsDragLeave}
          onDrop={handleLineItemsDrop}
        >
          <div className="shrink-0 border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">
              Line Items
              {isDragOver ? (
                <span className="ml-2 text-xs font-normal text-burgundy">
                  — drop to add
                </span>
              ) : null}
            </h2>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[280px] text-left text-xs">
              <thead className="sticky top-0 z-10 bg-gray-50">
                <tr className="border-b border-gray-100 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                  <th className="px-3 py-2">Qty</th>
                  <th className="px-3 py-2">Item / Description</th>
                  <th className="w-8 px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {lineItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-3 py-8 text-center text-xs text-gray-500"
                    >
                      {isDragOver
                        ? "Release to add this material"
                        : "No items yet — drag or click from the material catalogue →"}
                    </td>
                  </tr>
                ) : (
                  lineItems.map((item) => (
                    <tr
                      key={item.id}
                      className="group border-b border-gray-50 last:border-0 hover:bg-gray-50/80"
                    >
                      <td className="px-3 py-1.5 text-gray-700">
                        {editingQtyId === item.id ? (
                          <input
                            type="number"
                            min={0}
                            autoFocus
                            value={editingQtyValue}
                            onChange={(e) => setEditingQtyValue(e.target.value)}
                            onBlur={() => saveEditQty(item.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                saveEditQty(item.id);
                              }
                              if (e.key === "Escape") {
                                e.preventDefault();
                                cancelEditQty();
                              }
                            }}
                            className={qtyInputClass}
                            aria-label={`Edit quantity for ${item.description || "line item"}`}
                          />
                        ) : (
                          item.qty
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-gray-900">
                        {item.description}
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => startEditQty(item)}
                            className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-burgundy"
                            aria-label={`Edit quantity for ${item.description || "line item"}`}
                          >
                            <IconPencil size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteLineItem(item.id)}
                            className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-red-600"
                            aria-label={`Delete ${item.description || "line item"}`}
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
        </div>

        <aside className="flex min-w-0 flex-col bg-gray-50/80">
          <PoMaterialCataloguePanel onAddItem={addLineItemFromCatalogue} />
        </aside>
      </div>    </div>
  );
}
