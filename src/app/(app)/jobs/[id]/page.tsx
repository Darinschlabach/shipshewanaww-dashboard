"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  IconAlertCircle,
  IconArrowNarrowRight,
  IconDotsVertical,
  IconBuildingFactory,
  IconTrash,
} from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/client";
import DraftingTab from "@/components/jobs/DraftingTab";
import ProductionTab from "@/components/jobs/ProductionTab";
import PurchasingTab from "@/components/jobs/PurchasingTab";
import RoomsTab from "@/components/jobs/RoomsTab";
import FilesTab from "@/components/jobs/FilesTab";
import FinancialsTab from "@/components/jobs/FinancialsTab";
import ScheduleTab from "@/components/jobs/ScheduleTab";
import { getJobStageDisplay } from "@/lib/jobs";
import {
  formatCurrencyFull,
  formatDate,
  formatDateLong,
} from "@/lib/utils";
import {
  JOB_ACTIVE_STAGES,
  type Job,
  Contact,
} from "@/lib/types";

const JOB_DETAIL_TABS = [
  "Overview",
  "Job Specs",
  "Drafting",
  "Production",
  "Purchasing",
  "Schedule",
  "Financials",
  "Files",
] as const;

type JobDetailTab = (typeof JOB_DETAIL_TABS)[number];

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [job, setJob] = useState<
    (Job & { contacts: Contact | null }) | null
  >(null);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sendingToProduction, setSendingToProduction] = useState(false);
  const [onProductionBoard, setOnProductionBoard] = useState(false);
  const [boardStatus, setBoardStatus] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<JobDetailTab>("Overview");
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam?.toLowerCase() === "schedule") {
      setActiveTab("Schedule");
    }
  }, [searchParams]);

  const [purchasingFullScreenMode, setPurchasingFullScreenMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("jobs")
        .select("*, contacts(*)")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        setLoadError(error.message);
        setJob(null);
      } else if (data) {
        const j = data as Job & { contacts: Contact | null };
        setJob(j);
        setNotes(j.notes ?? "");
      } else {
        setJob(null);
      }

      const { data: boardRow } = await supabase
        .from("production_jobs")
        .select("id, kanban_status")
        .eq("job_id", id)
        .maybeSingle();
      setOnProductionBoard(!!boardRow);
      setBoardStatus(boardRow?.kanban_status ?? null);
    } catch (err) {
      console.error("Job detail load failed:", err);
      setLoadError(err instanceof Error ? err.message : "Could not load job.");
      setJob(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveNotes(value: string) {
    setSavingNotes(true);
    const supabase = createClient();
    await supabase.from("jobs").update({ notes: value }).eq("id", id);
    setSavingNotes(false);
  }

  function handleNotesBlur() {
    if (job && notes !== job.notes) saveNotes(notes);
  }

  async function handleDeleteJob() {
    if (!job) return;
    setMenuOpen(false);
    if (
      !confirm(
        `Delete "${job.name}"? Related production and purchase records will also be removed. This cannot be undone.`
      )
    ) {
      return;
    }

    setDeleting(true);
    const supabase = createClient();

    await fetch(`/api/invoices?job_id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });

    const { error } = await supabase.from("jobs").delete().eq("id", id);

    setDeleting(false);

    if (!error) {
      router.push("/jobs");
    }
  }

  async function handleSendToProduction() {
    if (!job || onProductionBoard) return;
    setMenuOpen(false);
    setSendingToProduction(true);
    setActionError(null);
    const supabase = createClient();

    const { error: stageError } = await supabase
      .from("jobs")
      .update({ stage: "production" })
      .eq("id", id);

    if (stageError) {
      setSendingToProduction(false);
      setActionError(stageError.message);
      return;
    }

    const { data: existing } = await supabase
      .from("production_jobs")
      .select("id")
      .eq("job_id", id)
      .maybeSingle();

    if (!existing) {
      const { error: boardError } = await supabase.from("production_jobs").insert({
        job_id: id,
        kanban_status: "queued",
        due_date: job.due_date || null,
      });

      if (boardError) {
        setSendingToProduction(false);
        setActionError(
          `Job stage updated, but it could not be added to the production queue: ${boardError.message}`
        );
        await load();
        return;
      }
    } else {
      // Always land in the queue — never skip ahead to fabricating.
      const { error: queueError } = await supabase
        .from("production_jobs")
        .update({ kanban_status: "queued", due_date: job.due_date || null })
        .eq("job_id", id);

      if (queueError) {
        setSendingToProduction(false);
        setActionError(queueError.message);
        await load();
        return;
      }
    }

    setSendingToProduction(false);
    await load();
  }

  if (loading) {
    return <p className="text-gray-500">Loading…</p>;
  }

  if (!job) {
    return (
      <div>
        <p className="text-gray-500">
          {loadError || "Job not found."}
        </p>
        <Link
          href="/jobs"
          className="mt-2 inline-block text-sm text-burgundy hover:underline"
        >
          Back to Jobs
        </Link>
      </div>
    );
  }

  const stageIndex = JOB_ACTIVE_STAGES.indexOf(
    job.stage === "delivery"
      ? "production"
      : JOB_ACTIVE_STAGES.includes(job.stage)
        ? job.stage
        : "design"
  );
  const customerName = job.contacts
    ? job.contacts.name
    : "Unknown";

  const designDone = !!job.design_approved_at;
  const completionPercent = Math.min(
    100,
    Math.max(0, Math.round(((stageIndex + 1) / JOB_ACTIVE_STAGES.length) * 100))
  );

  const contact = job.contacts;
  const displayField = (value: string | null | undefined) => value?.trim() || "—";
  const alreadyInProduction = onProductionBoard;
  const currentStageLabel = getJobStageDisplay(job, boardStatus);

  const isFillHeightTab =
    activeTab === "Drafting" ||
    activeTab === "Production" ||
    activeTab === "Purchasing" ||
    activeTab === "Schedule" ||
    activeTab === "Financials" ||
    activeTab === "Files";
  const hideJobHeaderForPurchasing =
    activeTab === "Purchasing" && purchasingFullScreenMode;

  return (
    <div
      className={
        isFillHeightTab
          ? "flex h-[calc(100vh-2.5rem)] min-h-0 flex-col overflow-hidden"
          : undefined
      }
    >
      {!hideJobHeaderForPurchasing ? (
        <Link
          href="/jobs"
          className={`mb-4 inline-block text-sm text-gray-500 hover:text-burgundy ${
            isFillHeightTab ? "shrink-0" : ""
          }`}
        >
          ← All jobs
        </Link>
      ) : null}

      {!hideJobHeaderForPurchasing ? (
        <div
          className={`mb-6 flex items-start justify-between gap-4 ${
            isFillHeightTab ? "shrink-0" : ""
          }`}
        >
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-gray-900">{job.name}</h1>
              <span
                className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${currentStageLabel.className}`}
              >
                {currentStageLabel.label}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {customerName}
              {job.start_date && ` · Started ${formatDateLong(job.start_date)}`}
              {` · ${formatCurrencyFull(Number(job.total_value))}`}
            </p>
          </div>
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              disabled={deleting || sendingToProduction}
              className="rounded-md border border-gray-300 bg-white p-2 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              aria-label="Job actions"
              aria-expanded={menuOpen}
            >
              <IconDotsVertical size={18} />
            </button>
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                  <button
                    type="button"
                    onClick={() => void handleSendToProduction()}
                    disabled={sendingToProduction || alreadyInProduction}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <IconBuildingFactory size={16} className="shrink-0 text-gray-500" />
                    {alreadyInProduction
                      ? "Already in production"
                      : sendingToProduction
                        ? "Sending…"
                        : "Move to Production"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteJob()}
                    disabled={deleting}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    <IconTrash size={16} className="shrink-0" />
                    {deleting ? "Deleting…" : "Delete job"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {actionError ? (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </p>
      ) : null}

      {!hideJobHeaderForPurchasing ? (
        <div
          className={`flex flex-wrap items-center gap-4 border-b border-gray-200 pb-2 text-sm ${
            isFillHeightTab ? "mb-2 shrink-0" : "mb-6"
          }`}
        >
          {JOB_DETAIL_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`inline-flex items-center gap-1 border-b-2 pb-2 ${
                tab === activeTab
                  ? "border-burgundy font-medium text-burgundy"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      ) : null}

      {activeTab === "Job Specs" ? (
        <RoomsTab jobId={id} />
      ) : activeTab === "Drafting" ? (
        <div className="min-h-0 flex-1">
          <DraftingTab jobId={id} />
        </div>
      ) : activeTab === "Production" ? (
        <div className="min-h-0 flex-1">
          <ProductionTab jobId={id} />
        </div>
      ) : null}

      <div
        className={`min-h-0 flex-1 ${
          activeTab === "Purchasing" ? "flex flex-col" : "hidden"
        }`}
      >
        <PurchasingTab
          jobId={id}
          isActive={activeTab === "Purchasing"}
          onFullScreenModeChange={setPurchasingFullScreenMode}
        />
      </div>

      {activeTab === "Schedule" ? (
        <div className="min-h-0 flex-1">
          <ScheduleTab
            jobId={id}
            jobName={job.name}
            autoOpenEditor={searchParams.get("openScheduleEditor") === "1"}
          />
        </div>
      ) : activeTab === "Financials" ? (
        <div className="min-h-0 flex-1">
          <FinancialsTab jobId={id} />
        </div>
      ) : activeTab === "Files" ? (
        <div className="min-h-0 flex-1">
          <FilesTab jobId={id} />
        </div>
      ) : activeTab === "Overview" ? (
        <>
      <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="rounded-lg border border-gray-200 bg-white p-4 xl:col-span-3">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Financial Summary
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Contract Value</span>
              <span className="font-medium text-gray-900">
                {formatCurrencyFull(Number(job.total_value))}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Payments Made</span>
              <span className="font-medium text-green-600">
                {formatCurrencyFull(Number(job.billing_collected))}
              </span>
            </div>
            <div className="mt-3 border-t border-gray-100 pt-3">
              <div className="text-xs text-gray-500">Amount Due</div>
              <div className="text-xl font-semibold text-gray-900">
                {formatCurrencyFull(
                  Math.max(0, Number(job.total_value) - Number(job.billing_collected))
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 xl:col-span-3">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Project Timeline
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Measure Date</span>
              <span className="text-gray-900">{formatDate(job.start_date)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Drafting Due</span>
              <span className="text-gray-900">{formatDate(job.due_date)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Production Start</span>
              <span className="text-gray-900">{formatDate(job.start_date)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Est. Completion</span>
              <span className="text-gray-900">{formatDate(job.due_date)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Target Ship Date</span>
              <span className="font-medium text-gray-900">{formatDate(job.due_date)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 xl:col-span-3">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Job Progress
          </h2>
          <div className="mb-3 flex items-center gap-4">
            <div className="relative h-16 w-16 rounded-full border-4 border-green-500">
              <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-gray-900">
                {completionPercent}%
              </div>
            </div>
            <div className="text-sm text-gray-500">Overall</div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Drafting</span>
              <span className="text-green-600">{designDone ? "100%" : "0%"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Production</span>
              <span className="text-burgundy">
                {job.stage === "production" || job.stage === "delivery"
                  ? "62%"
                  : stageIndex > 1
                    ? "100%"
                    : "0%"}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 xl:col-span-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Alerts</h2>
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              3
            </span>
          </div>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-start gap-2">
              <IconAlertCircle size={16} className="mt-0.5 text-red-500" />
              Material order partially received
            </li>
            <li className="flex items-start gap-2">
              <IconAlertCircle size={16} className="mt-0.5 text-amber-500" />
              Island countertop template needed
            </li>
            <li className="flex items-start gap-2">
              <IconAlertCircle size={16} className="mt-0.5 text-amber-500" />
              Install date conflicts with another job
            </li>
          </ul>
          <button className="mt-3 inline-flex items-center gap-1 text-sm text-burgundy hover:underline">
            View all alerts
            <IconArrowNarrowRight size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3 xl:items-stretch">
        <div className="flex min-h-0 flex-col rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Job Notes
          </h3>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleNotesBlur}
            rows={4}
            className="min-h-0 flex-1 resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-burgundy focus:outline-none focus:ring-1 focus:ring-burgundy"
            placeholder="Add notes about this job…"
          />
          {savingNotes && <p className="mt-2 text-xs text-gray-400">Saving…</p>}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Job Info
          </h3>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs text-gray-500">Address</dt>
              <dd className="mt-0.5 text-gray-900">{displayField(contact?.address)}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Phone</dt>
              <dd className="mt-0.5 text-gray-900">{displayField(contact?.phone)}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Email</dt>
              <dd className="mt-0.5 text-gray-900">{displayField(contact?.email)}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Fax</dt>
              <dd className="mt-0.5 text-gray-900">{displayField(contact?.fax)}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Job Contacts
            </h3>
            <button className="text-sm text-burgundy hover:underline">+ Add Contact</button>
          </div>
          <div className="space-y-3 text-sm">
            <div>
              <div className="font-medium text-gray-900">{customerName}</div>
              <div className="text-xs text-gray-500">Client</div>
            </div>
            <div>
              <div className="font-medium text-gray-900">Brent Hess</div>
              <div className="text-xs text-gray-500">Homeowner</div>
            </div>
            <div>
              <div className="font-medium text-gray-900">Builder Co.</div>
              <div className="text-xs text-gray-500">Builder</div>
            </div>
            <div>
              <div className="font-medium text-gray-900">Jordan Detweiler</div>
              <div className="text-xs text-gray-500">Designer</div>
            </div>
          </div>
        </div>
      </div>
        </>
      ) : null}
    </div>
  );
}
