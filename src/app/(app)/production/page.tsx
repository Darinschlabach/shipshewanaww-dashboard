"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  IconDotsVertical,
  IconLayoutGrid,
  IconPackage,
  IconTruck,
  IconX,
  IconArrowUpRight,
  IconArrowBack,
  IconPlayerPlay,
} from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/client";
import Modal from "@/components/Modal";
import PageHeader from "@/components/PageHeader";
import { formatDateLong } from "@/lib/utils";
import {
  PRODUCTION_COLUMNS,
  formatProductionJobNumber,
  getDueDateColor,
  getDueLabel,
  getPriorityLabel,
  getPriorityStyles,
  getProductionPriority,
  isDueThisWeek,
  isPastDue,
  getJobPhaseForProductionStage,
  normalizeProductionStage,
  persistProductionStage,
  stageToDbStatus,
  type ProductionStage,
} from "@/lib/production";
import type { ProductionJob } from "@/lib/types";

type Card = ProductionJob;

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
      className={`flex h-full min-h-0 flex-col rounded-lg border border-gray-200 border-t-4 bg-white ${accentClass} ${
        isOver ? "ring-2 ring-burgundy/30" : ""
      }`}
    >
      <div className="flex items-center gap-2 px-3 py-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-700">
          {label}
        </h3>
        <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-gray-100 px-1.5 text-xs font-medium text-gray-600">
          {count}
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-3">{children}</div>
    </div>
  );
}

