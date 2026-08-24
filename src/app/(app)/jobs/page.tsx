"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  IconBriefcase,
  IconChevronRight,
  IconColumns3,
  IconFilter,
  IconFolder,
  IconRefresh,
  IconSearch,
  IconTrash,
  IconUser,
  IconUsers,
} from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/async";
import PageHeader from "@/components/PageHeader";
import ConfirmModal from "@/components/ConfirmModal";
import FilterBar from "@/components/FilterBar";
import JobStageBadge from "@/components/JobStageBadge";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import {
  formatCurrencyFull,
  formatDateLong,
  formatRelativeTime,
} from "@/lib/utils";
import {
  isJobAwaitingApproval,
  isJobInProgress,
} from "@/lib/jobs";
import {
  JOB_ACTIVE_STAGES,
  JOB_STAGE_LABELS,
  type Job,
  JobStage,
  Contact,
} from "@/lib/types";

const FILTERS = [
  { value: "all", label: "All" },
  ...JOB_ACTIVE_STAGES.filter((stage) => stage !== "complete").map((stage) => ({
    value: stage,
    label: JOB_STAGE_LABELS[stage],
  })),
];

const STAGE_OPTIONS = [
  { value: "", label: "Stage" },
  ...FILTERS.filter((f) => f.value !== "all"),
];

const selectClass =
  "rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-burgundy focus:outline-none focus:ring-1 focus:ring-burgundy";

type JobRow = Job & { contacts: Contact | null };

