"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  IconAlertCircle,
  IconArrowNarrowRight,
  IconArchive,
  IconDotsVertical,
  IconBuildingFactory,
  IconPencil,
  IconRuler2,
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
import AddressAutocomplete from "@/components/AddressAutocomplete";
import ContactDetailPanel from "@/components/contacts/ContactDetailPanel";
import ContactSearchSelect from "@/components/ContactSearchSelect";
import Modal from "@/components/Modal";
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
  const [movingToDrafting, setMovingToDrafting] = useState(false);
  const [movingToArchive, setMovingToArchive] = useState(false);
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
  const [showEditInfo, setShowEditInfo] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [showContactDetail, setShowContactDetail] = useState(false);
  const [showRenameJob, setShowRenameJob] = useState(false);
  const [jobNameDraft, setJobNameDraft] = useState("");
  const [savingJobName, setSavingJobName] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [savingInfo, setSavingInfo] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [contactError, setContactError] = useState<string | null>(null);
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [infoForm, setInfoForm] = useState({
    address: "",
    phone: "",
    email: "",
    fax: "",
  });
  const [selectedContactId, setSelectedContactId] = useState<string | null>(
    null
  );

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

  function openEditInfo() {
    if (!job) return;
    setInfoError(null);
    setInfoForm({
      address: job.address?.trim() || job.contacts?.address?.trim() || "",
      phone: job.phone?.trim() || job.contacts?.phone?.trim() || "",
      email: job.email?.trim() || job.contacts?.email?.trim() || "",
      fax: job.fax?.trim() || job.contacts?.fax?.trim() || "",
    });
    setShowEditInfo(true);
  }

  function openRenameJob() {
    if (!job) return;
    setRenameError(null);
    setJobNameDraft(job.name);
    setShowRenameJob(true);
  }

  async function handleSaveJobName(e: FormEvent) {
    e.preventDefault();
    if (!job) return;
    const name = jobNameDraft.trim();
    if (!name) {
      setRenameError("Job name is required.");
      return;
    }

    setSavingJobName(true);
    setRenameError(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("jobs")
      .update({ name })
      .eq("id", id);

    if (error) {
      setRenameError(error.message);
      setSavingJobName(false);
      return;
    }

    const { renameJobSharePointFolderClient } = await import("@/lib/job-files");
    const sharePoint = await renameJobSharePointFolderClient({
      jobId: id,
      jobName: name,
    });
    if (!sharePoint.ok) {
      setRenameError(
        sharePoint.error ??
          "Job name saved, but the SharePoint folder could not be renamed."
      );
      setJob({ ...job, name });
      setSavingJobName(false);
      return;
    }

    setJob({ ...job, name });
    setSavingJobName(false);
    setShowRenameJob(false);
  }

  async function handleSaveJobInfo(e: FormEvent) {
    e.preventDefault();
    if (!job) return;
    setSavingInfo(true);
    setInfoError(null);
    const supabase = createClient();
    const payload = {
      address: infoForm.address.trim() || null,
      phone: infoForm.phone.trim() || null,
      email: infoForm.email.trim() || null,
      fax: infoForm.fax.trim() || null,
    };
    const { error } = await supabase.from("jobs").update(payload).eq("id", id);
    setSavingInfo(false);
    if (error) {
      setInfoError(
        /address|phone|email|fax|column|schema cache/i.test(error.message)
          ? `${error.message} Run supabase/migrations/20260811000001_jobs_info_fields.sql in the Supabase SQL Editor, then retry.`
          : error.message
      );
      return;
    }
    setJob({ ...job, ...payload });
    setShowEditInfo(false);
  }

  async function openAddContact() {
    setContactError(null);
    setSelectedContactId(job?.customer_id ?? null);
    setShowAddContact(true);
    const supabase = createClient();
    const { data } = await supabase.from("contacts").select("*").order("name");
    setAllContacts((data as Contact[]) ?? []);
  }

  async function handleSaveJobContact(e: FormEvent) {
    e.preventDefault();
    if (!job || !selectedContactId) {
      setContactError("Select a contact.");
      return;
    }
    setSavingContact(true);
    setContactError(null);
    const supabase = createClient();
    const contact =
      allContacts.find((c) => c.id === selectedContactId) ?? null;
    const patch: Record<string, unknown> = {
      customer_id: selectedContactId,
    };
    // Prefill empty job info from the contact when linking.
    if (!job.address?.trim() && contact?.address?.trim()) {
      patch.address = contact.address.trim();
    }
    if (!job.phone?.trim() && contact?.phone?.trim()) {
      patch.phone = contact.phone.trim();
    }
    if (!job.email?.trim() && contact?.email?.trim()) {
      patch.email = contact.email.trim();
    }
    if (!job.fax?.trim() && contact?.fax?.trim()) {
      patch.fax = contact.fax.trim();
    }

    const { error } = await supabase.from("jobs").update(patch).eq("id", id);
    if (error) {
      setSavingContact(false);
      setContactError(error.message);
      return;
    }

    // Move SharePoint job folder under the contractor (or Jobs root if not).
    try {
      const res = await fetch(
        `/api/jobs/${encodeURIComponent(id)}/sharepoint/relocate-for-contact`,
        { method: "POST" }
      );
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || json.ok === false) {
        setSavingContact(false);
        setContactError(
          json.error ??
            "Contact saved, but the SharePoint folder could not be moved."
        );
        await load();
        return;
      }
    } catch (err) {
      setSavingContact(false);
      setContactError(
        err instanceof Error
          ? err.message
          : "Contact saved, but the SharePoint folder could not be moved."
      );
      await load();
      return;
    }

    setSavingContact(false);
    setShowAddContact(false);
    await load();
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

  async function handleMoveToDrafting() {
    if (!job) return;
    // Allow healing jobs that are marked Drafting but still on the production board.
    if (job.stage === "design" && !onProductionBoard) return;
    setMenuOpen(false);
    setMovingToDrafting(true);
    setActionError(null);
    const supabase = createClient();

    const { error: stageError } = await supabase
      .from("jobs")
      .update({ stage: "design" })
      .eq("id", id);

    if (stageError) {
      setMovingToDrafting(false);
      setActionError(stageError.message);
      return;
    }

    const { error: boardError } = await supabase
      .from("production_jobs")
      .delete()
      .eq("job_id", id);

    if (boardError) {
      setMovingToDrafting(false);
      setActionError(
        `Job moved to Drafting, but it could not be removed from the production board: ${boardError.message}`
      );
      await load();
      return;
    }

    setMovingToDrafting(false);
    await load();
  }

  async function handleMoveToArchive() {
    if (!job || job.stage === "complete") return;
    setMenuOpen(false);
    if (
      !confirm(
        `Move "${job.name}" to Archive? It will leave the active production board.`
      )
    ) {
      return;
    }

    setMovingToArchive(true);
    setActionError(null);
    const supabase = createClient();

    const { error: stageError } = await supabase
      .from("jobs")
      .update({ stage: "complete" })
      .eq("id", id);

    if (stageError) {
      setMovingToArchive(false);
      setActionError(stageError.message);
      return;
    }

    const { error: boardError } = await supabase
      .from("production_jobs")
      .delete()
      .eq("job_id", id);

    if (boardError) {
      setMovingToArchive(false);
      setActionError(
        `Job archived, but it could not be removed from the production board: ${boardError.message}`
      );
      await load();
      return;
    }

    setMovingToArchive(false);
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
  const customerName = job.contacts ? job.contacts.name : "Unknown";

  const designDone = !!job.design_approved_at;
  const completionPercent = Math.min(
    100,
    Math.max(0, Math.round(((stageIndex + 1) / JOB_ACTIVE_STAGES.length) * 100))
  );

  const contact = job.contacts;
  const infoAddress = job.address?.trim() || contact?.address?.trim() || null;
  const infoPhone = job.phone?.trim() || contact?.phone?.trim() || null;
  const infoEmail = job.email?.trim() || contact?.email?.trim() || null;
  const infoFax = job.fax?.trim() || contact?.fax?.trim() || null;
  const displayField = (value: string | null | undefined) => value?.trim() || "—";
  const alreadyInProduction =
    onProductionBoard ||
    job.stage === "production" ||
    job.stage === "delivery";
  const alreadyInDrafting = job.stage === "design" && !onProductionBoard;
  const alreadyArchived = job.stage === "complete";
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
              <button
                type="button"
                onClick={openRenameJob}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-burgundy"
                aria-label="Rename job"
                title="Rename job"
              >
                <IconPencil size={16} />
              </button>
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
              disabled={
                deleting ||
                sendingToProduction ||
                movingToDrafting ||
                movingToArchive
              }
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
                    onClick={() => void handleMoveToDrafting()}
                    disabled={movingToDrafting || alreadyInDrafting}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <IconRuler2 size={16} className="shrink-0 text-gray-500" />
                    {alreadyInDrafting
                      ? "Already in drafting"
                      : movingToDrafting
                        ? "Moving…"
                        : "Move to Drafting"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSendToProduction()}
                    disabled={
                      sendingToProduction ||
                      alreadyInProduction ||
                      alreadyArchived
                    }
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <IconBuildingFactory size={16} className="shrink-0 text-gray-500" />
                    {alreadyArchived
                      ? "Archived"
                      : alreadyInProduction
                        ? "Already in production"
                        : sendingToProduction
                          ? "Sending…"
                          : "Move to Production"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleMoveToArchive()}
                    disabled={movingToArchive || alreadyArchived}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <IconArchive size={16} className="shrink-0 text-gray-500" />
                    {alreadyArchived
                      ? "Already archived"
                      : movingToArchive
                        ? "Archiving…"
                        : "Move to Archive"}
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
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Job Info
            </h3>
            <button
              type="button"
              onClick={openEditInfo}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-burgundy"
              aria-label="Edit job info"
              title="Edit job info"
            >
              <IconPencil size={16} />
            </button>
          </div>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs text-gray-500">Address</dt>
              <dd className="mt-0.5 text-gray-900">{displayField(infoAddress)}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Phone</dt>
              <dd className="mt-0.5 text-gray-900">{displayField(infoPhone)}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Email</dt>
              <dd className="mt-0.5 text-gray-900">{displayField(infoEmail)}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Fax</dt>
              <dd className="mt-0.5 text-gray-900">{displayField(infoFax)}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Job Contact
            </h3>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void openAddContact();
              }}
              className="text-sm text-burgundy hover:underline"
            >
              {contact ? "+ Change Contact" : "+ Add Contact"}
            </button>
          </div>
          {contact ? (
            <button
              type="button"
              onClick={() => setShowContactDetail(true)}
              className="w-full rounded-md text-left text-sm transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-burgundy/30 -mx-1 px-1 py-1"
            >
              <div className="font-medium text-gray-900">{contact.name}</div>
              {(contact.phone || contact.email) && (
                <div className="mt-0.5 text-xs text-gray-500">
                  {[contact.phone, contact.email].filter(Boolean).join(" · ")}
                </div>
              )}
              {contact.contact_type ? (
                <div className="mt-1 text-xs text-gray-500">
                  {contact.contact_type.replace(/s$/, "")}
                </div>
              ) : null}
            </button>
          ) : (
            <p className="text-sm text-gray-500">No contact yet.</p>
          )}
        </div>
      </div>
        </>
      ) : null}

      {showRenameJob ? (
        <Modal
          title="Rename job"
          onClose={() => {
            if (!savingJobName) setShowRenameJob(false);
          }}
        >
          <form onSubmit={handleSaveJobName} className="space-y-4">
            <p className="text-sm text-gray-600">
              Customer:{" "}
              <span className="font-medium text-gray-900">{customerName}</span>
            </p>
            <div>
              <label className="mb-1 block text-sm font-medium">Job name</label>
              <input
                required
                autoFocus
                value={jobNameDraft}
                onChange={(e) => setJobNameDraft(e.target.value)}
                placeholder="e.g. Jamison Kitchen"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            {renameError ? (
              <p className="text-sm text-red-600">{renameError}</p>
            ) : null}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRenameJob(false)}
                disabled={savingJobName}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingJobName}
                className="rounded-md bg-burgundy px-4 py-2 text-sm font-medium text-white hover:bg-burgundy/90 disabled:opacity-50"
              >
                {savingJobName ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {showEditInfo ? (
        <Modal title="Edit job info" onClose={() => setShowEditInfo(false)}>
          <form onSubmit={handleSaveJobInfo} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Address</label>
              <AddressAutocomplete
                id="job-info-address"
                value={infoForm.address}
                onChange={(address) =>
                  setInfoForm((prev) => ({ ...prev, address }))
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Phone</label>
              <input
                value={infoForm.phone}
                onChange={(e) =>
                  setInfoForm((prev) => ({ ...prev, phone: e.target.value }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Email</label>
              <input
                type="email"
                value={infoForm.email}
                onChange={(e) =>
                  setInfoForm((prev) => ({ ...prev, email: e.target.value }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Fax</label>
              <input
                value={infoForm.fax}
                onChange={(e) =>
                  setInfoForm((prev) => ({ ...prev, fax: e.target.value }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            {infoError ? (
              <p className="text-sm text-red-600">{infoError}</p>
            ) : null}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowEditInfo(false)}
                disabled={savingInfo}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingInfo}
                className="rounded-md bg-burgundy px-4 py-2 text-sm font-medium text-white hover:bg-burgundy/90 disabled:opacity-50"
              >
                {savingInfo ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {showAddContact ? (
        <Modal
          title={contact ? "Change job contact" : "Add job contact"}
          onClose={() => setShowAddContact(false)}
        >
          <form onSubmit={handleSaveJobContact} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Contact</label>
              <ContactSearchSelect
                contacts={allContacts}
                value={selectedContactId}
                required
                onChange={(contactId) => setSelectedContactId(contactId)}
              />
            </div>
            {contactError ? (
              <p className="text-sm text-red-600">{contactError}</p>
            ) : null}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddContact(false)}
                disabled={savingContact}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingContact || !selectedContactId}
                className="rounded-md bg-burgundy px-4 py-2 text-sm font-medium text-white hover:bg-burgundy/90 disabled:opacity-50"
              >
                {savingContact ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {showContactDetail && contact ? (
        <Modal
          title=""
          hideHeader
          onClose={() => setShowContactDetail(false)}
          className="max-h-[92vh] w-full max-w-5xl"
          bodyClassName="overflow-y-auto"
        >
          <ContactDetailPanel
            contactId={contact.id}
            variant="modal"
            onContactUpdated={(updated) =>
              setJob((prev) => (prev ? { ...prev, contacts: updated } : prev))
            }
            onContactDeleted={() => {
              setShowContactDetail(false);
              void load();
            }}
          />
        </Modal>
      ) : null}
    </div>
  );
}
