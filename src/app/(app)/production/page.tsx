"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  IconCalendar,
  IconClipboardList,
  IconClock,
  IconDots,
  IconFilter,
  IconLayoutGrid,
  IconNote,
  IconPackage,
  IconSearch,
  IconStack2,
} from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/client";
import PageHeader from "@/components/PageHeader";
import { formatDateLong } from "@/lib/utils";
import {
  DEFAULT_SHOP_NOTES,
  PRODUCTION_COLUMNS,
  PRODUCTION_DEPARTMENTS,
  PRODUCTION_PRIORITIES,
  avgDaysInProduction,
  formatProductionJobNumber,
  getAssigneeInitials,
  getDueDateColor,
  getDueLabel,
  getDueUrgency,
  getPriorityLabel,
  getPriorityStyles,
  getPriorityTaskLabel,
  getProductionPriority,
  isDueThisWeek,
  isPastDue,
  normalizeProductionStage,
  stageToDbStatus,
  stageToLegacyDbStatus,
  type ProductionStage,
} from "@/lib/production";
import type { ProductionJob } from "@/lib/types";

type Card = ProductionJob;

const selectClass =
  "rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-burgundy focus:outline-none focus:ring-1 focus:ring-burgundy";

function DroppableColumn({
  id,
  label,
  count,
  accentClass,
  children,
}: {
  id: ProductionStage;
  label: string;
  count: number;
  accentClass: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[420px] flex-col rounded-lg border border-gray-200 border-t-4 bg-white ${accentClass} ${
        isOver ? "ring-2 ring-burgundy/30" : ""
      }`}
    >
      <div className="flex items-center justify-between px-3 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-700">
            {label}
          </h3>
          <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-gray-100 px-1.5 text-xs font-medium text-gray-600">
            {count}
          </span>
        </div>
        <button
          type="button"
          className="rounded p-1 text-gray-400 hover:bg-gray-50 hover:text-gray-600"
          aria-label={`${label} column options`}
        >
          <IconDots size={16} />
        </button>
      </div>
      <div className="flex flex-1 flex-col px-3 pb-3">{children}</div>
    </div>
  );
}

function KanbanCardContent({
  card,
  index,
}: {
  card: Card;
  index: number;
}) {
  const job = card.jobs;
  const customerName = job?.contacts?.name ?? "—";
  const dueDate = card.due_date ?? job?.due_date ?? null;
  const priority = getProductionPriority(card);

  return (
    <>
      <p className="text-xs text-gray-400">
        {formatProductionJobNumber(job ?? undefined)}
      </p>
      <p className="mt-1 font-semibold text-gray-900">
        {job?.name ?? "Untitled job"}
      </p>
      <p className="mt-0.5 text-xs text-gray-500">{customerName}</p>
      <div className={`mt-3 flex items-center gap-1.5 text-xs ${getDueDateColor(dueDate)}`}>
        <IconCalendar size={14} />
        <span>Due: {formatDateLong(dueDate)}</span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${getPriorityStyles(priority)}`}
        >
          {getPriorityLabel(priority)}
        </span>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-semibold text-gray-600">
          {getAssigneeInitials(card.assignee, index)}
        </span>
      </div>
    </>
  );
}

function KanbanCard({
  card,
  index,
}: {
  card: Card;
  index: number;
}) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => router.push(`/jobs/${card.job_id}`)}
      className="cursor-pointer rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
    >
      <KanbanCardContent card={card} index={index} />
    </div>
  );
}

