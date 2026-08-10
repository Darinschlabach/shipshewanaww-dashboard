"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  IconArrowLeft,
  IconArrowRight,
  IconDotsVertical,
  IconFileTypePdf,
  IconMail,
  IconMapPin,
  IconPencil,
  IconPhone,
  IconTrash,
} from "@tabler/icons-react";
import Button from "@/components/Button";
import QuoteStatusBadge from "@/components/QuoteStatusBadge";
import QuoteRoomsTab from "@/components/quotes/QuoteRoomsTab";
import QuoteServicesTab from "@/components/quotes/QuoteServicesTab";
import QuoteFilesTab from "@/components/quotes/QuoteFilesTab";
import ConfirmModal from "@/components/ConfirmModal";
import Modal from "@/components/Modal";
import { createClient } from "@/lib/supabase/client";
import {
  buildQuoteDetail,
  formatQuoteDisplayNumber,
} from "@/lib/quote-detail";
import { listQuoteFiles, renameQuoteSharePointFolderClient } from "@/lib/quote-files";
import { formatQuoteNumber } from "@/lib/quotes";
import {
  buildQuoteRoomSummaries,
  fetchQuoteRoomsWithItems,
  quoteRoomsGrandTotal,
  type QuoteRoomSummaryLine,
} from "@/lib/quote-rooms";
import {
  fetchQuoteServices,
  quoteServicesTotal,
} from "@/lib/quote-services";
import { downloadQuotePdf } from "@/lib/download-quote-pdf";
import { COMPANY, quoteSalesTax } from "@/lib/company";
import { formatCurrencyFull, formatDateLong } from "@/lib/utils";
import type { Lead } from "@/lib/types";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "rooms", label: "Rooms" },
  { id: "services", label: "Services" },
  { id: "files", label: "Files" },
];

interface QuoteDetailViewProps {
  quote: Lead;
  onConvert: () => void;
  onUnconvert?: () => void;
  onDelete: () => void;
  onQuoteUpdated?: () => void;
  converting: boolean;
  unconverting?: boolean;
  deleting: boolean;
}

