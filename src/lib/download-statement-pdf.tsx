"use client";

import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import StatementPdfDocument, {
  type StatementCustomer,
  type StatementLine,
} from "@/components/wholesale/StatementPdfDocument";

const PAGE_WIDTH_IN = 8.5;
const PAGE_HEIGHT_IN = 11;
const MARGIN_IN = 0.25;
const RENDER_WIDTH_PX = 816;

function createPdfIframe(): {
  iframe: HTMLIFrameElement;
  mount: HTMLElement;
  cleanup: () => void;
} {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.left = "0";
  iframe.style.top = "0";
  iframe.style.width = `${RENDER_WIDTH_PX}px`;
  iframe.style.height = "1200px";
  iframe.style.border = "none";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  iframe.style.zIndex = "-1";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  if (!doc) {
    iframe.remove();
    throw new Error("Could not create PDF render frame.");
  }

  doc.open();
  doc.write(`<!DOCTYPE html>
<html><head>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; background: #fff; font-family: Arial, Helvetica, sans-serif; }
</style>
</head><body><div id="pdf-root"></div></body></html>`);
  doc.close();

  const mount = doc.getElementById("pdf-root");
  if (!mount) {
    iframe.remove();
    throw new Error("Could not mount PDF content.");
  }

  return {
    iframe,
    mount,
    cleanup: () => iframe.remove(),
  };
}

async function renderPageWithMargins(
  pdf: jsPDF,
  pageEl: HTMLElement
): Promise<void> {
  const canvas = await html2canvas(pageEl, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    logging: false,
    backgroundColor: "#ffffff",
    width: pageEl.offsetWidth,
    height: pageEl.offsetHeight,
    windowWidth: pageEl.offsetWidth,
    windowHeight: pageEl.offsetHeight,
    scrollX: 0,
    scrollY: 0,
  });

  const imgData = canvas.toDataURL("image/jpeg", 0.92);
  const contentWidth = PAGE_WIDTH_IN - MARGIN_IN * 2;
  const contentHeight = PAGE_HEIGHT_IN - MARGIN_IN * 2;
  pdf.addImage(
    imgData,
    "JPEG",
    MARGIN_IN,
    MARGIN_IN,
    contentWidth,
    contentHeight
  );
}

export async function downloadStatementPdf(opts: {
  customer: StatementCustomer;
  lines?: StatementLine[];
}): Promise<{ error?: string }> {
  let root: Root | null = null;
  let frame: ReturnType<typeof createPdfIframe> | null = null;
  const accountName = opts.customer.name;

  try {
    frame = createPdfIframe();
    root = createRoot(frame.mount);

    flushSync(() => {
      root!.render(
        createElement(StatementPdfDocument, {
          customer: opts.customer,
          lines: opts.lines ?? [],
        })
      );
    });

    // Allow logo image to load before capture.
    await new Promise((resolve) => setTimeout(resolve, 400));

    const pages = Array.from(
      frame.mount.querySelectorAll<HTMLElement>(".statement-page")
    );
    if (pages.length === 0) {
      return { error: "Statement document is empty." };
    }

    const pdf = new jsPDF({
      unit: "in",
      format: "letter",
      orientation: "portrait",
    });

    await renderPageWithMargins(pdf, pages[0]);

    const safeName = accountName
      .trim()
      .replace(/[^\w-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    pdf.save(`${safeName || "statement"}-statement.pdf`);
  } catch (err) {
    console.error("Statement PDF generation failed:", err);
    const message =
      err instanceof Error ? err.message : "Failed to generate PDF.";
    return {
      error: message.includes("unsupported color")
        ? "Failed to generate PDF. Please try again."
        : message,
    };
  } finally {
    root?.unmount();
    frame?.cleanup();
  }

  return {};
}
