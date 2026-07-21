"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { createClient } from "@/lib/supabase/client";
import {
  DELIVERY_SERVICE_NAME,
  fetchQuoteCabinetsTotal,
  fetchQuoteServices,
  isDeliveryService,
  partitionQuoteServices,
  quoteServicesTotal,
  reorderQuoteServices,
} from "@/lib/quote-services";
import type { QuoteService } from "@/lib/types";
import { formatCurrencyFull } from "@/lib/utils";
import QuoteServiceRow from "@/components/quotes/QuoteServiceRow";

interface QuoteServicesTabProps {
  quoteId: string;
  onQuoteUpdated?: () => void;
}

export default function QuoteServicesTab({
  quoteId,
  onQuoteUpdated,
}: QuoteServicesTabProps) {
  const [services, setServices] = useState<QuoteService[]>([]);
  const [cabinetsTotal, setCabinetsTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const load = useCallback(async () => {
    setLoading(true);
    const [{ services: rows, error: servicesError }, cabinets] =
      await Promise.all([
        fetchQuoteServices(quoteId),
        fetchQuoteCabinetsTotal(quoteId),
      ]);

    if (servicesError) {
      setError(servicesError);
      setServices([]);
    } else {
      setError(null);
      setServices(rows);
    }
    setCabinetsTotal(cabinets);
    setLoading(false);
  }, [quoteId]);

  useEffect(() => {
    void load();
  }, [load]);

  const servicesTotal = useMemo(() => quoteServicesTotal(services), [services]);
  const { delivery, otherServices } = useMemo(
    () => partitionQuoteServices(services),
    [services]
  );

  async function handleAddService() {
    setAdding(true);
    const supabase = createClient();
    const maxOrder = otherServices.reduce(
      (max, row) => Math.max(max, row.sort_order),
      delivery ? delivery.sort_order : -1
    );

    const { data, error: insertError } = await supabase
      .from("quote_services")
      .insert({
        lead_id: quoteId,
        name: "",
        description: "",
        price: 0,
        sort_order: maxOrder + 1,
      })
      .select("*")
      .single();

    setAdding(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }

    const created = data as QuoteService;
    setServices((prev) => {
      const { delivery: deliveryRow, otherServices: others } =
        partitionQuoteServices(prev);
      return deliveryRow ? [deliveryRow, ...others, created] : [created];
    });
    setEditingId(created.id);
    onQuoteUpdated?.();
  }

  async function handleSave(
    id: string,
    patch: Pick<QuoteService, "name" | "description" | "price">
  ) {
    const existing = services.find((row) => row.id === id);
    const isDelivery = existing ? isDeliveryService(existing) : false;
    const supabase = createClient();
    await supabase
      .from("quote_services")
      .update({
        name: isDelivery ? DELIVERY_SERVICE_NAME : patch.name,
        description: patch.description,
        price: patch.price,
        ...(isDelivery ? { is_delivery: true } : {}),
      })
      .eq("id", id);

    setServices((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              name: isDelivery ? DELIVERY_SERVICE_NAME : patch.name,
              description: patch.description,
              price: patch.price,
              ...(isDelivery ? { is_delivery: true } : {}),
            }
          : row
      )
    );
    setEditingId(null);
    onQuoteUpdated?.();
  }

  async function handleDelete(service: QuoteService) {
    if (isDeliveryService(service)) return;
    if (!confirm(`Delete "${service.name || "this service"}"?`)) return;

    const supabase = createClient();
    await supabase.from("quote_services").delete().eq("id", service.id);
    setServices((prev) => prev.filter((row) => row.id !== service.id));
    onQuoteUpdated?.();
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !delivery) return;

    const oldIndex = otherServices.findIndex((row) => row.id === active.id);
    const newIndex = otherServices.findIndex((row) => row.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reorderedOthers = arrayMove(otherServices, oldIndex, newIndex);
    const reordered = [delivery, ...reorderedOthers];
    setServices(reordered);
    await reorderQuoteServices(reordered.map((row) => row.id));
  }

  if (loading) {
    return <p className="p-6 text-sm text-gray-500">Loading services…</p>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Services
        </h2>
        <button
          type="button"
          onClick={() => void handleAddService()}
          disabled={adding}
          className="rounded-md bg-burgundy px-3 py-1.5 text-sm font-medium text-white hover:bg-burgundy/90 disabled:opacity-50"
        >
          + Add Service
        </button>
      </div>

      {error && (
        <p className="mb-3 shrink-0 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {error}
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-gray-200 bg-white">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(event) => void handleDragEnd(event)}
        >
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-gray-200 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                <th className="w-8 py-2.5 pr-1" />
                <th className="py-2.5 pr-3">Service</th>
                <th className="py-2.5 pr-3">Description</th>
                <th className="py-2.5 pr-3 text-right">Price</th>
                <th className="py-2.5 pr-3 text-right">Total</th>
                <th className="w-10 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {delivery && (
                <QuoteServiceRow
                  key={delivery.id}
                  service={delivery}
                  isDelivery
                  onSave={handleSave}
                  onDelete={handleDelete}
                />
              )}
              <SortableContext
                items={otherServices.map((row) => row.id)}
                strategy={verticalListSortingStrategy}
              >
                {otherServices.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-6 text-center text-sm text-gray-500"
                    >
                      No additional services yet. Click &ldquo;+ Add Service&rdquo;
                      to add another line.
                    </td>
                  </tr>
                ) : (
                  otherServices.map((service) => (
                    <QuoteServiceRow
                      key={service.id}
                      service={service}
                      startEditing={editingId === service.id}
                      onEditingDone={() => setEditingId(null)}
                      onSave={handleSave}
                      onDelete={handleDelete}
                    />
                  ))
                )}
              </SortableContext>
            </tbody>
          </table>
        </DndContext>
      </div>

      <div className="mt-3 flex shrink-0 flex-wrap items-end justify-between gap-4">
        <button
          type="button"
          onClick={() => void handleAddService()}
          disabled={adding}
          className="text-sm font-medium text-burgundy hover:underline disabled:opacity-50"
        >
          + Add Service
        </button>

        <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-4 sm:w-auto">
          <div className="flex items-center justify-between gap-6 text-sm">
            <span className="text-gray-600">Services Total</span>
            <span className="font-semibold tabular-nums text-gray-900">
              {formatCurrencyFull(servicesTotal)}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-6 border-t border-gray-100 pt-2 text-sm">
            <span className="text-gray-500">Cabinets Total</span>
            <span className="tabular-nums text-gray-700">
              {formatCurrencyFull(cabinetsTotal)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
