import { COMPANY } from "@/lib/company";
import { formatCurrencyPrecise, formatDateLong } from "@/lib/utils";
import {
  PDF_BAR_COLOR,
  PDF_PAGE_HEIGHT_PX,
  pdfPage,
} from "@/components/quotes/quote-pdf-styles";

export type StatementCustomer = {
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
};

export type StatementLine = {
  job: string;
  invoiceNumber: string;
  invoiceTotal: number;
  remainingBalance: number;
};

const STATEMENT_MAX_ROWS = 18;
const COL_WIDTHS = ["32%", "18%", "22%", "28%"] as const;

const itemCellStyle = {
  borderLeft: "1px solid #d4d4d4",
  borderRight: "1px solid #d4d4d4",
  borderTop: "none",
  borderBottom: "none",
  padding: "0 8px",
  fontSize: 11,
  lineHeight: "14px",
  display: "flex",
  alignItems: "center",
  minHeight: 0,
  boxSizing: "border-box" as const,
  overflow: "visible" as const,
} as const;

/** Statement PDF — invoice-matched header + invoice lines table. */
export default function StatementPdfDocument({
  customer,
  lines = [],
}: {
  customer: StatementCustomer;
  lines?: StatementLine[];
}) {
  const safeValue = (value: string | null | undefined) =>
    value?.trim() || "—";

  const remainingBalanceSum = lines.reduce(
    (sum, line) => sum + Number(line.remainingBalance || 0),
    0
  );
  const statementDate = formatDateLong(new Date().toISOString().slice(0, 10));

  const rows = [
    ...lines.slice(0, STATEMENT_MAX_ROWS).map((line, index) => ({
      key: `line-${index}`,
      line,
    })),
    ...Array.from(
      { length: Math.max(0, STATEMENT_MAX_ROWS - lines.length) },
      (_, index) => ({
        key: `blank-${index}`,
        line: null as StatementLine | null,
      })
    ),
  ];

  return (
    <section
      className="statement-page"
      style={{
        ...pdfPage,
        height: PDF_PAGE_HEIGHT_PX,
        minHeight: PDF_PAGE_HEIGHT_PX,
        maxHeight: PDF_PAGE_HEIGHT_PX,
        padding: "22px 34px 12px",
        boxSizing: "border-box",
        fontFamily: "Arial, Helvetica, sans-serif",
        color: PDF_BAR_COLOR,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
        background: "#ffffff",
      }}
    >
      <header
        style={{
          display: "grid",
          gridTemplateColumns: "280px 1fr 1fr",
          gap: 16,
          alignItems: "start",
          borderBottom: "1px solid #b9b9b9",
          paddingBottom: 8,
          flexShrink: 0,
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
            gridColumn: 3,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "flex-end",
            alignSelf: "stretch",
            minHeight: 118,
            paddingTop: 8,
            transform: "translateY(-24px)",
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: 38,
              letterSpacing: 1,
              fontWeight: 500,
              fontFamily: "Georgia, Times New Roman, serif",
              textAlign: "right",
            }}
          >
            STATEMENT
          </h1>
          <p
            style={{
              margin: "10px 0 0",
              fontSize: 13,
              lineHeight: 1.35,
              textAlign: "right",
            }}
          >
            Generated Date: {statementDate}
          </p>
        </div>
      </header>

      <section
        style={{
          marginTop: 10,
          borderBottom: "1px solid #b9b9b9",
          paddingBottom: 8,
          flexShrink: 0,
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
          CUSTOMER
        </p>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
          {safeValue(customer.name)}
        </p>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
          {safeValue(customer.address)}
        </p>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
          {safeValue(customer.phone)}
        </p>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
          {safeValue(customer.email)}
        </p>
      </section>

      <section
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          marginTop: 10,
          marginBottom: 0,
          minHeight: 0,
        }}
      >
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "grid",
            gridTemplateColumns: COL_WIDTHS.join(" "),
            gridTemplateRows: `24px repeat(${STATEMENT_MAX_ROWS}, minmax(0, 1fr))`,
            borderBottom: "1px solid #d4d4d4",
          }}
        >
          {(
            [
              { title: "JOB", align: "left" as const },
              { title: "INV. NUMBER", align: "left" as const },
              { title: "INV. TOTAL", align: "right" as const },
              { title: "REMAINING BALANCE", align: "right" as const },
            ] as const
          ).map(({ title, align }) => (
            <div
              key={title}
              style={{
                background: PDF_BAR_COLOR,
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: align === "right" ? "flex-end" : "flex-start",
                padding: "0 8px 6px",
                border: "1px solid #6a7178",
                fontSize: 11,
                fontWeight: 700,
                lineHeight: "14px",
              }}
            >
              {title}
            </div>
          ))}
          {rows.flatMap(({ key, line }) =>
            line
              ? [
                  <div key={`${key}-job`} style={itemCellStyle}>
                    {safeValue(line.job)}
                  </div>,
                  <div key={`${key}-inv`} style={itemCellStyle}>
                    {safeValue(line.invoiceNumber)}
                  </div>,
                  <div
                    key={`${key}-total`}
                    style={{
                      ...itemCellStyle,
                      justifyContent: "flex-end",
                      whiteSpace: "nowrap",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatCurrencyPrecise(line.invoiceTotal)}
                  </div>,
                  <div
                    key={`${key}-balance`}
                    style={{
                      ...itemCellStyle,
                      justifyContent: "flex-end",
                      whiteSpace: "nowrap",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatCurrencyPrecise(line.remainingBalance)}
                  </div>,
                ]
              : [
                  <div key={`${key}-job`} style={itemCellStyle} />,
                  <div key={`${key}-inv`} style={itemCellStyle} />,
                  <div key={`${key}-total`} style={itemCellStyle} />,
                  <div key={`${key}-balance`} style={itemCellStyle} />,
                ]
          )}
        </div>

        <div
          style={{
            marginTop: 6,
            flexShrink: 0,
            width: "100%",
            border: "1px solid #d4d4d4",
            display: "grid",
            gridTemplateColumns: "1fr max-content 20%",
            alignItems: "stretch",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              gridColumn: 1,
              gridRow: 1,
              minWidth: 0,
            }}
          />

          <div
            style={{
              gridColumn: 2,
              gridRow: 1,
              background: "#8e7641",
              color: "#fff",
              border: "1px solid #8e7641",
              borderLeft: "none",
              borderBottom: "none",
              padding: "4px 8px 8px",
              fontWeight: 700,
              fontSize: 16,
              lineHeight: 1,
              textAlign: "left",
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-start",
              minHeight: 32,
              boxSizing: "border-box",
            }}
          >
            <span style={{ transform: "translateY(-3px)" }}>
              REMAINING BALANCE DUE
            </span>
          </div>
          <div
            style={{
              gridColumn: 3,
              gridRow: 1,
              background: "#8e7641",
              color: "#fff",
              border: "1px solid #8e7641",
              borderRight: "none",
              borderBottom: "none",
              padding: "4px 8px 8px",
              fontWeight: 700,
              fontSize: 16,
              lineHeight: 1,
              textAlign: "right",
              fontVariantNumeric: "tabular-nums",
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              minHeight: 32,
              boxSizing: "border-box",
            }}
          >
            <span style={{ transform: "translateY(-3px)" }}>
              {formatCurrencyPrecise(remainingBalanceSum)}
            </span>
          </div>
        </div>
      </section>
    </section>
  );
}
