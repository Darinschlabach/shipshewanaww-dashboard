"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ConfirmModal from "@/components/ConfirmModal";
import PageHeader from "@/components/PageHeader";
import { priceQuote, roundMoney, type CostTotals } from "@/lib/costing/calculate";
import {
  fetchCategories,
  fetchComponents,
  fetchHardware,
  fetchSchedules,
  fetchTemplates,
  type CostingCategory,
  type CostingComponent,
  type CostingHardware,
  type CostingSchedule,
  type CostingTemplate,
} from "@/lib/costing/db";
import {
  addCabinetFromTemplate,
  addHardwareToCabinet,
  addPartToCabinet,
  commitCabinetSchedule,
  commitRefresh,
  commitRoomSchedule,
  deleteCabinet,
  deleteRoom,
  fetchCabinets,
  fetchContactNames,
  fetchQuote,
  fetchQuoteHardware,
  fetchQuoteParts,
  fetchRooms,
  previewCabinetSchedule,
  previewRefresh,
  previewRoomSchedule,
  removeHardwareFromCabinet,
  removePartFromCabinet,
  saveQuote,
  saveRoom,
  updateCabinetSize,
  type CabinetPriceChange,
  type CostingQuote,
  type QuoteCabinet,
  type QuoteRoom,
  type SavedHardware,
  type SavedPart,
} from "@/lib/costing/quotes";
import { formatCurrencyPrecise } from "@/lib/utils";
import { Field, inputClass, matchesSearch, parseRequiredNumber } from "@/components/costing/ui";

type Draft = {
  name: string;
  margin: string;
  status: "draft" | "sent";
  notes: string;
  contactId: string | null;
  contactQuery: string;
};

const emptyDraft: Draft = {
  name: "",
  margin: "30",
  status: "draft",
  notes: "",
  contactId: null,
  contactQuery: "",
};

