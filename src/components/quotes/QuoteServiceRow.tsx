"use client";

import { useEffect, useRef, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { IconGripVertical, IconPencil, IconTrash } from "@tabler/icons-react";
import type { QuoteService } from "@/lib/types";
import { DELIVERY_SERVICE_NAME } from "@/lib/quote-services";
import { formatCurrencyFull } from "@/lib/utils";

const inputClass =
  "w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-burgundy focus:outline-none focus:ring-1 focus:ring-burgundy";

const priceInputClass =
  "w-28 rounded border border-gray-300 px-2 py-1.5 text-right text-sm tabular-nums text-gray-900 focus:border-burgundy focus:outline-none focus:ring-1 focus:ring-burgundy";

interface QuoteServiceRowProps {
  service: QuoteService;
  onSave: (
    id: string,
    patch: Pick<QuoteService, "name" | "description" | "price">
  ) => Promise<void>;
  onDelete: (service: QuoteService) => void;
  startEditing?: boolean;
  onEditingDone?: () => void;
  isDelivery?: boolean;
}

function parsePrice(value: string): number {
  const trimmed = value.trim().replace(/[$,]/g, "");
  if (!trimmed) return 0;
  const n = parseFloat(trimmed);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
}

export default function QuoteServiceRow({
  service,
  onSave,
  onDelete,
  startEditing = false,
  onEditingDone,
  isDelivery = false,
}: QuoteServiceRowProps) {
  const nameRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(service.name);
  const [description, setDescription] = useState(service.description ?? "");
  const [price, setPrice] = useState(
    service.price > 0 ? String(service.price) : ""
  );
  const [isEditing, setIsEditing] = useState(
    startEditing || (!isDelivery && !service.name.trim())
  );
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: service.id, disabled: isDelivery });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  useEffect(() => {
    if (!isEditing) {
      setName(service.name);
      setDescription(service.description ?? "");
      setPrice(service.price > 0 ? String(service.price) : "");
    }
  }, [service, isEditing]);

  useEffect(() => {
    if (startEditing) {
      setIsEditing(true);
      requestAnimationFrame(() => {
        if (isDelivery) {
          priceRef.current?.focus();
          priceRef.current?.select();
          return;
        }
        nameRef.current?.focus();
        nameRef.current?.select();
      });
    }
  }, [startEditing, isDelivery]);

  async function commit() {
    const patch = {
      name: isDelivery ? DELIVERY_SERVICE_NAME : name.trim(),
      description: description.trim() || null,
      price: parsePrice(price),
    };
    await onSave(service.id, patch);
    setIsEditing(false);
    onEditingDone?.();
  }

  function handleEnterKey(
    e: React.KeyboardEvent,
    next?: React.RefObject<HTMLInputElement | null>
  ) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (next?.current) {
      requestAnimationFrame(() => {
        next.current?.focus();
        next.current?.select();
      });
    } else {
      void commit();
    }
  }

  function startEdit() {
    setIsEditing(true);
    requestAnimationFrame(() => {
      if (isDelivery) {
        priceRef.current?.focus();
        priceRef.current?.select();
        return;
      }
      nameRef.current?.focus();
      nameRef.current?.select();
    });
  }

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className="border-b border-gray-100 hover:bg-gray-50/80"
    >
      <td className="w-8 py-2 pr-1">
        {isDelivery ? (
          <span className="inline-block w-8" aria-hidden="true" />
        ) : (
          <button
            type="button"
            className="cursor-grab rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 active:cursor-grabbing"
            aria-label="Reorder service"
            {...attributes}
            {...listeners}
          >
            <IconGripVertical size={16} />
          </button>
        )}
      </td>
      <td className="py-2 pr-3">
        {isEditing && !isDelivery ? (
          <input
            ref={nameRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => handleEnterKey(e, descriptionRef)}
            placeholder="Service name"
            className={inputClass}
          />
        ) : (
          <span className="font-medium text-gray-900">
            {isDelivery ? DELIVERY_SERVICE_NAME : service.name.trim() || "—"}
          </span>
        )}
      </td>
      <td className="py-2 pr-3">
        {isEditing ? (
          <input
            ref={descriptionRef}
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => handleEnterKey(e, priceRef)}
            placeholder="Description"
            className={inputClass}
          />
        ) : (
          <span className="text-gray-600">
            {service.description?.trim() || "—"}
          </span>
        )}
      </td>
      <td className="py-2 pr-3 text-right">
        {isEditing ? (
          <input
            ref={priceRef}
            type="text"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            onKeyDown={(e) => handleEnterKey(e)}
            placeholder="0.00"
            className={`${priceInputClass} ml-auto`}
          />
        ) : (
          <span className="tabular-nums text-gray-900">
            {service.price > 0 ? formatCurrencyFull(service.price) : "—"}
          </span>
        )}
      </td>
      <td className="py-2 pr-3 text-right font-medium tabular-nums text-gray-900">
        {(() => {
          const amount = isEditing ? parsePrice(price) : service.price;
          return amount > 0 ? formatCurrencyFull(amount) : "—";
        })()}
      </td>
      <td className="py-2">
        {isEditing ? (
          <div className="flex items-center justify-end gap-0.5">
            <button
              type="button"
              onClick={() => void commit()}
              className="rounded px-2 py-1 text-xs font-medium text-burgundy hover:bg-burgundy/5"
            >
              Save
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-0.5">
            <button
              type="button"
              onClick={startEdit}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-burgundy"
              aria-label={`Edit ${isDelivery ? DELIVERY_SERVICE_NAME : service.name || "service"}`}
              title="Edit service"
            >
              <IconPencil size={14} />
            </button>
            {!isDelivery && (
              <button
                type="button"
                onClick={() => onDelete(service)}
                className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                aria-label={`Remove ${service.name || "service"}`}
                title="Delete service"
              >
                <IconTrash size={14} />
              </button>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}
