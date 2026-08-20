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
  isMiscQuoteItem,
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

function parseOptionalMoney(value: string): number | null {
  const trimmed = value.trim().replace(/[$,]/g, "");
  if (!trimmed) return null;
  const n = parseFloat(trimmed);
  return Number.isFinite(n) && n >= 0 ? n : null;
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
    const isMisc = isMiscQuoteItem(item);
    const needsDimensions =
      !isMisc && showDimensionColumns && quoteItemNeedsDimensions(item);
    const priceOptions =
      item.category === "cabinets"
        ? { cabinetMultiplier }
        : undefined;
    const qtyRef = useRef<HTMLInputElement>(null);
    const descriptionRef = useRef<HTMLInputElement>(null);
    const widthRef = useRef<HTMLInputElement>(null);
    const lengthRef = useRef<HTMLInputElement>(null);
    const heightRef = useRef<HTMLInputElement>(null);
    const unitPriceRef = useRef<HTMLInputElement>(null);

    const [qty, setQty] = useState(item.qty != null ? String(item.qty) : "");
    const [description, setDescription] = useState(item.description ?? "");
    const [width, setWidth] = useState(
      item.width_in != null ? String(item.width_in) : ""
    );
    const [length, setLength] = useState(
      item.length_in != null ? String(item.length_in) : ""
    );
    const [height, setHeight] = useState(
      item.height_in != null ? String(item.height_in) : ""
    );
    const [linePrice, setLinePrice] = useState(
      item.price > 0
        ? String(item.price)
        : item.base_price > 0
          ? String(item.base_price)
          : ""
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
      setDescription(item.description ?? "");
      setWidth(item.width_in != null ? String(item.width_in) : "");
      setLength(item.length_in != null ? String(item.length_in) : "");
      setHeight(item.height_in != null ? String(item.height_in) : "");
      setLinePrice(
        item.price > 0
          ? String(item.price)
          : item.base_price > 0
            ? String(item.base_price)
            : ""
      );
    }, [item, isLocked]);

    const parsedQty = parseOptionalInt(qty);
    const trimmedDescription = description.trim();
    const parsedLinePrice = parseOptionalMoney(linePrice);
    const miscUnitPrice =
      isMisc && parsedQty != null && parsedLinePrice != null && parsedQty > 0
        ? parsedLinePrice / parsedQty
        : isMisc
          ? (parsedLinePrice ?? 0)
          : item.base_price;

    const draftItem = {
      ...item,
      qty: parsedQty,
      width_in: parseOptionalDimension(width),
      length_in: parseOptionalDimension(length),
      height_in: parseOptionalDimension(height),
      base_price: isMisc ? miscUnitPrice : item.base_price,
    };

    const previewPrice = isMisc
      ? parsedQty != null && parsedLinePrice != null && parsedQty >= 1
        ? Math.round(parsedLinePrice * 100) / 100
        : null
      : calculateQuoteItemPrice(draftItem, priceOptions);

    async function commitFields() {
      if (isMisc) {
        await onUpdate(item.id, {
          qty: parsedQty,
          description: trimmedDescription || null,
          base_price: miscUnitPrice,
        });
        return;
      }
      await onUpdate(item.id, {
        qty: parseOptionalInt(qty),
        width_in: parseOptionalDimension(width),
        length_in: parseOptionalDimension(length),
        height_in: parseOptionalDimension(height),
      });
    }

    async function finishEntry() {
      if (isMisc) {
        if (
          parsedQty == null ||
          parsedLinePrice == null ||
          parsedQty < 1 ||
          !trimmedDescription
        ) {
          return;
        }
        await commitFields();
        setIsLocked(true);
        onEnterComplete(item.id);
        return;
      }

      if (!quoteItemPriceIsReady(draftItem, priceOptions)) return;

      await commitFields();
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
      setDescription(item.description ?? "");
      setWidth(item.width_in != null ? String(item.width_in) : "");
      setLength(item.length_in != null ? String(item.length_in) : "");
      setHeight(item.height_in != null ? String(item.height_in) : "");
      setLinePrice(
        item.price > 0
          ? String(item.price)
          : item.base_price > 0
            ? String(item.base_price)
            : ""
      );
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

    const miscLabel = trimmedDescription || item.item_type;

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
                  isMisc
                    ? descriptionRef
                    : needsDimensions
                      ? widthRef
                      : undefined
                )
              }
              placeholder="—"
              data-item-qty={item.id}
              className={`${dimInputClass} w-12`}
              aria-label={`Quantity for ${miscLabel}`}
            />
          )}
        </td>
        <td className="py-2 pr-3 font-medium text-gray-900">
          {isMisc ? (
            isLocked ? (
              <span className="text-sm text-gray-900">
                {item.description?.trim() || "Misc"}
              </span>
            ) : (
              <input
                ref={descriptionRef}
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={(e) => handleEnterKey(e, unitPriceRef)}
                placeholder="Describe item…"
                className="w-full min-w-[10rem] rounded border border-gray-300 px-2 py-1 text-sm focus:border-burgundy focus:outline-none focus:ring-1 focus:ring-burgundy"
                aria-label="Misc item description"
              />
            )
          ) : (
            item.item_type
          )}
        </td>
        <td className="py-2 pr-3 text-gray-500">
          {isMisc ? "Misc" : item.description?.trim() || "—"}
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
          {isMisc && !isLocked ? (
            <input
              ref={unitPriceRef}
              type="number"
              min={0}
              step="0.01"
              value={linePrice}
              onChange={(e) => setLinePrice(e.target.value)}
              onKeyDown={(e) => handleEnterKey(e)}
              placeholder="0.00"
              className={`${dimInputClass} ml-auto w-20 text-right`}
              aria-label={`Price for ${miscLabel}`}
            />
          ) : previewPrice != null ? (
            formatCurrencyFull(previewPrice)
          ) : (
            "—"
          )}
        </td>
        <td className="py-2">
          <div className="flex items-center justify-end gap-0.5">
            <button
              type="button"
              onClick={unlock}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-burgundy"
              aria-label={`Edit ${miscLabel}`}
              title={
                isMisc
                  ? "Edit qty, description, and price"
                  : needsDimensions
                    ? "Edit qty and dimensions"
                    : "Edit qty"
              }
            >
              <IconPencil size={14} />
            </button>
            <button
              type="button"
              onClick={() => onDelete(item)}
              className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
              aria-label={`Remove ${miscLabel}`}
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
