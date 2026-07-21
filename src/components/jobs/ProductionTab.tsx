"use client";

import { FormEvent, Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  IconCalendar,
  IconDots,
  IconDownload,
  IconPencil,
  IconTrash,
} from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/Button";
import Modal from "@/components/Modal";
import type { ProductionTask, Room } from "@/lib/types";
import { DRAFTING_FOR_MISC } from "@/lib/types";
import { roomPillStyle } from "@/lib/room-pill-style";

interface ProductionReminder {
  id: string;
  text: string;
  dueDate: string;
  completed: boolean;
}

interface ProductionDocument {
  id: string;
  name: string;
  addedOn: string;
}

const SPECIAL_ROOM_FILTERS = [DRAFTING_FOR_MISC] as const;

const MOCK_REMINDERS: ProductionReminder[] = [
  {
    id: "1",
    text: "Cut all cabinet components",
    dueDate: "2024-05-25",
    completed: false,
  },
  {
    id: "2",
    text: "Edge band all parts",
    dueDate: "2024-05-26",
    completed: false,
  },
  {
    id: "3",
    text: "Pre-assemble vanity cabinets",
    dueDate: "2024-05-27",
    completed: false,
  },
  {
    id: "4",
    text: "Sand and prep for finish",
    dueDate: "2024-05-28",
    completed: false,
  },
  {
    id: "5",
    text: "Apply first coat of finish",
    dueDate: "2024-05-29",
    completed: false,
  },
  {
    id: "6",
    text: "Final assembly and hardware install",
    dueDate: "2024-05-30",
    completed: false,
  },
];

const MOCK_DOCUMENTS: ProductionDocument[] = [
  { id: "1", name: "Face Frames Drawings", addedOn: "2024-05-20" },
  { id: "2", name: "Assembly Drawings", addedOn: "2024-05-20" },
  { id: "3", name: "Parts List", addedOn: "2024-05-18" },
  { id: "4", name: "Appliance Specs", addedOn: "2024-05-15" },
];

function formatDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function Pill({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${className}`}
    >
      {label}
    </span>
  );
}

function taskToRoomSelection(task: ProductionTask, rooms: Room[]): string {
  if (task.for_room === DRAFTING_FOR_MISC) {
    return DRAFTING_FOR_MISC;
  }
  if (task.room_id) {
    return `room:${task.room_id}`;
  }
  const room = rooms.find((r) => r.name === task.for_room);
  return room ? `room:${room.id}` : "";
}

function parseRoomSelection(
  roomSelection: string,
  rooms: Room[],
): { room_id: string | null; for_room: string } | null {
  if (roomSelection === DRAFTING_FOR_MISC) {
    return { room_id: null, for_room: DRAFTING_FOR_MISC };
  }
  if (roomSelection.startsWith("room:")) {
    const roomId = roomSelection.slice(5);
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return null;
    return { room_id: room.id, for_room: room.name };
  }
  return null;
}

function taskMatchesFilter(  task: ProductionTask,
  filterKey: string,
  rooms: Room[],
) {
  if (filterKey === "all") return true;
  if (filterKey === DRAFTING_FOR_MISC) {
    return task.for_room === DRAFTING_FOR_MISC;
  }
  const room = rooms.find((r) => r.id === filterKey);
  if (!room) return false;
  return task.room_id === room.id || task.for_room === room.name;
}

interface ProductionTabProps {
  jobId: string;
}

export default function ProductionTab({ jobId }: ProductionTabProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [tasks, setTasks] = useState<ProductionTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [roomFilter, setRoomFilter] = useState("all");
  const [hideCompleted, setHideCompleted] = useState(false);
  const [reminders, setReminders] = useState(MOCK_REMINDERS);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<ProductionTask | null>(null);
  const [savingTask, setSavingTask] = useState(false);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [taskForm, setTaskForm] = useState({
    subject: "",
    details: "",
    roomSelection: "",
    dueDate: todayIso(),
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [roomsRes, tasksRes] = await Promise.all([
      supabase
        .from("rooms")
        .select("*")
        .eq("job_id", jobId)
        .order("created_at", { ascending: true }),
      supabase
        .from("production_tasks")
        .select("*")
        .eq("job_id", jobId)
        .order("due_date", { ascending: true }),
    ]);

    setRooms((roomsRes.data as Room[]) ?? []);
    setTasks((tasksRes.data as ProductionTask[]) ?? []);
    setLoading(false);
  }, [jobId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const roomFilters = useMemo(() => {
    const items: { key: string; label: string }[] = [{ key: "all", label: "All" }];
    for (const label of SPECIAL_ROOM_FILTERS) {
      items.push({ key: label, label });
    }
    for (const room of rooms) {
      items.push({ key: room.id, label: room.name });
    }
    return items;
  }, [rooms]);

  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = { all: tasks.length };
    for (const { key } of roomFilters) {
      if (key === "all") continue;
      counts[key] = tasks.filter((task) =>
        taskMatchesFilter(task, key, rooms),
      ).length;
    }
    return counts;
  }, [roomFilters, rooms, tasks]);

  const visibleTasks = useMemo(() => {
    const filtered = tasks.filter((task) =>
      taskMatchesFilter(task, roomFilter, rooms),
    );
    const incomplete = filtered.filter((task) => !task.completed);
    const complete = filtered.filter((task) => task.completed);
    return hideCompleted ? incomplete : [...incomplete, ...complete];
  }, [roomFilter, rooms, hideCompleted, tasks]);

  const roomSelectOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [
      { value: DRAFTING_FOR_MISC, label: DRAFTING_FOR_MISC },
    ];
    for (const room of rooms) {
      options.push({ value: `room:${room.id}`, label: room.name });
    }
    return options;
  }, [rooms]);

  function openNewTaskModal() {
    setEditingTask(null);
    setTaskForm({
      subject: "",
      details: "",
      roomSelection: "",
      dueDate: todayIso(),
    });
    setShowTaskModal(true);
  }

  function openEditTaskModal(task: ProductionTask) {
    setEditingTask(task);
    setTaskForm({
      subject: task.subject,
      details: task.details ?? "",
      roomSelection: taskToRoomSelection(task, rooms),
      dueDate: task.due_date,
    });
    setShowTaskModal(true);
  }

  function toggleTaskExpanded(task: ProductionTask) {
    setExpandedTaskId((current) => (current === task.id ? null : task.id));
  }

  async function handleSaveTask(e: FormEvent) {
    e.preventDefault();
    const subject = taskForm.subject.trim();
    if (!subject || !taskForm.roomSelection || !taskForm.dueDate) return;

    const parsed = parseRoomSelection(taskForm.roomSelection, rooms);
    if (!parsed) return;

    const details = taskForm.details.trim() || null;

    setSavingTask(true);
    const supabase = createClient();

    if (editingTask) {
      const { data, error } = await supabase
        .from("production_tasks")
        .update({
          room_id: parsed.room_id,
          for_room: parsed.for_room,
          subject,
          details,
          due_date: taskForm.dueDate,
        })
        .eq("id", editingTask.id)
        .select("*")
        .single();

      setSavingTask(false);

      if (!error && data) {
        setTasks((prev) =>
          prev.map((task) =>
            task.id === editingTask.id ? (data as ProductionTask) : task,
          ),
        );
        setShowTaskModal(false);
        setEditingTask(null);
        setTaskForm({
          subject: "",
          details: "",
          roomSelection: "",
          dueDate: todayIso(),
        });
      }
      return;
    }

    const { data, error } = await supabase
      .from("production_tasks")
      .insert({
        job_id: jobId,
        room_id: parsed.room_id,
        for_room: parsed.for_room,
        subject,
        details,
        due_date: taskForm.dueDate,
        completed: false,
      })
      .select("*")
      .single();

    setSavingTask(false);

    if (!error && data) {
      setTasks((prev) => [data as ProductionTask, ...prev]);
      setShowTaskModal(false);
      setTaskForm({
        subject: "",
        details: "",
        roomSelection: "",
        dueDate: todayIso(),
      });
    }
  }

  async function handleDeleteTask(task: ProductionTask) {
    setDeletingTaskId(task.id);
    const supabase = createClient();
    const { error } = await supabase
      .from("production_tasks")
      .delete()
      .eq("id", task.id);

    setDeletingTaskId(null);

    if (!error) {
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
      if (expandedTaskId === task.id) {
        setExpandedTaskId(null);
      }
    }
  }

  function toggleReminder(id: string) {
    setReminders((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, completed: !r.completed } : r
      )
    );
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-2 xl:grid-cols-3">
      <div className="flex min-h-0 flex-col gap-2 xl:col-span-2">
        <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white px-3 py-2.5">
          <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-900">
              Production Tasks
            </h2>
            <div className="flex shrink-0 items-center gap-2">
              <label className="flex cursor-pointer items-center gap-1.5 rounded border border-gray-300 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={hideCompleted}
                  onChange={(e) => setHideCompleted(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-gray-300 text-burgundy focus:ring-burgundy"
                />
                Hide completed
              </label>
              <Button
                type="button"
                variant="primary"
                className="!px-2.5 !py-1 !text-xs"
                onClick={openNewTaskModal}
              >
                + Add task
              </Button>            </div>
          </div>

          <div className="mb-2 flex shrink-0 flex-wrap gap-3 border-b border-gray-200 text-xs">
            {roomFilters.map(({ key, label }) => {
              const active = roomFilter === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setRoomFilter(key)}
                  className={`pb-1.5 ${
                    active
                      ? "border-b-2 border-burgundy font-medium text-burgundy"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {label} ({filterCounts[key] ?? 0})
                </button>
              );
            })}
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            {loading ? (
              <p className="py-4 text-xs text-gray-500">Loading tasks…</p>
            ) : visibleTasks.length === 0 ? (
              <p className="py-4 text-xs text-gray-500">
                {hideCompleted
                  ? "No open tasks."
                  : roomFilter !== "all"
                    ? "No tasks in this category."
                    : "No tasks yet. Add one to get started."}
              </p>
            ) : (            <table className="w-full min-w-[360px] text-left text-xs">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="border-b border-gray-200 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                  <th className="pb-1.5 pr-3 font-medium">Subject</th>
                  <th className="pb-1.5 pr-3 font-medium">Room / Area</th>
                  <th className="pb-1.5 pr-3 font-medium">Due Date</th>
                  <th className="pb-1.5 w-16" />
                </tr>
              </thead>
              <tbody>
                {visibleTasks.map((task) => (
                  <Fragment key={task.id}>
                    <tr
                      className={`group border-b border-gray-100 last:border-0 ${
                        task.completed ? "bg-green-50" : ""
                      }`}
                    >
                      <td
                        className="cursor-pointer py-1.5 pr-3 font-medium text-gray-900"
                        onClick={() => toggleTaskExpanded(task)}
                      >
                        {task.subject}
                      </td>
                      <td
                        className="cursor-pointer py-1.5 pr-3"
                        onClick={() => toggleTaskExpanded(task)}
                      >
                        <Pill
                          label={task.for_room}
                          className={roomPillStyle(task.for_room)}
                        />
                      </td>
                      <td
                        className="cursor-pointer py-1.5 pr-3 whitespace-nowrap text-gray-600"
                        onClick={() => toggleTaskExpanded(task)}
                      >
                        {formatDate(task.due_date)}
                      </td>
                      <td className="py-1.5">
                        <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditTaskModal(task);
                            }}
                            className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-burgundy"
                            aria-label="Edit task"
                          >
                            <IconPencil size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleDeleteTask(task);
                            }}
                            disabled={deletingTaskId === task.id}
                            className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-red-600 disabled:opacity-50"
                            aria-label="Delete task"
                          >
                            <IconTrash size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedTaskId === task.id && (
                      <tr
                        className={`border-b border-gray-100 ${
                          task.completed ? "bg-green-50" : ""
                        }`}
                      >
                        <td colSpan={4} className="pb-3 pt-1">
                          <div
                            className={`rounded-md border p-3 ${
                              task.completed
                                ? "border-green-200 bg-white/60"
                                : "border-gray-200 bg-gray-50"
                            }`}
                          >
                            <label
                              className={`mb-1 block text-[11px] font-medium ${
                                task.completed ? "text-green-800" : "text-gray-600"
                              }`}
                            >
                              Details
                            </label>
                            <p className="whitespace-pre-wrap text-xs text-gray-800">
                              {task.details?.trim() || "No details provided."}
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
            )}
          </div>        </div>
      </div>

      <div className="flex min-h-0 flex-col gap-2 xl:col-span-1">
        <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white px-3 py-2.5">
          <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-900">
              Production Reminders
            </h2>
            <Button variant="primary" className="!px-2.5 !py-1 !text-xs shrink-0">
              + Add reminder
            </Button>
          </div>
          <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
            {reminders.map((reminder) => (
              <li
                key={reminder.id}
                className="flex items-start gap-2 border-b border-gray-100 pb-1.5 last:border-0 last:pb-0"
              >
                <input
                  type="checkbox"
                  checked={reminder.completed}
                  onChange={() => toggleReminder(reminder.id)}
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-gray-300 text-burgundy focus:ring-burgundy"
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-xs leading-snug ${
                      reminder.completed
                        ? "text-gray-400 line-through"
                        : "text-gray-900"
                    }`}
                  >
                    {reminder.text}
                  </p>
                  <p className="mt-0.5 flex items-center gap-0.5 text-[10px] text-gray-500">
                    <IconCalendar size={12} />
                    {formatDate(reminder.dueDate)}
                  </p>
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  aria-label="Reminder actions"
                >
                  <IconDots size={16} />
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex shrink-0 flex-col rounded-lg border border-gray-200 bg-white px-3 py-2.5">
          <h2 className="mb-2 text-sm font-semibold text-gray-900">
            Production Documents
          </h2>
          <ul className="space-y-1">
            {MOCK_DOCUMENTS.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center justify-between gap-2 rounded border border-gray-100 px-2 py-1.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-gray-900">
                    {doc.name}
                  </p>
                  <p className="text-[10px] text-gray-500">
                    Added {formatDate(doc.addedOn)}
                  </p>
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-burgundy"
                  aria-label={`Download ${doc.name}`}
                >
                  <IconDownload size={16} />
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="mt-2 w-full rounded border border-dashed border-gray-300 py-1.5 text-xs text-gray-600 hover:border-burgundy hover:text-burgundy"
          >
            Upload document
          </button>
        </div>
      </div>

      {showTaskModal && (
        <Modal
          title={editingTask ? "Edit task" : "New task"}
          onClose={() => {
            if (!savingTask) setShowTaskModal(false);
          }}
        >
          <form onSubmit={(e) => void handleSaveTask(e)} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Subject</label>
              <input
                required
                type="text"
                value={taskForm.subject}
                onChange={(e) =>
                  setTaskForm((prev) => ({ ...prev, subject: e.target.value }))
                }                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                placeholder="Task name…"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Room</label>
              <select
                required
                value={taskForm.roomSelection}
                onChange={(e) =>
                  setTaskForm((prev) => ({
                    ...prev,
                    roomSelection: e.target.value,
                  }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Select a room…</option>
                {roomSelectOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {rooms.length === 0 && (
                <p className="mt-1 text-xs text-gray-500">
                  No rooms in Job Specs yet. You can still choose Misc.
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Details</label>
              <textarea
                rows={4}
                value={taskForm.details}
                onChange={(e) =>
                  setTaskForm((prev) => ({ ...prev, details: e.target.value }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                placeholder="Add task details…"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Due date</label>
              <input
                required
                type="date"
                value={taskForm.dueDate}
                onChange={(e) =>
                  setTaskForm((prev) => ({ ...prev, dueDate: e.target.value }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                onClick={() => setShowTaskModal(false)}
                disabled={savingTask}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={savingTask}>
                {savingTask
                  ? "Saving…"
                  : editingTask
                    ? "Save changes"
                    : "Add task"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}