export default function JobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [boardStatusByJobId, setBoardStatusByJobId] = useState<
    Record<string, string>
  >({});
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [deleteJob, setDeleteJob] = useState<JobRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    customer: true,
    stage: true,
    due: true,
    value: true,
    updated: true,
  });
  const [form, setForm] = useState({
    name: "",
    customer_id: "",
    stage: "design" as JobStage,
    total_value: "",
    due_date: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const [{ data: jobsData }, { data: contactsData }, { data: boardData }] =
        await withTimeout(
          Promise.all([
            supabase
              .from("jobs")
              .select("*, contacts(*)")
              .order("updated_at", { ascending: false }),
            supabase.from("contacts").select("*").order("name"),
            supabase.from("production_jobs").select("job_id, kanban_status"),
          ]),
          12_000,
          "Jobs list"
        );
      setJobs((jobsData as JobRow[]) ?? []);
      setContacts((contactsData as Contact[]) ?? []);
      setBoardStatusByJobId(
        Object.fromEntries(
          ((boardData as { job_id: string; kanban_status: string }[]) ?? []).map(
            (row) => [row.job_id, row.kanban_status]
          )
        )
      );
    } catch (err) {
      console.error("Jobs load failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const activeJobs = jobs.filter((j) => j.stage !== "complete");
    const archivedJobs = jobs.filter((j) => j.stage === "complete");
    const totalValue = activeJobs.reduce(
      (sum, job) => sum + Number(job.total_value),
      0
    );
    return {
      total: activeJobs.length,
      inProgress: activeJobs.filter(isJobInProgress).length,
      awaitingApproval: activeJobs.filter(isJobAwaitingApproval).length,
      archived: archivedJobs.length,
      totalValue,
    };
  }, [jobs]);

  const archivedJobs = useMemo(
    () =>
      jobs
        .filter((j) => j.stage === "complete")
        .sort(
          (a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        ),
    [jobs]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const activeStage = stageFilter || (filter === "all" ? "" : filter);

    return jobs.filter((job) => {
      if (job.stage === "complete") return false;
      if (activeStage) {
        const matchesStage =
          job.stage === activeStage ||
          (activeStage === "production" && job.stage === "delivery");
        if (!matchesStage) return false;
      }
      if (customerFilter && job.customer_id !== customerFilter) return false;
      if (
        q &&
        !job.name.toLowerCase().includes(q) &&
        !(job.contacts?.name.toLowerCase().includes(q) ?? false)
      ) {
        return false;
      }
      return true;
    });
  }, [jobs, search, filter, stageFilter, customerFilter]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    const { data: job } = await supabase
      .from("jobs")
      .insert({
        name: form.name,
        customer_id: form.customer_id || null,
        stage: form.stage,
        total_value: parseFloat(form.total_value) || 0,
        due_date: form.due_date || null,
      })
      .select()
      .single();

    if (job) {
      if (form.stage === "production") {
        await supabase.from("production_jobs").insert({
          job_id: job.id,
          kanban_status: "queued",
          due_date: form.due_date || null,
        });
      }
      void fetch(
        `/api/jobs/${encodeURIComponent(job.id)}/sharepoint/ensure-folder`,
        { method: "POST" }
      ).catch(() => {
        /* Files tab retries ensure-folder */
      });
      setShowModal(false);
      router.push(`/jobs/${job.id}`);
    }
  }

  async function handleDeleteJob() {
    if (!deleteJob) return;
    setDeleting(true);
    const supabase = createClient();

    await fetch(
      `/api/invoices?job_id=${encodeURIComponent(deleteJob.id)}`,
      { method: "DELETE" }
    );

    const { error } = await supabase
      .from("jobs")
      .delete()
      .eq("id", deleteJob.id);

    if (!error) {
      setDeleteJob(null);
      await load();
    }

    setDeleting(false);
  }

  function toggleColumn(key: keyof typeof visibleColumns) {
    setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const statItems: {
    icon: typeof IconBriefcase;
    value: string | number;
    label: string;
    action?: { label: string; onClick: () => void };
  }[] = [
    { icon: IconBriefcase, value: stats.total, label: "Total jobs" },
    { icon: IconUsers, value: stats.inProgress, label: "In progress" },
    { icon: IconUser, value: stats.awaitingApproval, label: "Awaiting approval" },
    {
      icon: IconRefresh,
      value: stats.archived,
      label: "Archived",
      action: {
        label: "Open Archive",
        onClick: () => setShowArchiveModal(true),
      },
    },
    {
      icon: IconFolder,
      value: formatCurrencyFull(stats.totalValue),
      label: "Total value",
    },
  ];

  return (
    <>
      <div className="-m-5 flex h-[100vh] flex-col overflow-hidden">
        <div className="shrink-0 space-y-4 bg-white p-5 pb-4">
          <PageHeader
            title="Jobs"
            actionLabel="+ New job"
            onAction={() => setShowModal(true)}
          />

          <FilterBar
            options={FILTERS}
            activeOption={filter}
            onChange={(value) => {
              setFilter(value);
              setStageFilter("");
            }}
          />

          <div className="flex flex-wrap overflow-hidden rounded-lg border border-gray-200 bg-cream">
            {statItems.map(({ icon: Icon, value, label, action }, idx) => (
              <div
                key={label}
                className={`flex min-w-[150px] flex-1 items-center gap-3 px-5 py-4 ${
                  idx < statItems.length - 1 ? "border-r border-gray-200" : ""
                }`}
              >
                <Icon size={20} className="shrink-0 text-gray-400" stroke={1.5} />
                <div className="flex min-h-[3.25rem] flex-1 flex-col">
                  <p className="text-lg font-semibold text-gray-900">{value}</p>
                  <p className="text-xs text-gray-500">{label}</p>
                  {action ? (
                    <button
                      type="button"
                      onClick={action.onClick}
                      className="mt-auto self-end text-xs font-medium text-burgundy underline hover:text-burgundy/80"
                    >
                      {action.label}
                    </button>
                  ) : (
                    <p className="text-xs font-medium text-transparent">.</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <IconSearch
                size={18}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="search"
                placeholder="Search jobs…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-md border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-burgundy focus:outline-none focus:ring-1 focus:ring-burgundy"
              />
            </div>

            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className={selectClass}
            >
              {STAGE_OPTIONS.map((opt) => (
                <option key={opt.value || "all-stages"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <select
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className={selectClass}
            >
              <option value="">All customers</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <IconFilter size={16} />
              Filters
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowColumns((v) => !v)}
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <IconColumns3 size={16} />
                Columns
              </button>
              {showColumns && (
                <div className="absolute right-0 z-10 mt-1 w-44 rounded-md border border-gray-200 bg-white py-2 shadow-lg">
                  {(
                    [
                      ["customer", "Customer"],
                      ["stage", "Stage"],
                      ["due", "Delivery Date"],
                      ["value", "Value"],
                      ["updated", "Updated"],
                    ] as const
                  ).map(([key, label]) => (
                    <label
                      key={key}
                      className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={visibleColumns[key]}
                        onChange={() => toggleColumn(key)}
                        className="rounded border-gray-300"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          {loading ? (
            <p className="text-gray-500">Loading…</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                    Job
                  </th>
                  {visibleColumns.customer && (
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                      Customer
                    </th>
                  )}
                  {visibleColumns.stage && (
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                      Stage
                    </th>
                  )}
                  {visibleColumns.due && (
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                      Delivery Date
                    </th>
                  )}
                  {visibleColumns.value && (
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                      Value
                    </th>
                  )}
                  {visibleColumns.updated && (
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                      Updated
                    </th>
                  )}
                  <th className="w-10 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((job) => (
                  <tr
                    key={job.id}
                    onClick={() => router.push(`/jobs/${job.id}`)}
                    className="group cursor-pointer border-b border-gray-100 transition-colors hover:bg-gray-50"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 font-medium text-gray-900">
                        <IconFolder
                          size={18}
                          className="shrink-0 text-burgundy"
                          stroke={1.5}
                        />
                        {job.name}
                      </div>
                    </td>
                    {visibleColumns.customer && (
                      <td className="px-4 py-3 text-gray-600">
                        {job.contacts ? job.contacts.name : "—"}
                      </td>
                    )}
                    {visibleColumns.stage && (
                      <td className="px-4 py-3">
                        <JobStageBadge
                          job={job}
                          kanbanStatus={boardStatusByJobId[job.id]}
                        />
                      </td>
                    )}
                    {visibleColumns.due && (
                      <td className="px-4 py-3 text-gray-600">
                        {formatDateLong(job.due_date)}
                      </td>
                    )}
                    {visibleColumns.value && (
                      <td className="px-4 py-3 text-gray-900">
                        {formatCurrencyFull(Number(job.total_value))}
                      </td>
                    )}
                    {visibleColumns.updated && (
                      <td className="px-4 py-3 text-gray-600">
                        {formatRelativeTime(job.updated_at)}
                      </td>
                    )}
                    <td className="w-10 px-4 py-3">
                      <div className="relative ml-auto h-[18px] w-[18px]">
                        <IconChevronRight
                          size={18}
                          className="absolute inset-0 text-gray-400 transition-opacity group-hover:opacity-0"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteJob(job);
                          }}
                          className="absolute inset-0 inline-flex items-center justify-center text-red-500 opacity-0 transition-opacity pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto hover:text-red-600"
                          aria-label={`Delete ${job.name}`}
                        >
                          <IconTrash size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-sm text-gray-500"
                    >
                      No jobs match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          )}
        </div>
      </div>

      {showModal && (
        <Modal title="New job" onClose={() => setShowModal(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Job name</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Customer</label>
              <select
                value={form.customer_id}
                onChange={(e) =>
                  setForm({ ...form, customer_id: e.target.value })
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">— Select —</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Stage</label>
              <select
                value={form.stage}
                onChange={(e) =>
                  setForm({ ...form, stage: e.target.value as JobStage })
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                {FILTERS.filter((f) => f.value !== "all").map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Total value</label>
              <input
                type="number"
                value={form.total_value}
                onChange={(e) =>
                  setForm({ ...form, total_value: e.target.value })
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Delivery date</label>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) =>
                  setForm({ ...form, due_date: e.target.value })
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Create job
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {deleteJob && (
        <ConfirmModal
          title="Delete job?"
          body={`Delete "${deleteJob.name}"? Related production and purchase records will also be removed. This cannot be undone.`}
          confirmLabel="Delete"
          loading={deleting}
          onConfirm={handleDeleteJob}
          onCancel={() => setDeleteJob(null)}
        />
      )}

      {showArchiveModal && (
        <Modal
          title="Archive"
          onClose={() => setShowArchiveModal(false)}
          className="max-h-[85vh] w-full max-w-4xl"
        >
          {archivedJobs.length === 0 ? (
            <p className="text-sm text-gray-500">No archived jobs yet.</p>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <p className="text-sm text-gray-600">
                {archivedJobs.length} archived job
                {archivedJobs.length !== 1 ? "s" : ""}
              </p>
              <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-gray-200">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-gray-50">
                    <tr className="border-b border-gray-200">
                      <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                        Job
                      </th>
                      <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                        Customer
                      </th>
                      <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                        Value
                      </th>
                      <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                        Archived
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {archivedJobs.map((job) => (
                      <tr
                        key={job.id}
                        onClick={() => {
                          setShowArchiveModal(false);
                          router.push(`/jobs/${job.id}`);
                        }}
                        className="cursor-pointer border-b border-gray-100 transition-colors hover:bg-gray-50"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 font-medium text-gray-900">
                            <IconFolder
                              size={18}
                              className="shrink-0 text-burgundy"
                              stroke={1.5}
                            />
                            {job.name}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {job.contacts ? job.contacts.name : "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-900">
                          {formatCurrencyFull(Number(job.total_value))}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {formatRelativeTime(job.updated_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