export default function QuoteDetailView({
  quote,
  onConvert,
  onUnconvert,
  onDelete,
  onQuoteUpdated,
  converting,
  unconverting = false,
  deleting,
}: QuoteDetailViewProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [showConvert, setShowConvert] = useState(false);
  const [showUnconvert, setShowUnconvert] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showRenameJob, setShowRenameJob] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [jobName, setJobName] = useState(quote.project_type);
  const [savingJobName, setSavingJobName] = useState(false);
  const [roomSummaries, setRoomSummaries] = useState<QuoteRoomSummaryLine[]>([]);
  const [servicesTotal, setServicesTotal] = useState(0);
  const meta = buildQuoteDetail(quote);
  const roomsTotal = quoteRoomsGrandTotal(roomSummaries);
  const projectTotal = roomsTotal + servicesTotal;
  const displayTotal =
    roomSummaries.length > 0 || servicesTotal > 0
      ? projectTotal
      : Number(quote.est_value);
  const [includeTax, setIncludeTax] = useState(false);
  const [leadTimeWeeks, setLeadTimeWeeks] = useState(() => {
    const stored = Number(quote.lead_time_weeks);
    return String(Number.isFinite(stored) && stored > 0 ? stored : 7);
  });
  const quotePreviewTotal =
    displayTotal + quoteSalesTax(displayTotal, includeTax);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [fileCount, setFileCount] = useState(0);

  const isConverted = quote.status === "converted";

  useEffect(() => {
    let cancelled = false;
    async function loadFileCount() {
      const remote = await listQuoteFiles(quote.id);
      if (cancelled) return;
      if (!remote.error) {
        setFileCount(remote.files.length);
      }
    }
    void loadFileCount();
    return () => {
      cancelled = true;
    };
  }, [quote.id]);

  function resolvedLeadTimeWeeks(): number {
    const parsed = parseInt(leadTimeWeeks, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 7;
  }

  async function handleDownloadPdf() {
    setDownloadingPdf(true);
    setPdfError(null);
    const { error } = await downloadQuotePdf(quote, {
      includeTax,
      leadTimeWeeks: resolvedLeadTimeWeeks(),
    });
    if (error) setPdfError(error);
    setDownloadingPdf(false);
  }

  const loadRoomSummaries = useCallback(async () => {
    const [{ rooms, error }, { services, error: servicesError }] =
      await Promise.all([
        fetchQuoteRoomsWithItems(quote.id),
        fetchQuoteServices(quote.id),
      ]);
    if (!error) {
      setRoomSummaries(buildQuoteRoomSummaries(rooms));
    }
    if (!servicesError) {
      setServicesTotal(quoteServicesTotal(services));
    }
  }, [quote.id]);

  const handleQuoteUpdated = useCallback(() => {
    onQuoteUpdated?.();
    void loadRoomSummaries();
  }, [onQuoteUpdated, loadRoomSummaries]);

  useEffect(() => {
    void loadRoomSummaries();
  }, [loadRoomSummaries, activeTab, quote.est_value]);

  useEffect(() => {
    setJobName(quote.project_type);
  }, [quote.project_type]);

  useEffect(() => {
    const stored = Number(quote.lead_time_weeks);
    setLeadTimeWeeks(String(Number.isFinite(stored) && stored > 0 ? stored : 7));
  }, [quote.lead_time_weeks]);

  async function persistLeadTimeWeeks(weeks: number) {
    const supabase = createClient();
    await supabase
      .from("leads")
      .update({ lead_time_weeks: weeks })
      .eq("id", quote.id);
    onQuoteUpdated?.();
  }

  async function handleSaveJobName(e: FormEvent) {
    e.preventDefault();
    const name = jobName.trim();
    if (!name) return;

    setSavingJobName(true);
    const supabase = createClient();
    await supabase
      .from("leads")
      .update({ project_type: name })
      .eq("id", quote.id);

    // Keep SharePoint folder name in sync via DriveItem ID (no duplicate folder).
    await renameQuoteSharePointFolderClient({
      quoteId: quote.id,
      jobName: name,
    });

    setSavingJobName(false);
    setShowRenameJob(false);
    onQuoteUpdated?.();
  }

  const fillHeightTab =
    activeTab === "overview" ||
    activeTab === "rooms" ||
    activeTab === "services" ||
    activeTab === "files";

  return (
    <div
      className={
        fillHeightTab
          ? "flex h-[calc(100vh-2.5rem)] min-h-0 flex-col overflow-hidden"
          : "pb-8"
      }
    >
      <Link
        href="/leads"
        className="mb-2 inline-flex shrink-0 items-center gap-1 text-sm text-gray-600 hover:text-burgundy"
      >
        <IconArrowLeft size={16} />
        Back to Quotes
      </Link>

      <div className="mb-3 flex shrink-0 flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-2xl font-semibold text-gray-900">
              {meta.title}
            </h1>
            <button
              type="button"
              onClick={() => setShowRenameJob(true)}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-burgundy"
              aria-label="Rename job"
              title="Rename job"
            >
              <IconPencil size={16} />
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-600">
              {formatQuoteDisplayNumber(quote)}
            </span>
            <QuoteStatusBadge status={quote.status} />
          </div>
        </div>

        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            disabled={deleting || converting || unconverting}
            className="rounded-md border border-gray-300 bg-white p-2 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            aria-label="Quote actions"
            aria-expanded={menuOpen}
          >
            <IconDotsVertical size={18} />
          </button>
          {menuOpen ? (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-full z-20 mt-1 w-52 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                {!isConverted ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setShowConvert(true);
                    }}
                    disabled={converting}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <IconArrowRight size={16} className="shrink-0 text-gray-500" />
                    Convert To Job
                  </button>
                ) : null}
                {isConverted && quote.converted_job_id ? (
                  <>
                    <Link
                      href={`/jobs/${quote.converted_job_id}`}
                      onClick={() => setMenuOpen(false)}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <IconArrowRight size={16} className="shrink-0 text-gray-500" />
                      View Job
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        setShowUnconvert(true);
                      }}
                      disabled={unconverting}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Convert back to quote
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setShowDelete(true);
                  }}
                  disabled={deleting}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  <IconTrash size={16} className="shrink-0" />
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="mb-3 shrink-0 border-b border-gray-200">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map((tab) => {
            const label =
              tab.id === "files"
                ? `${tab.label} (${fileCount})`
                : tab.label;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "border-burgundy text-burgundy"
                    : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "overview" && (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="mb-3 grid shrink-0 grid-cols-2 gap-0 divide-x divide-gray-200 rounded-lg border border-gray-200 bg-white md:grid-cols-4">
          <div className="p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Customer
            </p>
            <p className="mt-1 font-medium text-gray-900">{meta.customerName}</p>
            <p className="mt-1 flex items-center gap-1 text-xs text-gray-600">
              <IconPhone size={12} />
              {meta.phone}
            </p>
            <p className="flex items-center gap-1 text-xs text-gray-600">
              <IconMail size={12} />
              {meta.email}
            </p>
            <p className="mt-0.5 flex items-start gap-1 text-xs text-gray-600">
              <IconMapPin size={12} className="mt-0.5 shrink-0" />
              {meta.customerAddress}
            </p>
          </div>
          <div className="p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Job Info
            </p>
            <dl className="mt-1 space-y-1 text-xs text-gray-700">
              <div>
                <span className="text-gray-500">Job Name: </span>
                {meta.jobName}
              </div>
              <div>
                <span className="text-gray-500">Address: </span>
                {meta.jobAddress}
              </div>
            </dl>
          </div>
          <div className="p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Quote Summary
            </p>
            <p className="mt-1 text-xs text-gray-500">Quote Total</p>
            <p className="text-xl font-semibold text-gray-900">
              {formatCurrencyFull(displayTotal)}
            </p>
          </div>
          <div className="p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Dates
            </p>
            <dl className="mt-1 space-y-1 text-xs text-gray-700">
              <div>
                <span className="text-gray-500">Created: </span>
                {formatDateLong(quote.created_at.slice(0, 10))}
              </div>
              <div>
                <span className="text-gray-500">Sent: </span>
                {quote.sent_at ? formatDateLong(quote.sent_at) : "—"}
              </div>
              <div>
                <span className="text-gray-500">Last Updated: </span>
                {formatDateLong(quote.updated_at.slice(0, 10))}
              </div>
              <div>
                <span className="text-gray-500">Follow Up: </span>
                <span className="font-medium text-red-600">
                  {meta.followUpDate
                    ? formatDateLong(meta.followUpDate)
                    : "—"}
                </span>
              </div>
            </dl>
          </div>
        </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto lg:grid-cols-2 lg:overflow-hidden">
            <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="mb-2 shrink-0 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Project Summary
              </h3>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-gray-100 text-xs text-gray-500">
                      <th className="pb-2 text-left font-medium">Item</th>
                      <th className="pb-2 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roomSummaries.length === 0 ? (
                      <tr>
                        <td
                          colSpan={2}
                          className="py-6 text-center text-sm text-gray-500"
                        >
                          No rooms yet. Add rooms on the Rooms tab to build
                          this summary.
                        </td>
                      </tr>
                    ) : (
                      roomSummaries.map((room) => (
                        <tr
                          key={room.id}
                          className="border-b border-gray-50 text-gray-800"
                        >
                          <td className="py-2">{room.name}</td>
                          <td className="py-2 text-right">
                            {formatCurrencyFull(room.amount)}
                          </td>
                        </tr>
                      ))
                    )}
                    <tr className="font-semibold text-gray-900">
                      <td className="pt-3">Total</td>
                      <td className="pt-3 text-right">
                        {formatCurrencyFull(displayTotal)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {meta.expirationDate && (
                <div className="mt-2 shrink-0 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  This quote is valid for 30 days. Expiration Date:{" "}
                  <span className="font-medium">
                    {formatDateLong(meta.expirationDate)}
                  </span>
                </div>
              )}
            </div>

            <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white p-4">
              <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Quote Preview
                </h3>
                <div className="flex shrink-0 items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-gray-600">
                    <span>Lead time</span>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={leadTimeWeeks}
                      onChange={(e) => setLeadTimeWeeks(e.target.value)}
                      onBlur={() => {
                        const weeks = resolvedLeadTimeWeeks();
                        setLeadTimeWeeks(String(weeks));
                        void persistLeadTimeWeeks(weeks);
                      }}
                      className="w-12 rounded border border-gray-300 px-1.5 py-0.5 text-center text-xs text-gray-900"
                      aria-label="Lead time in weeks"
                    />
                    <span>weeks</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={includeTax}
                      onChange={(e) => setIncludeTax(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-gray-300 text-burgundy focus:ring-burgundy"
                    />
                    Include tax
                  </label>
                </div>
              </div>
              <div className="mb-3 flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gradient-to-b from-gray-50 to-white p-4 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={COMPANY.logoPath}
                  alt={COMPANY.name}
                  className="mb-2 h-12 w-auto max-w-full object-contain"
                />
                <p className="font-serif text-sm font-semibold tracking-wide text-burgundy">
                  QUOTE
                </p>
                <p className="text-[10px] uppercase tracking-wider text-gray-500">
                  {COMPANY.tagline}
                </p>
                <p className="mt-2 line-clamp-2 text-xs font-medium text-gray-800">
                  {meta.title}
                </p>
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  {formatCurrencyFull(quotePreviewTotal)}
                </p>
                <p className="mt-0.5 text-[10px] text-gray-500">
                  {formatQuoteNumber(quote)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleDownloadPdf()}
                disabled={downloadingPdf}
                className="flex w-full shrink-0 items-center justify-center gap-2 rounded-md border border-gray-300 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
              >
                <IconFileTypePdf size={18} />
                {downloadingPdf ? "Generating PDF…" : "Download PDF"}
              </button>
              {pdfError && (
                <p className="mt-2 text-center text-xs text-red-600">{pdfError}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "rooms" && (
        <div className="min-h-0 flex-1 overflow-hidden">
          <QuoteRoomsTab quoteId={quote.id} onQuoteUpdated={handleQuoteUpdated} />
        </div>
      )}

      {activeTab === "services" && (
        <div className="min-h-0 flex-1 overflow-hidden px-0 pb-4">
          <QuoteServicesTab
            quoteId={quote.id}
            onQuoteUpdated={handleQuoteUpdated}
          />
        </div>
      )}

      {activeTab === "files" && (
        <div className="min-h-0 flex-1 overflow-hidden">
          <QuoteFilesTab
            quoteId={quote.id}
            onFileCountChange={setFileCount}
          />
        </div>
      )}

      {showRenameJob && (
        <Modal title="Rename job" onClose={() => setShowRenameJob(false)}>
          <form onSubmit={handleSaveJobName} className="space-y-4">
            <p className="text-sm text-gray-600">
              Customer:{" "}
              <span className="font-medium text-gray-900">{meta.customerName}</span>
            </p>
            <div>
              <label className="mb-1 block text-sm font-medium">Job name</label>
              <input
                required
                autoFocus
                value={jobName}
                onChange={(e) => setJobName(e.target.value)}
                placeholder="e.g. Jamison Kitchen"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" onClick={() => setShowRenameJob(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={savingJobName}>
                {savingJobName ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {showConvert && (
        <ConfirmModal
          title="Convert to job?"
          body={`Create a new job for ${quote.customer_name} — ${quote.project_type}?`}
          confirmLabel="Convert"
          loading={converting}
          onConfirm={() => {
            onConvert();
            setShowConvert(false);
          }}
          onCancel={() => setShowConvert(false)}
        />
      )}

      {showUnconvert && onUnconvert && (
        <ConfirmModal
          title="Convert back to quote?"
          body={`Restore ${formatQuoteDisplayNumber(quote)} and remove the linked job? Any job-only data (production, rooms, etc.) will be deleted.`}
          confirmLabel="Convert back"
          loading={unconverting}
          onConfirm={() => {
            onUnconvert();
            setShowUnconvert(false);
          }}
          onCancel={() => setShowUnconvert(false)}
        />
      )}

      {showDelete && (
        <ConfirmModal
          title="Delete quote?"
          body={
            isConverted
              ? `Delete ${formatQuoteDisplayNumber(quote)}? The linked job will remain; only this quote record is removed.`
              : `Permanently delete ${formatQuoteDisplayNumber(quote)} for ${quote.customer_name}? This cannot be undone.`
          }
          confirmLabel="Delete"
          loading={deleting}
          onConfirm={() => {
            onDelete();
            setShowDelete(false);
          }}
          onCancel={() => setShowDelete(false)}
        />
      )}
    </div>
  );
}
