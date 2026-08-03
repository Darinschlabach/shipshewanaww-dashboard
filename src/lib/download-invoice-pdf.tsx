"use client";

import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import InvoicePdfDocument from "@/components/invoices/InvoicePdfDocument";
import type {
  InvoiceDetailMeta,
  InvoiceDetailRow,
} from "@/lib/invoice-detail";
import {
  buildInvoiceDocumentData,
  type InvoiceDocumentLineItem,
} from "@/lib/invoice-document";

const PAGE_WIDTH_IN = 8.5;
const PAGE_HEIGHT_IN = 11;
const RENDER_WIDTH_PX = 816;

function waitForImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll("img"));
  if (images.length === 0) return Promise.resolve();

  for (const img of images) {
    const src = img.getAttribute("src") ?? "";
    if (src.startsWith("/")) {
      img.src = `${window.location.origin}${src}`;
    }
  }

  return Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          img.onload = () => resolve();
          img.onerror = () => resolve();
        })
    )
  ).then(() => undefined);
}

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
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=UnifrakturMaguntia&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Allura&family=Cinzel:wght@400;500;600&family=Great+Vibes&family=Monsieur+La+Doulaise&family=Qwitcher+Grypen:wght@400;700&family=Tangerine:wght@400;700&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; background: #fff; }
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

async function renderFullWhitePage(pdf: jsPDF, pageEl: HTMLElement): Promise<void> {
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
  pdf.addImage(imgData, "JPEG", 0, 0, PAGE_WIDTH_IN, PAGE_HEIGHT_IN);
}

export async function downloadInvoicePdf(opts: {
  invoice: InvoiceDetailRow;
  meta: InvoiceDetailMeta;
  lineItems: InvoiceDocumentLineItem[];
  includeTax?: boolean;
}): Promise<{ error?: string }> {
  const data = buildInvoiceDocumentData(
    opts.invoice,
    opts.meta,
    opts.lineItems
  );
  const includeTax = opts.includeTax ?? false;

  let root: Root | null = null;
  let frame: ReturnType<typeof createPdfIframe> | null = null;

  try {
    frame = createPdfIframe();
    root = createRoot(frame.mount);

    flushSync(() => {
      root!.render(
        createElement(InvoicePdfDocument, {
          data,
          includeTax,
        })
      );
    });

    await waitForImages(frame.mount);
    await frame.iframe.contentDocument?.fonts?.ready;
    await new Promise((resolve) => setTimeout(resolve, 400));

    const pages = Array.from(
      frame.mount.querySelectorAll<HTMLElement>(".invoice-page")
    );
    if (pages.length === 0) {
      return { error: "Invoice document is empty." };
    }

    pages.forEach((pageEl) => {
      const footer = pageEl.querySelector<HTMLElement>(".invoice-page-number");
      if (footer) {
        footer.textContent = "Page 1 of 1";
      }
    });

    const pdf = new jsPDF({
      unit: "in",
      format: "letter",
      orientation: "portrait",
    });

    await renderFullWhitePage(pdf, pages[0]);

    const filename = `${data.quoteNumber.replace(/[^\w-]+/g, "-")}.pdf`;
    pdf.save(filename);
  } catch (err) {
    console.error("Invoice PDF generation failed:", err);
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
