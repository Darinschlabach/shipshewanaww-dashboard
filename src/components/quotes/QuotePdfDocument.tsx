import { COMPANY, quoteSalesTax } from "@/lib/company";
import type { QuoteDocumentData } from "@/lib/quote-document";
import { formatCurrencyPrecise, formatDateLong } from "@/lib/utils";
import QuotePdfRoomPage from "./QuotePdfRoomPage";
import { RoomNumberBadge, QuotePdfThankYouImage, pdfTableCellStyle as projectSummaryCellStyle } from "./quote-pdf-components";
import { PDF_BAR_COLOR, PDF_PAGE_HEIGHT_PX, pdfPage } from "./quote-pdf-styles";

interface QuotePdfDocumentProps {
  data: QuoteDocumentData;
  includeTax?: boolean;
  leadTimeWeeks?: number;
}

const PROJECT_SUMMARY_ROW_COUNT = 10;

export default function QuotePdfDocument({
  data,
  includeTax = false,
  leadTimeWeeks = 7,
}: QuotePdfDocumentProps) {
  const totalPages = 1 + data.rooms.length;

  return (
    <>
      <QuotePdfSummaryPage
        data={data}
        pageNumber={1}
        totalPages={totalPages}
        showThankYou={data.rooms.length === 0}
        includeTax={includeTax}
        leadTimeWeeks={leadTimeWeeks}
      />
      {data.rooms.map((room, index) => (
        <QuotePdfRoomPage
          key={room.id}
          room={room}
          roomNumber={index + 1}
          quoteNumber={data.quoteNumber}
          pageNumber={index + 2}
          totalPages={totalPages}
          isLastPage={index === data.rooms.length - 1}
        />
      ))}
    </>
  );
}

