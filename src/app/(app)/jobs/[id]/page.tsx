"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  IconAlertCircle,
  IconArrowNarrowRight,
} from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/client";
import { unconvertQuoteFromJob } from "@/lib/unconvert-quote";
import Button from "@/components/Button";
import ConfirmModal from "@/components/ConfirmModal";
import Modal from "@/components/Modal";
import DraftingTab from "@/components/jobs/DraftingTab";
import ProductionTab from "@/components/jobs/ProductionTab";
import PurchasingTab from "@/components/jobs/PurchasingTab";
import RoomsTab from "@/components/jobs/RoomsTab";
import FilesTab from "@/components/jobs/FilesTab";
import FinancialsTab from "@/components/jobs/FinancialsTab";
import ScheduleTab from "@/components/jobs/ScheduleTab";
import TasksTab from "@/components/jobs/TasksTab";
import {
  formatCurrencyFull,
  formatDate,
  formatDateLong,
} from "@/lib/utils";
import {
  JOB_ACTIVE_STAGES,
  JOB_STAGE_LABELS,
  type Job,
  JobStage,
  Contact,
  Lead,
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
  "Tasks",
] as const;

type JobDetailTab = (typeof JOB_DETAIL_TABS)[number];

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<
    (Job & { contacts: Contact | null }) | null
  >(null);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [sourceQuote, setSourceQuote] = useState<Lead | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showUnconvert, setShowUnconvert] = useState(false);
  const [unconverting, setUnconverting] = useState(false);
  const [activeTab, setActiveTab] = useState<JobDetailTab>("Overview");
  const [purchasingFullScreenMode, setPurchasingFullScreenMode] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    total_value: "",
    due_date: "",
    stage: "design" as JobStage,
  });

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("jobs")
      .select("*, contacts(*)")
      .eq("id", id)
      .single();

    if (data) {
      const j = data as Job & { contacts: Contact | null };
      setJob(j);
      setNotes(j.notes ?? "");
      setEditForm({
        name: j.name,
        total_value: String(j.total_value),
        due_date: j.due_date ?? "",
        stage: j.stage,
      });
    }

    const { data: quoteData } = await supabase
      .from("leads")
      .select("*")
      .eq("converted_job_id", id)
      .maybeSingle();

    setSourceQuote((quoteData as Lead) ?? null);
  }, [id]);

  useEffect(() => {
    load();
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
    if (
      !confirm(
        `Delete "${job.name}"? Related production and purchase records will also be removed. This cannot be undone.`
      )
    ) {
      return;
    }

    setDeleting(true);
    const supabase = createClient();

    await supabase.from("invoices").delete().eq("job_id", id);

    const { error } = await supabase.from("jobs").delete().eq("id", id);

    setDeleting(false);

    if (!error) {
      router.push("/jobs");
    }
  }

  async function handleUnconvert() {
    if (!sourceQuote || !job) return;
    setUnconverting(true);
    const supabase = createClient();
    const { error } = await unconvertQuoteFromJob(supabase, sourceQuote, job);
    setUnconverting(false);
    if (!error) {
      router.push(`/leads/${sourceQuote.id}`);
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    await supabase
      .from("jobs")
      .update({
        name: editForm.name,
        total_value: parseFloat(editForm.total_value) || 0,
        due_date: editForm.due_date || null,
        stage: editForm.stage,
      })
      .eq("id", id);
    setShowEdit(false);
    load();
  }

  if (!job) {
    return <p className="text-gray-500">Loading…</p>;
  }

  const stageIndex = JOB_ACTIVE_STAGES.indexOf(
    JOB_ACTIVE_STAGES.includes(job.stage) ? job.stage : "design"
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

  const isFillHeightTab =
    activeTab === "Drafting" ||
    activeTab === "Production" ||
    activeTab === "Purchasing" ||
    activeTab === "Schedule" ||
    activeTab === "Financials" ||
    activeTab === "Files" ||
    activeTab === "Tasks";
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
            <h1 className="text-2xl font-semibold text-gray-900">{job.name}</h1>
            <p className="mt-1 text-sm text-gray-500">
              {customerName}
              {job.start_date && ` · Started ${formatDateLong(job.start_date)}`}
              {` · ${formatCurrencyFull(Number(job.total_value))}`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {sourceQuote && (
              <Button
                onClick={() => setShowUnconvert(true)}
                disabled={deleting || unconverting}
              >
                Convert back to quote
              </Button>
            )}
            <Button onClick={() => setShowEdit(true)} disabled={deleting || unconverting}>
              Edit job
            </Button>
            <button
              type="button"
              onClick={handleDeleteJob}
              disabled={deleting}
              className="rounded border border-red-300 bg-white px-3 py-1.5 text-sm text-red-600 hover:border-red-400 hover:bg-red-50 disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Delete job"}
            </button>
          </div>
        </div>
      ) : null}

      {!hideJobHeaderForPurchasing ? (
        <div
          className={`mb-6 flex flex-wrap items-center gap-4 border-b border-gray-200 pb-2 text-sm ${
            isFillHeightTab ? "shrink-0" : ""
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
              {tab === "Tasks" && (
                <span className="rounded-full bg-burgundy px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  12
                </span>
              )}
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
          <ScheduleTab jobId={id} />
        </div>
      ) : activeTab === "Financials" ? (
        <div className="min-h-0 flex-1">
          <FinancialsTab jobId={id} />
        </div>
      ) : activeTab === "Files" ? (
        <div className="min-h-0 flex-1">
          <FilesTab jobId={id} />
        </div>
      ) : activeTab === "Tasks" ? (
        <div className="min-h-0 flex-1">
          <TasksTab jobId={id} />
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
                {job.stage === "production" ? "62%" : stageIndex > 1 ? "100%" : "0%"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Delivery</span>
              <span className="text-gray-400">{job.stage === "delivery" ? "10%" : "0%"}</span>
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

      {showEdit && (
        <Modal title="Edit job" onClose={() => setShowEdit(false)}>
          <form onSubmit={handleEdit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Job name</label>
              <input
                required
                value={editForm.name}
                onChange={(e) =>
                  setEditForm({ ...editForm, name: e.target.value })
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Stage</label>
              <select
                value={editForm.stage}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    stage: e.target.value as JobStage,
                  })
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                {JOB_ACTIVE_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {JOB_STAGE_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Total value</label>
              <input
                type="number"
                value={editForm.total_value}
                onChange={(e) =>
                  setEditForm({ ...editForm, total_value: e.target.value })
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Due date</label>
              <input
                type="date"
                value={editForm.due_date}
                onChange={(e) =>
                  setEditForm({ ...editForm, due_date: e.target.value })
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" onClick={() => setShowEdit(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Save
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {showUnconvert && sourceQuote && job && (
        <ConfirmModal
          title="Convert back to quote?"
          body={`Restore this job as a quote for ${sourceQuote.customer_name}? The job and any job-only data will be removed.`}
          confirmLabel="Convert back"
          loading={unconverting}
          onConfirm={() => {
            handleUnconvert();
            setShowUnconvert(false);
          }}
          onCancel={() => setShowUnconvert(false)}
        />
      )}
    </div>
  );
}
