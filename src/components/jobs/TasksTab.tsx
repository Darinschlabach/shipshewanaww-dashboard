"use client";

import { useMemo, useState } from "react";
import {
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconCircleCheck,
  IconClock,
  IconDots,
  IconFilter,
  IconSearch,
} from "@tabler/icons-react";
import Button from "@/components/Button";
import { getAvatarColor, getInitialsFromName } from "@/lib/utils";

type TaskPhase =
  | "Drafting"
  | "Pre-Production"
  | "Purchasing"
  | "Production"
  | "Delivery";

type TaskStatus =
  | "Not Started"
  | "In Progress"
  | "Waiting"
  | "Completed"
  | "Overdue";

type TaskPriority = "High" | "Medium" | "Low";

interface JobTask {
  id: string;
  title: string;
  description: string;
  phase: TaskPhase;
  assignee: string;
  assigneeIndex: number;
  dueDate: string;
  overdue?: boolean;
  status: TaskStatus;
  priority: TaskPriority;
}

const STATUS_FILTERS: { key: TaskStatus | "all"; label: string; count: number }[] =
  [
    { key: "all", label: "All Tasks", count: 28 },
    { key: "Not Started", label: "Not Started", count: 12 },
    { key: "In Progress", label: "In Progress", count: 8 },
    { key: "Waiting", label: "Waiting", count: 3 },
    { key: "Completed", label: "Completed", count: 18 },
    { key: "Overdue", label: "Overdue", count: 3 },
  ];

const PHASE_STYLES: Record<TaskPhase, string> = {
  Drafting: "bg-blue-50 text-blue-700",
  "Pre-Production": "bg-purple-50 text-purple-700",
  Purchasing: "bg-green-50 text-green-700",
  Production: "bg-yellow-50 text-yellow-800",
  Delivery: "bg-pink-50 text-pink-700",
};

const STATUS_STYLES: Record<TaskStatus, string> = {
  "Not Started": "bg-gray-100 text-gray-700",
  "In Progress": "bg-amber-50 text-amber-700",
  Waiting: "bg-sky-50 text-sky-700",
  Completed: "bg-green-50 text-green-700",
  Overdue: "bg-red-50 text-red-700",
};

const PRIORITY_DOT: Record<TaskPriority, string> = {
  High: "bg-red-500",
  Medium: "bg-amber-500",
  Low: "bg-green-500",
};

const MOCK_TASKS: JobTask[] = [
  {
    id: "1",
    title: "Review and approve final drawings",
    description: "Master vanity and tall cabinet details",
    phase: "Drafting",
    assignee: "Paula Hess",
    assigneeIndex: 0,
    dueDate: "2024-05-18",
    overdue: true,
    status: "Overdue",
    priority: "High",
  },
  {
    id: "2",
    title: "Order cabinet hardware",
    description: "Hinges, pulls, and soft-close slides",
    phase: "Purchasing",
    assignee: "Nathan Yoder",
    assigneeIndex: 1,
    dueDate: "2024-05-24",
    status: "In Progress",
    priority: "Medium",
  },
  {
    id: "3",
    title: "Prepare shop drawings for production",
    description: "Face frames and assembly details",
    phase: "Pre-Production",
    assignee: "Nathan Yoder",
    assigneeIndex: 1,
    dueDate: "2024-05-22",
    status: "In Progress",
    priority: "High",
  },
  {
    id: "4",
    title: "Schedule delivery with client",
    description: "Confirm install window and access",
    phase: "Delivery",
    assignee: "Paula Hess",
    assigneeIndex: 0,
    dueDate: "2024-06-20",
    status: "Not Started",
    priority: "Medium",
  },
  {
    id: "5",
    title: "Cut cabinet components",
    description: "Vanity base and tall cabinet panels",
    phase: "Production",
    assignee: "Jacob Miller",
    assigneeIndex: 2,
    dueDate: "2024-05-28",
    status: "Not Started",
    priority: "High",
  },
  {
    id: "6",
    title: "Confirm countertop template date",
    description: "Coordinate with stone fabricator",
    phase: "Pre-Production",
    assignee: "Paula Hess",
    assigneeIndex: 0,
    dueDate: "2024-05-25",
    status: "Waiting",
    priority: "Medium",
  },
  {
    id: "7",
    title: "Submit change order for approval",
    description: "Added linen cabinet pullouts",
    phase: "Drafting",
    assignee: "Nathan Yoder",
    assigneeIndex: 1,
    dueDate: "2024-05-26",
    status: "Not Started",
    priority: "Low",
  },
  {
    id: "8",
    title: "Receive lumber delivery",
    description: "Maple plywood and melamine sheets",
    phase: "Purchasing",
    assignee: "Ethan Beachy",
    assigneeIndex: 3,
    dueDate: "2024-05-20",
    overdue: true,
    status: "Overdue",
    priority: "High",
  },
];

