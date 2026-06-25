import type { CSSProperties } from "react";

/** Letter-size page at 96dpi — used for PDF export only. */
export const PDF_PAGE_WIDTH_PX = 816;
export const PDF_PAGE_HEIGHT_PX = 1056;

/** Dark bar color used in quote PDF header/footer accents. */
export const PDF_BAR_COLOR = "#1f2933";

export const pdfPage: CSSProperties = {
  width: PDF_PAGE_WIDTH_PX,
  minHeight: PDF_PAGE_HEIGHT_PX,
  background: "#ffffff",
  boxSizing: "border-box",
};
