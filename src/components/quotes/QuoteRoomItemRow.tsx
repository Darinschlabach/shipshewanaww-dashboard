"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { IconPencil, IconTrash } from "@tabler/icons-react";
import {
  calculateQuoteItemPrice,
  parseOptionalDimension,
  parseOptionalInt,
  quoteItemNeedsDimensions,
  quoteItemPriceIsReady,
} from "@/lib/quote-item-pricing";
import type { QuoteRoomItem } from "@/lib/types";
import { formatCurrencyFull } from "@/lib/utils";

const dimInputClass =
  "w-14 rounded border border-gray-300 px-1.5 py-1 text-center text-xs tabular-nums focus:border-burgundy focus:outline-none focus:ring-1 focus:ring-burgundy";

const lockedCellClass =
  "inline-block min-w-[2.5rem] text-center text-xs tabular-nums text-gray-700";

export type QuoteRoomItemRowHandle = {
  focusQty: () => void;
};

interface QuoteRoomItemRowProps {
  item: QuoteRoomItem;
  showDimensionColumns: boolean;
  cabinetMultiplier?: number;
  onUpdate: (id: string, patch: Partial<QuoteRoomItem>) => Promise<void>;
  onDelete: (item: QuoteRoomItem) => void;
  onEnterComplete: (itemId: string) => void;
}