export default function ProductionPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("production_jobs")
      .select("*, jobs(*, contacts(name))")
      .order("due_date");

    const active = ((data as Card[]) ?? []).filter((card) => {
      const stage = card.jobs?.stage;
      return stage === "production" || stage === "delivery";
    });

    setCards(active);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return cards.filter((card) => {
      const stage = normalizeProductionStage(card.kanban_status);
      const priority = getProductionPriority(card);
      const job = card.jobs;

      if (stageFilter && stage !== stageFilter) return false;
      if (departmentFilter && card.department !== departmentFilter) return false;
      if (priorityFilter && priority !== priorityFilter) return false;

      if (!q) return true;
      return (
        (job?.name.toLowerCase().includes(q) ?? false) ||
        (job?.contacts?.name.toLowerCase().includes(q) ?? false) ||
        formatProductionJobNumber(job ?? undefined).toLowerCase().includes(q)
      );
    });
  }, [cards, search, stageFilter, departmentFilter, priorityFilter]);

  const stats = useMemo(
    () => ({
      total: filtered.length,
      dueThisWeek: filtered.filter((c) =>
        isDueThisWeek(c.due_date ?? c.jobs?.due_date)
      ).length,
      pastDue: filtered.filter((c) =>
        isPastDue(c.due_date ?? c.jobs?.due_date)
      ).length,
      readyForDelivery: filtered.filter(
        (c) => normalizeProductionStage(c.kanban_status) === "ready_for_delivery"
      ).length,
      avgDays: avgDaysInProduction(filtered),
    }),
    [filtered]
  );

  const todaysPriorities = useMemo(() => {
    return [...filtered]
      .sort((a, b) => {
        const urgencyOrder = { past: 0, urgent: 1, soon: 2, normal: 3 };
        const aUrgency = urgencyOrder[getDueUrgency(a.due_date ?? a.jobs?.due_date)];
        const bUrgency = urgencyOrder[getDueUrgency(b.due_date ?? b.jobs?.due_date)];
        return aUrgency - bUrgency;
      })
      .slice(0, 3)
      .map((card) => {
        const stage = normalizeProductionStage(card.kanban_status);
        const dueDate = card.due_date ?? card.jobs?.due_date;
        const dueLabel = getDueLabel(dueDate);
        const isUrgent =
          getDueUrgency(dueDate) === "past" || getDueUrgency(dueDate) === "urgent";

        return {
          id: card.id,
          task: `${getPriorityTaskLabel(stage)} ${card.jobs?.name ?? "job"}`,
          jobNumber: formatProductionJobNumber(card.jobs ?? undefined),
          dueLabel,
          urgent: isUrgent,
        };
      });
  }, [filtered]);

  function getColumnCards(stage: ProductionStage) {
    return filtered.filter(
      (c) => normalizeProductionStage(c.kanban_status) === stage
    );
  }

  function handleDragStart(event: DragStartEvent) {
    const card = cards.find((c) => c.id === event.active.id);
    setActiveCard(card ?? null);
  }

  async function persistStatus(cardId: string, stage: ProductionStage) {
    const supabase = createClient();
    const status = stageToDbStatus(stage);
    const { error } = await supabase
      .from("production_jobs")
      .update({ kanban_status: status })
      .eq("id", cardId);

    if (error) {
      await supabase
        .from("production_jobs")
        .update({ kanban_status: stageToLegacyDbStatus(stage) })
        .eq("id", cardId);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveCard(null);
    const { active, over } = event;
    if (!over) return;

    const cardId = active.id as string;
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;

    let newStage: ProductionStage | null = null;

    if (PRODUCTION_COLUMNS.some((col) => col.id === over.id)) {
      newStage = over.id as ProductionStage;
    } else {
      const overCard = cards.find((c) => c.id === over.id);
      if (overCard) {
        newStage = normalizeProductionStage(overCard.kanban_status);
      }
    }

    if (!newStage || newStage === normalizeProductionStage(card.kanban_status)) {
      return;
    }

    setCards((prev) =>
      prev.map((c) =>
        c.id === cardId ? { ...c, kanban_status: stageToDbStatus(newStage!) } : c
      )
    );

    await persistStatus(cardId, newStage);
  }

  const statItems = [
    {
      icon: IconClipboardList,
      iconClass: "text-blue-500",
      value: stats.total,
      label: "Total in Production",
    },
    {
      icon: IconStack2,
      iconClass: "text-orange-500",
      value: stats.dueThisWeek,
      label: "Due This Week",
    },
    {
      icon: IconClock,
      iconClass: "text-amber-500",
      value: stats.pastDue,
      label: "Past Due",
    },
    {
      icon: IconPackage,
      iconClass: "text-green-600",
      value: stats.readyForDelivery,
      label: "Ready for Delivery",
    },
    {
      icon: IconCalendar,
      iconClass: "text-blue-700",
      value: stats.avgDays,
      label: "Avg. Days in Production",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Production"
        subtitle="Shop floor overview of all jobs in production"
        rightSlot={
          <Link
            href="/jobs"
            className="shrink-0 rounded-md bg-burgundy px-4 py-2 text-sm font-medium text-white hover:bg-burgundy/90"
          >
            + New Production Task
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {statItems.map(({ icon: Icon, iconClass, value, label }) => (
          <div
            key={label}
            className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-4"
          >
            <Icon size={22} className={`shrink-0 ${iconClass}`} stroke={1.5} />
            <div>
              <p className="text-2xl font-semibold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
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
          <option value="">All Stages</option>
          {PRODUCTION_COLUMNS.map((col) => (
            <option key={col.id} value={col.id}>
              {col.label}
            </option>
          ))}
        </select>

        <select
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
          className={selectClass}
        >
          <option value="">All Departments</option>
          {PRODUCTION_DEPARTMENTS.map((dept) => (
            <option key={dept} value={dept}>
              {dept}
            </option>
          ))}
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className={selectClass}
        >
          <option value="">All Priorities</option>
          {PRODUCTION_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {getPriorityLabel(p)}
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

        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <IconLayoutGrid size={16} />
          View
        </button>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            {PRODUCTION_COLUMNS.map((col) => {
              const columnCards = getColumnCards(col.id);
              return (
                <DroppableColumn
                  key={col.id}
                  id={col.id}
                  label={col.label}
                  count={columnCards.length}
                  accentClass={col.accentClass}
                >
                  <SortableContext
                    id={col.id}
                    items={columnCards.map((c) => c.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="flex flex-1 flex-col gap-2">
                      {columnCards.length === 0 ? (
                        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 px-4 py-10 text-center">
                          <IconPackage
                            size={28}
                            className="mb-2 text-gray-300"
                            stroke={1.5}
                          />
                          <p className="text-sm font-medium text-gray-500">
                            No jobs in this stage
                          </p>
                          <p className="mt-1 text-xs text-gray-400">
                            Drag a job here to update its production stage
                          </p>
                        </div>
                      ) : (
                        columnCards.map((card, index) => (
                          <KanbanCard key={card.id} card={card} index={index} />
                        ))
                      )}
                    </div>
                  </SortableContext>
                  <Link
                    href="/jobs"
                    className="mt-3 block text-center text-sm font-medium text-burgundy hover:underline"
                  >
                    + Add Job
                  </Link>
                </DroppableColumn>
              );
            })}
          </div>

          <DragOverlay>
            {activeCard ? (
              <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
                <KanbanCardContent
                  card={activeCard}
                  index={cards.indexOf(activeCard)}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">
            Today&apos;s Priorities
          </h3>
          {todaysPriorities.length === 0 ? (
            <p className="text-sm text-gray-500">No urgent tasks today.</p>
          ) : (
            <ul className="space-y-3">
              {todaysPriorities.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-3 text-sm"
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                        item.urgent ? "bg-red-500" : "bg-amber-400"
                      }`}
                    />
                    <div>
                      <p className="text-gray-900">{item.task}</p>
                      <p className="text-xs text-gray-500">{item.jobNumber}</p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 text-xs font-medium ${
                      item.urgent ? "text-red-600" : "text-gray-500"
                    }`}
                  >
                    {item.dueLabel}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">Shop Notes</h3>
          <ul className="space-y-3 text-sm text-gray-700">
            {DEFAULT_SHOP_NOTES.map((note) => (
              <li key={note} className="flex items-start gap-2">
                <IconNote size={16} className="mt-0.5 shrink-0 text-gray-400" />
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
