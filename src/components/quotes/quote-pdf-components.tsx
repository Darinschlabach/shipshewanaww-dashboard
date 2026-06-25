import type { ReactNode } from "react";
import { PDF_BAR_COLOR } from "./quote-pdf-styles";

export const pdfSectionLabelStyle = {
  margin: "0 0 8px",
  color: "#8e7641",
  fontWeight: 700,
  fontSize: 13,
} as const;

export const pdfTableCellStyle = {
  border: "1px solid #d4d4d4",
  padding: "6px 10px",
} as const;

export function RoomNumberBadge({
  number,
  onDark = false,
}: {
  number: number;
  onDark?: boolean;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 22,
        height: 22,
        borderRadius: "50%",
        border: onDark ? "1.5px solid #fff" : `1.5px solid ${PDF_BAR_COLOR}`,
        color: onDark ? "#fff" : PDF_BAR_COLOR,
        fontSize: 11,
        fontWeight: 700,
        flexShrink: 0,
        lineHeight: 1,
      }}
    >
      <span style={{ display: "inline-block", transform: "translateY(-6px)" }}>{number}</span>
    </span>
  );
}

export function PdfSectionTitle({ children }: { children: ReactNode }) {
  return <p style={pdfSectionLabelStyle}>{children}</p>;
}

export function QuotePdfThankYouImage() {
  return (
    <div style={{ textAlign: "center" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/quote-thank-you.png"
        alt="Thank You For Your Business"
        style={{
          width: 315,
          maxWidth: "100%",
          height: "auto",
          display: "inline-block",
          background: "#fff",
          filter: "brightness(1.04) contrast(1.04)",
        }}
      />
    </div>
  );
}