function QuotePdfSummaryPage({
  data,
  pageNumber,
  totalPages,
  showThankYou = false,
  includeTax = false,
  leadTimeWeeks = 7,
}: {
  data: QuoteDocumentData;
  pageNumber: number;
  totalPages: number;
  showThankYou?: boolean;
  includeTax?: boolean;
  leadTimeWeeks?: number;
}) {
  const delivery = data.deliveryTotal;
  const fullAmount = data.roomsTotal + data.servicesTotal;
  const subtotal = fullAmount;
  const tax = quoteSalesTax(subtotal, includeTax);
  const total = Math.floor(subtotal + tax);
  const projectRows = data.rooms;
  const summaryRows = [
    ...projectRows.map((room, index) => ({
      key: room.id,
      number: index + 1,
      room,
    })),
    ...Array.from({ length: Math.max(0, PROJECT_SUMMARY_ROW_COUNT - projectRows.length) }, (_, index) => ({
      key: `blank-${projectRows.length + index + 1}`,
      number: projectRows.length + index + 1,
      room: null,
    })),
  ];
  const safeValue = (value: string) => value?.trim() || "—";

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
      <header
        style={{
          display: "grid",
          gridTemplateColumns: "280px 1fr 1fr",
          gap: 16,
          alignItems: "start",
          borderBottom: "1px solid #b9b9b9",
          paddingBottom: 12,
        }}
      >
        <div style={{ marginLeft: "-18px", transform: "translate(30px, -5px)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/shipshewana-logo.png"
            alt={COMPANY.name}
            style={{
              width: 174,
              height: "auto",
              maxHeight: 118,
              objectFit: "contain",
              objectPosition: "left top",
              display: "block",
              transform: "translateX(-3px)",
            }}
          />
          <div style={{ transform: "translateX(-12px)" }}>
            <p style={{ margin: "4px 0 0", fontSize: 11, lineHeight: 1.35 }}>{COMPANY.address}</p>
            <div style={{ transform: "translateX(-54px)" }}>
              <p style={{ margin: "2px 0 0", fontSize: 11, lineHeight: 1.35, textAlign: "center" }}>{COMPANY.email}</p>
              <p style={{ margin: "2px 0 0", fontSize: 11, lineHeight: 1.35, textAlign: "center" }}>{COMPANY.phone}</p>
            </div>
          </div>
        </div>

        <div />

        <div style={{ paddingTop: 2, transform: "translateY(-24px)", gridColumn: 3 }}>
          <h1
            style={{
              margin: "0 0 8px",
              fontSize: 38,
              letterSpacing: 1,
              fontWeight: 500,
              fontFamily: "Georgia, Times New Roman, serif",
              textAlign: "right",
            }}
          >
            QUOTATION
          </h1>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, transform: "translateY(6px)" }}>
            <tbody>
              {[
                ["Quote #", data.quoteNumber],
                ["Date", formatDateLong(data.quoteDate)],
                ["Valid Until", formatDateLong(data.expirationDate)],
                ["Lead Time", `${leadTimeWeeks} Weeks`],
              ].map(([label, value]) => (
                <tr key={label}>
                  <td
                    style={{
                      fontWeight: 700,
                      borderBottom: "1px solid #ddd",
                      padding: "4px 0 8px",
                    }}
                  >
                    {label}
                  </td>
                  <td
                    style={{
                      borderBottom: "1px solid #ddd",
                      padding: "4px 0 8px",
                      textAlign: "right",
                    }}
                  >
                    {value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </header>

      <section
        style={{
          marginTop: 14,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          borderBottom: "1px solid #b9b9b9",
          paddingBottom: 12,
        }}
      >
        <div>
          <p style={{ margin: "0 0 8px", color: "#8e7641", fontWeight: 700, fontSize: 13 }}>
            PREPARED FOR
          </p>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>{safeValue(data.customerName)}</p>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
            {safeValue(data.customerAddress)}
          </p>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>{safeValue(data.customerPhone)}</p>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>{safeValue(data.customerEmail)}</p>
        </div>
        <div>
          <p style={{ margin: "0 0 8px", color: "#8e7641", fontWeight: 700, fontSize: 13 }}>
            PROJECT INFORMATION
          </p>
          {[
            ["Project Name", safeValue(data.jobName)],
            ["Location", safeValue(data.jobAddress)],
            ["Project Type", "New Construction"],
          ].map(([label, value]) => (
            <div
              key={label}
              style={{ display: "grid", gridTemplateColumns: "1fr 1.35fr", fontSize: 13, marginBottom: 6 }}
            >
              <span style={{ fontWeight: 700 }}>{label}:</span>
              <span>{value}</span>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 14 }}>
        <p style={{ margin: "0 0 8px", color: "#8e7641", fontWeight: 700, fontSize: 13 }}>
          PROJECT SUMMARY
        </p>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: PDF_BAR_COLOR, color: "#fff" }}>
              {["ROOM", "DESCRIPTION", "FINISH / STYLE", "ESTIMATED TOTAL"].map((title) => (
                <th
                  key={title}
                  style={{
                    textAlign: title === "ESTIMATED TOTAL" ? "right" : "left",
                    padding: "8px 10px",
                    border: "1px solid #6a7178",
                    fontSize: 12,
                  }}
                >
                  {title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {summaryRows.map(({ key, number, room }) =>
              room ? (
                <tr key={key}>
                  <td style={projectSummaryCellStyle}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <RoomNumberBadge number={number} />
                      <span>{room.name}</span>
                    </span>
                  </td>
                  <td style={projectSummaryCellStyle}>Custom Cabinetry</td>
                  <td style={projectSummaryCellStyle}>
                    {safeValue(`${room.woodSpecies} / ${room.doorStyle}`)}
                  </td>
                  <td
                    style={{
                      ...projectSummaryCellStyle,
                      textAlign: "right",
                      whiteSpace: "nowrap",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatCurrencyPrecise(room.roomTotal)}
                  </td>
                </tr>
              ) : (
                <tr key={key}>
                  <td style={projectSummaryCellStyle}>
                    <RoomNumberBadge number={number} />
                  </td>
                  <td style={projectSummaryCellStyle} />
                  <td style={projectSummaryCellStyle} />
                  <td style={projectSummaryCellStyle} />
                </tr>
              )
            )}
          </tbody>
        </table>
      </section>

      <section
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "1fr 250px",
          columnGap: 12,
          marginBottom: 24,
          minHeight: 0,
          alignItems: "stretch",
        }}
      >
        <div
          style={{
            gridColumn: 1,
            border: "1px solid #d4d4d4",
            alignSelf: "stretch",
            marginTop: 6,
            padding: "8px 10px",
            display: "flex",
            flexDirection: "column",
            height: "100%",
          }}
        >
          <div>
            <p style={{ margin: 0, fontSize: 11, lineHeight: 1.35, color: "#1f2933", transform: "translateY(-12px)" }}>
              We propose to furnish material and labor - complete in accordance with above
              specifications.
            </p>
            <div style={{ borderTop: "1px solid #d4d4d4", marginTop: "-3px", marginLeft: "-10px", marginRight: "-10px" }} />
            <p style={{ margin: 0, fontSize: 11, lineHeight: 1.35, color: "#1f2933" }}>
              All material guaranteed to be specified. All work to be completed in a
              workmanlike manner according to standard practices. Any altercation or
              deviation from above specifications involving extra cost will be executed
              only upon written orders and will become an extra charge over and above
              the estimate.
            </p>
            <div style={{ borderTop: "1px solid #d4d4d4", marginTop: 12, marginLeft: "-10px", marginRight: "-10px" }} />
            <p style={{ margin: "6px 0 0", fontSize: 11, lineHeight: 1.35, color: "#1f2933", transform: "translateY(-6px)" }}>
              Acceptance of Proposal — The above prices, specifications and conditions are
              satisfactory and are hereby accepted. You are authorized to the work as specified.
            </p>
          </div>
          <p
            style={{
              marginTop: "auto",
              marginBottom: 0,
              fontSize: 11,
              lineHeight: 1.35,
              color: "#1f2933",
              transform: "translateY(-3px)",
              display: "flex",
              alignItems: "flex-end",
              gap: 6,
            }}
          >
            <span style={{ whiteSpace: "nowrap" }}>Signature:</span>
            <span
              style={{
                display: "inline-block",
                flex: 1,
                minWidth: 220,
                borderBottom: "1px solid #1f2933",
                marginBottom: 2,
                transform: "translateY(6px)",
              }}
            />
          </p>
        </div>

        <div style={{ gridColumn: 2, alignSelf: "end", marginTop: 6, transform: "translateY(6px)" }}>
        <table
          style={{
            width: 250,
            borderCollapse: "collapse",
            fontSize: 13,
            tableLayout: "fixed",
          }}
        >
          <colgroup>
            <col style={{ width: "38%" }} />
            <col style={{ width: "62%" }} />
          </colgroup>
          <tbody>
            {[
              ["DELIVERY", formatCurrencyPrecise(delivery)],
              ["SUBTOTAL", formatCurrencyPrecise(subtotal)],
              ["SALES TAX", formatCurrencyPrecise(tax)],
            ].map(([label, value]) => (
              <tr key={label}>
                <td
                  style={{
                    border: "1px solid #d4d4d4",
                    padding: "8px 10px",
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                    verticalAlign: "middle",
                  }}
                >
                  {label}
                </td>
                <td
                  style={{
                    border: "1px solid #d4d4d4",
                    padding: "8px 10px",
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                    verticalAlign: "middle",
                    whiteSpace: "nowrap",
                  }}
                >
                  {value}
                </td>
              </tr>
            ))}
            <tr style={{ background: "#8e7641", color: "#fff" }}>
              <td
                colSpan={2}
                style={{
                  border: "1px solid #8e7641",
                  padding: 0,
                  height: 44,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    height: "100%",
                    padding: "0 10px",
                    fontWeight: 700,
                    fontSize: 20,
                    lineHeight: 1,
                  }}
                >
                  <span>TOTAL</span>
                  <span style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                    {formatCurrencyPrecise(total)}
                  </span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        </div>
      </section>

      {showThankYou && (
        <div style={{ marginTop: "auto", marginBottom: 36, textAlign: "center" }}>
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
