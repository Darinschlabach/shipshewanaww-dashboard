"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  IconPencil,
  IconTrash,
} from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/client";
import type { Room } from "@/lib/types";
import {
  ROOM_HARDWARE_OPTIONS,
  ROOM_OVERLAY_OPTIONS,
} from "@/lib/types";
import Button from "@/components/Button";
import Modal from "@/components/Modal";
import CreatableSpecSelect from "@/components/CreatableSpecSelect";
import {
  addBaseMoldingOption,
  addCrownMoldingOption,
  addDoorStyleOption,
  addFinishColorOption,
  addFinishTypeOption,
  addWoodSpeciesOption,
  fetchRoomSpecOptions,
  mergeRoomSpecOptions,
  type RoomSpecOptions,
} from "@/lib/room-spec-options";

interface RoomsTabProps {
  jobId: string;
}

type RoomFormState = {
  name: string;
  wood_species: string;
  door_style: string;
  finish_type: string;
  finish_color: string;
  overlay: string;
  hardware: string;
  base_molding: string;
  crown_molding: string;
  notes: string;
};

const EMPTY_ROOM_FORM: RoomFormState = {
  name: "",
  wood_species: "",
  door_style: "",
  finish_type: "",
  finish_color: "",
  overlay: "",
  hardware: "",
  base_molding: "",
  crown_molding: "",
  notes: "",
};

const selectClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm";

