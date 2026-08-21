import type { QuoteDocumentRoom, QuoteDocumentRoomItem } from "@/lib/quote-document";
import { formatCurrencyPrecise } from "@/lib/utils";
import {
  PdfSectionTitle,
  QuotePdfThankYouImage,
  RoomNumberBadge,
  pdfTableCellStyle,
} from "./quote-pdf-components";
import { PDF_BAR_COLOR, PDF_PAGE_HEIGHT_PX, pdfPage } from "./quote-pdf-styles";

interface QuotePdfRoomPageProps {
  room: QuoteDocumentRoom;
  roomNumber: number;
  quoteNumber: string;
  pageNumber: number;
  totalPages: number;
  isLastPage?: boolean;
}

const tableHeaderStyle = {
  background: "#fff",
  color: PDF_BAR_COLOR,
} as const;

function safeValue(value: string) {
  return value?.trim() || "—";
}

const roomHeaderTextShift = { transform: "translateY(-6px)" } as const;

function roomVariables(room: QuoteDocumentRoom) {
  return [room.woodSpecies, room.finish, room.doorStyle]
    .map((value) => safeValue(value))
    .join("  ·  ");
}

function ItemTable({
  items,
  showDimensions,
}: {
  items: QuoteDocumentRoomItem[];
  showDimensions: boolean;
}) {
  if (items.length === 0) {
    return (
      <p
        style={{
          margin: 0,
          padding: "12px 10px",
          border: "1px solid #d4d4d4",
          borderTop: "none",
          fontSize: 12,
          color: "#6b7280",
          fontStyle: "italic",
        }}
      >
        None
      </p>
    );
  }

  const headers = showDimensions
    ? ["QTY", "ITEM", "TYPE", "W x H x D", "PRICE"]
    : ["QTY", "ITEM", "TYPE", "PRICE"];

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
      <thead>
        <tr style={tableHeaderStyle}>
          {headers.map((title) => (
            <th
              key={title}
              style={{
                textAlign: title === "PRICE" ? "right" : "left",
                padding: "7px 10px",
                border: "1px solid #d4d4d4",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {title}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id}>
            <td style={{ ...pdfTableCellStyle, width: 48, fontVariantNumeric: "tabular-nums" }}>
              {item.qty}
            </td>
            <td style={pdfTableCellStyle}>{item.name}</td>
            <td style={{ ...pdfTableCellStyle, color: "#4b5563" }}>{item.subtype}</td>
            {showDimensions && (
              <td
                style={{
                  ...pdfTableCellStyle,
                  fontVariantNumeric: "tabular-nums",
                  whiteSpace: "nowrap",
                }}
              >
                {item.dimensions ?? "—"}
              </td>
            )}
            <td
              style={{
                ...pdfTableCellStyle,
                textAlign: "right",
                fontVariantNumeric: "tabular-nums",
                whiteSpace: "nowrap",
              }}
            >
              {formatCurrencyPrecise(item.price)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function QuotePdfRoomPage({
  room,
  roomNumber,
  quoteNumber,
  pageNumber,
  totalPages,
  isLastPage = false,
}: QuotePdfRoomPageProps) {
  const cabinets = room.items.filter((item) => item.category === "cabinets");
  const components = room.items.filter(
    (item) => item.category === "components" || item.category === "labor"
  );

  return (
    <section
      className="quote-page"
      style={{
        ...pdfPage,
        minHeight: PDF_PAGE_HEIGHT_PX,
        padding: "26px 34px 24px",
        fontFamily: "Arial, Helvetica, sans-serif",
        color: PDF_BAR_COLOR,
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
          paddingBottom: 8,
          borderBottom: "1px solid #b9b9b9",
          fontSize: 11,
        }}
      >
        <span style={{ fontWeight: 700, letterSpacing: 0.3 }}>ROOM DETAIL</span>
        <span style={{ color: "#6b7280" }}>{quoteNumber}</span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1.4fr)",
          background: PDF_BAR_COLOR,
          color: "#fff",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "9px 12px",
            borderRight: "1px solid #6a7178",
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          <RoomNumberBadge number={roomNumber} onDark />
          <span style={roomHeaderTextShift}>{room.name}</span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "9px 12px",
            fontSize: 12,
            lineHeight: 1.4,
            ...roomHeaderTextShift,
          }}
        >
          {roomVariables(room)}
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <PdfSectionTitle>CABINETS</PdfSectionTitle>
        <ItemTable items={cabinets} showDimensions />

        <div style={{ marginTop: 16 }}>
          <PdfSectionTitle>COMPONENTS</PdfSectionTitle>
          <ItemTable items={components} showDimensions={false} />
        </div>

        <div
          style={{
            marginTop: 16,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <table style={{ borderCollapse: "collapse", fontSize: 13, minWidth: 220 }}>
            <tbody>
              <tr>
                <td
                  style={{
                    ...pdfTableCellStyle,
                    fontWeight: 700,
                    padding: "8px 12px",
                  }}
                >
                  ROOM TOTAL
                </td>
                <td
                  style={{
                    ...pdfTableCellStyle,
                    textAlign: "right",
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                    padding: "8px 12px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {formatCurrencyPrecise(room.roomTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {isLastPage && (
        <div style={{ marginTop: "auto", marginBottom: 36 }}>
          <QuotePdfThankYouImage />
        </div>
      )}

      <p
        className="quote-page-number"
        style={{
          position: "absolute",
          bottom: 32,
          left: 0,
          right: 0,
          margin: 0,
          textAlign: "center",
          fontSize: 10,
          lineHeight: 1,
        }}
      >
        Page {pageNumber} of {totalPages}
      </p>
    </section>
  );
}
