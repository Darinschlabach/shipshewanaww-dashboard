import { COMPANY, quoteSalesTax } from "@/lib/company";
import type { InvoiceDocumentPayment } from "@/lib/invoice-document";
import type { QuoteDocumentData } from "@/lib/quote-document";
import { formatCurrencyPrecise, formatDateLong } from "@/lib/utils";
import {
  PDF_BAR_COLOR,
  PDF_PAGE_HEIGHT_PX,
  pdfPage,
} from "@/components/quotes/quote-pdf-styles";

interface InvoicePdfDocumentProps {
  data: QuoteDocumentData;
  includeTax?: boolean;
  paymentsCredits?: number;
  paymentHistory?: InvoiceDocumentPayment[];
  template?: "standard" | "advance";
  downPaymentPercent?: number | null;
}

const PROJECT_SUMMARY_ROW_COUNT = 10;
const SUMMARY_COL_WIDTHS = ["12%", "68%", "20%"] as const;

const itemCellStyle = {
  borderLeft: "1px solid #d4d4d4",
  borderRight: "1px solid #d4d4d4",
  borderTop: "none",
  borderBottom: "none",
  padding: "6px 10px",
} as const;

const totalsLabelCellStyle = {
  border: "1px solid #d4d4d4",
  padding: "8px 10px",
  fontWeight: 700,
  whiteSpace: "nowrap" as const,
  verticalAlign: "middle" as const,
  textAlign: "left" as const,
  fontSize: 13,
  boxSizing: "border-box" as const,
};

const totalsValueCellStyle = {
  border: "1px solid #d4d4d4",
  padding: "8px 10px",
  textAlign: "right" as const,
  fontVariantNumeric: "tabular-nums" as const,
  verticalAlign: "middle" as const,
  whiteSpace: "nowrap" as const,
  fontSize: 13,
  boxSizing: "border-box" as const,
};

/** Invoice PDF — same layout as the quote first page; invoice-only labels. */
export default function InvoicePdfDocument({
  data,
  includeTax = false,
  paymentsCredits = 0,
  paymentHistory = [],
  template = "standard",
  downPaymentPercent = null,
}: InvoicePdfDocumentProps) {
  return (
    <InvoicePdfSummaryPage
      data={data}
      includeTax={includeTax}
      paymentsCredits={paymentsCredits}
      paymentHistory={paymentHistory}
      template={template}
      downPaymentPercent={downPaymentPercent}
    />
  );
}

