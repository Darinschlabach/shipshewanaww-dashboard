"use client";

import { useState } from "react";
import {
  IconCalendar,
  IconChevronDown,
  IconDots,
  IconDownload,
} from "@tabler/icons-react";
import Button from "@/components/Button";

const PRODUCTION_STEPS = [
  "Fabricating",
  "Finishing",
  "Assembly",
  "Delivered",
] as const;

type ItemStatus =
  | "Pending"
  | "In Production"
  | "Completed"
  | "Ready for QC"
  | "Ready for Delivery";

interface ProductionTask {
  id: string;
  item: string;
  room: string;
  type: string;
  status: ItemStatus;
  assignedTo: string;
  dueDate: string;
}

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

const STATUS_STYLES: Record<ItemStatus, string> = {
  Pending: "bg-gray-100 text-gray-700",
  "In Production": "bg-amber-50 text-amber-700",
  Completed: "bg-green-50 text-green-700",
  "Ready for QC": "bg-sky-50 text-sky-700",
  "Ready for Delivery": "bg-purple-50 text-purple-700",
};

const MOCK_TASKS: ProductionTask[] = [
  {
    id: "1",
    item: "Vanity Cabinet",
    room: "Vanity",
    type: "Cabinet",
    status: "In Production",
    assignedTo: "Jacob M.",
    dueDate: "2024-05-28",
  },
  {
    id: "2",
    item: "Tall Linen Cabinet",
    room: "Closet",
    type: "Cabinet",
    status: "Pending",
    assignedTo: "Unassigned",
    dueDate: "2024-05-30",
  },
  {
    id: "3",
    item: "Drawer Fronts (6)",
    room: "Vanity",
    type: "Component",
    status: "Completed",
    assignedTo: "Ethan B.",
    dueDate: "2024-05-24",
  },
  {
    id: "4",
    item: "Shower Bench",
    room: "Shower",
    type: "Millwork",
    status: "In Production",
    assignedTo: "Jacob M.",
    dueDate: "2024-05-29",
  },
  {
    id: "5",
    item: "Medicine Cabinet",
    room: "Vanity",
    type: "Cabinet",
    status: "In Production",
    assignedTo: "Ryan W.",
    dueDate: "2024-05-27",
  },
  {
    id: "6",
    item: "Crown Molding",
    room: "Bathroom",
    type: "Trim",
    status: "Completed",
    assignedTo: "Ethan B.",
    dueDate: "2024-05-23",
  },
  {
    id: "7",
    item: "Towel Bar Blocking",
    room: "Bathroom",
    type: "Component",
    status: "Pending",
    assignedTo: "Unassigned",
    dueDate: "2024-05-31",
  },
];

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

function Pill({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${className}`}
    >
      {label}
    </span>
  );
}

function ProductionStepper({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center">
      {PRODUCTION_STEPS.map((label, index) => {
        const stepNum = index + 1;
        const completed = stepNum <= currentStep;
        const isLast = index === PRODUCTION_STEPS.length - 1;

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

interface ProductionTabProps {
  jobId: string;
}

export default function ProductionTab({ jobId: _jobId }: ProductionTabProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [reminders, setReminders] = useState(MOCK_REMINDERS);

  const totalItems = MOCK_TASKS.length;
  const completedCount = MOCK_TASKS.filter(
    (t) => t.status === "Completed"
  ).length;
  const inProductionCount = MOCK_TASKS.filter(
    (t) => t.status === "In Production"
  ).length;
  const readyForQcCount = MOCK_TASKS.filter(
    (t) => t.status === "Ready for QC"
  ).length;
  const readyForDeliveryCount = MOCK_TASKS.filter(
    (t) => t.status === "Ready for Delivery"
  ).length;

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
        <div className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-2.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-900">
              Production Overview
            </h2>
            <button
              type="button"
              className="inline-flex shrink-0 items-center gap-0.5 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
              onClick={() =>
                setCurrentStep((s) =>
                  s < PRODUCTION_STEPS.length ? s + 1 : 1
                )
              }
            >
              Update status
              <IconChevronDown size={14} />
            </button>
          </div>
          <ProductionStepper currentStep={currentStep} />
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-gray-100 pt-2 text-[10px] text-gray-600">
            <span>
              <span className="font-medium text-gray-900">{totalItems}</span>{" "}
              Total Items
            </span>
            <span>
              <span className="font-medium text-gray-900">{completedCount}</span>{" "}
              Completed
            </span>
            <span>
              <span className="font-medium text-gray-900">
                {inProductionCount}
              </span>{" "}
              In Production
            </span>
            <span>
              <span className="font-medium text-gray-900">{readyForQcCount}</span>{" "}
              Ready for QC
            </span>
            <span>
              <span className="font-medium text-gray-900">
                {readyForDeliveryCount}
              </span>{" "}
              Ready for Delivery
            </span>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white px-3 py-2.5">
          <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-900">
              Production Tasks
            </h2>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
              >
                Filter
                <IconChevronDown size={14} className="ml-0.5 inline" />
              </button>
              <Button variant="primary" className="!px-2.5 !py-1 !text-xs">
                + Add item
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="border-b border-gray-200 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                  <th className="pb-1.5 pr-3 font-medium">Item</th>
                  <th className="pb-1.5 pr-3 font-medium">Room / Area</th>
                  <th className="pb-1.5 pr-3 font-medium">Type</th>
                  <th className="pb-1.5 pr-3 font-medium">Status</th>
                  <th className="pb-1.5 pr-3 font-medium">Assigned To</th>
                  <th className="pb-1.5 pr-3 font-medium">Due Date</th>
                  <th className="pb-1.5 w-6" />
                </tr>
              </thead>
              <tbody>
                {MOCK_TASKS.map((task) => (
                  <tr
                    key={task.id}
                    className="border-b border-gray-100 last:border-0"
                  >
                    <td className="py-1.5 pr-3 font-medium text-gray-900">
                      {task.item}
                    </td>
                    <td className="py-1.5 pr-3 text-gray-700">{task.room}</td>
                    <td className="py-1.5 pr-3 text-gray-700">{task.type}</td>
                    <td className="py-1.5 pr-3">
                      <Pill
                        label={task.status}
                        className={STATUS_STYLES[task.status]}
                      />
                    </td>
                    <td className="py-1.5 pr-3 text-gray-700">
                      {task.assignedTo}
                    </td>
                    <td className="py-1.5 pr-3 whitespace-nowrap text-gray-600">
                      {formatDate(task.dueDate)}
                    </td>
                    <td className="py-1.5">
                      <button
                        type="button"
                        className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        aria-label="Task actions"
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
            <button
              type="button"
              className="text-xs text-burgundy hover:underline"
            >
              View all items
            </button>
          </div>
        </div>
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
          <button
            type="button"
            className="mt-2 shrink-0 text-xs text-burgundy hover:underline"
          >
            View all tasks
          </button>
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
    </div>
  );
}
