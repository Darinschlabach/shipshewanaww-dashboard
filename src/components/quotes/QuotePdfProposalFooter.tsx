import type { CSSProperties } from "react";
import {
  QUOTE_ACCEPTANCE_TEXT,
  QUOTE_PDF_TERMS_BAR,
  QUOTE_PROPOSAL_LEGAL,
  quoteSalesTax,
} from "@/lib/company";
import type { QuoteDocumentData } from "@/lib/quote-document";
import { formatCurrencyPrecise } from "@/lib/utils";

const border = "1px solid #000";
const cellPad = "6px 8px";
const blackletter: CSSProperties = {
  fontFamily: '"UnifrakturMaguntia", "Times New Roman", serif',
  fontWeight: 400,
};

interface QuotePdfProposalFooterProps {
  data: QuoteDocumentData;
  includeTax?: boolean;
}

function computeTotals(data: QuoteDocumentData, includeTax: boolean) {
  const cabinets = data.roomsTotal;
  const accessories = data.servicesTotal;
  const subtotal = cabinets + accessories;
  const tax = quoteSalesTax(subtotal, includeTax);
  const grandTotal = subtotal + tax;
  return { cabinets, accessories, subtotal, tax, grandTotal };
}

function TotalRow({
  label,
  value,
  bold,
  shaded,
}: {
  label: string;
  value: string;
  bold?: boolean;
  shaded?: boolean;
}) {
  return (
    <tr>
      <td
        style={{
          border,
          padding: cellPad,
          fontSize: 11,
          fontWeight: bold ? 700 : 400,
          background: shaded ? "#e8e8e8" : "#fff",
        }}
      >
        {label}
      </td>
      <td
        style={{
          border,
          padding: cellPad,
          fontSize: 11,
          textAlign: "right",
          fontWeight: bold ? 700 : 400,
          fontVariantNumeric: "tabular-nums",
          background: shaded ? "#e8e8e8" : "#fff",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </td>
    </tr>
  );
}

export default function QuotePdfProposalFooter({
  data,
  includeTax = false,
}: QuotePdfProposalFooterProps) {
  const totals = computeTotals(data, includeTax);

  return (
    <footer style={{ fontFamily: "Arial, Helvetica, sans-serif", color: "#000" }}>
      {/* Row 1 — proposal, signature, totals */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 140px 170px",
          border,
        }}
      >
        <div style={{ borderRight: border, padding: cellPad }}>
          <p style={{ margin: "0 0 6px", fontSize: 11, lineHeight: 1.35 }}>
            <span style={{ ...blackletter, fontSize: 15 }}>We Propose</span>{" "}
            hereby to furnish material and labor — complete in accordance with
            above specifications.
          </p>
          <p
            style={{
              margin: 0,
              fontSize: 8.5,
              lineHeight: 1.35,
              textAlign: "justify",
            }}
          >
            {QUOTE_PROPOSAL_LEGAL}
          </p>
        </div>

        <div
          style={{
            borderRight: border,
            padding: cellPad,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                borderBottom: "1px solid #000",
                minHeight: 36,
                marginBottom: 4,
              }}
            />
            <p style={{ margin: 0, fontSize: 9, textAlign: "center" }}>
              Authorized Signature
            </p>
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 8, lineHeight: 1.35 }}>
            Note: this proposal may be withdrawn by us if not accepted within{" "}
            <span
              style={{
                display: "inline-block",
                minWidth: 20,
                borderBottom: "1px solid #000",
              }}
            >
              {data.validForDays}
            </span>{" "}
            days.
          </p>
        </div>

        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            alignSelf: "stretch",
          }}
        >
          <tbody>
            <TotalRow
              label="Cabinets"
              value={formatCurrencyPrecise(totals.cabinets)}
            />
            <TotalRow
              label="Accessories"
              value={formatCurrencyPrecise(totals.accessories)}
            />
            <TotalRow
              label="Subtotal"
              value={formatCurrencyPrecise(totals.subtotal)}
            />
            <TotalRow label="Tax" value={formatCurrencyPrecise(totals.tax)} />
            <TotalRow
              label="GRAND TOTAL"
              value={formatCurrencyPrecise(totals.grandTotal)}
              bold
              shaded
            />
          </tbody>
        </table>
      </div>

      {/* Row 2 — acceptance & customer signatures */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 220px",
          border,
          borderTop: "none",
        }}
      >
        <div style={{ borderRight: border, padding: cellPad }}>
          <p style={{ margin: "0 0 8px", fontSize: 11, lineHeight: 1.35 }}>
            <span style={{ ...blackletter, fontSize: 15 }}>
              Acceptance of Proposal
            </span>{" "}
            — {QUOTE_ACCEPTANCE_TEXT}
          </p>
          <p style={{ margin: 0, fontSize: 10 }}>
            Date of Acceptance:{" "}
            <span
              style={{
                display: "inline-block",
                minWidth: 120,
                borderBottom: "1px solid #000",
              }}
            />
          </p>
        </div>

        <div style={{ padding: cellPad }}>
          {[0, 1].map((i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 6,
                marginBottom: i === 0 ? 10 : 0,
              }}
            >
              <span style={{ fontSize: 9, whiteSpace: "nowrap" }}>Signature</span>
              <div
                style={{
                  flex: 1,
                  borderBottom: "1px solid #000",
                  minHeight: 18,
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Row 3 — terms bar */}
      <div
        style={{
          border,
          borderTop: "none",
          padding: "4px 8px",
          fontSize: 9,
          textAlign: "center",
        }}
      >
        {QUOTE_PDF_TERMS_BAR}
      </div>
    </footer>
  );
}