const TOTAL_TASKS = 28;
const PAGE_SIZE = 8;

function formatDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function PhaseBadge({ phase }: { phase: TaskPhase }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${PHASE_STYLES[phase]}`}
    >
      {phase}
    </span>
  );
}

function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

function PriorityLabel({ priority }: { priority: TaskPriority }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-700">
      <span className={`h-2 w-2 rounded-full ${PRIORITY_DOT[priority]}`} />
      {priority}
    </span>
  );
}

interface TasksTabProps {
  jobId: string;
}

export default function TasksTab({ jobId: _jobId }: TasksTabProps) {
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filteredTasks = useMemo(() => {
    let list = MOCK_TASKS;
    if (statusFilter !== "all") {
      list = list.filter((t) => t.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.assignee.toLowerCase().includes(q)
      );
    }
    return list;
  }, [statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(TOTAL_TASKS / PAGE_SIZE));
  const displayTotal =
    statusFilter === "all" && !search.trim() ? TOTAL_TASKS : filteredTasks.length;

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds(new Set(filteredTasks.map((t) => t.id)));
    } else {
      setSelectedIds(new Set());
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
          <div className="mb-1 flex items-start justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Overdue Tasks
            </span>
            <IconClock size={18} className="text-red-600" />
          </div>
          <p className="text-2xl font-semibold text-red-600">3</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
          <div className="mb-1 flex items-start justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Due Today
            </span>
            <IconCalendar size={18} className="text-amber-600" />
          </div>
          <p className="text-2xl font-semibold text-amber-600">2</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
          <div className="mb-1 flex items-start justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Upcoming (Next 7 Days)
            </span>
            <IconCalendar size={18} className="text-blue-600" />
          </div>
          <p className="text-2xl font-semibold text-blue-600">5</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
          <div className="mb-1 flex items-start justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Completed
            </span>
            <IconCircleCheck size={18} className="text-green-600" />
          </div>
          <p className="text-2xl font-semibold text-green-600">18</p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-2">
        <aside className="flex w-48 shrink-0 flex-col rounded-lg border border-gray-200 bg-white">
          <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-3 py-2">
            <h2 className="text-sm font-semibold text-gray-900">Filters</h2>
            <button
              type="button"
              onClick={() => {
                setStatusFilter("all");
                setSearch("");
                setPage(1);
              }}
              className="text-[10px] text-burgundy hover:underline"
            >
              Clear all
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Status
            </p>
            <ul className="mb-4 space-y-1">
              {STATUS_FILTERS.map(({ key, label, count }) => (
                <li key={key}>
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={statusFilter === key}
                      onChange={() => {
                        setStatusFilter(key);
                        setPage(1);
                      }}
                      className="h-3.5 w-3.5 rounded border-gray-300 text-burgundy focus:ring-burgundy"
                    />
                    <span className="flex-1">{label}</span>
                    <span className="text-gray-400">{count}</span>
                  </label>
                </li>
              ))}
            </ul>

            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Assignee
            </p>
            <select className="mb-4 w-full rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 focus:border-burgundy focus:outline-none focus:ring-1 focus:ring-burgundy">
              <option>All Assignees</option>
              <option>Paula Hess</option>
              <option>Nathan Yoder</option>
              <option>Jacob Miller</option>
              <option>Ethan Beachy</option>
            </select>

            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Phase
            </p>
            <select className="w-full rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 focus:border-burgundy focus:outline-none focus:ring-1 focus:ring-burgundy">
              <option>All Phases</option>
              <option>Drafting</option>
              <option>Pre-Production</option>
              <option>Purchasing</option>
              <option>Production</option>
              <option>Delivery</option>
            </select>
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-3 py-2">
            <h2 className="text-sm font-semibold text-gray-900">Tasks</h2>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <IconSearch
                  size={14}
                  className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="search"
                  placeholder="Search tasks..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="w-40 rounded border border-gray-200 py-1 pl-7 pr-2 text-xs focus:border-burgundy focus:outline-none focus:ring-1 focus:ring-burgundy"
                />
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
              >
                <IconFilter size={14} />
                Filter
              </button>
              <Button variant="primary" className="!px-2.5 !py-1 !text-xs">
                + New task
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="sticky top-0 z-10 bg-gray-50">
                <tr className="border-b border-gray-200 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                  <th className="w-8 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={
                        filteredTasks.length > 0 &&
                        filteredTasks.every((t) => selectedIds.has(t.id))
                      }
                      onChange={(e) => toggleSelectAll(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-gray-300 text-burgundy focus:ring-burgundy"
                    />
                  </th>
                  <th className="px-3 py-2 font-medium">Task</th>
                  <th className="px-3 py-2 font-medium">Phase</th>
                  <th className="px-3 py-2 font-medium">Assignee</th>
                  <th className="px-3 py-2 font-medium">Due Date</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Priority</th>
                  <th className="w-8 px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((task) => (
                  <tr
                    key={task.id}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50/80"
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(task.id)}
                        onChange={() => toggleSelect(task.id)}
                        className="h-3.5 w-3.5 rounded border-gray-300 text-burgundy focus:ring-burgundy"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <p className="font-medium text-gray-900">{task.title}</p>
                      <p className="text-[10px] text-gray-500">
                        {task.description}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      <PhaseBadge phase={task.phase} />
                    </td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2">
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${getAvatarColor(task.assigneeIndex)}`}
                        >
                          {getInitialsFromName(task.assignee)}
                        </span>
                        <span className="text-gray-800">{task.assignee}</span>
                      </span>
                    </td>
                    <td
                      className={`px-3 py-2 whitespace-nowrap ${
                        task.overdue
                          ? "font-medium text-red-600"
                          : "text-gray-600"
                      }`}
                    >
                      {formatDate(task.dueDate)}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={task.status} />
                    </td>
                    <td className="px-3 py-2">
                      <PriorityLabel priority={task.priority} />
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        aria-label={`Actions for ${task.title}`}
                      >
                        <IconDots size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-3 py-2">
            <p className="text-[10px] text-gray-500">
              Showing {(page - 1) * PAGE_SIZE + 1} to{" "}
              {Math.min(page * PAGE_SIZE, displayTotal)} of {displayTotal} tasks
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="flex h-7 w-7 items-center justify-center rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                aria-label="Previous page"
              >
                <IconChevronLeft size={16} />
              </button>
              {[1, 2, 3].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={`flex h-7 min-w-[1.75rem] items-center justify-center rounded border px-1.5 text-xs ${
                    page === p
                      ? "border-burgundy bg-burgundy text-white"
                      : "border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {p}
                </button>
              ))}
              <span className="px-0.5 text-xs text-gray-400">…</span>
              <button
                type="button"
                onClick={() => setPage(4)}
                className={`flex h-7 min-w-[1.75rem] items-center justify-center rounded border px-1.5 text-xs ${
                  page === 4
                    ? "border-burgundy bg-burgundy text-white"
                    : "border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
              >
                4
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="flex h-7 w-7 items-center justify-center rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                aria-label="Next page"
              >
                <IconChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