function KanbanCardContent({ card }: { card: Card }) {
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
        <span>Delivery Date: {formatDateLong(dueDate)}</span>
      </div>
      <div className="mt-3">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${getPriorityStyles(priority)}`}
        >
          {getPriorityLabel(priority)}
        </span>
      </div>
    </>
  );
}

function KanbanCard({
  card,
  menuOpen,
  onMenuClick,
}: {
  card: Card;
  menuOpen: boolean;
  onMenuClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
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
      className="relative rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
    >
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onMenuClick}
        className="absolute right-2 top-2 z-10 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        aria-label="Job actions"
        aria-expanded={menuOpen}
      >
        <IconDotsVertical size={16} />
      </button>
      <div {...attributes} {...listeners} className="cursor-grab p-3 pr-8 active:cursor-grabbing">
        <KanbanCardContent card={card} />
      </div>
    </div>
  );
}

export default function ProductionPage() {
  const router = useRouter();
  const [cards, setCards] = useState<Card[]>([]);
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);
  const [showQueue, setShowQueue] = useState(false);
  const [cardMenu, setCardMenu] = useState<{
    id: string;
    top: number;
    right: number;
    showStartFabricating: boolean;
  } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const loadSeq = useRef(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    setLoading(true);
    const supabase = createClient();

    // Jobs can be marked production without a board row — create any missing ones.
    const { data: stageJobs } = await supabase
      .from("jobs")
      .select("id, due_date")
      .in("stage", ["production", "delivery"]);

    if (stageJobs?.length) {
      const { data: existingRows } = await supabase
        .from("production_jobs")
        .select("job_id");
      const existingIds = new Set(
        (existingRows ?? []).map((row) => row.job_id as string)
      );
      const missing = stageJobs.filter((job) => !existingIds.has(job.id));
      if (missing.length > 0) {
        await supabase.from("production_jobs").insert(
          missing.map((job) => ({
            job_id: job.id,
            kanban_status: "queued",
            due_date: job.due_date || null,
          }))
        );
      }
    }

    const { data } = await supabase
      .from("production_jobs")
      .select("*, jobs(*, contacts(name))")
      .order("due_date");

    if (seq !== loadSeq.current) return;

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

  const stats = useMemo(
    () => {
      const activeCards = cards.filter(
        (c) => normalizeProductionStage(c.kanban_status) !== "queued"
      );
      return {
        total: activeCards.length,
        dueThisWeek: activeCards.filter((c) =>
          isDueThisWeek(c.due_date ?? c.jobs?.due_date)
        ).length,
        pastDue: activeCards.filter((c) =>
          isPastDue(c.due_date ?? c.jobs?.due_date)
        ).length,
        readyForDelivery: activeCards.filter(
          (c) =>
            normalizeProductionStage(c.kanban_status) === "ready_for_delivery"
        ).length,
      };
    },
    [cards]
  );

  function getColumnCards(stage: ProductionStage) {
    return cards.filter(
      (c) => normalizeProductionStage(c.kanban_status) === stage
    );
  }

  function handleDragStart(event: DragStartEvent) {
    const card = cards.find((c) => c.id === event.active.id);
    setActiveCard(card ?? null);
  }

  async function persistStatus(
    card: Card,
    stage: ProductionStage
  ): Promise<boolean> {
    const supabase = createClient();
    const result = await persistProductionStage(supabase, card.job_id, stage);

    if (!result.ok) {
      return false;
    }

    setCards((prev) =>
      prev.map((c) =>
        c.id === card.id ? { ...c, kanban_status: result.kanbanStatus } : c
      )
    );

    await supabase
      .from("jobs")
      .update({ stage: getJobPhaseForProductionStage(stage) })
      .eq("id", card.job_id);

    return true;
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

    const previousStatus = card.kanban_status;

    setCards((prev) =>
      prev.map((c) =>
        c.id === cardId ? { ...c, kanban_status: stageToDbStatus(newStage!) } : c
      )
    );

    setSaveError(null);
    const saved = await persistStatus(card, newStage);
    if (!saved) {
      setCards((prev) =>
        prev.map((c) =>
          c.id === cardId ? { ...c, kanban_status: previousStatus } : c
        )
      );
      setSaveError("Could not save the production stage. Please try again.");
    }
  }

  const queueJobs = useMemo(() => {
    return cards
      .filter((card) => normalizeProductionStage(card.kanban_status) === "queued")
      .sort((a, b) => {
        const dueA = a.due_date ?? a.jobs?.due_date ?? "";
        const dueB = b.due_date ?? b.jobs?.due_date ?? "";
        return dueA.localeCompare(dueB);
      });
  }, [cards]);

  async function startFabricating(cardId: string) {
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;
    const previousStatus = card.kanban_status;
    setCards((prev) =>
      prev.map((c) =>
        c.id === cardId ? { ...c, kanban_status: "cutting" } : c
      )
    );
    setCardMenu(null);
    setSaveError(null);
    const saved = await persistStatus(card, "cutting");
    if (!saved) {
      setCards((prev) =>
        prev.map((c) =>
          c.id === cardId ? { ...c, kanban_status: previousStatus } : c
        )
      );
      setSaveError("Could not move the job to Fabricating. Please try again.");
    }
  }

  async function moveToQueue(cardId: string) {
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;
    if (normalizeProductionStage(card.kanban_status) === "queued") return;

    const previousStatus = card.kanban_status;
    setCards((prev) =>
      prev.map((c) =>
        c.id === cardId ? { ...c, kanban_status: "queued" } : c
      )
    );
    setCardMenu(null);
    setSaveError(null);
    const saved = await persistStatus(card, "queued");
    if (!saved) {
      setCards((prev) =>
        prev.map((c) =>
          c.id === cardId ? { ...c, kanban_status: previousStatus } : c
        )
      );
      setSaveError("Could not move the job to the production queue. Please try again.");
    }
  }

  async function removeFromProduction(card: Card) {
    setCardMenu(null);
    setCards((prev) => prev.filter((c) => c.id !== card.id));

    const supabase = createClient();
    await supabase.from("production_jobs").delete().eq("id", card.id);
    // Move job stage out of production so sync doesn't put it back on the board.
    if (card.job_id) {
      await supabase.from("jobs").update({ stage: "design" }).eq("id", card.job_id);
    }
  }

  function openCardMenu(
    e: React.MouseEvent<HTMLButtonElement>,
    cardId: string,
    showStartFabricating: boolean
  ) {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setCardMenu((prev) =>
      prev?.id === cardId
        ? null
        : {
            id: cardId,
            top: rect.bottom + 4,
            right: window.innerWidth - rect.right,
            showStartFabricating,
          }
    );
  }

  const statItems = [
    {
      icon: IconClipboardList,
      iconClass: "text-blue-500",
      value: stats.total,
      label: "Total in Production",
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
      icon: IconTruck,
      iconClass: "text-orange-500",
      value: stats.dueThisWeek,
      label: "Deliveries This Week",
    },
  ];

  return (
    <div className="flex h-[calc(100vh-2.5rem)] flex-col gap-6">
      <PageHeader
        title="Production"
        subtitle="Shop floor overview of all jobs in production"
        rightSlot={
          <button
            type="button"
            onClick={() => setShowQueue(true)}
            className="inline-flex shrink-0 items-center gap-2 rounded-md bg-burgundy px-4 py-2 text-sm font-medium text-white hover:bg-burgundy/90"
          >
            Production Queue
            <IconLayoutGrid size={16} stroke={1.75} />
          </button>
        }
      />

      {saveError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {saveError}
        </p>
      ) : null}

      <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
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

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={(event) => void handleDragEnd(event)}
          >
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
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
                        columnCards.map((card) => (
                          <KanbanCard
                            key={card.id}
                            card={card}
                            menuOpen={cardMenu?.id === card.id}
                            onMenuClick={(e) =>
                              openCardMenu(e, card.id, false)
                            }
                          />
                        ))
                      )}
                    </div>
                  </SortableContext>
                </DroppableColumn>
              );
            })}
          </div>

          <DragOverlay>
            {activeCard ? (
              <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
                <KanbanCardContent card={activeCard} />
              </div>
            ) : null}
          </DragOverlay>
          </DndContext>
        </div>
      )}

      {showQueue && (
        <Modal
          title={`Production Queue (${queueJobs.length})`}
          onClose={() => {
            setCardMenu(null);
            setShowQueue(false);
          }}
          className="max-h-[85vh] w-full max-w-lg"
        >
          {queueJobs.length === 0 ? (
            <p className="text-sm text-gray-500">
              No jobs are currently in the production queue.
            </p>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ul className="divide-y divide-gray-100">
                {queueJobs.map((card) => {
                  const job = card.jobs;
                  const dueDate = card.due_date ?? job?.due_date ?? null;
                  return (
                    <li
                      key={card.id}
                      className="relative flex items-center gap-3 px-1 py-2.5"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setCardMenu(null);
                          setShowQueue(false);
                          router.push(`/jobs/${card.job_id}`);
                        }}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left hover:opacity-80"
                      >
                        <span className="w-14 shrink-0 text-xs text-gray-400">
                          {formatProductionJobNumber(job ?? undefined)}
                        </span>
                        <span className="max-w-[9rem] shrink-0 truncate text-sm font-medium text-gray-900">
                          {job?.name ?? "Untitled job"}
                        </span>
                        <span className="min-w-0 max-w-[10rem] truncate text-xs text-gray-500">
                          {job?.contacts?.name ?? "—"}
                        </span>
                        <span className="min-w-0 flex-1" />
                        <span
                          className={`shrink-0 text-xs ${getDueDateColor(dueDate)}`}
                        >
                          {getDueLabel(dueDate)}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => openCardMenu(e, card.id, true)}
                        className="shrink-0 rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                        aria-label="Job actions"
                        aria-expanded={cardMenu?.id === card.id}
                      >
                        <IconDotsVertical size={16} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </Modal>
      )}

      {cardMenu &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[60]"
              onClick={() => setCardMenu(null)}
            />
            <div
              className="fixed z-[70] w-52 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
              style={{ top: cardMenu.top, right: cardMenu.right }}
            >
              <button
                type="button"
                onClick={() => {
                  const card = cards.find((c) => c.id === cardMenu.id);
                  if (!card) return;
                  setCardMenu(null);
                  setShowQueue(false);
                  router.push(`/jobs/${card.job_id}`);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                <IconArrowUpRight size={14} stroke={2} />
                Open Job
              </button>
              {cardMenu.showStartFabricating ? (
                <button
                  type="button"
                  onClick={() => {
                    void startFabricating(cardMenu.id);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  <IconPlayerPlay size={14} stroke={2} />
                  Start Fabricating
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    void moveToQueue(cardMenu.id);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  <IconArrowBack size={14} stroke={2} />
                  Move to queue
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  const card = cards.find((c) => c.id === cardMenu.id);
                  if (card) void removeFromProduction(card);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
              >
                <IconX size={14} stroke={2} />
                Remove From Production
              </button>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
