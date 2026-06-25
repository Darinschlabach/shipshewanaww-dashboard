"use client";

import { useMemo, useState } from "react";
import {
  IconCalendar,
  IconChevronDown,
  IconDots,
} from "@tabler/icons-react";
import Button from "@/components/Button";

const DRAWING_STEPS = [
  "Measurements",
  "Layout",
  "Client Approval",
  "Production Drawings",
] as const;

type QuestionCategory = "Bathroom" | "Vanity" | "Shower" | "Doors / Millwork";
type QuestionPriority = "High" | "Medium" | "Low";
type QuestionStatus = "Open" | "Answered";

interface DraftingQuestion {
  id: string;
  question: string;
  category: QuestionCategory;
  priority: QuestionPriority;
  status: QuestionStatus;
  askedOn: string;
}

interface DraftingReminder {
  id: string;
  text: string;
  dueDate: string;
  completed: boolean;
}

const MOCK_QUESTIONS: DraftingQuestion[] = [
  {
    id: "1",
    question: "Are the crown molding dimensions for the ceiling final?",
    category: "Bathroom",
    priority: "High",
    status: "Open",
    askedOn: "2024-05-20",
  },
  {
    id: "2",
    question: "Should the glass door swing into the shower or out?",
    category: "Shower",
    priority: "High",
    status: "Open",
    askedOn: "2024-05-20",
  },
  {
    id: "3",
    question: "Are the plumbing and electrical rough-ins on the left wall completed?",
    category: "Vanity",
    priority: "Medium",
    status: "Open",
    askedOn: "2024-05-21",
  },
  {
    id: "4",
    question: "Should the towel bar be installed between the vanity and closet?",
    category: "Vanity",
    priority: "Medium",
    status: "Open",
    askedOn: "2024-05-21",
  },
  {
    id: "5",
    question: "Can the frameless shower door reveal confirm the floor tile height?",
    category: "Shower",
    priority: "High",
    status: "Answered",
    askedOn: "2024-05-22",
  },
  {
    id: "6",
    question:
      "Can the island base be modified to fit the wall? The kitchen layout may need adjustment.",
    category: "Bathroom",
    priority: "Medium",
    status: "Open",
    askedOn: "2024-05-18",
  },
  {
    id: "7",
    question: "What is the final door swing direction for the linen closet?",
    category: "Doors / Millwork",
    priority: "Low",
    status: "Open",
    askedOn: "2024-05-15",
  },
  {
    id: "8",
    question: "Is the vanity drawer depth limited by the plumbing chase?",
    category: "Vanity",
    priority: "Medium",
    status: "Answered",
    askedOn: "2024-05-14",
  },
  {
    id: "9",
    question: "Should the wainscoting height match the adjacent hallway?",
    category: "Bathroom",
    priority: "Medium",
    status: "Open",
    askedOn: "2024-05-19",
  },
  {
    id: "10",
    question: "Confirm ceiling height for upper cabinet stack",
    category: "Bathroom",
    priority: "High",
    status: "Open",
    askedOn: "2024-05-17",
  },
  {
    id: "11",
    question: "Tile niche depth — standard or custom?",
    category: "Bathroom",
    priority: "Low",
    status: "Open",
    askedOn: "2024-05-16",
  },
];

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

const CATEGORY_FILTERS = [
  { key: "all", label: "All" },
  { key: "Bathroom", label: "Bathroom" },
  { key: "Vanity", label: "Vanity" },
  { key: "Shower", label: "Shower" },
  { key: "Doors / Millwork", label: "Doors / Millwork" },
] as const;

type CategoryFilterKey = (typeof CATEGORY_FILTERS)[number]["key"];

const CATEGORY_STYLES: Record<QuestionCategory, string> = {
  Bathroom: "bg-blue-50 text-blue-700",
  Vanity: "bg-purple-50 text-purple-700",
  Shower: "bg-green-50 text-green-700",
  "Doors / Millwork": "bg-orange-50 text-orange-700",
};

const PRIORITY_STYLES: Record<QuestionPriority, string> = {
  High: "bg-red-50 text-red-700",
  Medium: "bg-amber-50 text-amber-700",
  Low: "bg-sky-50 text-sky-700",
};