function SpecSelect({
  label,
  value,
  options,
  onChange,
  placeholder = "Select…",
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={selectClass}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function RoomsTab({ jobId }: RoomsTabProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRoomForm, setShowRoomForm] = useState(false);
  const [showRoomDetail, setShowRoomDetail] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [savingRoom, setSavingRoom] = useState(false);
  const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null);
  const [roomForm, setRoomForm] = useState<RoomFormState>(EMPTY_ROOM_FORM);
  const [specOptions, setSpecOptions] = useState<RoomSpecOptions>({
    woodSpecies: [],
    doorStyles: [],
    finishTypes: [],
    finishColors: [],
    baseMoldings: [],
    crownMoldings: [],
  });

  const loadSpecOptions = useCallback(async (room?: Room | null) => {
    const options = await fetchRoomSpecOptions();
    setSpecOptions(mergeRoomSpecOptions(options, room));
  }, []);

  const loadRooms = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("rooms")
      .select("*")
      .eq("job_id", jobId)
      .order("created_at", { ascending: true });
    setRooms((data as Room[]) ?? []);
    setLoading(false);
  }, [jobId]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  useEffect(() => {
    void loadSpecOptions();
  }, [loadSpecOptions]);

  const roomCountLabel = useMemo(() => {
    const count = rooms.length;
    return `${count} room${count === 1 ? "" : "s"}`;
  }, [rooms]);

  function openCreateRoomModal() {
    setEditingRoom(null);
    setRoomForm(EMPTY_ROOM_FORM);
    void loadSpecOptions();
    setShowRoomForm(true);
  }

  function openEditRoomModal(room: Room) {
    setEditingRoom(room);
    setRoomForm({
      name: room.name,
      wood_species: room.wood_species ?? "",
      door_style: room.door_style ?? "",
      finish_type: room.finish_type ?? "",
      finish_color: room.finish_color ?? "",
      overlay: room.overlay ?? "",
      hardware: room.hardware ?? "",
      base_molding: room.base_molding ?? "",
      crown_molding: room.crown_molding ?? "",
      notes: room.notes ?? "",
    });
    void loadSpecOptions(room);
    setShowRoomForm(true);
  }

  async function refreshSpecOptions(room?: Room | null) {
    const options = await fetchRoomSpecOptions();
    const merged = mergeRoomSpecOptions(options, room);
    setSpecOptions(merged);
    return merged;
  }

  function openRoomDetail(room: Room) {
    setSelectedRoom(room);
    setShowRoomDetail(true);
  }

  async function handleSaveRoom(e: FormEvent) {
    e.preventDefault();
    if (!roomForm.name.trim()) return;

    setSavingRoom(true);
    const supabase = createClient();

    if (editingRoom) {
      await supabase
        .from("rooms")
        .update({
          name: roomForm.name.trim(),
          wood_species: roomForm.wood_species.trim() || null,
          door_style: roomForm.door_style.trim() || null,
          finish_type: roomForm.finish_type.trim() || null,
          finish_color: roomForm.finish_color.trim() || null,
          overlay: roomForm.overlay.trim() || null,
          hardware: roomForm.hardware.trim() || null,
          base_molding: roomForm.base_molding.trim() || null,
          crown_molding: roomForm.crown_molding.trim() || null,
          notes: roomForm.notes.trim() || null,
        })
        .eq("id", editingRoom.id);
    } else {
      await supabase.from("rooms").insert({
        job_id: jobId,
        name: roomForm.name.trim(),
        wood_species: roomForm.wood_species.trim() || null,
        door_style: roomForm.door_style.trim() || null,
        finish_type: roomForm.finish_type.trim() || null,
        finish_color: roomForm.finish_color.trim() || null,
        overlay: roomForm.overlay.trim() || null,
        hardware: roomForm.hardware.trim() || null,
        base_molding: roomForm.base_molding.trim() || null,
        crown_molding: roomForm.crown_molding.trim() || null,
        notes: roomForm.notes.trim() || null,
      });
    }

    setSavingRoom(false);
    setShowRoomForm(false);
    setEditingRoom(null);
    setRoomForm(EMPTY_ROOM_FORM);
    await loadRooms();
  }

  async function handleDeleteRoom(room: Room) {
    if (!confirm(`Delete room "${room.name}"? This cannot be undone.`)) return;

    setDeletingRoomId(room.id);
    const supabase = createClient();
    await supabase.from("rooms").delete().eq("id", room.id);
    setDeletingRoomId(null);

    if (selectedRoom?.id === room.id) {
      setSelectedRoom(null);
      setShowRoomDetail(false);
    }

    await loadRooms();
  }

  function displaySpecValue(value: string | null, isItalicWhenEmpty = true) {
    if (value && value.trim()) {
      return <span className="font-semibold text-gray-900">{value}</span>;
    }

    return (
      <span
        className={`${isItalicWhenEmpty ? "italic" : ""} font-semibold text-gray-400`}
      >
        TBD
      </span>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-2xl font-semibold text-gray-900">Job Specs ({roomCountLabel})</h2>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading rooms...</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {rooms.map((room) => {
            const hasCompleteSpecs = !!(
              room.wood_species?.trim() &&
              room.door_style?.trim() &&
              room.finish_type?.trim() &&
              room.finish_color?.trim() &&
              room.overlay?.trim() &&
              room.hardware?.trim() &&
              room.base_molding?.trim() &&
              room.crown_molding?.trim()
            );
            const finishValue =
              room.finish_type?.trim() && room.finish_color?.trim()
                ? `${room.finish_type} · ${room.finish_color}`
                : null;

            return (
              <button
                key={room.id}
                type="button"
                className="group flex w-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white text-left shadow-sm transition hover:shadow-md"
                onClick={() => openRoomDetail(room)}
              >
                <div
                  className={`border-l-6 ${
                    hasCompleteSpecs ? "border-burgundy" : "border-gray-300"
                  }`}
                >
                  <div className="p-4">
                    <div className="mb-3 flex items-start justify-between">
                      <div className="text-xl font-semibold text-gray-900">{room.name}</div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-label={`Edit ${room.name}`}
                          className="rounded p-1 text-gray-600 hover:bg-gray-100 hover:text-burgundy"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditRoomModal(room);
                          }}
                        >
                          <IconPencil size={14} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${room.name}`}
                          className="rounded p-1 text-gray-600 hover:bg-gray-100 hover:text-red-600"
                          disabled={deletingRoomId === room.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRoom(room);
                          }}
                        >
                          <IconTrash size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 text-base">
                      <div className="flex items-start justify-between gap-2 border-b border-gray-200 pb-1.5">
                        <span className="text-gray-800">Species</span>
                        {displaySpecValue(room.wood_species)}
                      </div>
                      <div className="flex items-start justify-between gap-2 border-b border-gray-200 pb-1.5">
                        <span className="text-gray-800">Door style</span>
                        {displaySpecValue(room.door_style)}
                      </div>
                      <div className="flex items-start justify-between gap-2 pb-1.5">
                        <span className="text-gray-800">Finish</span>
                        {finishValue ? (
                          <span className="text-right font-semibold text-gray-900">
                            {finishValue}
                          </span>
                        ) : (
                          <span className="italic font-semibold text-gray-400">TBD</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}

          <button
            type="button"
            onClick={openCreateRoomModal}
            className="flex min-h-[132px] items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white text-xl font-medium text-gray-700 transition hover:border-burgundy hover:text-burgundy"
          >
            <span className="inline-flex items-center gap-2">+ Add room</span>
          </button>
        </div>
      )}

      {showRoomForm && (
        <Modal title={editingRoom ? "Edit room" : "Add room"} onClose={() => setShowRoomForm(false)}>
          <form onSubmit={handleSaveRoom} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Room name</label>
              <input
                required
                value={roomForm.name}
                onChange={(e) => setRoomForm((prev) => ({ ...prev, name: e.target.value }))}
                className={selectClass}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <CreatableSpecSelect
                label="Wood species"
                value={roomForm.wood_species}
                options={specOptions.woodSpecies}
                onChange={(wood_species) =>
                  setRoomForm((prev) => ({ ...prev, wood_species }))
                }
                onAddOption={async (name) => {
                  const saved = await addWoodSpeciesOption(name);
                  if (saved) await refreshSpecOptions(editingRoom);
                  return saved;
                }}
              />
              <CreatableSpecSelect
                label="Door style"
                value={roomForm.door_style}
                options={specOptions.doorStyles}
                onChange={(door_style) =>
                  setRoomForm((prev) => ({ ...prev, door_style }))
                }
                onAddOption={async (name) => {
                  const saved = await addDoorStyleOption(name);
                  if (saved) await refreshSpecOptions(editingRoom);
                  return saved;
                }}
              />
              <CreatableSpecSelect
                label="Finish type"
                value={roomForm.finish_type}
                options={specOptions.finishTypes}
                onChange={(finish_type) =>
                  setRoomForm((prev) => ({ ...prev, finish_type }))
                }
                onAddOption={async (name) => {
                  const saved = await addFinishTypeOption(name);
                  if (saved) await refreshSpecOptions(editingRoom);
                  return saved;
                }}
              />
              <CreatableSpecSelect
                label="Finish color"
                value={roomForm.finish_color}
                options={specOptions.finishColors}
                onChange={(finish_color) =>
                  setRoomForm((prev) => ({ ...prev, finish_color }))
                }
                onAddOption={async (name) => {
                  const saved = await addFinishColorOption(name);
                  if (saved) await refreshSpecOptions(editingRoom);
                  return saved;
                }}
              />
              <SpecSelect
                label="Overlay"
                value={roomForm.overlay}
                options={ROOM_OVERLAY_OPTIONS}
                onChange={(overlay) =>
                  setRoomForm((prev) => ({ ...prev, overlay }))
                }
              />
              <SpecSelect
                label="Hardware"
                value={roomForm.hardware}
                options={ROOM_HARDWARE_OPTIONS}
                onChange={(hardware) =>
                  setRoomForm((prev) => ({ ...prev, hardware }))
                }
              />
              <CreatableSpecSelect
                label="Base molding"
                value={roomForm.base_molding}
                options={specOptions.baseMoldings}
                onChange={(base_molding) =>
                  setRoomForm((prev) => ({ ...prev, base_molding }))
                }
                onAddOption={async (name) => {
                  const saved = await addBaseMoldingOption(name);
                  if (saved) await refreshSpecOptions(editingRoom);
                  return saved;
                }}
              />
              <CreatableSpecSelect
                label="Crown molding"
                value={roomForm.crown_molding}
                options={specOptions.crownMoldings}
                onChange={(crown_molding) =>
                  setRoomForm((prev) => ({ ...prev, crown_molding }))
                }
                onAddOption={async (name) => {
                  const saved = await addCrownMoldingOption(name);
                  if (saved) await refreshSpecOptions(editingRoom);
                  return saved;
                }}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Notes</label>
              <textarea
                rows={3}
                value={roomForm.notes}
                onChange={(e) => setRoomForm((prev) => ({ ...prev, notes: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" onClick={() => setShowRoomForm(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={savingRoom}>
                {savingRoom ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {showRoomDetail && selectedRoom && (
        <Modal title={selectedRoom.name} onClose={() => setShowRoomDetail(false)}>
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <dl className="space-y-3 text-sm">
                <div className="flex items-start justify-between gap-4 border-b border-gray-200 pb-2">
                  <dt className="text-gray-500">Wood species</dt>
                  <dd className="font-semibold text-gray-900">
                    {selectedRoom.wood_species?.trim() || "TBD"}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4 border-b border-gray-200 pb-2">
                  <dt className="text-gray-500">Door style</dt>
                  <dd className="font-semibold text-gray-900">
                    {selectedRoom.door_style?.trim() || "TBD"}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4 border-b border-gray-200 pb-2">
                  <dt className="text-gray-500">Finish type</dt>
                  <dd className="font-semibold text-gray-900">
                    {selectedRoom.finish_type?.trim() || "TBD"}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4 border-b border-gray-200 pb-2">
                  <dt className="text-gray-500">Finish color</dt>
                  <dd className="font-semibold text-gray-900">
                    {selectedRoom.finish_color?.trim() || "TBD"}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4 border-b border-gray-200 pb-2">
                  <dt className="text-gray-500">Overlay</dt>
                  <dd className="font-semibold text-gray-900">
                    {selectedRoom.overlay?.trim() || "TBD"}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4 border-b border-gray-200 pb-2">
                  <dt className="text-gray-500">Hardware</dt>
                  <dd className="font-semibold text-gray-900">
                    {selectedRoom.hardware?.trim() || "TBD"}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4 border-b border-gray-200 pb-2">
                  <dt className="text-gray-500">Base molding</dt>
                  <dd className="font-semibold text-gray-900">
                    {selectedRoom.base_molding?.trim() || "TBD"}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-gray-500">Crown molding</dt>
                  <dd className="font-semibold text-gray-900">
                    {selectedRoom.crown_molding?.trim() || "TBD"}
                  </dd>
                </div>
              </dl>
            </div>

            <div>
              <h3 className="mb-1 text-sm font-medium text-gray-900">Notes</h3>
              <p className="rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-700">
                {selectedRoom.notes?.trim() || "No notes yet"}
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                onClick={() => {
                  setShowRoomDetail(false);
                  openEditRoomModal(selectedRoom);
                }}
              >
                Edit room
              </Button>
              <Button type="button" variant="primary" onClick={() => setShowRoomDetail(false)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