const QuoteRoomItemRow = forwardRef<QuoteRoomItemRowHandle, QuoteRoomItemRowProps>(
  function QuoteRoomItemRow(
    {
      item,
      showDimensionColumns,
      cabinetMultiplier = 1,
      onUpdate,
      onDelete,
      onEnterComplete,
    },
    ref
  ) {
    const needsDimensions =
      showDimensionColumns && quoteItemNeedsDimensions(item);
    const priceOptions =
      item.category === "cabinets"
        ? { cabinetMultiplier }
        : undefined;
    const qtyRef = useRef<HTMLInputElement>(null);
    const widthRef = useRef<HTMLInputElement>(null);
    const lengthRef = useRef<HTMLInputElement>(null);
    const heightRef = useRef<HTMLInputElement>(null);

    const [qty, setQty] = useState(item.qty != null ? String(item.qty) : "");
    const [width, setWidth] = useState(
      item.width_in != null ? String(item.width_in) : ""
    );
    const [length, setLength] = useState(
      item.length_in != null ? String(item.length_in) : ""
    );
    const [height, setHeight] = useState(
      item.height_in != null ? String(item.height_in) : ""
    );
    const [isLocked, setIsLocked] = useState(() =>
      quoteItemPriceIsReady(item, priceOptions)
    );

    useImperativeHandle(ref, () => ({
      focusQty: () => {
        qtyRef.current?.focus();
        qtyRef.current?.select();
      },
    }));

    useEffect(() => {
      if (!isLocked) return;
      setQty(item.qty != null ? String(item.qty) : "");
      setWidth(item.width_in != null ? String(item.width_in) : "");
      setLength(item.length_in != null ? String(item.length_in) : "");
      setHeight(item.height_in != null ? String(item.height_in) : "");
    }, [item, isLocked]);

    const previewPrice = calculateQuoteItemPrice(
      {
        ...item,
        qty: parseOptionalInt(qty),
        width_in: parseOptionalDimension(width),
        length_in: parseOptionalDimension(length),
        height_in: parseOptionalDimension(height),
      },
      priceOptions
    );

    async function commitDimensions() {
      await onUpdate(item.id, {
        qty: parseOptionalInt(qty),
        width_in: parseOptionalDimension(width),
        length_in: parseOptionalDimension(length),
        height_in: parseOptionalDimension(height),
      });
    }

    async function finishEntry() {
      const draft = {
        ...item,
        qty: parseOptionalInt(qty),
        width_in: parseOptionalDimension(width),
        length_in: parseOptionalDimension(length),
        height_in: parseOptionalDimension(height),
      };
      if (!quoteItemPriceIsReady(draft, priceOptions)) return;

      await commitDimensions();
      setIsLocked(true);
      onEnterComplete(item.id);
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
        void finishEntry();
      }
    }

    function unlock() {
      setQty(item.qty != null ? String(item.qty) : "");
      setWidth(item.width_in != null ? String(item.width_in) : "");
      setLength(item.length_in != null ? String(item.length_in) : "");
      setHeight(item.height_in != null ? String(item.height_in) : "");
      setIsLocked(false);
      requestAnimationFrame(() => {
        qtyRef.current?.focus();
        qtyRef.current?.select();
      });
    }

    function displayOrInput(
      value: string,
      lockedValue: string | null,
      input: React.ReactNode
    ) {
      if (isLocked) {
        return (
          <span className={lockedCellClass}>{lockedValue?.trim() || "—"}</span>
        );
      }
      return input;
    }

    return (
      <tr className="border-b border-gray-100 hover:bg-gray-50/80">
        <td className="py-2 pr-2">
          {displayOrInput(
            qty,
            qty,
            <input
              ref={qtyRef}
              type="number"
              min={1}
              step={1}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              onKeyDown={(e) =>
                handleEnterKey(
                  e,
                  needsDimensions ? widthRef : undefined
                )
              }
              placeholder="—"
              data-item-qty={item.id}
              className={`${dimInputClass} w-12`}
              aria-label={`Quantity for ${item.item_type}`}
            />
          )}
        </td>
        <td className="py-2 pr-3 font-medium text-gray-900">{item.item_type}</td>
        <td className="py-2 pr-3 text-gray-500">
          {item.description?.trim() || "—"}
        </td>
        {needsDimensions && (
          <>
            <td className="py-2 pr-2">
              {displayOrInput(
                width,
                width,
                <input
                  ref={widthRef}
                  type="number"
                  min={0}
                  step={0.125}
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                  onKeyDown={(e) => handleEnterKey(e, heightRef)}
                  placeholder="—"
                  className={dimInputClass}
                  aria-label="Width in inches"
                />
              )}
            </td>
            <td className="py-2 pr-2">
              {displayOrInput(
                height,
                height,
                <input
                  ref={heightRef}
                  type="number"
                  min={0}
                  step={0.125}
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  onKeyDown={(e) => handleEnterKey(e, lengthRef)}
                  placeholder="—"
                  className={dimInputClass}
                  aria-label="Height in inches"
                />
              )}
            </td>
            <td className="py-2 pr-2">
              {displayOrInput(
                length,
                length,
                <input
                  ref={lengthRef}
                  type="number"
                  min={0}
                  step={0.125}
                  value={length}
                  onChange={(e) => setLength(e.target.value)}
                  onKeyDown={(e) => handleEnterKey(e)}
                  placeholder="—"
                  className={dimInputClass}
                  aria-label="Depth in inches"
                />
              )}
            </td>
          </>
        )}
        {showDimensionColumns && !needsDimensions && (
          <>
            <td className="py-2 pr-2" />
            <td className="py-2 pr-2" />
            <td className="py-2 pr-2" />
          </>
        )}
        <td className="py-2 pr-2 text-right tabular-nums text-gray-900">
          {previewPrice != null ? formatCurrencyFull(previewPrice) : "—"}
        </td>
        <td className="py-2">
          <div className="flex items-center justify-end gap-0.5">
            <button
              type="button"
              onClick={unlock}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-burgundy"
              aria-label={`Edit ${item.item_type}`}
              title={needsDimensions ? "Edit qty and dimensions" : "Edit qty"}
            >
              <IconPencil size={14} />
            </button>
            <button
              type="button"
              onClick={() => onDelete(item)}
              className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
              aria-label={`Remove ${item.item_type}`}
            >
              <IconTrash size={14} />
            </button>
          </div>
        </td>
      </tr>
    );
  }
);

export default QuoteRoomItemRow;