const STATUS_STYLES: Record<QuestionStatus, string> = {
  Open: "bg-amber-50 text-amber-700",
  Answered: "bg-green-50 text-green-700",
};

function formatAskedOn(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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

function DrawingProgressStepper({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center">
      {DRAWING_STEPS.map((label, index) => {
        const stepNum = index + 1;
        const completed = stepNum <= currentStep;
        const isLast = index === DRAWING_STEPS.length - 1;

        return (
          <div
            key={label}
            className={`flex items-center ${isLast ? "" : "flex-1"}`}
          >
            <div className="flex flex-col items-center">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                  completed
                    ? "bg-burgundy text-white"
                    : "border-2 border-gray-300 bg-white text-gray-400"
                }`}
              >
                {stepNum}
              </span>
              <span
                className={`mt-1 max-w-[4.5rem] text-center text-[10px] leading-tight ${
                  completed ? "font-medium text-gray-900" : "text-gray-500"
                }`}
              >
                {label}
              </span>
            </div>
            {!isLast && (
              <div
                className={`mx-1.5 mb-4 h-0.5 flex-1 ${
                  stepNum < currentStep ? "bg-burgundy" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

interface DraftingTabProps {
  jobId: string;
}

export default function DraftingTab({ jobId: _jobId }: DraftingTabProps) {
  const [currentStep, setCurrentStep] = useState(2);
  const [categoryFilter, setCategoryFilter] =
    useState<CategoryFilterKey>("all");
  const [showAnswered, setShowAnswered] = useState(false);
  const [reminders, setReminders] = useState(MOCK_REMINDERS);
  const [draftingNotes, setDraftingNotes] = useState(
    "Client prefers a warm, natural look. Vanity to be inset with face frame. Confirm mirror style and lighting."
  );
  const [savingNotes, setSavingNotes] = useState(false);

  const openQuestions = useMemo(
    () => MOCK_QUESTIONS.filter((q) => q.status === "Open"),
    []
  );

  const answeredCount = useMemo(
    () => MOCK_QUESTIONS.filter((q) => q.status === "Answered").length,
    []
  );

  const filteredQuestions = useMemo(() => {
    let list = showAnswered
      ? MOCK_QUESTIONS.filter((q) => q.status === "Answered")
      : openQuestions;

    if (categoryFilter !== "all") {
      list = list.filter((q) => q.category === categoryFilter);
    }

    return list;
  }, [categoryFilter, openQuestions, showAnswered]);

  const categoryCounts = useMemo(() => {
    const base = showAnswered
      ? MOCK_QUESTIONS.filter((q) => q.status === "Answered")
      : openQuestions;

    return {
      all: base.length,
      Bathroom: base.filter((q) => q.category === "Bathroom").length,
      Vanity: base.filter((q) => q.category === "Vanity").length,
      Shower: base.filter((q) => q.category === "Shower").length,
      "Doors / Millwork": base.filter((q) => q.category === "Doors / Millwork")
        .length,
    };
  }, [openQuestions, showAnswered]);

  function toggleReminder(id: string) {
    setReminders((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, completed: !r.completed } : r
      )
    );
  }

  async function handleSaveNotes() {
    setSavingNotes(true);
    await new Promise((r) => setTimeout(r, 400));
    setSavingNotes(false);
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-2 xl:grid-cols-3">
      <div className="flex min-h-0 flex-col gap-2 xl:col-span-2">
        <div className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-2.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-900">
              Drawing Progress
            </h2>
            <button
              type="button"
              className="inline-flex shrink-0 items-center gap-0.5 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
              onClick={() =>
                setCurrentStep((s) =>
                  s < DRAWING_STEPS.length ? s + 1 : 1
                )
              }
            >
              Update progress
              <IconChevronDown size={14} />
            </button>
          </div>
          <DrawingProgressStepper currentStep={currentStep} />
          <p className="mt-2 border-t border-gray-100 pt-2 text-[10px] text-gray-500">
            Last updated May 25, 2024 by You
          </p>
        </div>

        <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white px-3 py-2.5">
          <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-900">
              Questions / Clarifications
            </h2>
            <Button variant="primary" className="!px-2.5 !py-1 !text-xs shrink-0">
              + New question
            </Button>
          </div>

          <div className="mb-2 flex shrink-0 flex-wrap gap-3 border-b border-gray-200 text-xs">
            {CATEGORY_FILTERS.map(({ key, label }) => {
              const count =
                key === "all"
                  ? categoryCounts.all
                  : categoryCounts[key as QuestionCategory];
              const active = categoryFilter === key;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCategoryFilter(key)}
                  className={`pb-1.5 ${
                    active
                      ? "border-b-2 border-burgundy font-medium text-burgundy"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {label} ({count})
                </button>
              );
            })}
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[600px] text-left text-xs">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="border-b border-gray-200 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                  <th className="pb-1.5 pr-3 font-medium">Question</th>
                  <th className="pb-1.5 pr-3 font-medium">For</th>
                  <th className="pb-1.5 pr-3 font-medium">Priority</th>
                  <th className="pb-1.5 pr-3 font-medium">Status</th>
                  <th className="pb-1.5 pr-3 font-medium">Asked on</th>
                  <th className="pb-1.5 w-6" />
                </tr>
              </thead>
              <tbody>
                {filteredQuestions.map((q) => (
                  <tr
                    key={q.id}
                    className="border-b border-gray-100 last:border-0"
                  >
                    <td className="py-1.5 pr-3 text-gray-900">{q.question}</td>
                    <td className="py-1.5 pr-3">
                      <Pill
                        label={q.category}
                        className={CATEGORY_STYLES[q.category]}
                      />
                    </td>
                    <td className="py-1.5 pr-3">
                      <Pill
                        label={q.priority}
                        className={PRIORITY_STYLES[q.priority]}
                      />
                    </td>
                    <td className="py-1.5 pr-3">
                      <Pill
                        label={q.status}
                        className={STATUS_STYLES[q.status]}
                      />
                    </td>
                    <td className="py-1.5 pr-3 whitespace-nowrap text-gray-600">
                      {formatAskedOn(q.askedOn)}
                    </td>
                    <td className="py-1.5">
                      <button
                        type="button"
                        className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        aria-label="Question actions"
                      >
                        <IconDots size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="shrink-0 border-t border-gray-100 pt-1.5">
            {!showAnswered && answeredCount > 0 && (
              <button
                type="button"
                onClick={() => setShowAnswered(true)}
                className="text-xs text-burgundy hover:underline"
              >
                View answered questions ({answeredCount})
              </button>
            )}
            {showAnswered && (
              <button
                type="button"
                onClick={() => {
                  setShowAnswered(false);
                  setCategoryFilter("all");
                }}
                className="text-xs text-burgundy hover:underline"
              >
                Back to open questions
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-col gap-2 xl:col-span-1">
        <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white px-3 py-2.5">
          <h2 className="mb-2 shrink-0 text-sm font-semibold text-gray-900">
            Drafting Reminders
          </h2>
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
          <button
            type="button"
            className="mt-2 shrink-0 w-full rounded border border-dashed border-gray-300 py-1.5 text-xs text-gray-600 hover:border-burgundy hover:text-burgundy"
          >
            + Add reminder
          </button>
        </div>

        <div className="flex shrink-0 flex-col rounded-lg border border-gray-200 bg-white px-3 py-2.5">
          <h2 className="mb-1.5 text-sm font-semibold text-gray-900">
            Drafting Notes
          </h2>
          <textarea
            value={draftingNotes}
            onChange={(e) => setDraftingNotes(e.target.value)}
            rows={3}
            className="w-full resize-none rounded border border-gray-200 px-2 py-1.5 text-xs text-gray-800 focus:border-burgundy focus:outline-none focus:ring-1 focus:ring-burgundy"
          />
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-gray-100 pt-2">
            <p className="text-[10px] text-gray-500">
              Last updated May 25, 2024 by You
            </p>
            <Button
              variant="primary"
              className="!px-2.5 !py-1 !text-xs"
              onClick={handleSaveNotes}
              disabled={savingNotes}
            >
              {savingNotes ? "Saving…" : "Save notes"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