function InvoicePdfSummaryPage({
  data,
  includeTax = false,
  paymentsCredits = 0,
  paymentHistory = [],
  template = "standard",
  downPaymentPercent = null,
}: {
  data: QuoteDocumentData;
  includeTax?: boolean;
  paymentsCredits?: number;
  paymentHistory?: InvoiceDocumentPayment[];
  template?: "standard" | "advance";
  downPaymentPercent?: number | null;
}) {
  const fullAmount = data.roomsTotal + data.servicesTotal;
  const subtotal = fullAmount;
  const tax = quoteSalesTax(fullAmount, includeTax);
  const total = fullAmount + tax;
  const payments = Math.max(0, paymentsCredits);
  const balanceDue = Math.max(0, total - payments);
  const isAdvance = template === "advance";
  const downPayment =
    isAdvance &&
    downPaymentPercent != null &&
    Number.isFinite(downPaymentPercent)
      ? Math.round(total * (downPaymentPercent / 100) * 100) / 100
      : null;
  const amountDue = downPayment != null ? downPayment : balanceDue;
  const balanceDueUponDelivery =
    downPayment != null ? Math.max(0, total - downPayment) : null;
  const dueLabel = isAdvance ? "ADVANCE PAYMENT" : "BALANCE DUE";
  const projectRows = data.rooms;
  const summaryRows = [
    ...projectRows.map((room) => ({
      key: room.id,
      room,
    })),
    ...Array.from(
      { length: Math.max(0, PROJECT_SUMMARY_ROW_COUNT - projectRows.length) },
      (_, index) => ({
        key: `blank-${projectRows.length + index + 1}`,
        room: null as (typeof projectRows)[number] | null,
      })
    ),
  ];
  const safeValue = (value: string) => value?.trim() || "—";

  return (
    <section
      className="invoice-page"
      style={{
        ...pdfPage,
        height: PDF_PAGE_HEIGHT_PX,
        minHeight: PDF_PAGE_HEIGHT_PX,
        maxHeight: PDF_PAGE_HEIGHT_PX,
        padding: "26px 34px 16px",
        boxSizing: "border-box",
        fontFamily: "Arial, Helvetica, sans-serif",
        color: PDF_BAR_COLOR,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
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
            <p style={{ margin: "4px 0 0", fontSize: 11, lineHeight: 1.35 }}>
              {COMPANY.address}
            </p>
            <div style={{ transform: "translateX(-54px)" }}>
              <p
                style={{
                  margin: "2px 0 0",
                  fontSize: 11,
                  lineHeight: 1.35,
                  textAlign: "center",
                }}
              >
                {COMPANY.email}
              </p>
              <p
                style={{
                  margin: "2px 0 0",
                  fontSize: 11,
                  lineHeight: 1.35,
                  textAlign: "center",
                }}
              >
                {COMPANY.phone}
              </p>
            </div>
          </div>
        </div>

        <div />

        <div
          style={{
            paddingTop: 2,
            transform: "translateY(-24px)",
            gridColumn: 3,
          }}
        >
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
            INVOICE
          </h1>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
              transform: "translateY(6px)",
            }}
          >
            <tbody>
              {[
                ["Invoice #", data.quoteNumber],
                ["Date", formatDateLong(data.quoteDate)],
                ["Due Date", formatDateLong(data.expirationDate)],
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
          <p
            style={{
              margin: "0 0 8px",
              color: "#8e7641",
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            BILL TO
          </p>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
            {safeValue(data.customerName)}
          </p>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
            {safeValue(data.customerAddress)}
          </p>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
            {safeValue(data.customerPhone)}
          </p>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
            {safeValue(data.customerEmail)}
          </p>
        </div>
        <div>
          <p
            style={{
              margin: "0 0 8px",
              color: "#8e7641",
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            PROJECT INFORMATION
          </p>
          {[
            ["Project Name", safeValue(data.jobName)],
            ["Location", safeValue(data.jobAddress)],
            ["Project Type", "New Construction"],
          ].map(([label, value]) => (
            <div
              key={label}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1.35fr",
                fontSize: 13,
                marginBottom: 6,
              }}
            >
              <span style={{ fontWeight: 700 }}>{label}:</span>
              <span>{value}</span>
            </div>
          ))}
        </div>
      </section>

      <section
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          marginTop: 14,
          marginBottom: 0,
          minHeight: 0,
        }}
      >
        <p
          style={{
            margin: "0 0 8px",
            color: "#8e7641",
            fontWeight: 700,
            fontSize: 13,
            flexShrink: 0,
          }}
        >
          PROJECT SUMMARY
        </p>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
              tableLayout: "fixed",
              flexShrink: 0,
            }}
          >
            <colgroup>
              {SUMMARY_COL_WIDTHS.map((width) => (
                <col key={width} style={{ width }} />
              ))}
            </colgroup>
            <thead>
              <tr style={{ background: PDF_BAR_COLOR, color: "#fff" }}>
                {(
                  [
                    { title: "QTY", align: "left" as const },
                    { title: "DESCRIPTION", align: "left" as const },
                    { title: "TOTAL", align: "right" as const },
                  ] as const
                ).map(({ title, align }) => (
                  <th
                    key={title}
                    style={{
                      textAlign: align,
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
              {summaryRows.map(({ key, room }) =>
                room ? (
                  <tr key={key}>
                    <td
                      style={{
                        ...itemCellStyle,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {room.itemCount}
                    </td>
                    <td style={itemCellStyle}>{safeValue(room.name)}</td>
                    <td
                      style={{
                        ...itemCellStyle,
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
                    <td style={itemCellStyle} />
                    <td style={itemCellStyle} />
                    <td style={itemCellStyle} />
                  </tr>
                )
              )}
            </tbody>
          </table>
          <div
            style={{
              flex: 1,
              display: "grid",
              gridTemplateColumns: SUMMARY_COL_WIDTHS.join(" "),
              minHeight: 24,
              borderLeft: "1px solid #d4d4d4",
              borderRight: "1px solid #d4d4d4",
              borderBottom: "1px solid #d4d4d4",
            }}
          >
            <div style={{ borderRight: "1px solid #d4d4d4" }} />
            <div style={{ borderRight: "1px solid #d4d4d4" }} />
            <div />
          </div>
        </div>

        <div
          style={{
            marginTop: 6,
            flexShrink: 0,
            width: "100%",
            display: "grid",
            gridTemplateColumns: "1fr max-content 20%",
            alignItems: "stretch",
          }}
        >
          <div
            style={{
              gridColumn: 1,
              gridRow: "1 / 6",
              marginRight: 12,
              border: "1px solid #d4d4d4",
              padding: "8px 10px",
              boxSizing: "border-box",
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <p
              style={{
                margin: "0 0 8px",
                color: "#8e7641",
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              PAYMENTS MADE
            </p>
            {paymentHistory.length === 0 ? (
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  lineHeight: 1.4,
                  color: "#6b7280",
                }}
              >
                No payments recorded.
              </p>
            ) : (
              <table
                style={{
                  width: "100%",
                  borderCollapse: "separate",
                  borderSpacing: 0,
                  fontSize: 11,
                }}
              >
                <thead>
                  <tr>
                    {[
                      { title: "DATE", align: "left" as const },
                      { title: "METHOD", align: "left" as const },
                      { title: "REFERENCE #", align: "left" as const },
                      { title: "AMOUNT", align: "right" as const },
                    ].map(({ title, align }) => (
                      <th
                        key={title}
                        style={{
                          textAlign: align,
                          padding: "0 5px 8px",
                          borderBottom: "1px solid #d4d4d4",
                          fontSize: 10,
                          fontWeight: 700,
                          lineHeight: 1.35,
                          verticalAlign: "bottom",
                          color: PDF_BAR_COLOR,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paymentHistory.map((payment) => (
                    <tr key={payment.id}>
                      <td
                        style={{
                          padding: "6px 5px 4px",
                          verticalAlign: "top",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatDateLong(payment.paidAt)}
                      </td>
                      <td
                        style={{
                          padding: "6px 5px 4px",
                          verticalAlign: "top",
                        }}
                      >
                        {payment.method}
                      </td>
                      <td
                        style={{
                          padding: "6px 5px 4px",
                          verticalAlign: "top",
                        }}
                      >
                        {payment.reference}
                      </td>
                      <td
                        style={{
                          padding: "6px 5px 4px",
                          verticalAlign: "top",
                          textAlign: "right",
                          whiteSpace: "nowrap",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {formatCurrencyPrecise(payment.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {[
            ["SUBTOTAL", formatCurrencyPrecise(subtotal)],
            ["SALES TAX", formatCurrencyPrecise(tax)],
            ["TOTAL", formatCurrencyPrecise(total)],
            ["PAYMENTS/CREDITS", formatCurrencyPrecise(payments)],
          ].map(([label, value], index) => (
            <div key={label} style={{ display: "contents" }}>
              <div
                style={{
                  ...totalsLabelCellStyle,
                  gridColumn: 2,
                  gridRow: index + 1,
                }}
              >
                {label}
              </div>
              <div
                style={{
                  ...totalsValueCellStyle,
                  gridColumn: 3,
                  gridRow: index + 1,
                }}
              >
                {value}
              </div>
            </div>
          ))}
          <div
            style={{
              gridColumn: 2,
              gridRow: 5,
              background: "#8e7641",
              color: "#fff",
              border: "1px solid #8e7641",
              padding: "8px 10px",
              fontWeight: 700,
              fontSize: 20,
              lineHeight: 1,
              textAlign: "left",
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-start",
              minHeight: 44,
              boxSizing: "border-box",
            }}
          >
            {dueLabel}
          </div>
          <div
            style={{
              gridColumn: 3,
              gridRow: 5,
              background: "#8e7641",
              color: "#fff",
              border: "1px solid #8e7641",
              padding: "8px 10px",
              fontWeight: 700,
              fontSize: 20,
              lineHeight: 1,
              textAlign: "right",
              fontVariantNumeric: "tabular-nums",
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              minHeight: 44,
              boxSizing: "border-box",
            }}
          >
            {formatCurrencyPrecise(amountDue)}
          </div>
          {balanceDueUponDelivery != null ? (
            <p
              style={{
                gridColumn: "2 / 4",
                gridRow: 6,
                margin: "8px 0 0",
                fontSize: 12,
                fontStyle: "italic",
                fontWeight: 400,
                lineHeight: 1.45,
                color: "#4b5563",
                textAlign: "left",
              }}
            >
              Balance Due Upon Delivery—{" "}
              {formatCurrencyPrecise(balanceDueUponDelivery)}
            </p>
          ) : null}
        </div>
      </section>
    </section>
  );
}
