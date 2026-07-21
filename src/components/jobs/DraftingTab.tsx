"use client";

import { FormEvent, Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { IconCalendar, IconDots, IconPencil, IconTrash } from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/Button";
import Modal from "@/components/Modal";
import type { DraftingQuestion, Room } from "@/lib/types";
import {
  DRAFTING_FOR_ALL_ROOMS,
  DRAFTING_FOR_MISC,
} from "@/lib/types";
import { roomPillStyle } from "@/lib/room-pill-style";

interface DraftingReminder {
  id: string;
  text: string;
  dueDate: string;
  completed: boolean;
}

const MOCK_REMINDERS: DraftingReminder[] = [
  {
    id: "1",
    text: "Confirm all dimensions with Brent",
    dueDate: "2024-05-21",
    completed: false,
  },
  {
    id: "2",
    text: "Verify plumbing and electrical locations",
    dueDate: "2024-05-18",
    completed: false,
  },
  {
    id: "3",
    text: "Client meeting for lighting and mirror",
    dueDate: "2024-05-24",
    completed: false,
  },
  {
    id: "4",
    text: "Follow up on hardware selection",
    dueDate: "2024-05-17",
    completed: false,
  },
];

const SPECIAL_ROOM_FILTERS = [DRAFTING_FOR_MISC] as const;

function formatAskedOn(iso: string) {
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

function questionMatchesFilter(
  question: DraftingQuestion,
  filterKey: string,
  rooms: Room[],
) {
  if (filterKey === "all") return true;
  if (filterKey === DRAFTING_FOR_ALL_ROOMS || filterKey === DRAFTING_FOR_MISC) {
    return question.for_room === filterKey;
  }
  const room = rooms.find((r) => r.id === filterKey);
  if (!room) return false;
  return question.room_id === room.id || question.for_room === room.name;
}

function questionToRoomSelection(
  question: DraftingQuestion,
  rooms: Room[],
): string {
  if (question.for_room === DRAFTING_FOR_ALL_ROOMS) {
    return DRAFTING_FOR_ALL_ROOMS;
  }
  if (question.for_room === DRAFTING_FOR_MISC) {
    return DRAFTING_FOR_MISC;
  }
  if (question.room_id) {
    return `room:${question.room_id}`;
  }
  const room = rooms.find((r) => r.name === question.for_room);
  return room ? `room:${room.id}` : "";
}

function parseRoomSelection(
  roomSelection: string,
  rooms: Room[],
): { room_id: string | null; for_room: string } | null {
  if (roomSelection === DRAFTING_FOR_ALL_ROOMS) {
    return { room_id: null, for_room: DRAFTING_FOR_ALL_ROOMS };
  }
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

interface DraftingTabProps {
  jobId: string;
}

export default function DraftingTab({ jobId }: DraftingTabProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [questions, setQuestions] = useState<DraftingQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [roomFilter, setRoomFilter] = useState("all");
  const [hideAnswered, setHideAnswered] = useState(false);
  const [reminders, setReminders] = useState(MOCK_REMINDERS);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<DraftingQuestion | null>(
    null,
  );
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [deletingQuestionId, setDeletingQuestionId] = useState<string | null>(
    null,
  );
  const [questionForm, setQuestionForm] = useState({
    question: "",
    roomSelection: "",
  });
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(
    null,
  );
  const [answerDraft, setAnswerDraft] = useState("");
  const [editingAnswerId, setEditingAnswerId] = useState<string | null>(null);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [submittingAnswerId, setSubmittingAnswerId] = useState<string | null>(
    null,
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [roomsRes, questionsRes] = await Promise.all([
      supabase
        .from("rooms")
        .select("*")
        .eq("job_id", jobId)
        .order("created_at", { ascending: true }),
      supabase
        .from("drafting_questions")
        .select("*")
        .eq("job_id", jobId)
        .order("asked_on", { ascending: false }),
    ]);

    setRooms((roomsRes.data as Room[]) ?? []);
    setQuestions((questionsRes.data as DraftingQuestion[]) ?? []);
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

  const visibleQuestions = useMemo(() => {
    const filtered = questions.filter((q) =>
      questionMatchesFilter(q, roomFilter, rooms),
    );
    const sortByAskedOn = (a: DraftingQuestion, b: DraftingQuestion) =>
      new Date(b.asked_on).getTime() - new Date(a.asked_on).getTime();
    const open = filtered.filter((q) => q.status === "open").sort(sortByAskedOn);
    const answered = filtered
      .filter((q) => q.status === "answered")
      .sort(sortByAskedOn);
    return hideAnswered ? open : [...open, ...answered];
  }, [questions, roomFilter, rooms, hideAnswered]);

  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = { all: questions.length };
    for (const { key } of roomFilters) {
      if (key === "all") continue;
      counts[key] = questions.filter((q) =>
        questionMatchesFilter(q, key, rooms),
      ).length;
    }
    return counts;
  }, [questions, roomFilters, rooms]);

  const roomSelectOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [
      { value: DRAFTING_FOR_MISC, label: DRAFTING_FOR_MISC },
    ];
    if (editingQuestion?.for_room === DRAFTING_FOR_ALL_ROOMS) {
      options.unshift({
        value: DRAFTING_FOR_ALL_ROOMS,
        label: DRAFTING_FOR_ALL_ROOMS,
      });
    }
    for (const room of rooms) {
      options.push({ value: `room:${room.id}`, label: room.name });
    }
    return options;
  }, [rooms, editingQuestion]);

  function openNewQuestionModal() {
    setEditingQuestion(null);
    setQuestionForm({ question: "", roomSelection: "" });
    setShowQuestionModal(true);
  }

  function openEditQuestionModal(question: DraftingQuestion) {
    setEditingQuestion(question);
    setQuestionForm({
      question: question.question,
      roomSelection: questionToRoomSelection(question, rooms),
    });
    setShowQuestionModal(true);
  }

  async function handleSaveQuestion(e: FormEvent) {
    e.preventDefault();
    const questionText = questionForm.question.trim();
    if (!questionText || !questionForm.roomSelection) return;

    const parsed = parseRoomSelection(questionForm.roomSelection, rooms);
    if (!parsed) return;

    setSavingQuestion(true);
    const supabase = createClient();

    if (editingQuestion) {
      const { data, error } = await supabase
        .from("drafting_questions")
        .update({
          room_id: parsed.room_id,
          for_room: parsed.for_room,
          question: questionText,
        })
        .eq("id", editingQuestion.id)
        .select("*")
        .single();

      setSavingQuestion(false);

      if (!error && data) {
        setQuestions((prev) =>
          prev.map((q) =>
            q.id === editingQuestion.id ? (data as DraftingQuestion) : q,
          ),
        );
        setShowQuestionModal(false);
        setEditingQuestion(null);
        setQuestionForm({ question: "", roomSelection: "" });
      }
      return;
    }

    const { data, error } = await supabase
      .from("drafting_questions")
      .insert({
        job_id: jobId,
        room_id: parsed.room_id,
        for_room: parsed.for_room,
        question: questionText,
        status: "open",
        asked_on: todayIso(),
      })
      .select("*")
      .single();

    setSavingQuestion(false);

    if (!error && data) {
      setQuestions((prev) => [data as DraftingQuestion, ...prev]);
      setShowQuestionModal(false);
      setQuestionForm({ question: "", roomSelection: "" });
    }
  }

  function toggleQuestionExpanded(question: DraftingQuestion) {
    if (expandedQuestionId === question.id) {
      setExpandedQuestionId(null);
      setAnswerDraft("");
      setEditingAnswerId(null);
      setAnswerError(null);
      return;
    }
    setExpandedQuestionId(question.id);
    setEditingAnswerId(null);
    setAnswerDraft(question.answer ?? "");
    setAnswerError(null);
  }

  async function handleSaveAnswer(
    question: DraftingQuestion,
    isRevision = false,
  ) {
    const answer = answerDraft.trim();
    if (!answer) return;

    setAnswerError(null);
    setSubmittingAnswerId(question.id);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("drafting_questions")
      .update(
        isRevision
          ? { answer }
          : {
              answer,
              status: "answered",
            },
      )
      .eq("id", question.id)
      .select("*")
      .single();

    if (error || !data) {
      setSubmittingAnswerId(null);
      setAnswerError("Could not save answer. Please try again.");
      return;
    }

    let saved = data as DraftingQuestion;

    if (!isRevision) {
      const { data: dated, error: dateError } = await supabase
        .from("drafting_questions")
        .update({ answered_on: todayIso() })
        .eq("id", question.id)
        .select("*")
        .single();

      if (!dateError && dated) {
        saved = dated as DraftingQuestion;
      }
    }

    setSubmittingAnswerId(null);
    setQuestions((prev) =>
      prev.map((q) => (q.id === question.id ? saved : q)),
    );
    if (isRevision) {
      setEditingAnswerId(null);
    } else {
      setExpandedQuestionId(null);
      setAnswerDraft("");
    }
  }

  async function handleDeleteQuestion(question: DraftingQuestion) {
    setDeletingQuestionId(question.id);
    const supabase = createClient();
    const { error } = await supabase
      .from("drafting_questions")
      .delete()
      .eq("id", question.id);

    setDeletingQuestionId(null);

    if (!error) {
      setQuestions((prev) => prev.filter((q) => q.id !== question.id));
      if (expandedQuestionId === question.id) {
        setExpandedQuestionId(null);
        setAnswerDraft("");
        setEditingAnswerId(null);
      }
    }
  }

  function toggleReminder(id: string) {
    setReminders((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, completed: !r.completed } : r,
      ),
    );
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-2 xl:grid-cols-3">
      <div className="flex min-h-0 flex-col gap-2 xl:col-span-2">
        <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white px-3 py-2.5">
          <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-900">
              Questions / Clarifications
            </h2>
            <div className="flex shrink-0 items-center gap-2">
              <label className="flex cursor-pointer items-center gap-1.5 rounded border border-gray-300 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={hideAnswered}
                  onChange={(e) => setHideAnswered(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-gray-300 text-burgundy focus:ring-burgundy"
                />
                Hide answered
              </label>
              <Button
                type="button"
                variant="primary"
                className="!px-2.5 !py-1 !text-xs shrink-0"
                onClick={openNewQuestionModal}
              >
                + New question
              </Button>
            </div>
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
              <p className="py-4 text-xs text-gray-500">Loading questions…</p>
            ) : visibleQuestions.length === 0 ? (
              <p className="py-4 text-xs text-gray-500">
                {hideAnswered
                  ? "No open questions."
                  : "No questions yet. Add one to get started."}
              </p>
            ) : (
              <table className="w-full min-w-[480px] text-left text-xs">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr className="border-b border-gray-200 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                    <th className="pb-1.5 pr-3 font-medium">Question</th>
                    <th className="pb-1.5 pr-3 font-medium">For</th>
                    <th className="pb-1.5 pr-3 font-medium">Asked on</th>
                    <th className="pb-1.5 w-16" />
                  </tr>
                </thead>
                <tbody>
                  {visibleQuestions.map((q) => {
                    const isAnswered = q.status === "answered";
                    return (
                    <Fragment key={q.id}>
                      <tr
                        className={`group border-b border-gray-100 last:border-0 ${
                          isAnswered ? "bg-green-50" : ""
                        }`}
                      >
                        <td
                          className="cursor-pointer py-1.5 pr-3 text-gray-900"
                          onClick={() => toggleQuestionExpanded(q)}
                        >
                          {q.question}
                        </td>
                        <td
                          className="cursor-pointer py-1.5 pr-3"
                          onClick={() => toggleQuestionExpanded(q)}
                        >
                          <Pill
                            label={q.for_room}
                            className={roomPillStyle(q.for_room)}
                          />
                        </td>
                        <td
                          className="cursor-pointer py-1.5 pr-3 whitespace-nowrap text-gray-600"
                          onClick={() => toggleQuestionExpanded(q)}
                        >
                          {formatAskedOn(q.asked_on)}
                        </td>
                        <td className="py-1.5">
                          <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditQuestionModal(q);
                              }}
                              className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-burgundy"
                              aria-label="Edit question"
                            >
                              <IconPencil size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleDeleteQuestion(q);
                              }}
                              disabled={deletingQuestionId === q.id}
                              className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-red-600 disabled:opacity-50"
                              aria-label="Delete question"
                            >
                              <IconTrash size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedQuestionId === q.id && (
                        <tr
                          className={`border-b border-gray-100 ${
                            isAnswered ? "bg-green-50" : ""
                          }`}
                        >
                          <td colSpan={4} className="pb-3 pt-1">
                            {isAnswered ? (
                              <div className="rounded-md border border-green-200 bg-white/60 p-3">
                                <div className="mb-1 flex items-center justify-between gap-2">
                                  <label className="text-[11px] font-medium text-green-800">
                                    Answer
                                  </label>
                                  {editingAnswerId !== q.id && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingAnswerId(q.id);
                                        setAnswerDraft(q.answer ?? "");
                                      }}
                                      className="rounded p-1 text-gray-500 hover:bg-green-100 hover:text-burgundy"
                                      aria-label="Edit answer"
                                    >
                                      <IconPencil size={14} />
                                    </button>
                                  )}
                                </div>
                                {q.answered_on && (
                                  <p className="mb-1.5 text-[10px] text-green-700">
                                    Answered {formatAskedOn(q.answered_on)}
                                  </p>
                                )}
                                {editingAnswerId === q.id ? (
                                  <>
                                    <textarea
                                      rows={3}
                                      value={answerDraft}
                                      onChange={(e) =>
                                        setAnswerDraft(e.target.value)
                                      }
                                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900"
                                      placeholder="Write your answer…"
                                    />
                                    <div className="mt-2 flex justify-end">
                                      <Button
                                        type="button"
                                        variant="primary"
                                        className="!px-2.5 !py-1 !text-xs"
                                        disabled={
                                          !answerDraft.trim() ||
                                          submittingAnswerId === q.id
                                        }
                                        onClick={() =>
                                          void handleSaveAnswer(q, true)
                                        }
                                      >
                                        {submittingAnswerId === q.id
                                          ? "Saving…"
                                          : "Save"}
                                      </Button>
                                    </div>
                                  </>
                                ) : (
                                  <p className="whitespace-pre-wrap text-xs text-gray-800">
                                    {q.answer?.trim() || "No answer recorded."}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                                <label className="mb-1 block text-[11px] font-medium text-gray-600">
                                  Answer
                                </label>
                                <textarea
                                  rows={3}
                                  value={answerDraft}
                                  onChange={(e) => {
                                    setAnswerDraft(e.target.value);
                                    setAnswerError(null);
                                  }}
                                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900"
                                  placeholder="Write your answer…"
                                />
                                {answerError && expandedQuestionId === q.id && (
                                  <p className="mt-2 text-xs text-red-600">
                                    {answerError}
                                  </p>
                                )}
                                <div className="mt-2 flex justify-end">
                                  <Button
                                    type="button"
                                    variant="primary"
                                    className="!px-2.5 !py-1 !text-xs"
                                    disabled={
                                      !answerDraft.trim() ||
                                      submittingAnswerId === q.id
                                    }
                                    onClick={() => void handleSaveAnswer(q)}
                                  >
                                    {submittingAnswerId === q.id
                                      ? "Submitting…"
                                      : "Submit"}
                                  </Button>
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-col gap-2 xl:col-span-1">
        <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white px-3 py-2.5">
          <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-900">
              Drafting Reminders
            </h2>
            <Button
              type="button"
              variant="primary"
              className="!px-2.5 !py-1 !text-xs shrink-0"
            >
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
                    {formatAskedOn(reminder.dueDate)}
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
      </div>

      {showQuestionModal && (
        <Modal
          title={editingQuestion ? "Edit question" : "New question"}
          onClose={() => {
            if (!savingQuestion) setShowQuestionModal(false);
          }}
        >
          <form onSubmit={handleSaveQuestion} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Question</label>
              <textarea
                required
                rows={4}
                value={questionForm.question}
                onChange={(e) =>
                  setQuestionForm((prev) => ({
                    ...prev,
                    question: e.target.value,
                  }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                placeholder="Type your question…"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Room</label>
              <select
                required
                value={questionForm.roomSelection}
                onChange={(e) =>
                  setQuestionForm((prev) => ({
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
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                onClick={() => setShowQuestionModal(false)}
                disabled={savingQuestion}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={savingQuestion}>
                {savingQuestion
                  ? "Saving…"
                  : editingQuestion
                    ? "Save changes"
                    : "Add question"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