export default function QuoteBuilder({ quoteId }: { quoteId: string }) {
  const [quote, setQuote] = useState<CostingQuote | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [rooms, setRooms] = useState<QuoteRoom[]>([]);
  const [cabinets, setCabinets] = useState<QuoteCabinet[]>([]);
  const [parts, setParts] = useState<SavedPart[]>([]);
  const [hardware, setHardware] = useState<SavedHardware[]>([]);
  const [schedules, setSchedules] = useState<CostingSchedule[]>([]);
  const [templates, setTemplates] = useState<CostingTemplate[]>([]);
  const [categories, setCategories] = useState<CostingCategory[]>([]);
  const [components, setComponents] = useState<CostingComponent[]>([]);
  const [hardwareLibrary, setHardwareLibrary] = useState<CostingHardware[]>([]);
  const [contacts, setContacts] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [roomName, setRoomName] = useState("Kitchen");
  const [roomSchedule, setRoomSchedule] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [addingRoomId, setAddingRoomId] = useState<string | null>(null);
  const [pendingRoom, setPendingRoom] = useState<QuoteRoom | null>(null);
  const [schedulePrompt, setSchedulePrompt] = useState<{
    roomId: string;
    scheduleId: string | null;
    changes: CabinetPriceChange[];
    skipped: number;
  } | null>(null);
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const scheduleDefaulted = useRef(false);

  async function load() {
    const [quoteResult, roomResult, scheduleResult, templateResult, categoryResult, componentResult, hardwareResult, people] =
      await Promise.all([
        fetchQuote(quoteId),
        fetchRooms(quoteId),
        fetchSchedules(),
        fetchTemplates(),
        fetchCategories(),
        fetchComponents(),
        fetchHardware(),
        fetchContactNames(),
      ]);
    const cabinetResult = await fetchCabinets(roomResult.rows.map((room) => room.id));
    const ids = cabinetResult.rows.map((row) => row.id);
    const [partResult, hardwareLines] = await Promise.all([fetchQuoteParts(ids), fetchQuoteHardware(ids)]);
    setQuote(quoteResult.row);
    if (quoteResult.row) {
      const contact = people.find((row) => row.id === quoteResult.row?.contact_id);
      setDraft({
        name: quoteResult.row.name,
        margin: String(quoteResult.row.margin_pct),
        status: quoteResult.row.status,
        notes: quoteResult.row.notes,
        contactId: quoteResult.row.contact_id,
        contactQuery: contact?.name ?? "",
      });
    }
    setRooms(roomResult.rows);
    setCabinets(cabinetResult.rows);
    setParts(partResult.rows);
    setHardware(hardwareLines.rows);
    setSchedules(scheduleResult.rows);
    setTemplates(templateResult.rows);
    setCategories(categoryResult.rows);
    setComponents(componentResult.rows);
    setHardwareLibrary(hardwareResult.rows);
    setContacts(people);
    if (!scheduleDefaulted.current) {
      scheduleDefaulted.current = true;
      const first = scheduleResult.rows.find((row) => row.active);
      if (first) setRoomSchedule(first.id);
    }
    setError(
      quoteResult.error ??
        roomResult.error ??
        cabinetResult.error ??
        partResult.error ??
        hardwareLines.error ??
        scheduleResult.error ??
        templateResult.error
    );
  }

  useEffect(() => {
    void load();
  }, [quoteId]);

  const marginPct = Number(draft.margin);
  const priced = useMemo(() => {
    return priceQuote({
      marginPct: Number.isFinite(marginPct) ? marginPct : 0,
      cabinets: cabinets.map(totalsOf),
    });
  }, [cabinets, marginPct]);

  async function saveHeader() {
    const margin = parseRequiredNumber(draft.margin, "margin");
    if (!draft.name.trim()) {
      setError("Enter a quote name");
      return;
    }
    if (typeof margin === "string") {
      setError(margin);
      return;
    }
    if (margin < 0 || margin >= 100) {
      setError("Margin must be from 0 up to, but not including, 100%");
      return;
    }
    const message = await saveQuote(quoteId, {
      name: draft.name.trim(),
      margin_pct: margin,
      status: draft.status,
      notes: draft.notes.trim(),
      contact_id: draft.contactId,
    });
    setError(message);
    if (!message) await load();
  }

  async function addRoom() {
    if (!roomName.trim()) return;
    const sort = rooms.reduce((max, room) => Math.max(max, room.sort_order), -1) + 1;
    const message = await saveRoom({
      quote_id: quoteId,
      name: roomName,
      schedule_id: roomSchedule || null,
      sort_order: sort,
    });
    setError(message);
    if (!message) {
      setRoomName("Room");
      await load();
    }
  }

  async function moveRoom(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= rooms.length) return;
    const copy = [...rooms];
    const [row] = copy.splice(index, 1);
    copy.splice(next, 0, row);
    for (let itemIndex = 0; itemIndex < copy.length; itemIndex += 1) {
      const message = await saveRoom({ ...copy[itemIndex], sort_order: itemIndex });
      if (message) {
        setError(message);
        return;
      }
    }
    await load();
  }

  if (!quote && !error) return <p className="text-sm text-gray-500">Loading quote…</p>;
  if (!quote) return <p className="text-sm text-red-600">{error}</p>;

  const contactMatches = contacts.filter((row) => matchesSearch(draft.contactQuery, [row.name])).slice(0, 8);

  return (
    <section>
      <Link href="/costing-quotes" className="text-sm text-burgundy">
        Back to costing quotes
      </Link>
      <PageHeader title={quote.name} subtitle="Prices stay on the cabinet until you refresh them." />
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      {warnings.length ? (
        <p className="mb-3 whitespace-pre-wrap text-sm text-amber-800">{warnings.join("\n")}</p>
      ) : null}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Name">
              <input
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Margin %">
              <input
                value={draft.margin}
                onChange={(event) => setDraft({ ...draft, margin: event.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Status">
              <select
                value={draft.status}
                onChange={(event) => setDraft({ ...draft, status: event.target.value as Draft["status"] })}
                className={inputClass}
              >
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
              </select>
            </Field>
            <Field label="Customer">
              <input
                value={draft.contactQuery}
                onChange={(event) =>
                  setDraft({ ...draft, contactQuery: event.target.value, contactId: null })
                }
                placeholder="Search contacts"
                className={inputClass}
              />
            </Field>
          </div>
          {draft.contactQuery && !draft.contactId ? (
            <ul className="mt-2 max-w-md rounded-md border border-gray-200">
              {contactMatches.map((contact) => (
                <li key={contact.id}>
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-cream"
                    onClick={() => setDraft({ ...draft, contactId: contact.id, contactQuery: contact.name })}
                  >
                    {contact.name}
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm text-gray-500 hover:bg-cream"
                  onClick={() => setDraft({ ...draft, contactId: null, contactQuery: "" })}
                >
                  No customer
                </button>
              </li>
            </ul>
          ) : null}
          <Field label="Notes">
            <textarea
              value={draft.notes}
              onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
              rows={2}
              className={`${inputClass} mt-3`}
            />
          </Field>
          <button
            type="button"
            onClick={() => void saveHeader()}
            className="mt-3 rounded-md bg-burgundy px-4 py-2 text-sm font-medium text-white hover:bg-burgundy/90"
          >
            Save quote
          </button>
        </div>
        <Totals title="Quote" priced={priced} />
      </div>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">Add a room</h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <Field label="Name">
            <input value={roomName} onChange={(event) => setRoomName(event.target.value)} className={inputClass} />
          </Field>
          <Field label="Schedule">
            <select value={roomSchedule} onChange={(event) => setRoomSchedule(event.target.value)} className={inputClass}>
              <option value="">No schedule</option>
              {schedules.filter((row) => row.active).map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </Field>
          <button type="button" onClick={() => void addRoom()} className="rounded-md border border-gray-900 px-4 py-2 text-sm">
            Add room
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {rooms.map((room, index) => {
          const roomCabinets = cabinets.filter((row) => row.room_id === room.id);
          const roomPrice = priceQuote({
            marginPct: Number.isFinite(marginPct) ? marginPct : quote.margin_pct,
            cabinets: roomCabinets.map(totalsOf),
          });
          return (
            <section key={room.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Room">
                  <input
                    defaultValue={room.name}
                    key={room.name}
                    onBlur={(event) => {
                      if (event.target.value.trim() && event.target.value !== room.name) {
                        void saveRoom({ ...room, name: event.target.value }).then((message) => {
                          setError(message);
                          void load();
                        });
                      }
                    }}
                    className={inputClass}
                  />
                </Field>
                <Field label="Schedule">
                  <select
                    value={room.schedule_id ?? ""}
                    onChange={(event) => {
                      const next = event.target.value || null;
                      if (next === (room.schedule_id ?? null)) return;
                      void previewRoomSchedule(room.id, next).then((result) => {
                        if (result.error) {
                          setError(result.error);
                          return;
                        }
                        if (!result.changes.length) {
                          void commitRoomSchedule(room.id, next).then((saved) => {
                            setError(saved.error);
                            setWarnings(saved.warnings);
                            void load();
                          });
                          return;
                        }
                        setSchedulePrompt({
                          roomId: room.id,
                          scheduleId: next,
                          changes: result.changes,
                          skipped: result.skipped,
                        });
                      });
                    }}
                    className={inputClass}
                  >
                    <option value="">No schedule</option>
                    {schedules
                      .filter((row) => row.active || row.id === room.schedule_id)
                      .map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.name}
                        </option>
                      ))}
                  </select>
                </Field>
                <button type="button" className="text-sm" onClick={() => void moveRoom(index, -1)} disabled={index === 0}>
                  Up
                </button>
                <button
                  type="button"
                  className="text-sm"
                  onClick={() => void moveRoom(index, 1)}
                  disabled={index === rooms.length - 1}
                >
                  Down
                </button>
                <button type="button" className="text-sm text-red-700" onClick={() => setPendingRoom(room)}>
                  Delete room
                </button>
              </div>
              <p className="mt-3 text-sm text-gray-600">
                Room cost {money(roomPrice.totalCost)} · Sell {money(roomPrice.sellPrice)}
              </p>
              <p className="text-xs text-gray-500">
                Changing this schedule reprices every cabinet in the room that does not have its own schedule.
                You can cancel and keep the current schedule.
              </p>
              <div className="mt-3 space-y-3">
                {roomCabinets.map((cabinet) => (
                  <CabinetCard
                    key={cabinet.id}
                    cabinet={cabinet}
                    room={room}
                    parts={parts.filter((row) => row.cabinet_id === cabinet.id)}
                    hardware={hardware.filter((row) => row.cabinet_id === cabinet.id)}
                    schedules={schedules}
                    components={components}
                    hardwareLibrary={hardwareLibrary}
                    open={openId === cabinet.id}
                    onToggle={() => setOpenId(openId === cabinet.id ? null : cabinet.id)}
                    onChanged={(message, nextWarnings) => {
                      setError(message);
                      setWarnings(nextWarnings ?? []);
                      void load();
                    }}
                  />
                ))}
              </div>
              {addingRoomId === room.id ? (
                <AddCabinet
                  templates={templates.filter((row) => row.active)}
                  categories={categories}
                  schedules={schedules.filter((row) => row.active || row.id === room.schedule_id)}
                  onCancel={() => setAddingRoomId(null)}
                  onAdd={async (input) => {
                    const result = await addCabinetFromTemplate({ ...input, roomId: room.id });
                    setError(result.error);
                    setWarnings(result.warnings);
                    if (!result.error) {
                      setAddingRoomId(null);
                      await load();
                    }
                  }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingRoomId(room.id)}
                  className="mt-3 text-sm font-medium text-burgundy"
                >
                  Add cabinet
                </button>
              )}
            </section>
          );
        })}
      </div>
      {schedulePrompt ? (
        <PriceChangeDialog
          title="Change the room schedule?"
          intro="These cabinets use this room's schedule. Apply reprices them with the new schedule at current prices. Cancel leaves the schedule as it is."
          changes={schedulePrompt.changes}
          footnote={
            schedulePrompt.skipped
              ? `${schedulePrompt.skipped} ${schedulePrompt.skipped === 1 ? "cabinet keeps its" : "cabinets keep their"} own schedule and ${schedulePrompt.skipped === 1 ? "is" : "are"} not repriced.`
              : null
          }
          confirmLabel="Apply schedule"
          loading={scheduleBusy}
          onCancel={() => setSchedulePrompt(null)}
          onConfirm={() => {
            setScheduleBusy(true);
            void commitRoomSchedule(schedulePrompt.roomId, schedulePrompt.scheduleId).then((saved) => {
              setScheduleBusy(false);
              setSchedulePrompt(null);
              setError(saved.error);
              setWarnings(saved.warnings);
              void load();
            });
          }}
        />
      ) : null}
      {pendingRoom ? (
        <ConfirmModal
          title={`Delete ${pendingRoom.name}?`}
          body="This removes the room and every cabinet in it."
          confirmLabel="Delete"
          onCancel={() => setPendingRoom(null)}
          onConfirm={() => {
            void deleteRoom(pendingRoom.id).then((message) => {
              setPendingRoom(null);
              setError(message);
              void load();
            });
          }}
        />
      ) : null}
    </section>
  );
}

function Totals({ title, priced }: { title: string; priced: ReturnType<typeof priceQuote> }) {
  return (
    <aside className="rounded-lg border border-gray-200 bg-cream p-4">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      <dl className="mt-2 space-y-1 text-sm">
        <Row label="Material" value={priced.materialCost} />
        <Row label="Labor" value={priced.laborCost} />
        <Row label="Doors" value={priced.doorCost} />
        <Row label="Drawer boxes" value={priced.drawerBoxCost} />
        <Row label="Finish" value={priced.finishCost} />
        <Row label="Hardware" value={priced.hardwareCost} />
        <div className="flex justify-between border-t border-gray-300 pt-1 font-semibold">
          <dt>Total cost</dt>
          <dd>{money(priced.totalCost)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Margin</dt>
          <dd>{priced.marginPct}%</dd>
        </div>
        <div className="flex justify-between text-gray-600">
          <dt>Same as markup</dt>
          <dd>{roundMoney(priced.equivalentMarkupPct).toFixed(2)}%</dd>
        </div>
        <div className="flex justify-between text-base font-semibold text-burgundy">
          <dt>Sell price</dt>
          <dd>{priced.error ? "—" : money(priced.sellPrice)}</dd>
        </div>
      </dl>
      {priced.hardwareMarkup > 0 ? (
        <p className="mt-2 text-xs text-gray-600">
          Hardware markup {money(priced.hardwareMarkup)} is added after the margin.
        </p>
      ) : null}
      {priced.error ? <p className="mt-2 text-xs text-red-700">{priced.error}</p> : null}
    </aside>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-gray-700">
      <dt>{label}</dt>
      <dd>{money(value)}</dd>
    </div>
  );
}

function CabinetCard({
  cabinet,
  room,
  parts,
  hardware,
  schedules,
  components,
  hardwareLibrary,
  open,
  onToggle,
  onChanged,
}: {
  cabinet: QuoteCabinet;
  room: QuoteRoom;
  parts: SavedPart[];
  hardware: SavedHardware[];
  schedules: CostingSchedule[];
  components: CostingComponent[];
  hardwareLibrary: CostingHardware[];
  open: boolean;
  onToggle: () => void;
  onChanged: (error: string | null, warnings?: string[]) => void;
}) {
  const [size, setSize] = useState({
    height: String(cabinet.height),
    width: String(cabinet.width),
    depth: String(cabinet.depth),
    doors: String(cabinet.doors),
    drawers: String(cabinet.drawers),
    shelves: String(cabinet.shelves),
    quantity: String(cabinet.quantity),
    labor: String(cabinet.base_labor_minutes),
    label: cabinet.label,
    notes: cabinet.notes,
  });
  const [componentId, setComponentId] = useState(components[0]?.id ?? "");
  const [hardwareId, setHardwareId] = useState(hardwareLibrary.find((row) => row.active)?.id ?? "");
  const [qtyFormula, setQtyFormula] = useState("1");
  const [refresh, setRefresh] = useState<{
    before: number;
    after: number;
    warnings: string[];
    kept: string[];
  } | null>(null);
  const [schedulePrompt, setSchedulePrompt] = useState<{
    scheduleId: string | null;
    change: CabinetPriceChange;
  } | null>(null);
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const roomScheduleName = schedules.find((row) => row.id === room.schedule_id)?.name ?? "none";
  const scheduleName =
    schedules.find((row) => row.id === (cabinet.schedule_override_id ?? room.schedule_id))?.name ??
    "No schedule";

  useEffect(() => {
    setSize({
      height: String(cabinet.height),
      width: String(cabinet.width),
      depth: String(cabinet.depth),
      doors: String(cabinet.doors),
      drawers: String(cabinet.drawers),
      shelves: String(cabinet.shelves),
      quantity: String(cabinet.quantity),
      labor: String(cabinet.base_labor_minutes),
      label: cabinet.label,
      notes: cabinet.notes,
    });
  }, [cabinet.updated_at]);

  async function updatePrice() {
    const height = parseRequiredNumber(size.height, "height");
    const width = parseRequiredNumber(size.width, "width");
    const depth = parseRequiredNumber(size.depth, "depth");
    const doors = whole(size.doors, "Doors", 0);
    const drawers = whole(size.drawers, "Drawers", 0);
    const shelves = whole(size.shelves, "Shelves", 0);
    const quantity = whole(size.quantity, "Quantity", 1);
    const labor = parseRequiredNumber(size.labor, "base labor");
    const problem = [height, width, depth, doors, drawers, shelves, quantity, labor].find(
      (value) => typeof value === "string"
    );
    if (typeof problem === "string") {
      onChanged(problem);
      return;
    }
    if (
      typeof height !== "number" ||
      typeof width !== "number" ||
      typeof depth !== "number" ||
      typeof labor !== "number" ||
      typeof doors !== "number" ||
      typeof drawers !== "number" ||
      typeof shelves !== "number" ||
      typeof quantity !== "number" ||
      height <= 0 ||
      width <= 0 ||
      depth <= 0 ||
      labor < 0
    ) {
      onChanged("Height, width, and depth must be greater than 0.");
      return;
    }
    const result = await updateCabinetSize(cabinet.id, {
      label: size.label,
      notes: size.notes,
      height,
      width,
      depth,
      doors,
      drawers,
      shelves,
      quantity,
      base_labor_minutes: labor,
    });
    onChanged(result.error, result.warnings);
  }

  return (
    <article className="rounded-md border border-gray-200 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-gray-900">{cabinet.label}</p>
          <p className="text-xs text-gray-500">
            {cabinet.height} × {cabinet.width} × {cabinet.depth} · qty {cabinet.quantity} · {scheduleName}
          </p>
          <p className="text-sm text-gray-800">
            {money(cabinet.total_cost)}
            {cabinet.quantity > 1 ? ` · ${money(cabinet.total_cost / cabinet.quantity)} each` : ""}
          </p>
        </div>
        <button type="button" onClick={onToggle} className="text-sm text-burgundy">
          {open ? "Hide parts" : "Parts"}
        </button>
      </div>
      {open ? (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {(
              [
                ["label", "Label"],
                ["height", "Height"],
                ["width", "Width"],
                ["depth", "Depth"],
                ["doors", "Doors"],
                ["drawers", "Drawers"],
                ["shelves", "Shelves"],
                ["quantity", "Quantity"],
                ["labor", "Base labor min"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="text-xs text-gray-600">
                {label}
                <input
                  value={size[key]}
                  onChange={(event) => setSize({ ...size, [key]: event.target.value })}
                  className={`${inputClass} mt-1 py-1 text-sm`}
                />
              </label>
            ))}
          </div>
          <label className="block text-xs text-gray-600">
            Notes
            <input
              value={size.notes}
              onChange={(event) => setSize({ ...size, notes: event.target.value })}
              className={`${inputClass} mt-1 py-1 text-sm`}
            />
          </label>
          <label className="block text-xs text-gray-600">
            Schedule
            <select
              value={cabinet.schedule_override_id ?? ""}
              onChange={(event) => {
                const next = event.target.value || null;
                void previewCabinetSchedule(cabinet.id, next).then((result) => {
                  if (result.error) {
                    onChanged(result.error);
                    return;
                  }
                  if (!result.change) {
                    void commitCabinetSchedule(cabinet.id, next).then((saved) =>
                      onChanged(saved.error, saved.warnings)
                    );
                    return;
                  }
                  setSchedulePrompt({ scheduleId: next, change: result.change });
                });
              }}
              className={`${inputClass} mt-1 py-1 text-sm`}
            >
              <option value="">Room schedule ({roomScheduleName})</option>
              {schedules
                .filter((row) => row.active || row.id === cabinet.schedule_override_id)
                .map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
            </select>
          </label>
          <p className="text-xs text-gray-500">
            Updating the size uses the prices saved on these parts. Labor rate{" "}
            {cabinet.labor_rate_used == null ? "not saved" : `${money(cabinet.labor_rate_used)} / hour`}.
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => void updatePrice()} className="text-sm font-medium text-burgundy">
              Update price
            </button>
            <button
              type="button"
              className="text-sm"
              onClick={() => {
                void previewRefresh(cabinet.id).then((result) => {
                  if (result.error) onChanged(result.error);
                  else
                    setRefresh({
                      before: result.before,
                      after: result.after,
                      warnings: result.warnings,
                      kept: result.kept,
                    });
                });
              }}
            >
              Refresh to current prices
            </button>
            <button type="button" className="text-sm text-red-700" onClick={() => setConfirmDelete(true)}>
              Delete cabinet
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="text-left text-[10px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="py-1 pr-2">Part</th>
                  <th className="py-1 pr-2">Size</th>
                  <th className="py-1 pr-2">Qty</th>
                  <th className="py-1 pr-2">Material</th>
                  <th className="py-1 pr-2">Used</th>
                  <th className="py-1 pr-2">Cost</th>
                  <th className="py-1">Min</th>
                </tr>
              </thead>
              <tbody>
                {parts.map((part) => (
                  <tr key={part.id} className="border-t border-gray-100 align-top">
                    <td className="py-1 pr-2">
                      {part.name}
                      <button
                        type="button"
                        className="mt-1 block text-red-700"
                        onClick={() => {
                          void removePartFromCabinet(cabinet.id, part.id).then((result) =>
                            onChanged(result.error, result.warnings)
                          );
                        }}
                      >
                        Remove
                      </button>
                    </td>
                    <td className="py-1 pr-2 whitespace-nowrap">
                      {part.slot_type === "drawer_box"
                        ? `${dim(part.resolved_length)} × ${dim(part.resolved_width)} × ${dim(part.resolved_height)}`
                        : `${dim(part.resolved_length)} × ${dim(part.resolved_width)}`}
                    </td>
                    <td className="py-1 pr-2">{dim(part.resolved_qty)}</td>
                    <td className="py-1 pr-2">
                      {part.drawer_box_name ?? part.door_style_name ?? part.material_name ?? "—"}
                      {part.material_unit_price != null ? ` · ${money(part.material_unit_price)}` : ""}
                      {part.door_price_per_sqft != null ? ` · ${money(part.door_price_per_sqft)}/sq ft` : ""}
                      {part.drawer_box_price_per_cuft != null ? ` · ${money(part.drawer_box_price_per_cuft)}/cu ft` : ""}
                      {part.slot_type === "material" && !part.material_name ? (
                        <span className="mt-0.5 block text-red-600">No material was on the schedule</span>
                      ) : null}
                    </td>
                    <td className="py-1 pr-2 whitespace-nowrap">
                      {part.quantity_used == null
                        ? "—"
                        : `${dim(part.quantity_used)} ${part.quantity_unit === "sqft" ? "sq ft" : part.quantity_unit === "board_ft" ? "bf" : part.quantity_unit === "linear_ft" ? "lin ft" : part.quantity_unit === "cuft" ? "cu ft" : "ea"}`}
                    </td>
                    <td className="py-1 pr-2">
                      {money(part.material_cost + part.door_cost + part.drawer_box_cost + part.finish_cost)}
                    </td>
                    <td className="py-1">
                      {dim(part.resolved_qty == null ? part.labor_minutes : part.labor_minutes * part.resolved_qty)}
                    </td>
                  </tr>
                ))}
                {hardware.map((item) => (
                  <tr key={item.id} className="border-t border-gray-100">
                    <td className="py-1 pr-2">
                      {item.name}
                      <button
                        type="button"
                        className="mt-1 block text-red-700"
                        onClick={() => {
                          void removeHardwareFromCabinet(cabinet.id, item.id).then((result) =>
                            onChanged(result.error, result.warnings)
                          );
                        }}
                      >
                        Remove
                      </button>
                    </td>
                    <td className="py-1 pr-2">—</td>
                    <td className="py-1 pr-2">{dim(item.resolved_qty)}</td>
                    <td className="py-1 pr-2">Hardware · {money(item.unit_cost)}</td>
                    <td className="py-1 pr-2">{item.resolved_qty == null ? "—" : `${dim(item.resolved_qty)} ea`}</td>
                    <td className="py-1 pr-2">{money(item.line_cost)}</td>
                    <td className="py-1">
                      {dim(item.resolved_qty == null ? item.install_minutes : item.install_minutes * item.resolved_qty)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-gray-600">
              Add part
              <select
                value={componentId}
                onChange={(event) => setComponentId(event.target.value)}
                className={`${inputClass} mt-1 py-1 text-sm`}
              >
                {components.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="text-sm text-burgundy"
              onClick={() => {
                if (!componentId) return;
                void addPartToCabinet(cabinet.id, componentId).then((result) =>
                  onChanged(result.error, result.warnings)
                );
              }}
            >
              Add
            </button>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-gray-600">
              Add hardware
              <select
                value={hardwareId}
                onChange={(event) => setHardwareId(event.target.value)}
                className={`${inputClass} mt-1 py-1 text-sm`}
              >
                {hardwareLibrary
                  .filter((row) => row.active)
                  .map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="text-xs text-gray-600">
              Qty formula
              <input
                value={qtyFormula}
                onChange={(event) => setQtyFormula(event.target.value)}
                className={`${inputClass} mt-1 w-28 py-1 text-sm`}
              />
            </label>
            <button
              type="button"
              className="text-sm text-burgundy"
              onClick={() => {
                if (!hardwareId) return;
                void addHardwareToCabinet(cabinet.id, hardwareId, qtyFormula).then((result) =>
                  onChanged(result.error, result.warnings)
                );
              }}
            >
              Add
            </button>
          </div>
        </div>
      ) : null}
      {schedulePrompt ? (
        <PriceChangeDialog
          title="Change this cabinet's schedule?"
          intro="Apply reprices this cabinet with the new schedule at current prices. Parts and hardware you added or removed stay. Cancel leaves the schedule as it is."
          changes={[schedulePrompt.change]}
          footnote={null}
          confirmLabel="Apply schedule"
          loading={scheduleBusy}
          onCancel={() => setSchedulePrompt(null)}
          onConfirm={() => {
            setScheduleBusy(true);
            void commitCabinetSchedule(cabinet.id, schedulePrompt.scheduleId).then((saved) => {
              setScheduleBusy(false);
              setSchedulePrompt(null);
              onChanged(saved.error, saved.warnings);
            });
          }}
        />
      ) : null}
      {refresh ? (
        <PriceChangeDialog
          title="Refresh to current prices?"
          intro="Parts and hardware you added or removed stay on this cabinet. Each line is priced again from the current schedule and hardware library. Size and quantity stay."
          changes={[
            {
              id: cabinet.id,
              label: cabinet.label,
              before: refresh.before,
              after: refresh.after,
              warnings: refresh.warnings,
              kept: refresh.kept,
            },
          ]}
          footnote={null}
          confirmLabel="Refresh"
          onCancel={() => setRefresh(null)}
          onConfirm={() => {
            void commitRefresh(cabinet.id).then((result) => {
              setRefresh(null);
              onChanged(result.error, result.warnings);
            });
          }}
        />
      ) : null}
      {confirmDelete ? (
        <ConfirmModal
          title={`Delete ${cabinet.label}?`}
          body="This removes the cabinet from the quote. The template stays in the catalogue."
          confirmLabel="Delete"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            void deleteCabinet(cabinet.id).then((message) => {
              setConfirmDelete(false);
              onChanged(message);
            });
          }}
        />
      ) : null}
    </article>
  );
}

function AddCabinet({
  templates,
  categories,
  schedules,
  onCancel,
  onAdd,
}: {
  templates: CostingTemplate[];
  categories: CostingCategory[];
  schedules: CostingSchedule[];
  onCancel: () => void;
  onAdd: (input: {
    templateId: string;
    label: string;
    height: number;
    width: number;
    depth: number;
    doors: number;
    drawers: number;
    shelves: number;
    quantity: number;
    baseLaborMinutes: number;
    scheduleOverrideId: string | null;
    notes: string;
  }) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [form, setForm] = useState({
    label: "",
    height: "34.5",
    width: "24",
    depth: "24",
    doors: "1",
    drawers: "0",
    shelves: "1",
    quantity: "1",
    labor: "0",
    scheduleId: "",
    notes: "",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const visible = templates.filter((row) => {
    const category = categories.find((item) => item.id === row.category_id)?.name;
    return matchesSearch(query, [row.name, category]);
  });

  function choose(template: CostingTemplate) {
    setTemplateId(template.id);
    setForm({
      label: template.name,
      height: String(template.default_height),
      width: String(template.default_width),
      depth: String(template.default_depth),
      doors: String(template.default_doors),
      drawers: String(template.default_drawers),
      shelves: String(template.default_shelves),
      quantity: "1",
      labor: String(template.base_labor_minutes),
      scheduleId: "",
      notes: "",
    });
  }

  async function add() {
    const height = parseRequiredNumber(form.height, "height");
    const width = parseRequiredNumber(form.width, "width");
    const depth = parseRequiredNumber(form.depth, "depth");
    const doors = whole(form.doors, "Doors", 0);
    const drawers = whole(form.drawers, "Drawers", 0);
    const shelves = whole(form.shelves, "Shelves", 0);
    const quantity = whole(form.quantity, "Quantity", 1);
    const labor = parseRequiredNumber(form.labor, "base labor");
    const problem = [height, width, depth, doors, drawers, shelves, quantity, labor].find(
      (value) => typeof value === "string"
    );
    if (!templateId) {
      setFormError("Choose a template");
      return;
    }
    if (!form.label.trim()) {
      setFormError("Enter a label");
      return;
    }
    if (typeof problem === "string") {
      setFormError(problem);
      return;
    }
    if (
      typeof height !== "number" ||
      typeof width !== "number" ||
      typeof depth !== "number" ||
      typeof labor !== "number" ||
      typeof doors !== "number" ||
      typeof drawers !== "number" ||
      typeof shelves !== "number" ||
      typeof quantity !== "number"
    ) {
      return;
    }
    setFormError(null);
    await onAdd({
      templateId,
      label: form.label,
      height,
      width,
      depth,
      doors,
      drawers,
      shelves,
      quantity,
      baseLaborMinutes: labor,
      scheduleOverrideId: form.scheduleId || null,
      notes: form.notes,
    });
  }

  return (
    <div className="mt-3 rounded-md border border-dashed border-gray-300 p-3">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search templates"
        className={`${inputClass} mb-2 max-w-xs py-1`}
      />
      <div className="max-h-40 space-y-2 overflow-y-auto">
        {categories.map((category) => {
          const rows = visible.filter((row) => row.category_id === category.id);
          if (!rows.length) return null;
          return (
            <div key={category.id}>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{category.name}</p>
              {rows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => choose(row)}
                  className={`block w-full rounded px-2 py-1 text-left text-sm ${
                    templateId === row.id ? "bg-cream text-burgundy" : "hover:bg-gray-50"
                  }`}
                >
                  {row.name}
                </button>
              ))}
            </div>
          );
        })}
      </div>
      {templateId ? (
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          {(
            [
              ["label", "Label"],
              ["height", "Height"],
              ["width", "Width"],
              ["depth", "Depth"],
              ["doors", "Doors"],
              ["drawers", "Drawers"],
              ["shelves", "Shelves"],
              ["quantity", "Quantity"],
              ["labor", "Base labor min"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="text-xs text-gray-600">
              {label}
              <input
                value={form[key]}
                onChange={(event) => setForm({ ...form, [key]: event.target.value })}
                className={`${inputClass} mt-1 py-1 text-sm`}
              />
            </label>
          ))}
          <label className="text-xs text-gray-600">
            Schedule override
            <select
              value={form.scheduleId}
              onChange={(event) => setForm({ ...form, scheduleId: event.target.value })}
              className={`${inputClass} mt-1 py-1 text-sm`}
            >
              <option value="">Use the room schedule</option>
              {schedules.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
      {formError ? <p className="mt-2 text-sm text-red-600">{formError}</p> : null}
      <div className="mt-3 flex gap-3">
        <button type="button" onClick={() => void add()} className="text-sm font-medium text-burgundy">
          Add to room
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-gray-600">
          Cancel
        </button>
      </div>
    </div>
  );
}

function totalsOf(cabinet: QuoteCabinet): CostTotals {
  return {
    materialCost: cabinet.material_cost,
    laborCost: cabinet.labor_cost,
    doorCost: cabinet.door_cost,
    drawerBoxCost: cabinet.drawer_box_cost,
    finishCost: cabinet.finish_cost,
    hardwareCost: cabinet.hardware_cost,
    hardwareMarkup: cabinet.hardware_markup,
    totalCost: cabinet.total_cost,
    laborMinutes: 0,
  };
}

function whole(value: string, label: string, min: number): number | string {
  const parsed = parseRequiredNumber(value, label.toLowerCase());
  if (typeof parsed === "string") return parsed;
  if (!Number.isInteger(parsed) || parsed < min) {
    return min === 1 ? `${label} must be a whole number, 1 or more` : `${label} must be a whole number, 0 or more`;
  }
  return parsed;
}

function PriceChangeDialog({
  title,
  intro,
  changes,
  footnote,
  confirmLabel,
  loading,
  onConfirm,
  onCancel,
}: {
  title: string;
  intro: string;
  changes: CabinetPriceChange[];
  footnote: string | null;
  confirmLabel: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <p className="mt-2 text-sm text-gray-600">{intro}</p>
        <ul className="mt-4 space-y-3">
          {changes.map((change) => (
            <li key={change.id} className="rounded-md border border-gray-200 p-3 text-sm">
              <p className="font-medium text-gray-900">{change.label}</p>
              <p className="text-gray-700">
                {money(change.before)} → {money(change.after)}
              </p>
              {change.warnings.length ? (
                <ul className="mt-2 list-disc pl-4 text-xs text-gray-600">
                  {change.warnings.map((line, index) => (
                    <li key={`${change.id}-warning-${index}`}>{line}</li>
                  ))}
                </ul>
              ) : null}
              {change.kept.length ? (
                <div className="mt-2 text-xs text-amber-800">
                  <p>These stay on the cabinet, but they will keep the saved price:</p>
                  <ul className="mt-1 list-disc pl-4">
                    {change.kept.map((line, index) => (
                      <li key={`${change.id}-kept-${index}`}>{line}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
        {footnote ? <p className="mt-3 text-xs text-gray-500">{footnote}</p> : null}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="rounded-md bg-burgundy px-4 py-2 text-sm font-medium text-white hover:bg-burgundy/90 disabled:opacity-50"
          >
            {loading ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function money(value: number) {
  return formatCurrencyPrecise(roundMoney(value));
}

function dim(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return String(Math.round(value * 1000) / 1000);
}
